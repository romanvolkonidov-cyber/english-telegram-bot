#!/usr/bin/env bash
# Deploy + verify the bot is back online.
#   ./deploy.sh                 # pull current branch, then deploy
#   SKIP_PULL=1 ./deploy.sh     # deploy what's on disk (no git pull)
set -euo pipefail

SERVER="trader@158.220.94.77"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/home/trader/english-bot"
APP="english-bot"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH=(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SERVER")
cd "$LOCAL_DIR"

# ── Server env written on every deploy ──────────────────────────────────────────
# These are written into the server's .env on every deploy (other keys like
# BOT_TOKEN are left untouched — .env is never rsynced). Edit here once.
CLAUDE_MODEL="claude-haiku-4-5-20251001"      # tutor + word game run on Haiku 4.5
WEBAPP_URL=""                                  # set to "https://bot.wellversed.live" to re-enable the Mini App
WEBAPP_API_DOMAIN="api.wellversed.live"        # public hostname for the API (Caddy serves it)
WEBAPP_API_PORT="8081"                         # local port the in-process API listens on
# Telegram user IDs that play the Mini App for FREE (comma-separated): you + wife.
# Override at run time too: ADMIN_TELEGRAM_IDS=123,456 ./deploy.sh
ADMIN_TELEGRAM_IDS="${ADMIN_TELEGRAM_IDS:-7057284380,1752767024}"

if [ "${SKIP_PULL:-0}" != "1" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "⬇️  Pulling latest on '$BRANCH'..."
  git pull --ff-only origin "$BRANCH"
fi
echo "📌 Deploying: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

if [ "${SKIP_TYPECHECK:-0}" != "1" ]; then
  # Self-healing: if the TypeScript compiler isn't installed locally, fetch dev
  # tools first so the gate works without manual setup (or skip with SKIP_TYPECHECK=1).
  if [ ! -x node_modules/.bin/tsc ]; then
    echo "🔧 Installing dev tools (first run only)..."; npm install
  fi
  echo "🔎 Type-checking..."; npm run typecheck
fi

echo "📤 Syncing files..."
rsync -avz --delete \
  --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='*.log' \
  -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

echo "🔧 Ensuring Mini App env in server .env..."
# Idempotently set just the web-app keys (replace each line if present, else append).
# Local values are injected as env vars; the heredoc runs remotely and edits .env
# in place — every other secret in .env is preserved.
"${SSH[@]}" "CLAUDE_MODEL='$CLAUDE_MODEL' WEBAPP_URL='$WEBAPP_URL' WEBAPP_API_PORT='$WEBAPP_API_PORT' ADMIN_TELEGRAM_IDS='$ADMIN_TELEGRAM_IDS' REMOTE_DIR='$REMOTE_DIR' bash -s" <<'ENVSETUP'
  set -e
  cd "$REMOTE_DIR"
  touch .env
  set_kv() {
    key="$1"; val="$2"
    # Drop any existing definition, then append the current value.
    sed -i "/^${key}=/d" .env
    printf '%s=%s\n' "$key" "$val" >> .env
  }
  set_kv CLAUDE_MODEL "$CLAUDE_MODEL"
  set_kv WEBAPP_URL "$WEBAPP_URL"
  set_kv WEBAPP_ORIGIN "$WEBAPP_URL"
  set_kv WEBAPP_API_PORT "$WEBAPP_API_PORT"
  set_kv ADMIN_TELEGRAM_IDS "$ADMIN_TELEGRAM_IDS"
  echo "   set CLAUDE_MODEL=$CLAUDE_MODEL WEBAPP_URL=$WEBAPP_URL ADMIN_TELEGRAM_IDS=${ADMIN_TELEGRAM_IDS:-(none)}"
ENVSETUP

# NOTE: HTTPS for the API ($WEBAPP_API_DOMAIN) is a ONE-TIME server setup, not part
# of every deploy. This VPS already runs nginx on :443 (it's also a Jitsi host), so
# the API is exposed through an nginx vhost + a Let's Encrypt cert (certbot), NOT
# Caddy. Run once on the server:  sudo bash webapp/install-api-nginx.sh

echo "📦 Installing dependencies (clean)..."
"${SSH[@]}" "cd $REMOTE_DIR && (npm ci --omit=dev || npm install --omit=dev)"

echo "🏗️  Build (if defined)..."
"${SSH[@]}" "cd $REMOTE_DIR && npm run build --if-present"

echo "🔄 Restarting $APP..."
"${SSH[@]}" "cd $REMOTE_DIR && (pm2 restart $APP --update-env || pm2 start npm --name $APP -- start) && pm2 save"

echo "🏥 Health check..."
"${SSH[@]}" bash -s <<HEALTH
  set -e; sleep 5
  status=\$(pm2 jlist | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d);const p=a.find(x=>x.name==='$APP');console.log(p?p.pm2_env.status+' restarts='+p.pm2_env.restart_time:'missing')}catch(e){console.log('unknown')}})")
  echo "   pm2: \$status"
  pm2 logs $APP --lines 15 --nostream || true
  echo "\$status" | grep -q '^online' || { echo "❌ $APP NOT online"; exit 1; }
HEALTH
echo "✅ Done — $APP is online."
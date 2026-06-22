#!/usr/bin/env bash
#
# Deploy the bot to the VPS and verify it actually comes back online.
#
# Steps: pull latest -> typecheck locally (fail fast) -> sync to server
#        (never overwriting the server's .env) -> clean reinstall -> optional
#        build -> pm2 restart -> health check.
#
# Usage:
#   ./deploy.sh                 # pull current branch, then deploy
#   SKIP_PULL=1 ./deploy.sh     # deploy exactly what's on disk (no git pull)
#   SKIP_TYPECHECK=1 ./deploy.sh
#
set -euo pipefail

SERVER="trader@158.220.94.77"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/home/trader/english-bot"
APP="english-bot"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH=(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SERVER")

cd "$LOCAL_DIR"

# 1) Get the latest code locally (so we never deploy stale source).
if [ "${SKIP_PULL:-0}" != "1" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "⬇️  Pulling latest on '$BRANCH'..."
  git pull --ff-only origin "$BRANCH"
fi
echo "📌 Deploying commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# 2) Fail fast: don't ship code that doesn't even type-check.
if [ "${SKIP_TYPECHECK:-0}" != "1" ]; then
  echo "🔎 Type-checking..."
  npm run typecheck
fi

# 3) Sync source to the server. IMPORTANT: never push node_modules, .git, logs,
#    or .env — the server keeps its own .env with the real secrets.
echo "📤 Syncing files..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.log' \
  -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

# 4) Clean, reproducible install of runtime deps (uses package-lock.json). This
#    is the "rebuild": it brings node_modules exactly in line with the lockfile,
#    including tsx (the runtime). Falls back to npm install if there's no lock.
echo "📦 Installing dependencies (clean)..."
"${SSH[@]}" "cd $REMOTE_DIR && (npm ci --omit=dev || npm install --omit=dev)"

# 5) Optional compile step — a no-op today (we run TypeScript via tsx), but if a
#    'build' script is ever added it will run automatically.
echo "🏗️  Build (if defined)..."
"${SSH[@]}" "cd $REMOTE_DIR && npm run build --if-present"

# 6) Restart and persist the process list.
echo "🔄 Restarting $APP..."
"${SSH[@]}" "cd $REMOTE_DIR && (pm2 restart $APP --update-env || pm2 start npm --name $APP -- start) && pm2 save"

# 7) Health check — confirm it's actually ONLINE and not crash-looping.
echo "🏥 Health check..."
"${SSH[@]}" bash -s <<HEALTH
  set -e
  sleep 5
  status=\$(pm2 jlist | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d);const p=a.find(x=>x.name==='$APP');console.log(p?p.pm2_env.status+' restarts='+p.pm2_env.restart_time:'missing')}catch(e){console.log('unknown')}})")
  echo "   pm2: \$status"
  echo "   --- last log lines ---"
  pm2 logs $APP --lines 15 --nostream || true
  echo "\$status" | grep -q '^online' || { echo "❌ $APP is NOT online — check the logs above."; exit 1; }
HEALTH

echo "✅ Done — $APP is online."

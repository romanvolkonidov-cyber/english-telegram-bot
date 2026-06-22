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

if [ "${SKIP_PULL:-0}" != "1" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "⬇️  Pulling latest on '$BRANCH'..."
  git pull --ff-only origin "$BRANCH"
fi
echo "📌 Deploying: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

if [ "${SKIP_TYPECHECK:-0}" != "1" ]; then
  echo "🔎 Type-checking..."; npm run typecheck
fi

echo "📤 Syncing files..."
rsync -avz --delete \
  --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='*.log' \
  -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

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
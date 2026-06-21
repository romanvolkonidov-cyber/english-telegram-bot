#!/usr/bin/env bash
set -euo pipefail

SERVER="trader@158.220.94.77"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/home/trader/english-bot"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📤 Syncing files..."
rsync -avz --exclude='.git' --exclude='node_modules' \
  -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

echo "📦 Installing dependencies..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SERVER" \
  "cd $REMOTE_DIR && npm install --omit=dev"

echo "🔄 Restarting bot..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SERVER" \
  "pm2 restart english-bot && pm2 save"

echo "📋 Checking status..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SERVER" \
  "sleep 2 && pm2 logs english-bot --lines 10 --nostream"

echo "✅ Done."



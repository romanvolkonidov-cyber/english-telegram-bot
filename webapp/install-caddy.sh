#!/usr/bin/env bash
# One-time setup of HTTPS for the word-game Mini App API, RUN ON THE VPS.
#
#   ssh trader@158.220.94.77      # log into the server
#   bash install-caddy.sh         # (this file is rsynced to the server by deploy.sh,
#                                 #  under /home/trader/english-bot/webapp/)
#
# It installs Caddy, points api.wellversed.live at the local API (port 8081), opens
# the firewall, and lets Caddy fetch a free Let's Encrypt certificate automatically.
# Safe to re-run.
set -euo pipefail

DOMAIN="api.wellversed.live"
API_PORT="8081"

echo "▶ Installing Caddy + serving https://$DOMAIN → localhost:$API_PORT"

# 1. Open the firewall for HTTP/HTTPS (needed for the certificate challenge + serving).
if command -v ufw >/dev/null 2>&1; then
  echo "• Opening ports 80 and 443 (ufw)…"
  sudo ufw allow 80/tcp  || true
  sudo ufw allow 443/tcp || true
fi

# 2. Install Caddy from its official apt repository (Debian/Ubuntu) if not present.
if ! command -v caddy >/dev/null 2>&1; then
  echo "• Installing Caddy…"
  sudo apt-get update
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y caddy
else
  echo "• Caddy already installed."
fi

# 3. Write the Caddy config (reverse-proxy the domain to the local API).
echo "• Writing /etc/caddy/Caddyfile…"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
	reverse_proxy localhost:$API_PORT
}
EOF

# 4. Reload Caddy (it will obtain/renew the TLS certificate automatically).
echo "• Reloading Caddy…"
sudo systemctl enable caddy >/dev/null 2>&1 || true
sudo systemctl restart caddy

echo
echo "✅ Done. Give it ~30s for the certificate, then test from your laptop:"
echo "   curl https://$DOMAIN/api/health     # expect: {\"ok\":true}"
echo
echo "If it fails: make sure the 'api' DNS record in Cloudflare is GREY (DNS only),"
echo "and that the bot is running (the API listens on :$API_PORT inside it)."

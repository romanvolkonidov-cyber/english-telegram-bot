#!/usr/bin/env bash
# One-time HTTPS setup for the word-game Mini App API, RUN ON THE VPS with sudo.
#
#   ssh trader@158.220.94.77
#   sudo bash /home/trader/english-bot/webapp/install-api-nginx.sh
#
# This server already runs nginx on :443 (it's also a Jitsi host), so we add an
# nginx vhost for api.wellversed.live that reverse-proxies to the in-process API
# (localhost:8081), then let certbot fetch + auto-renew a Let's Encrypt cert.
# Safe to re-run.
set -euo pipefail

DOMAIN="api.wellversed.live"
API_PORT="8081"
CONF="/etc/nginx/conf.d/api-wellversed.conf"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo:  sudo bash $0"; exit 1
fi

echo "▶ Configuring nginx vhost for https://$DOMAIN → localhost:$API_PORT"

# 1. nginx vhost (HTTP for now; certbot adds the 443 block + redirect).
cat > "$CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 2. Validate + reload nginx.
nginx -t
systemctl reload nginx

# 3. Install certbot (nginx plugin) if missing.
if ! command -v certbot >/dev/null 2>&1; then
  echo "• Installing certbot…"
  apt-get update -y
  apt-get install -y certbot python3-certbot-nginx
fi

# 4. Obtain + install the certificate (adds the 443 block, sets up auto-renew).
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
  --register-unsafely-without-email --redirect

echo
echo "✅ Done. Test from your laptop:"
echo "   curl https://$DOMAIN/api/health     # expect: {\"ok\":true}"

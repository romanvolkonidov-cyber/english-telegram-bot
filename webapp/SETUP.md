# Word-game Mini App — setup & deploy

The word game is a Telegram **Mini App**: a React app (this `webapp/` folder) hosted
on **Vercel**, talking to an **API that runs inside the existing bot process** on the
VPS. The bot still owns Telegram Stars crediting. Nothing about the AI tutor changes.

```
Telegram ──Open button──▶ bot.wellversed.live (Vercel: this app)
                               │ fetch + initData
                               ▼
                          api.wellversed.live (Caddy TLS → VPS :8081, in the bot)
                               │
                          DeepSeek (rounds) + Firebase (wallet/leaderboard)
```

## 1. DNS (registrar for wellversed.live)
- `bot.wellversed.live` → **CNAME** to Vercel (`cname.vercel-dns.com`), set when you add
  the domain in the Vercel project.
- `api.wellversed.live` → **A record** to the VPS public IP (`158.220.94.77`).

## 2. VPS — API + TLS
The API starts automatically with the bot when `WEBAPP_URL` is set. `deploy.sh` writes
these into the server `.env` for you (`WEBAPP_URL`, `WEBAPP_ORIGIN`, `WEBAPP_API_PORT`,
`ADMIN_TELEGRAM_IDS`), so a normal `./deploy.sh` is enough to start the API on
`localhost:8081` inside the bot process.

**HTTPS (one-time):** this VPS already runs **nginx** on :443 (it's also a Jitsi host),
so the API is exposed via an nginx vhost + Let's Encrypt (certbot) — *not* Caddy. Run
once on the server:
```
ssh trader@158.220.94.77
sudo bash /home/trader/english-bot/webapp/install-api-nginx.sh
```
It creates `/etc/nginx/conf.d/api-wellversed.conf` (proxy → `localhost:8081`) and gets
an auto-renewing cert for `api.wellversed.live`. Verify:
`curl https://api.wellversed.live/api/health` → `{"ok":true}`.

## 3. Vercel — frontend
- New Vercel project, **Root Directory = `webapp`** (framework auto-detected: Vite).
- Environment variable: `VITE_API_BASE=https://api.wellversed.live`.
- Add domain `bot.wellversed.live` to the project (Vercel prints the DNS record to set).
- Deploys on every push; build command `vite build`, output `dist` (see `vercel.json`).

## 4. BotFather
- The bot sets the **menu button** to a Web App pointing at `WEBAPP_URL` on startup,
  so the "Open" button appears automatically once `WEBAPP_URL` is set and the bot
  restarts.
- Optional: BotFather → your bot → **Bot Settings → Configure Mini App** → set the same
  `https://bot.wellversed.live` to also enable the profile "Open App" button and
  `t.me/<bot>?startapp` deep links.

## 5. Firestore (one-time, for the leaderboard)
The weekly leaderboard query needs a composite index on the `tutor_game_wallets`
collection (`weekKey ==`, `weeklyCorrect desc`). If it's missing, the leaderboard just
shows empty and the server logs a link to create it — open that link once.

## Local development
```
# Terminal 1 — bot + API (needs .env with BOT_TOKEN, DEEPSEEK, WEBAPP_URL):
npm run dev
# Terminal 2 — frontend against the local API:
cd webapp && VITE_API_BASE=http://localhost:8081 npm run dev
```
Note: a browser opened directly has no Telegram `initData`, so API calls return 401 —
test the full flow by opening the app **inside Telegram** (point the menu button at a
tunnel like `ngrok`/Vercel preview), or hit the API with a signed `initData` (see the
smoke test approach in the chat history).

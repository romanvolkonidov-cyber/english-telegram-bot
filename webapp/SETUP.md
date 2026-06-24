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
The API starts automatically with the bot when `WEBAPP_URL` is set. Add to the server
`.env` (`/home/trader/english-bot/.env`):
```
WEBAPP_URL=https://bot.wellversed.live
WEBAPP_ORIGIN=https://bot.wellversed.live
WEBAPP_API_PORT=8081
# optional: play free while testing (comma-separated Telegram user IDs)
# ADMIN_TELEGRAM_IDS=123456789
```
Install Caddy and use `webapp/Caddyfile` (see its header for commands). Caddy gets a
Let's Encrypt cert for `api.wellversed.live` and proxies to `localhost:8081`.
Then deploy the bot as usual: `./deploy.sh` (it rsyncs + restarts pm2; the API now runs
in the same process — no new service).

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

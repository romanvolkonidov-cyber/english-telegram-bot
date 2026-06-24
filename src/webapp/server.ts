import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { config } from "../config.js";
import { validateInitData, type WebAppUser } from "./auth.js";
import { generateRound, GAME_LEVELS } from "../tutor/wordgame.js";
import { synthesizeSpeech } from "../services/media.js";
import {
  getGameWallet,
  commitGameRound,
  recordGameAnswer,
  getWeeklyLeaderboard,
} from "../tutor/wallet.js";
import {
  GAME_FREE_ROUNDS,
  GAME_REPORT_EVERY_ROUNDS,
  GAME_STARS_PER_ROUND,
  GAME_PACKAGES,
  GAME_CUSTOM_STARS_PER_ROUND,
  GAME_CUSTOM_MIN_STARS,
  GAME_CUSTOM_MAX_STARS,
  roundsForCustomStars,
  gamePackageById,
} from "../tutor/pricing.js";

/**
 * HTTP API for the word-game Telegram Mini App. Runs IN-PROCESS with the bot (see
 * src/index.ts) so it reuses the exact same game logic, wallet, and pricing — no
 * duplication. A reverse proxy (Caddy) terminates TLS in front of it.
 *
 * Every endpoint authenticates the caller from Telegram `initData` (validated with
 * the bot token), so the API always knows the real Telegram user. The "correct"
 * answer for a round is NEVER sent to the client — grading happens here.
 */

/** What the bot must provide so the API can issue Telegram Stars invoices. */
export interface WebappDeps {
  /** Wraps bot.api.createInvoiceLink → returns a payable invoice URL. */
  createInvoiceLink: (
    title: string,
    description: string,
    payload: string,
    prices: { label: string; amount: number }[],
  ) => Promise<string>;
}

/** Server-side memory of the round currently on the player's screen (single process). */
interface PendingRound {
  correctIndex: number;
  options: string[];
  explain: string;
  word: string;
  createdAt: number;
}
const pending = new Map<string, PendingRound>();

/** Drop pending rounds older than this so the map can't grow unbounded. */
const PENDING_TTL_MS = 60 * 60 * 1000;
function sweepPending(): void {
  const cutoff = Date.now() - PENDING_TTL_MS;
  for (const [k, v] of pending) if (v.createdAt < cutoff) pending.delete(k);
}

function isAdmin(telegramId: string): boolean {
  return config.adminTelegramIds.includes(telegramId);
}

/** Telegram UI language → the help language the round generator expects. */
function nativeLanguageFor(user: WebAppUser): string {
  return user.languageCode === "ru" ? "Russian" : "English";
}

/** Express handler augmented with the authenticated user. */
type AuthedHandler = (req: Request, res: Response, user: WebAppUser) => void | Promise<void>;

export function startWebappServer(deps: WebappDeps): void {
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  app.use(
    cors({
      origin: config.webappOrigin || true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Auth gate: pull initData from the Authorization header ("tma <initData>") and
  // attach the validated user, or 401.
  const authed = (handler: AuthedHandler) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const header = req.get("authorization") || "";
      const initData = header.startsWith("tma ") ? header.slice(4) : header;
      const user = validateInitData(initData);
      if (!user) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      await handler(req, res, user);
    } catch (err) {
      next(err);
    }
  };

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Current player state: balance, identity, the levels to choose from.
  app.get(
    "/api/state",
    authed(async (_req, res, user) => {
      const gw = await getGameWallet(user.telegramId).catch(() => null);
      const admin = isAdmin(user.telegramId);
      res.json({
        name: gw?.displayName || user.firstName,
        nativeLanguage: nativeLanguageFor(user),
        isAdmin: admin,
        freeLeft: admin ? null : Math.max(0, GAME_FREE_ROUNDS - (gw?.freeRoundsUsed ?? 0)),
        paidLeft: admin ? null : gw?.paidRoundsLeft ?? 0,
        bestStreak: gw?.bestStreak ?? 0,
        weeklyCorrect: gw?.weeklyCorrect ?? 0,
        levels: GAME_LEVELS,
        starsPerRound: GAME_STARS_PER_ROUND,
      });
    }),
  );

  // Generate + charge one round. The correct answer is withheld from the response.
  app.post(
    "/api/round",
    authed(async (req, res, user) => {
      sweepPending();
      const admin = isAdmin(user.telegramId);
      const body = req.body as { fromLevel?: string; toLevel?: string; usedWords?: unknown };
      const level = GAME_LEVELS.find((l) => l.from === body.fromLevel && l.to === body.toLevel);
      if (!level) {
        res.status(400).json({ error: "bad_level" });
        return;
      }

      // One wallet read: serves as both the play-gate and the source of the
      // persisted recent-words list (the key to NOT repeating words across launches).
      const gw0 = await getGameWallet(user.telegramId).catch(() => null);
      const canPlay = admin || (gw0 ? gw0.freeRoundsUsed < GAME_FREE_ROUNDS || gw0.paidRoundsLeft > 0 : true);
      if (!canPlay) {
        res.status(402).json({ error: "out_of_rounds" });
        return;
      }

      // Avoid both the player's PERSISTED recent words and this session's words.
      const clientUsed = Array.isArray(body.usedWords) ? body.usedWords.map((w) => String(w)) : [];
      const avoid = [...(gw0?.recentWords ?? []), ...clientUsed];
      const round = await generateRound(level.from, level.to, nativeLanguageFor(user), avoid);
      if (!round) {
        res.status(503).json({ error: "generation_failed" });
        return;
      }

      // Charge the round AND record the served word (persisted for cross-session
      // repeat-avoidance). May emit an admin milestone — surfaced via the bot.
      await commitGameRound(
        user.telegramId,
        round.costUsd,
        GAME_FREE_ROUNDS,
        admin,
        GAME_REPORT_EVERY_ROUNDS,
        round.word,
      ).catch(() => null);

      pending.set(user.telegramId, {
        correctIndex: round.correctIndex,
        options: round.options,
        explain: round.explain,
        word: round.word,
        createdAt: Date.now(),
      });

      const gw = await getGameWallet(user.telegramId).catch(() => null);
      res.json({
        word: round.word,
        definition: round.definition,
        options: round.options,
        toLevel: level.to,
        freeLeft: admin ? null : Math.max(0, GAME_FREE_ROUNDS - (gw?.freeRoundsUsed ?? 0)),
        paidLeft: admin ? null : gw?.paidRoundsLeft ?? 0,
      });
    }),
  );

  // Grade the answer to the round currently on screen for this user.
  app.post(
    "/api/answer",
    authed(async (req, res, user) => {
      const p = pending.get(user.telegramId);
      if (!p) {
        res.status(409).json({ error: "no_active_round" });
        return;
      }
      const optIndex = Number((req.body as { optIndex?: unknown }).optIndex);
      if (!Number.isInteger(optIndex) || optIndex < 0 || optIndex >= p.options.length) {
        res.status(400).json({ error: "bad_option" });
        return;
      }
      pending.delete(user.telegramId); // single-shot

      const correct = optIndex === p.correctIndex;
      // Grade purely from in-memory state (no DB needed) and respond IMMEDIATELY so
      // the tap feels instant. Persist stats (streak, weekly leaderboard) in the
      // background — the verdict must not wait on a Firestore write.
      void recordGameAnswer(user.telegramId, correct, user.firstName).catch(() => {});
      res.json({
        correct,
        correctIndex: p.correctIndex,
        correctWord: p.options[p.correctIndex] ?? "",
        explain: p.explain,
      });
    }),
  );

  // Weekly leaderboard (top 10), with a `me` flag for the caller.
  app.get(
    "/api/leaderboard",
    authed(async (_req, res, user) => {
      const rows = await getWeeklyLeaderboard(10).catch(() => []);
      res.json({
        rows: rows.map((r) => ({
          displayName: r.displayName,
          weeklyCorrect: r.weeklyCorrect,
          bestStreak: r.bestStreak,
          me: r.telegramId === user.telegramId,
        })),
      });
    }),
  );

  // Shop: packages + the flat custom rate.
  app.get(
    "/api/shop",
    authed(async (_req, res) => {
      res.json({
        starsPerRound: GAME_STARS_PER_ROUND,
        packages: GAME_PACKAGES.map((p) => ({ id: p.id, stars: p.stars, rounds: p.rounds, title: p.title })),
        custom: {
          starsPerRound: GAME_CUSTOM_STARS_PER_ROUND,
          minStars: GAME_CUSTOM_MIN_STARS,
          maxStars: GAME_CUSTOM_MAX_STARS,
        },
      });
    }),
  );

  // Create a Telegram Stars invoice link. Crediting happens in the bot's
  // successful_payment handler (handleGamePayment) — same payloads as the chat flow.
  app.post(
    "/api/buy",
    authed(async (req, res) => {
      const body = req.body as { packId?: string; customStars?: number };
      try {
        if (body.packId) {
          const pkg = gamePackageById(body.packId);
          if (!pkg) {
            res.status(400).json({ error: "bad_pack" });
            return;
          }
          const link = await deps.createInvoiceLink(
            `Word Game — ${pkg.title}`,
            `${pkg.rounds} word game rounds`,
            `wg_pay:${pkg.id}`,
            [{ label: pkg.title, amount: pkg.stars }],
          );
          res.json({ invoiceLink: link });
          return;
        }
        const stars = Number(body.customStars);
        if (!Number.isInteger(stars) || stars < GAME_CUSTOM_MIN_STARS || stars > GAME_CUSTOM_MAX_STARS) {
          res.status(400).json({ error: "bad_amount" });
          return;
        }
        const rounds = roundsForCustomStars(stars);
        const link = await deps.createInvoiceLink(
          `Word Game — ${rounds} rounds`,
          `${rounds} rounds for ${stars} ⭐`,
          `wg_pay:c:${rounds}`,
          [{ label: `${rounds} rounds`, amount: stars }],
        );
        res.json({ invoiceLink: link });
      } catch (err) {
        console.error("createInvoiceLink failed:", err);
        res.status(502).json({ error: "invoice_failed" });
      }
    }),
  );

  // On-demand pronunciation (one short TTS clip for a word). Charged tiny + only when
  // tapped; the frontend limits it to once per round.
  app.get(
    "/api/tts",
    authed(async (req, res) => {
      // Speaks any text: the English word (pronunciation) OR the native-language
      // feedback (Gemini auto-detects language from the text). `word` kept for
      // back-compat. Used only in opt-in voice mode.
      const text = String((req.query.text ?? req.query.word ?? "") as string).slice(0, 400);
      if (!text.trim()) {
        res.status(400).json({ error: "no_text" });
        return;
      }
      const ogg = await synthesizeSpeech(text).catch(() => null);
      if (!ogg) {
        res.status(503).json({ error: "tts_unavailable" });
        return;
      }
      // Not charged: tiny, absorbed by the round's flat-rate margin.
      res.setHeader("Content-Type", "audio/ogg");
      res.send(Buffer.from(ogg));
    }),
  );

  // Final error guard.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("webapp API error:", err);
    if (!res.headersSent) res.status(500).json({ error: "server_error" });
  });

  app.listen(config.webappApiPort, () => {
    console.log(`🌐 Word-game Mini App API listening on :${config.webappApiPort}`);
  });
}

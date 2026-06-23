import { InlineKeyboard, InputFile } from "grammy";
import type { BotContext } from "../context.js";
import { generateRound, GAME_LEVELS } from "../../tutor/wordgame.js";
import { generateImage, synthesizeSpeech } from "../../services/media.js";
import { startLoadingHints } from "../loadingHints.js";
import { getCachedImageFileId, cacheImageFileId } from "../../tutor/gameImages.js";
import { MEDIA_COST_USD } from "../../tutor/pricing.js";
import {
  GAME_FREE_ROUNDS,
  GAME_STARS_PER_ROUND,
  GAME_REPORT_EVERY_ROUNDS,
  GAME_PACKAGES,
  STAR_NET_USD,
  gamePackageById,
  gameStarsPerRound,
} from "../../tutor/pricing.js";
import {
  getGameWallet,
  peekGameRound,
  commitGameRound,
  creditGameRounds,
  recordGameAnswer,
  getWeeklyLeaderboard,
  type GameMilestone,
} from "../../tutor/wallet.js";
import { notifyAdmins } from "../../services/adminNotify.js";
import { config, hasGemini } from "../../config.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function tg(ctx: BotContext): string {
  return String(ctx.from?.id ?? "");
}

function isAdmin(ctx: BotContext): boolean {
  return ctx.session.role === "teacher";
}

function tr(ctx: BotContext, ru: string, en: string): string {
  return ctx.session.lang === "en" ? en : ru;
}

/** Keep a chat action ("typing" / "record_voice") visible across a long task —
 *  Telegram actions expire after ~5 s, so a single send vanishes while we generate
 *  and the player thinks the bot froze. Re-sends every 4 s; returns a stop fn. */
function keepThinking(
  ctx: BotContext,
  action: Parameters<typeof ctx.replyWithChatAction>[0] = "typing",
): () => void {
  ctx.replyWithChatAction(action).catch(() => {});
  const id = setInterval(() => ctx.replyWithChatAction(action).catch(() => {}), 4000);
  return () => clearInterval(id);
}

// ── entry: /wordgame command or "wg" menu button ──────────────────────────────

export async function wordGameCommand(ctx: BotContext): Promise<void> {
  ctx.session.flow = undefined;
  await showLevelMenu(ctx);
}

export async function showLevelMenu(ctx: BotContext): Promise<void> {
  const kb = new InlineKeyboard();
  for (const lv of GAME_LEVELS) {
    kb.text(`${lv.label}`, `wg:lv:${lv.from}:${lv.to}`).row();
  }
  kb.text(tr(ctx, "🏆 Таблица лидеров", "🏆 Leaderboard"), "wg:lb").row();
  kb.text(tr(ctx, "⬅️ Меню", "⬅️ Menu"), "menu");

  const gw = await getGameWallet(tg(ctx)).catch(() => null);
  const freeLeft = isAdmin(ctx)
    ? "∞"
    : String(Math.max(0, GAME_FREE_ROUNDS - (gw?.freeRoundsUsed ?? 0)));
  const paidLeft = isAdmin(ctx) ? "∞" : String(gw?.paidRoundsLeft ?? 0);
  const balanceLine =
    freeLeft !== "0"
      ? tr(ctx, `🎁 Бесплатных попыток: <b>${freeLeft}</b>`, `🎁 Free rounds left: <b>${freeLeft}</b>`)
      : tr(ctx, `🎮 Раундов на балансе: <b>${paidLeft}</b>`, `🎮 Paid rounds left: <b>${paidLeft}</b>`);

  await ctx.reply(
    tr(
      ctx,
      `🎮 <b>Игра слов</b>\nВыбери уровень: тебе покажут слово с картинкой, а ты найдёшь лучший синоним уровнем выше.\n\n${balanceLine}`,
      `🎮 <b>Word game</b>\nChoose a level: you'll see a word with a picture and pick the best higher-level synonym.\n\n${balanceLine}`,
    ),
    { parse_mode: "HTML", reply_markup: kb },
  );
}

// ── start a level ─────────────────────────────────────────────────────────────

export async function startGameLevel(
  ctx: BotContext,
  fromLevel: string,
  toLevel: string,
): Promise<void> {
  ctx.session.flow = {
    kind: "wordgame",
    fromLevel,
    toLevel,
    score: 0,
    total: 0,
    usedWords: [],
  };
  await runRound(ctx);
}

// ── generate and show one round ───────────────────────────────────────────────

export async function nextGameRound(ctx: BotContext): Promise<void> {
  await runRound(ctx);
}

async function runRound(ctx: BotContext): Promise<void> {
  const flow = ctx.session.flow?.kind === "wordgame" ? ctx.session.flow : null;
  if (!flow) return;

  // Double-tap guard: ignore a second "Next word" while one is still generating.
  if (flow.busy) return;
  flow.busy = true;
  // Keep a "typing" indicator alive through generation+verification+image so the
  // player never sees the bot go silent. Stopped once the question is on screen;
  // the outer finally guarantees cleanup on any early return.
  let stopThinking = () => {};
  // "I'm running to you…" pics if the FIRST round is slow (first turn does the most
  // work). Cancelled the moment the question is ready.
  const firstRound = flow.total === 0;
  let cancelHints = () => {};
  try {
    // Is a round available? (peek only — we charge AFTER a successful round, so a
    // failed generation never costs the student a round, and "Try again" is free.)
    const canPlay = await peekGameRound(tg(ctx), GAME_FREE_ROUNDS, isAdmin(ctx));
    if (!canPlay) {
      await showGameBuyMenu(ctx, "out");
      return;
    }

    stopThinking = keepThinking(ctx, "typing");
    if (firstRound) cancelHints = startLoadingHints(ctx);

    const nativeLang = ctx.session.lang === "en" ? "English" : "Russian";
    const round = await generateRound(flow.fromLevel, flow.toLevel, nativeLang, flow.usedWords);

    if (!round) {
      cancelHints();
      await ctx.reply(
        tr(
          ctx,
          "⏳ Небольшая заминка на стороне ИИ — он сейчас перегружен, обычно это быстро проходит. Попробуй ещё раз (это бесплатно).",
          "⏳ A brief hiccup on the AI's side — it's momentarily overloaded and usually recovers quickly. Try again (this is free).",
        ),
        {
          reply_markup: new InlineKeyboard()
            .text(tr(ctx, "🔄 Ещё раз", "🔄 Try again"), "wg:retry")
            .text(tr(ctx, "⬅️ Уровни", "⬅️ Levels"), "wg:levels"),
        },
      );
      return;
    }

    // Resolve the picture. Reuse a cached one for this word when we have it (free,
    // instant) — otherwise generate a fresh photo and pay the image cost ONCE; we
    // cache its file_id below so the next student to get this word reuses it.
    const cachedFileId = await getCachedImageFileId(round.word);
    let freshImage: { bytes: Uint8Array; mimeType: string } | null = null;
    let imageCostUsd = 0;
    if (!cachedFileId) {
      freshImage = await generateImage(round.imagePrompt, { style: "photo" }).catch(() => null);
      if (freshImage) imageCostUsd = MEDIA_COST_USD.image;
    }

    const letter = (i: number) => String.fromCharCode(65 + i);

    // We send a short pronunciation voice note AFTER the question (below) so the
    // question appears immediately instead of waiting on TTS. Book its cost now
    // (one flat ~$0.01 TTS call) when speech is available — pure audio, no LLM.
    const willSpeak = hasGemini;
    const voiceCostUsd = willSpeak ? MEDIA_COST_USD.tts : 0;

    const roundCostUsd = round.costUsd + imageCostUsd + voiceCostUsd;

    // Round is good — now consume it and book its real cost (Claude + any image we
    // generated + any voice). Fire an admin profit report every N rounds played.
    const milestone = await commitGameRound(
      tg(ctx),
      roundCostUsd,
      GAME_FREE_ROUNDS,
      isAdmin(ctx),
      GAME_REPORT_EVERY_ROUNDS,
    ).catch(() => null);
    if (milestone) await reportMilestone(ctx, milestone);

    // Track used words (cap the list so the persisted session can't grow forever).
    flow.usedWords.push(round.word);
    if (flow.usedWords.length > 60) flow.usedWords = flow.usedWords.slice(-60);
    flow.total += 1;

    // Store current round in flow for the answer handler.
    flow.currentOptions = round.options;
    flow.correctIndex = round.correctIndex;
    flow.currentExplain = round.explain;
    flow.currentWord = round.word;
    flow.roundCostUsd = roundCostUsd;

    // Build options keyboard.
    const kb = new InlineKeyboard();
    round.options.forEach((opt, i) => {
      kb.text(`${letter(i)}. ${opt}`, `wg:ans:${i}`).row();
    });
    kb.text(tr(ctx, "⏹ Завершить", "⏹ End game"), "wg:end");

    const header = tr(
      ctx,
      `🔤 <b>${round.word}</b>   <i>${round.definition}</i>\n\n❓ Какой синоним уровня <b>${flow.toLevel}</b> подходит лучше всего?`,
      `🔤 <b>${round.word}</b>   <i>${round.definition}</i>\n\n❓ Which <b>${flow.toLevel}</b> synonym fits best?`,
    );
    const captionOpts = { caption: header, parse_mode: "HTML" as const, reply_markup: kb };

    cancelHints(); // the question is ready — stop the "I'm running…" pics

    // Photo + question in ONE message so the answer buttons attach to the picture.
    // (No early return — we still send the voice note afterwards.)
    let photoSent = false;
    if (cachedFileId) {
      try {
        await ctx.replyWithPhoto(cachedFileId, captionOpts);
        photoSent = true;
      } catch {
        /* a stale file_id can fail — fall through to text rather than block play */
      }
    } else if (freshImage) {
      const ext = freshImage.mimeType.includes("jpeg") ? "jpg" : "png";
      try {
        const sent = await ctx.replyWithPhoto(
          new InputFile(Buffer.from(freshImage.bytes), `word.${ext}`),
          captionOpts,
        );
        photoSent = true;
        // Remember Telegram's file_id so this word's image is free from now on.
        const fileId = sent.photo?.[sent.photo.length - 1]?.file_id;
        if (fileId) await cacheImageFileId(round.word, fileId);
      } catch {
        /* photo send failed — fall through to a text-only round */
      }
    }
    if (!photoSent) await ctx.reply(header, { parse_mode: "HTML", reply_markup: kb });
    stopThinking(); // question is on screen — drop the "typing" indicator

    // Now synthesize and send the pronunciation voice note — the question is
    // already visible and answerable, so TTS latency no longer blocks the round.
    // Show a "recording audio" indicator so the incoming voice is expected.
    if (willSpeak) {
      const stopRecording = keepThinking(ctx, "record_voice");
      try {
        const voiceScript =
          `${round.word}. Which word means the same as ${round.word}? ` +
          round.options.map((o, i) => `${letter(i)}: ${o}.`).join(" ");
        const voiceOgg = await synthesizeSpeech(voiceScript).catch(() => null);
        if (voiceOgg) {
          await ctx.replyWithVoice(new InputFile(voiceOgg, "wordgame.ogg"));
        }
      } catch {
        /* non-fatal — the round is fully playable without the audio */
      } finally {
        stopRecording();
      }
    }
  } finally {
    cancelHints(); // safety: clears any pending "I'm running…" pics on early return
    stopThinking(); // safety: clears the interval on any early return above
    flow.busy = false;
  }
}

/** Send the admin profit report for a student's N-round milestone. */
async function reportMilestone(ctx: BotContext, m: GameMilestone): Promise<void> {
  const onTrial = m.lifetimeStarsPaid === 0;
  const profitLine = onTrial
    ? `🎁 Free-trial cost so far: −$${m.lifetimeCostUsd.toFixed(4)} (no purchase yet)`
    : `${m.lifetimeProfitUsd >= 0 ? "🟢" : "🔴"} Profit (lifetime): ${m.lifetimeProfitUsd >= 0 ? "+" : ""}$${m.lifetimeProfitUsd.toFixed(2)}`;
  await notifyAdmins(ctx.api, {
    title: `🎮 Game milestone — ${m.totalRounds} rounds played`,
    ctx,
    details:
      `Last ${m.batchRounds} rounds cost: $${m.batchCostUsd.toFixed(4)} (real API, Claude+image)\n` +
      `Lifetime cost: $${m.lifetimeCostUsd.toFixed(4)}\n` +
      `Paid: ${m.lifetimeStarsPaid} ⭐ → net $${m.lifetimeNetUsd.toFixed(2)} (after Telegram + conversion)\n` +
      profitLine,
  }).catch(() => {});
}

// ── answer handler ────────────────────────────────────────────────────────────

export async function wordGameAnswer(ctx: BotContext, optIndex: number): Promise<void> {
  const flow = ctx.session.flow?.kind === "wordgame" ? ctx.session.flow : null;
  if (!flow || flow.correctIndex === undefined) {
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery();

  // Lock the buttons.
  try {
    await ctx.editMessageReplyMarkup();
  } catch { /* ignore */ }

  const correct = optIndex === flow.correctIndex;
  if (correct) flow.score += 1;

  // Persist the outcome (lifetime totals, streak, weekly leaderboard counter).
  const displayName = ctx.session.name ?? ctx.from?.first_name ?? "Player";
  const stats = await recordGameAnswer(tg(ctx), correct, displayName).catch(() => null);

  const chosenWord = flow.currentOptions?.[optIndex] ?? "";
  const correctWord = flow.currentOptions?.[flow.correctIndex] ?? "";

  const verdict = correct
    ? tr(ctx, `✅ Верно! <b>${chosenWord}</b> — это лучший синоним.`, `✅ Correct! <b>${chosenWord}</b> is the best synonym.`)
    : tr(
        ctx,
        `❌ Не совсем. Твой ответ: <b>${chosenWord}</b>\n✅ Лучший синоним: <b>${correctWord}</b>`,
        `❌ Not quite. You chose: <b>${chosenWord}</b>\n✅ Best synonym: <b>${correctWord}</b>`,
      );

  const explainLine = flow.currentExplain
    ? `\n\n<i>${flow.currentExplain}</i>`
    : "";

  // Per-round cost is no longer reported here — admins get a consolidated profit
  // report every GAME_REPORT_EVERY_ROUNDS rounds (see reportMilestone) instead.

  // Clear round state.
  flow.currentOptions = undefined;
  flow.correctIndex = undefined;
  flow.currentExplain = undefined;
  flow.currentWord = undefined;
  flow.roundCostUsd = undefined;

  const scoreInfo = tr(
    ctx,
    `📊 Счёт: <b>${flow.score}/${flow.total}</b>`,
    `📊 Score: <b>${flow.score}/${flow.total}</b>`,
  );
  // A streak line once it's worth celebrating (2+ in a row).
  const streakLine =
    stats && stats.currentStreak >= 2
      ? tr(ctx, `   🔥 Серия: <b>${stats.currentStreak}</b>`, `   🔥 Streak: <b>${stats.currentStreak}</b>`)
      : "";

  const kb = new InlineKeyboard()
    .text(tr(ctx, "▶️ Следующее слово", "▶️ Next word"), "wg:next")
    .row()
    .text(tr(ctx, "🏆 Таблица лидеров", "🏆 Leaderboard"), "wg:lb")
    .text(tr(ctx, "⏹ Завершить", "⏹ End game"), "wg:end");

  await ctx.reply(`${verdict}${explainLine}\n\n${scoreInfo}${streakLine}`, {
    parse_mode: "HTML",
    reply_markup: kb,
  });
}

// ── buy menu ──────────────────────────────────────────────────────────────────

export async function showGameBuyMenu(ctx: BotContext, reason: "out" | "menu"): Promise<void> {
  const freeStarsWorth = GAME_FREE_ROUNDS * GAME_STARS_PER_ROUND;
  const lead =
    reason === "out"
      ? tr(
          ctx,
          `🎮 Бесплатный период закончился — ты использовал <b>${freeStarsWorth} ⭐</b> на пробные раунды. Пополни баланс, чтобы продолжить!`,
          `🎮 Free trial ended — you used <b>${freeStarsWorth} ⭐</b> worth of rounds. Top up to keep playing!`,
        )
      : tr(ctx, "🎮 <b>Игра слов — пополнение</b>", "🎮 <b>Word Game — top up</b>");

  const lines = [lead, ""];
  const kb = new InlineKeyboard();
  for (const p of GAME_PACKAGES) {
    const perRound = gameStarsPerRound(p);
    lines.push(
      tr(
        ctx,
        `• <b>${p.title}</b> — ${p.stars} ⭐  (${perRound} ⭐/раунд)`,
        `• <b>${p.title}</b> — ${p.stars} ⭐  (${perRound} ⭐/round)`,
      ),
    );
    kb.text(tr(ctx, `🎮 ${p.rounds} раундов · ${p.stars} ⭐`, `🎮 ${p.rounds} rounds · ${p.stars} ⭐`), `wg:buy:${p.id}`).row();
  }
  kb.text(tr(ctx, "⬅️ Меню", "⬅️ Menu"), "menu");

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
}

// ── Stars invoice for game rounds ─────────────────────────────────────────────

export async function startGamePurchase(ctx: BotContext, pkgId: string): Promise<void> {
  const pkg = gamePackageById(pkgId);
  const chatId = ctx.chat?.id;
  if (!pkg || !chatId) return;
  try {
    await ctx.api.sendInvoice(
      chatId,
      tr(ctx, `Игра слов — ${pkg.title}`, `Word Game — ${pkg.title}`),
      tr(
        ctx,
        `${pkg.rounds} раундов игры слов`,
        `${pkg.rounds} word game rounds`,
      ),
      `wg_pay:${pkgId}`,
      "XTR",
      [{ label: pkg.title, amount: pkg.stars }],
    );
  } catch (err) {
    console.error("Game invoice failed:", err);
    await ctx.reply(tr(ctx, "Не удалось выставить счёт.", "Could not create invoice."));
  }
}

export async function handleGamePayment(ctx: BotContext): Promise<void> {
  const payload = ctx.message?.successful_payment?.invoice_payload ?? "";
  if (!payload.startsWith("wg_pay:")) return;
  const pkgId = payload.slice("wg_pay:".length);
  const pkg = gamePackageById(pkgId);
  if (!pkg) return;
  await creditGameRounds(tg(ctx), pkg.rounds, pkg.stars).catch(() => {});
  const name = ctx.session.name ?? ctx.from?.first_name ?? "Player";
  await ctx.reply(
    tr(
      ctx,
      `✅ Спасибо! <b>${pkg.rounds} раундов</b> добавлено. Играй!`,
      `✅ Thanks! <b>${pkg.rounds} rounds</b> added. Let's play!`,
    ),
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(tr(ctx, "🎮 Играть", "🎮 Play"), "wg:levels"),
    },
  );
  await notifyAdmins(ctx.api, {
    title: "🎮 Game top-up",
    ctx,
    details: `${name} bought ${pkg.title} (${pkg.stars} ⭐ = ${pkg.rounds} rounds). Net: $${(pkg.stars * STAR_NET_USD).toFixed(2)}`,
  }).catch(() => {});
}

// ── end game ──────────────────────────────────────────────────────────────────

export async function endGame(ctx: BotContext): Promise<void> {
  const flow = ctx.session.flow?.kind === "wordgame" ? ctx.session.flow : null;
  ctx.session.flow = undefined;
  const score = flow?.score ?? 0;
  const total = flow?.total ?? 0;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  // Pull the persistent stats for an all-time line under this session's result.
  const gw = await getGameWallet(tg(ctx)).catch(() => null);
  const statsLine = gw
    ? tr(
        ctx,
        `\n🔥 Лучшая серия: <b>${gw.bestStreak}</b>   🏆 За неделю: <b>${gw.weeklyCorrect}</b>`,
        `\n🔥 Best streak: <b>${gw.bestStreak}</b>   🏆 This week: <b>${gw.weeklyCorrect}</b>`,
      )
    : "";

  await ctx.reply(
    tr(
      ctx,
      `🏁 Игра завершена!\n📊 Результат: <b>${score}/${total}</b> (${pct}%)${statsLine}`,
      `🏁 Game over!\n📊 Result: <b>${score}/${total}</b> (${pct}%)${statsLine}`,
    ),
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text(tr(ctx, "🔄 Сыграть ещё", "🔄 Play again"), "wg:levels")
        .row()
        .text(tr(ctx, "🏆 Таблица лидеров", "🏆 Leaderboard"), "wg:lb")
        .text(tr(ctx, "🏠 Меню", "🏠 Menu"), "menu"),
    },
  );
}

// ── leaderboard ───────────────────────────────────────────────────────────────

export async function showLeaderboard(ctx: BotContext): Promise<void> {
  const rows = await getWeeklyLeaderboard(10).catch(() => []);
  const me = tg(ctx);
  const medals = ["🥇", "🥈", "🥉"];

  const header = tr(ctx, "🏆 <b>Таблица лидеров недели</b>", "🏆 <b>Weekly leaderboard</b>");
  let body: string;
  if (!rows.length) {
    body = tr(
      ctx,
      "Пока никто не набрал очков на этой неделе. Будь первым!",
      "No scores yet this week. Be the first!",
    );
  } else {
    body = rows
      .map((r, i) => {
        const rank = medals[i] ?? `${i + 1}.`;
        const you = r.telegramId === me ? tr(ctx, " ← ты", " ← you") : "";
        const name = escapeHtml(r.displayName);
        return tr(
          ctx,
          `${rank} <b>${name}</b> — ${r.weeklyCorrect} верных (🔥 ${r.bestStreak})${you}`,
          `${rank} <b>${name}</b> — ${r.weeklyCorrect} correct (🔥 ${r.bestStreak})${you}`,
        );
      })
      .join("\n");
  }

  await ctx.reply(`${header}\n\n${body}`, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard()
      .text(tr(ctx, "🎮 Играть", "🎮 Play"), "wg:levels")
      .text(tr(ctx, "🏠 Меню", "🏠 Menu"), "menu"),
  });
}

/** Minimal HTML escaping for a user-supplied display name. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

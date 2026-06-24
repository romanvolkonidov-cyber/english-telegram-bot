import { InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { generateRound, GAME_LEVELS } from "../../tutor/wordgame.js";
import { startLoadingHints } from "../loadingHints.js";
import {
  GAME_FREE_ROUNDS,
  GAME_STARS_PER_ROUND,
  GAME_REPORT_EVERY_ROUNDS,
  GAME_PACKAGES,
  GAME_CUSTOM_STARS_PER_ROUND,
  GAME_CUSTOM_MIN_STARS,
  GAME_CUSTOM_MAX_STARS,
  roundsForCustomStars,
  STAR_NET_USD,
  gamePackageById,
} from "../../tutor/pricing.js";
import {
  getGameWallet,
  commitGameRound,
  creditGameRounds,
  recordGameAnswer,
  getWeeklyLeaderboard,
  type GameMilestone,
} from "../../tutor/wallet.js";
import { notifyAdmins } from "../../services/adminNotify.js";

// ── rich-message helper ───────────────────────────────────────────────────────

/** Send a rich-markdown message (Grammy 1.44+), falling back to HTML then plain. */
async function replyRich(
  ctx: BotContext,
  markdown: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  if (!markdown.trim()) return;
  try {
    await ctx.replyWithRichMessage(
      { markdown },
      keyboard ? { reply_markup: keyboard } : {},
    );
    return;
  } catch { /* fall through */ }
  // HTML fallback — convert the subset of Markdown we use
  const html = markdown
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>")
    .replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");
  try {
    await ctx.reply(html, { parse_mode: "HTML", reply_markup: keyboard });
  } catch {
    await ctx.reply(markdown, { reply_markup: keyboard }).catch(() => {});
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

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
      `🎮 <b>Игра слов</b>\nВыбери уровень: тебе покажут слово, а ты найдёшь лучший синоним уровнем выше.\n\n${balanceLine}`,
      `🎮 <b>Word game</b>\nChoose a level: you'll see a word and pick the best higher-level synonym.\n\n${balanceLine}`,
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
  // If we're already mid-generation on a freshly-started game, ignore a second
  // level tap (mashing the level menu mustn't spin up parallel games).
  if (ctx.session.flow?.kind === "wordgame" && ctx.session.flow.busy) return;
  // Lock the level-menu buttons so re-tapping them does nothing.
  try {
    await ctx.editMessageReplyMarkup();
  } catch { /* ignore */ }
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

  // Double-tap guard: ignore a repeat "Next word" while one is still generating,
  // OR while a question is already on screen waiting to be answered (a nervous
  // re-tap must not generate or charge a second round).
  if (flow.busy || flow.correctIndex !== undefined) return;
  flow.busy = true;
  // Keep a "typing" indicator alive through generation+verification so the player
  // never sees the bot go silent. Stopped once the question is on screen; the outer
  // finally guarantees cleanup on any early return.
  let stopThinking = () => {};
  // "I'm running to you…" pics if the FIRST round is slow (first turn does the most
  // work). Cancelled the moment the question is ready.
  const firstRound = flow.total === 0;
  let cancelHints = () => {};
  try {
    // Read the wallet once: used for both the play-gate check and the cross-session
    // recent-words list (so the model never repeats a word the student already saw,
    // even after a /start that wipes the in-session usedWords list).
    const gw = await getGameWallet(tg(ctx)).catch(() => null);
    const canPlay =
      isAdmin(ctx) ||
      (gw ? gw.freeRoundsUsed < GAME_FREE_ROUNDS || gw.paidRoundsLeft > 0 : true);
    if (!canPlay) {
      await showGameBuyMenu(ctx, "out");
      return;
    }

    stopThinking = keepThinking(ctx, "typing");
    if (firstRound) cancelHints = startLoadingHints(ctx);

    const nativeLang = ctx.session.lang === "en" ? "English" : "Russian";
    // Merge persisted recent words with the current session list so the avoid-list
    // survives /start and bot restarts — same approach as the webapp API server.
    const avoid = [...(gw?.recentWords ?? []), ...flow.usedWords];
    const round = await generateRound(flow.fromLevel, flow.toLevel, nativeLang, avoid);

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

    const letter = (i: number) => String.fromCharCode(65 + i);

    const roundCostUsd = round.costUsd; // text-only round (Claude); no voice, no image

    // Round is good — now consume it and book its real cost (the Claude calls).
    // Fire an admin profit report every N rounds played.
    const milestone = await commitGameRound(
      tg(ctx),
      roundCostUsd,
      GAME_FREE_ROUNDS,
      isAdmin(ctx),
      GAME_REPORT_EVERY_ROUNDS,
      round.word,
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
    flow.currentDistractorExplains = round.distractorExplains;
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
      `### 🔤 ${round.word}\n\n_${round.definition}_\n\n❓ Какой синоним уровня **${flow.toLevel}** подходит лучше всего?`,
      `### 🔤 ${round.word}\n\n_${round.definition}_\n\n❓ Which **${flow.toLevel}** synonym fits best?`,
    );

    cancelHints(); // the question is ready — stop the "I'm running…" pics
    await replyRich(ctx, header, kb);
    stopThinking(); // question is on screen — drop the "typing" indicator
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
      `Last ${m.batchRounds} rounds cost: $${m.batchCostUsd.toFixed(4)} (real API, Claude Haiku)\n` +
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

  // Single-shot: snapshot the round and clear it IMMEDIATELY, so a second tap (a
  // nervous double-press on the options) sees no pending question and bails above —
  // no double-scoring, no double follow-up.
  const correctIndex = flow.correctIndex;
  const options = flow.currentOptions ?? [];
  const currentExplain = flow.currentExplain;
  const distractorExplains = flow.currentDistractorExplains ?? {};
  flow.currentOptions = undefined;
  flow.correctIndex = undefined;
  flow.currentExplain = undefined;
  flow.currentDistractorExplains = undefined;
  flow.currentWord = undefined;
  flow.roundCostUsd = undefined;

  await ctx.answerCallbackQuery();

  // Lock the buttons.
  try {
    await ctx.editMessageReplyMarkup();
  } catch { /* ignore */ }

  const correct = optIndex === correctIndex;
  if (correct) flow.score += 1;

  // Persist the outcome (lifetime totals, streak, weekly leaderboard counter).
  const displayName = ctx.session.name ?? ctx.from?.first_name ?? "Player";
  const stats = await recordGameAnswer(tg(ctx), correct, displayName).catch(() => null);

  const chosenWord = options[optIndex] ?? "";
  const correctWord = options[correctIndex] ?? "";

  const verdict = correct
    ? tr(ctx, `✅ Верно! **${chosenWord}** — это лучший синоним.`, `✅ Correct! **${chosenWord}** is the best synonym.`)
    : tr(
        ctx,
        `❌ Не совсем. Ты выбрал: **${chosenWord}**\n✅ Лучший синоним: **${correctWord}**`,
        `❌ Not quite. You chose: **${chosenWord}**\n✅ Best synonym: **${correctWord}**`,
      );

  // When wrong: blockquote explaining why the chosen word doesn't fit, then why
  // the correct answer does.
  const wrongWord = correct ? "" : (options[optIndex] ?? "");
  const wrongLine =
    !correct && distractorExplains[wrongWord]
      ? `\n\n>${distractorExplains[wrongWord]}`
      : "";
  const explainLine = currentExplain ? `\n\n>${currentExplain}` : "";

  const scoreInfo = tr(
    ctx,
    `📊 Счёт: **${flow.score}/${flow.total}**`,
    `📊 Score: **${flow.score}/${flow.total}**`,
  );
  const streakLine =
    stats && stats.currentStreak >= 2
      ? tr(ctx, `   🔥 Серия: **${stats.currentStreak}**`, `   🔥 Streak: **${stats.currentStreak}**`)
      : "";

  const kb = new InlineKeyboard()
    .text(tr(ctx, "▶️ Следующее слово", "▶️ Next word"), "wg:next")
    .row()
    .text(tr(ctx, "🏆 Таблица лидеров", "🏆 Leaderboard"), "wg:lb")
    .text(tr(ctx, "⏹ Завершить", "⏹ End game"), "wg:end");

  await replyRich(ctx, `${verdict}${wrongLine}${explainLine}\n\n${scoreInfo}${streakLine}`, kb);
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

  // Flat rate across every package and the custom top-up — bigger packs simply
  // bundle more rounds at the same price per round.
  const rate = GAME_STARS_PER_ROUND;
  const lines = [
    lead,
    "",
    tr(ctx, `💎 Цена: <b>${rate} ⭐ за раунд</b> (одинаково для всех пакетов).`, `💎 Price: <b>${rate} ⭐ per round</b> (same for every pack).`),
    "",
  ];
  const kb = new InlineKeyboard();
  for (const p of GAME_PACKAGES) {
    lines.push(
      tr(
        ctx,
        `• <b>${p.title}</b> — ${p.stars} ⭐`,
        `• <b>${p.title}</b> — ${p.stars} ⭐`,
      ),
    );
    kb.text(tr(ctx, `🎮 ${p.rounds} раундов · ${p.stars} ⭐`, `🎮 ${p.rounds} rounds · ${p.stars} ⭐`), `wg:buy:${p.id}`).row();
  }
  lines.push(
    tr(
      ctx,
      `• <b>Своя сумма</b> — ${rate} ⭐/раунд`,
      `• <b>Custom amount</b> — ${rate} ⭐/round`,
    ),
  );
  kb.text(tr(ctx, "✏️ Своя сумма", "✏️ Custom amount"), "wg:custom").row();
  kb.text(tr(ctx, "⬅️ Меню", "⬅️ Menu"), "menu");

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
}

// ── Stars invoice for game rounds ─────────────────────────────────────────────

/** Send a Telegram Stars invoice for `stars` ⭐. Shared by package and custom buys. */
async function sendGameInvoice(
  ctx: BotContext,
  title: string,
  description: string,
  payload: string,
  stars: number,
  label: string,
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  try {
    await ctx.api.sendInvoice(chatId, title, description, payload, "XTR", [
      { label, amount: stars },
    ]);
  } catch (err) {
    console.error("Game invoice failed:", err);
    await ctx.reply(tr(ctx, "Не удалось выставить счёт.", "Could not create invoice."));
  }
}

export async function startGamePurchase(ctx: BotContext, pkgId: string): Promise<void> {
  const pkg = gamePackageById(pkgId);
  if (!pkg) return;
  await sendGameInvoice(
    ctx,
    tr(ctx, `Игра слов — ${pkg.title}`, `Word Game — ${pkg.title}`),
    tr(ctx, `${pkg.rounds} раундов игры слов`, `${pkg.rounds} word game rounds`),
    `wg_pay:${pkgId}`,
    pkg.stars,
    pkg.title,
  );
}

/** Ask the student to type how many Stars they want to spend (custom top-up). */
export async function promptCustomGameAmount(ctx: BotContext): Promise<void> {
  ctx.session.flow = { kind: "wgbuy" };
  await ctx.reply(
    tr(
      ctx,
      `✏️ Сколько ⭐ хочешь потратить?\nНапиши число от <b>${GAME_CUSTOM_MIN_STARS}</b> до <b>${GAME_CUSTOM_MAX_STARS}</b>.\nКурс: <b>${GAME_CUSTOM_STARS_PER_ROUND} ⭐ = 1 раунд</b>.`,
      `✏️ How many ⭐ do you want to spend?\nSend a number between <b>${GAME_CUSTOM_MIN_STARS}</b> and <b>${GAME_CUSTOM_MAX_STARS}</b>.\nRate: <b>${GAME_CUSTOM_STARS_PER_ROUND} ⭐ = 1 round</b>.`,
    ),
    { parse_mode: "HTML" },
  );
}

/** Handle the number the student typed for a custom top-up, then invoice it. */
export async function gameCustomOnText(ctx: BotContext, text: string): Promise<void> {
  const raw = text.trim();
  const stars = /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isInteger(stars) || stars < GAME_CUSTOM_MIN_STARS || stars > GAME_CUSTOM_MAX_STARS) {
    // Keep the flow so the next message is treated as another attempt.
    await ctx.reply(
      tr(
        ctx,
        `⚠️ Введи целое число ⭐ от ${GAME_CUSTOM_MIN_STARS} до ${GAME_CUSTOM_MAX_STARS}.`,
        `⚠️ Enter a whole number of ⭐ between ${GAME_CUSTOM_MIN_STARS} and ${GAME_CUSTOM_MAX_STARS}.`,
      ),
    );
    return;
  }
  const rounds = roundsForCustomStars(stars);
  ctx.session.flow = undefined;
  await sendGameInvoice(
    ctx,
    tr(ctx, `Игра слов — ${rounds} раундов`, `Word Game — ${rounds} rounds`),
    tr(ctx, `${rounds} раундов за ${stars} ⭐`, `${rounds} rounds for ${stars} ⭐`),
    `wg_pay:c:${rounds}`,
    stars,
    tr(ctx, `${rounds} раундов`, `${rounds} rounds`),
  );
}

export async function handleGamePayment(ctx: BotContext): Promise<void> {
  const sp = ctx.message?.successful_payment;
  const payload = sp?.invoice_payload ?? "";
  if (!payload.startsWith("wg_pay:")) return;

  let rounds: number;
  let stars: number;
  let reportLabel: string;

  if (payload.startsWith("wg_pay:c:")) {
    // Custom top-up: rounds encoded in the payload, Stars come from the payment.
    rounds = Number.parseInt(payload.slice("wg_pay:c:".length), 10);
    stars = sp?.total_amount ?? rounds * GAME_CUSTOM_STARS_PER_ROUND;
    reportLabel = `custom ${rounds} rounds`;
  } else {
    const pkg = gamePackageById(payload.slice("wg_pay:".length));
    if (!pkg) return;
    rounds = pkg.rounds;
    stars = pkg.stars;
    reportLabel = pkg.title;
  }
  if (!Number.isInteger(rounds) || rounds <= 0) return;

  await creditGameRounds(tg(ctx), rounds, stars).catch(() => {});
  const name = ctx.session.name ?? ctx.from?.first_name ?? "Player";
  await ctx.reply(
    tr(
      ctx,
      `✅ Спасибо! <b>${rounds} раундов</b> добавлено. Играй!`,
      `✅ Thanks! <b>${rounds} rounds</b> added. Let's play!`,
    ),
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(tr(ctx, "🎮 Играть", "🎮 Play"), "wg:levels"),
    },
  );
  await notifyAdmins(ctx.api, {
    title: "🎮 Game top-up",
    ctx,
    details: `${name} bought ${reportLabel} (${stars} ⭐ = ${rounds} rounds). Net: $${(stars * STAR_NET_USD).toFixed(2)}`,
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

import { InlineKeyboard, InputFile } from "grammy";
import type { BotContext } from "../context.js";
import { generateRound, GAME_LEVELS } from "../../tutor/wordgame.js";
import {
  GAME_FREE_ROUNDS,
  GAME_STARS_PER_ROUND,
  GAME_PACKAGES,
  GAME_ROUND_COST_USD,
  GAME_CUSTOM_STARS_PER_ROUND,
  GAME_CUSTOM_MIN_STARS,
  GAME_CUSTOM_MAX_STARS,
  roundsForCustomStars,
  STAR_NET_USD,
  gamePackageById,
} from "../../tutor/pricing.js";
import {
  getGameWallet,
  consumeGameRound,
  creditGameRounds,
} from "../../tutor/wallet.js";
import { notifyAdmins } from "../../services/adminNotify.js";
import { config } from "../../config.js";

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

async function runRound(ctx: BotContext): Promise<void> {
  const flow = ctx.session.flow?.kind === "wordgame" ? ctx.session.flow : null;
  if (!flow) return;

  // Check balance before spending an API call.
  const canPlay = await consumeGameRound(tg(ctx), GAME_FREE_ROUNDS, isAdmin(ctx));
  if (!canPlay) {
    await showGameBuyMenu(ctx, "out");
    return;
  }

  await ctx.replyWithChatAction("typing");

  const nativeLang = ctx.session.lang === "en" ? "English" : "Russian";
  const round = await generateRound(flow.fromLevel, flow.toLevel, nativeLang, flow.usedWords);

  if (!round) {
    await ctx.reply(
      tr(
        ctx,
        "⏳ Не удалось сгенерировать раунд — попробуй ещё раз.",
        "⏳ Couldn't generate a round — please try again.",
      ),
      {
        reply_markup: new InlineKeyboard()
          .text(tr(ctx, "🔄 Ещё раз", "🔄 Try again"), "wg:retry")
          .text(tr(ctx, "⬅️ Уровни", "⬅️ Levels"), "wg:levels"),
      },
    );
    return;
  }

  // Track used words to avoid repetition.
  flow.usedWords.push(round.word);
  flow.total += 1;

  // Store current round in flow for the answer handler.
  flow.currentOptions = round.options;
  flow.correctIndex = round.correctIndex;
  flow.currentExplain = round.explain;
  flow.currentWord = round.word;
  flow.roundCostUsd = round.costUsd;

  // Send image if available.
  if (round.image) {
    const ext = round.image.mimeType.includes("jpeg") ? "jpg" : "png";
    try {
      await ctx.replyWithPhoto(new InputFile(Buffer.from(round.image.bytes), `word.${ext}`));
    } catch {
      /* non-fatal — continue without image */
    }
  }

  // Build options keyboard.
  const kb = new InlineKeyboard();
  round.options.forEach((opt, i) => {
    kb.text(`${String.fromCharCode(65 + i)}. ${opt}`, `wg:ans:${i}`).row();
  });
  kb.text(tr(ctx, "⏹ Завершить", "⏹ End game"), "wg:end");

  const header = tr(
    ctx,
    `🔤 <b>${round.word}</b>   <i>${round.definition}</i>\n\n❓ Какой синоним уровня <b>${flow.toLevel}</b> подходит лучше всего?`,
    `🔤 <b>${round.word}</b>   <i>${round.definition}</i>\n\n❓ Which <b>${flow.toLevel}</b> synonym fits best?`,
  );
  await ctx.reply(header, { parse_mode: "HTML", reply_markup: kb });
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

  // Admin cost reporting.
  if (isAdmin(ctx)) {
    const costUsd = flow.roundCostUsd ?? GAME_ROUND_COST_USD;
    const netUsd = GAME_STARS_PER_ROUND * STAR_NET_USD;
    const profit = netUsd - costUsd;
    await ctx.reply(
      `💸 Round cost $${costUsd.toFixed(4)} | net $${netUsd.toFixed(4)} | P&L ${profit >= 0 ? "+" : ""}$${profit.toFixed(4)}`,
    ).catch(() => {});
  }

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

  const kb = new InlineKeyboard()
    .text(tr(ctx, "▶️ Следующее слово", "▶️ Next word"), "wg:next")
    .row()
    .text(tr(ctx, "⏹ Завершить", "⏹ End game"), "wg:end");

  await ctx.reply(`${verdict}${explainLine}\n\n${scoreInfo}`, {
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
    const perRound = Math.round(p.stars / p.rounds);
    lines.push(
      tr(
        ctx,
        `• <b>${p.title}</b> — ${p.stars} ⭐  (${perRound} ⭐/раунд)`,
        `• <b>${p.title}</b> — ${p.stars} ⭐  (${perRound} ⭐/round)`,
      ),
    );
    kb.text(`🎮 ${p.rounds} раундов · ${p.stars} ⭐`, `wg:buy:${p.id}`).row();
  }
  lines.push(
    tr(
      ctx,
      `• <b>Своя сумма</b> — ${GAME_CUSTOM_STARS_PER_ROUND} ⭐/раунд`,
      `• <b>Custom amount</b> — ${GAME_CUSTOM_STARS_PER_ROUND} ⭐/round`,
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
  await ctx.reply(
    tr(
      ctx,
      `🏁 Игра завершена!\n📊 Результат: <b>${score}/${total}</b> (${pct}%)`,
      `🏁 Game over!\n📊 Result: <b>${score}/${total}</b> (${pct}%)`,
    ),
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text(tr(ctx, "🔄 Сыграть ещё", "🔄 Play again"), "wg:levels")
        .row()
        .text(tr(ctx, "🏠 Меню", "🏠 Menu"), "menu"),
    },
  );
}

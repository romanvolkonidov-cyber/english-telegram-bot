import type { BotContext } from "../context.js";
import { listStudentConnections } from "../../data/connections.js";
import { fetchStudentById } from "../../data/students.js";
import { creditAllowance, creditGameRounds } from "../../tutor/wallet.js";
import { LESSON_BUDGET_USD, approxLessons } from "../../tutor/pricing.js";
import { notifyAdmins } from "../../services/adminNotify.js";

/**
 * Admin tool: give a chosen student bonus AI-tutor lessons or word-game rounds.
 *
 * Wallets are keyed by Telegram id, while the teacher picks a student by their
 * homework `studentId` — so we bridge the two via the Telegram connection record.
 * A bonus is credited free of charge (game rounds are added with 0 stars paid, so
 * they never distort the leaderboard or profit accounting).
 */

function isAdmin(ctx: BotContext): boolean {
  return ctx.session.role === "teacher";
}

function tr(ctx: BotContext, ru: string, en: string): string {
  return ctx.session.lang === "en" ? en : ru;
}

/** Resolve a homework studentId to their Telegram connection (wallet key + chat). */
async function connectionForStudent(
  studentId: string,
): Promise<{ telegramUserId: number; chatId: number } | null> {
  const conns = await listStudentConnections().catch(() => []);
  const c = conns.find((x) => x.studentId === studentId);
  return c ? { telegramUserId: c.telegramUserId, chatId: c.chatId } : null;
}

/** Step 1: admin tapped a bonus button — start the flow and ask for a quantity. */
export async function startBonusGrant(
  ctx: BotContext,
  target: "lessons" | "rounds",
  studentId: string,
): Promise<void> {
  if (!isAdmin(ctx)) return;

  const conn = await connectionForStudent(studentId);
  if (!conn) {
    await ctx.reply(
      tr(
        ctx,
        "⚠️ Этот ученик ещё не подключил бота, поэтому начислить бонус некуда.",
        "⚠️ This student hasn't connected the bot yet, so there's no wallet to credit.",
      ),
    );
    return;
  }

  const student = await fetchStudentById(studentId).catch(() => null);
  const studentName = student?.name ?? "Student";

  ctx.session.flow = {
    kind: "grant",
    target,
    studentId,
    studentName,
    telegramUserId: conn.telegramUserId,
    chatId: conn.chatId,
  };

  const what =
    target === "lessons" ? tr(ctx, "уроков", "lessons") : tr(ctx, "раундов игры", "game rounds");
  await ctx.reply(
    tr(
      ctx,
      `🎁 Сколько <b>${what}</b> добавить ученику <b>${studentName}</b>?\nОтправь число (например, 5). /menu — отмена.`,
      `🎁 How many <b>${what}</b> to add for <b>${studentName}</b>?\nSend a number (e.g. 5). /menu to cancel.`,
    ),
    { parse_mode: "HTML" },
  );
}

/** Step 2: admin sent the quantity — credit the bonus and confirm. */
export async function bonusOnText(ctx: BotContext, text: string): Promise<void> {
  const flow = ctx.session.flow?.kind === "grant" ? ctx.session.flow : null;
  if (!flow) return;
  if (!isAdmin(ctx)) {
    ctx.session.flow = undefined;
    return;
  }

  const qty = Math.floor(Number(text.trim()));
  if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) {
    await ctx.reply(
      tr(
        ctx,
        "Введи целое число от 1 до 1000, или /menu для отмены.",
        "Enter a whole number from 1 to 1000, or /menu to cancel.",
      ),
    );
    return;
  }

  const wallKey = String(flow.telegramUserId);
  ctx.session.flow = undefined;

  try {
    if (flow.target === "lessons") {
      const wallet = await creditAllowance(wallKey, qty * LESSON_BUDGET_USD);
      const total = approxLessons(wallet.balanceUsd);
      await ctx.reply(
        tr(
          ctx,
          `✅ Начислено <b>${qty}</b> уроков ученику <b>${flow.studentName}</b>. Теперь у него ≈ <b>${total}</b> уроков.`,
          `✅ Added <b>${qty}</b> lessons for <b>${flow.studentName}</b>. They now have ≈ <b>${total}</b> lessons.`,
        ),
        { parse_mode: "HTML" },
      );
      await ctx.api
        .sendMessage(
          flow.chatId,
          tr(
            ctx,
            `🎁 Тебе начислено <b>${qty}</b> бонусных уроков! Открой /learn и продолжай 💪`,
            `🎁 You've been given <b>${qty}</b> bonus lessons! Open /learn and keep going 💪`,
          ),
          { parse_mode: "HTML" },
        )
        .catch(() => {});
    } else {
      // stars = 0: a free bonus, so it doesn't count as revenue or skew the leaderboard.
      const gw = await creditGameRounds(wallKey, qty, 0);
      await ctx.reply(
        tr(
          ctx,
          `✅ Начислено <b>${qty}</b> раундов игры ученику <b>${flow.studentName}</b>. Баланс раундов: <b>${gw.paidRoundsLeft}</b>.`,
          `✅ Added <b>${qty}</b> game rounds for <b>${flow.studentName}</b>. Round balance: <b>${gw.paidRoundsLeft}</b>.`,
        ),
        { parse_mode: "HTML" },
      );
      await ctx.api
        .sendMessage(
          flow.chatId,
          tr(
            ctx,
            `🎁 Тебе начислено <b>${qty}</b> бонусных раундов в Игре слов! Жми /wordgame 🎮`,
            `🎁 You've been given <b>${qty}</b> bonus Word-game rounds! Tap /wordgame 🎮`,
          ),
          { parse_mode: "HTML" },
        )
        .catch(() => {});
    }
  } catch (err) {
    await ctx.reply(
      tr(ctx, "⚠️ Не удалось начислить бонус.", "⚠️ Couldn't credit the bonus."),
    );
    await notifyAdmins(ctx.api, {
      title: "Bonus grant failed",
      ctx,
      details: `student=${flow.studentName} target=${flow.target}`,
      err,
    }).catch(() => {});
  }
}

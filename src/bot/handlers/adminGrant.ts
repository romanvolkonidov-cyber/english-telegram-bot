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
 * A student may have linked from more than one Telegram account (e.g. a relink), so
 * we credit EVERY connection for that studentId — otherwise the bonus could land on
 * an old account while the student studies on a newer one (the "I added lessons but
 * the student still can't study" case). The grant is free of charge (game rounds are
 * added with 0 stars paid, so they never distort the leaderboard or profit reports).
 */

function isAdmin(ctx: BotContext): boolean {
  return ctx.session.role === "teacher";
}

function tr(ctx: BotContext, ru: string, en: string): string {
  return ctx.session.lang === "en" ? en : ru;
}

/** All Telegram connections (wallet key + chat) for a homework studentId. */
async function connectionsForStudent(
  studentId: string,
): Promise<{ telegramUserId: number; chatId: number }[]> {
  const conns = await listStudentConnections().catch(() => []);
  return conns
    .filter((x) => x.studentId === studentId)
    .map((x) => ({ telegramUserId: x.telegramUserId, chatId: x.chatId }));
}

/** Step 1: admin tapped a bonus button — start the flow and ask for a quantity. */
export async function startBonusGrant(
  ctx: BotContext,
  target: "lessons" | "rounds",
  studentId: string,
): Promise<void> {
  if (!isAdmin(ctx)) return;

  const conns = await connectionsForStudent(studentId);
  if (conns.length === 0) {
    await ctx.reply(
      tr(
        ctx,
        "⚠️ Этот ученик ещё не подключил бота в Telegram, поэтому начислять бонус некуда. " +
          "Попроси его открыть бота и войти, затем повтори.",
        "⚠️ This student hasn't connected the bot in Telegram yet, so there's no wallet to credit. " +
          "Ask them to open the bot and log in, then try again.",
      ),
    );
    return;
  }

  const student = await fetchStudentById(studentId).catch(() => null);
  const studentName = student?.name ?? "Student";

  ctx.session.flow = { kind: "grant", target, studentId, studentName };

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

/** Step 2: admin sent the quantity — credit every linked wallet and confirm. */
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

  ctx.session.flow = undefined;

  // Re-resolve connections now (fresh), and credit every linked Telegram account.
  const conns = await connectionsForStudent(flow.studentId);
  if (conns.length === 0) {
    await ctx.reply(
      tr(
        ctx,
        "⚠️ У этого ученика больше нет подключённого Telegram-аккаунта — начислять некуда.",
        "⚠️ This student has no linked Telegram account anymore — nowhere to credit.",
      ),
    );
    return;
  }

  // The student-facing message and the admin verification line.
  const studentMsg =
    flow.target === "lessons"
      ? tr(
          ctx,
          `🎁 Тебе начислено <b>${qty}</b> бонусных уроков! Открой /learn и продолжай 💪`,
          `🎁 You've been given <b>${qty}</b> bonus lessons! Open /learn and keep going 💪`,
        )
      : tr(
          ctx,
          `🎁 Тебе начислено <b>${qty}</b> бонусных раундов в Игре слов! Жми /wordgame 🎮`,
          `🎁 You've been given <b>${qty}</b> bonus Word-game rounds! Tap /wordgame 🎮`,
        );

  const report: string[] = [];
  try {
    for (const conn of conns) {
      const wallKey = String(conn.telegramUserId);
      if (flow.target === "lessons") {
        const wallet = await creditAllowance(wallKey, qty * LESSON_BUDGET_USD);
        report.push(`tg ${wallKey}: ≈ ${approxLessons(wallet.balanceUsd)} lessons ($${wallet.balanceUsd.toFixed(2)})`);
      } else {
        const gw = await creditGameRounds(wallKey, qty, 0);
        report.push(`tg ${wallKey}: ${gw.paidRoundsLeft} rounds left`);
      }
      // Notify the student on that chat (best-effort).
      await ctx.api.sendMessage(conn.chatId, studentMsg, { parse_mode: "HTML" }).catch(() => {});
    }

    const what = flow.target === "lessons" ? tr(ctx, "уроков", "lessons") : tr(ctx, "раундов", "rounds");
    const accounts = conns.length > 1 ? tr(ctx, ` (аккаунтов: ${conns.length})`, ` (${conns.length} accounts)`) : "";
    await ctx.reply(
      tr(
        ctx,
        `✅ Начислено <b>${qty}</b> ${what} ученику <b>${flow.studentName}</b>${accounts}.\n<code>${report.join("\n")}</code>`,
        `✅ Added <b>${qty}</b> ${what} for <b>${flow.studentName}</b>${accounts}.\n<code>${report.join("\n")}</code>`,
      ),
      { parse_mode: "HTML" },
    );
  } catch (err) {
    await ctx.reply(tr(ctx, "⚠️ Не удалось начислить бонус.", "⚠️ Couldn't credit the bonus."));
    await notifyAdmins(ctx.api, {
      title: "Bonus grant failed",
      ctx,
      details: `student=${flow.studentName} target=${flow.target} qty=${qty}`,
      err,
    }).catch(() => {});
  }
}

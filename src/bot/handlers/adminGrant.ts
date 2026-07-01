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

/**
 * The Telegram account a student actually uses: among all logins linked to their
 * studentId, the one that logged in most recently. (One student can have more than
 * one linked account — e.g. shared credentials or a relink — and crediting them ALL
 * would hand out the bonus several times. Crediting the active one lands it where
 * the student studies, exactly once.) Returns null if the student never logged in.
 */
async function activeConnectionForStudent(
  studentId: string,
): Promise<{ telegramUserId: number; chatId: number; linkedCount: number } | null> {
  const conns = (await listStudentConnections().catch(() => [])).filter(
    (x) => x.studentId === studentId,
  );
  if (conns.length === 0) return null;
  conns.sort((a, b) => b.lastActiveMs - a.lastActiveMs); // most recent first
  const best = conns[0]!;
  return { telegramUserId: best.telegramUserId, chatId: best.chatId, linkedCount: conns.length };
}

/** Step 1: admin tapped a bonus button — start the flow and ask for a quantity. */
export async function startBonusGrant(
  ctx: BotContext,
  target: "lessons" | "rounds",
  studentId: string,
): Promise<void> {
  if (!isAdmin(ctx)) return;

  const active = await activeConnectionForStudent(studentId);
  if (!active) {
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

  // Re-resolve fresh and credit ONLY the account the student actually uses (their
  // most recently active login). Crediting all linked logins would multiply the bonus.
  const active = await activeConnectionForStudent(flow.studentId);
  if (!active) {
    await ctx.reply(
      tr(
        ctx,
        "⚠️ У этого ученика больше нет подключённого Telegram-аккаунта — начислять некуда.",
        "⚠️ This student has no linked Telegram account anymore — nowhere to credit.",
      ),
    );
    return;
  }

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

  const wallKey = String(active.telegramUserId);
  // If the student has more than one linked login, tell the admin which one got it.
  const multi =
    active.linkedCount > 1
      ? tr(
          ctx,
          ` (из ${active.linkedCount} привязанных аккаунтов — начислено активному)`,
          ` (of ${active.linkedCount} linked accounts — credited the active one)`,
        )
      : "";
  try {
    let detail: string;
    if (flow.target === "lessons") {
      const wallet = await creditAllowance(wallKey, qty * LESSON_BUDGET_USD);
      detail = `tg ${wallKey}: ≈ ${approxLessons(wallet.balanceUsd)} lessons ($${wallet.balanceUsd.toFixed(2)})`;
    } else {
      const gw = await creditGameRounds(wallKey, qty, 0);
      detail = `tg ${wallKey}: ${gw.paidRoundsLeft} rounds left`;
    }
    // Notify the student on that chat (best-effort).
    await ctx.api.sendMessage(active.chatId, studentMsg, { parse_mode: "HTML" }).catch(() => {});

    const what = flow.target === "lessons" ? tr(ctx, "уроков", "lessons") : tr(ctx, "раундов", "rounds");
    await ctx.reply(
      tr(
        ctx,
        `✅ Начислено <b>${qty}</b> ${what} ученику <b>${flow.studentName}</b>${multi}.\n<code>${detail}</code>`,
        `✅ Added <b>${qty}</b> ${what} for <b>${flow.studentName}</b>${multi}.\n<code>${detail}</code>`,
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

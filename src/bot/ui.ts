import type { InlineKeyboard } from "grammy";
import { GrammyError } from "grammy";
import type { BotContext } from "./context.js";
import { t } from "../i18n.js";
import { mainMenuKeyboard, teacherMenuKeyboard } from "./keyboards.js";
import { countPendingHomework } from "../data/homework.js";

/** Show a "typing…" indicator while we fetch — makes waits feel responsive. */
export async function typing(ctx: BotContext): Promise<void> {
  try {
    await ctx.replyWithChatAction("typing");
  } catch {
    /* non-fatal */
  }
}

/**
 * Render a "screen": edit the current message in place when we arrived via a
 * button press, otherwise send a fresh message. Falls back to a new message if
 * editing fails (e.g. the message had media or content was identical).
 */
export async function view(
  ctx: BotContext,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  const options = {
    parse_mode: "HTML" as const,
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, options);
      return;
    } catch (err) {
      // "message is not modified" or non-text message — fall through to reply.
      if (!(err instanceof GrammyError)) throw err;
    }
  }
  await ctx.reply(text, options);
}

export async function showMainMenu(ctx: BotContext): Promise<void> {
  const lang = ctx.session.lang;
  let head = "";
  if (ctx.session.studentId) {
    try {
      const n = await countPendingHomework(ctx.session.studentId);
      head = (n > 0 ? t(lang, "menu_pending", { n }) : t(lang, "menu_caught_up")) + "\n\n";
    } catch {
      /* show the menu without the count if the lookup fails */
    }
  }
  await view(ctx, head + t(lang, "main_menu_title"), mainMenuKeyboard(lang));
}

export async function showTeacherMenu(ctx: BotContext): Promise<void> {
  await view(ctx, t(ctx.session.lang, "teacher_welcome"), teacherMenuKeyboard(ctx.session.lang));
}

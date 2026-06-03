import type { InlineKeyboard } from "grammy";
import { GrammyError } from "grammy";
import type { BotContext } from "./context.js";
import { t } from "../i18n.js";
import { mainMenuKeyboard, teacherMenuKeyboard } from "./keyboards.js";

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
  await view(ctx, t(ctx.session.lang, "main_menu_title"), mainMenuKeyboard(ctx.session.lang));
}

export async function showTeacherMenu(ctx: BotContext): Promise<void> {
  await view(ctx, t(ctx.session.lang, "teacher_welcome"), teacherMenuKeyboard(ctx.session.lang));
}

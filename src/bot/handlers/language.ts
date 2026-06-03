import type { BotContext } from "../context.js";
import type { Language } from "../../config.js";
import { t } from "../../i18n.js";
import { view, showMainMenu, showTeacherMenu } from "../ui.js";
import { languageKeyboard } from "../keyboards.js";
import { setLanguage as persistLanguage } from "../../data/connections.js";

export async function showLanguagePicker(ctx: BotContext): Promise<void> {
  await view(ctx, t(ctx.session.lang, "choose_language"), languageKeyboard());
}

export async function setLanguage(ctx: BotContext, lang: Language): Promise<void> {
  ctx.session.lang = lang;
  // Persist only if a connection exists (logged in); ignore failures.
  if (ctx.session.role && ctx.from) {
    try {
      await persistLanguage(ctx.from.id, lang);
    } catch {
      /* ignore */
    }
  }
  await ctx.reply(t(lang, "language_set"), { parse_mode: "HTML" });
  if (ctx.session.role === "teacher") await showTeacherMenu(ctx);
  else if (ctx.session.role === "student") await showMainMenu(ctx);
}

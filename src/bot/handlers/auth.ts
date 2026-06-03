import type { BotContext } from "../context.js";
import { t } from "../../i18n.js";
import { esc } from "../../util/format.js";
import { view, showMainMenu, showTeacherMenu } from "../ui.js";
import { isAdminLogin, verifyStudentLogin } from "../../data/students.js";
import {
  deleteConnection,
  saveStudentConnection,
  saveTeacherConnection,
} from "../../data/connections.js";

/** /start — route to the right place based on whether the user is logged in. */
export async function startCommand(ctx: BotContext): Promise<void> {
  const lang = ctx.session.lang;
  if (ctx.session.role === "teacher") {
    await showTeacherMenu(ctx);
    return;
  }
  if (ctx.session.role === "student" && ctx.session.studentId) {
    await view(ctx, t(lang, "login_success", { name: esc(ctx.session.name ?? "") }));
    await showMainMenu(ctx);
    return;
  }
  // Not logged in → begin the login flow.
  ctx.session.flow = { kind: "login", step: "username" };
  await ctx.reply(t(lang, "welcome"), { parse_mode: "HTML" });
  await ctx.reply(t(lang, "ask_username"), { parse_mode: "HTML" });
}

/** Handle a text message while in the login flow. */
export async function loginOnText(ctx: BotContext, text: string): Promise<void> {
  const lang = ctx.session.lang;
  const flow = ctx.session.flow;
  if (!flow || flow.kind !== "login") return;

  const value = text.trim();

  if (flow.step === "username") {
    if (!value) {
      await ctx.reply(t(lang, "ask_username"), { parse_mode: "HTML" });
      return;
    }
    flow.username = value;
    flow.step = "password";
    await ctx.reply(t(lang, "ask_password"), { parse_mode: "HTML" });
    return;
  }

  // step === "password"
  const username = flow.username ?? "";
  const password = value;
  // Best-effort: remove the message containing the password for privacy.
  try {
    await ctx.deleteMessage();
  } catch {
    /* private chats may not allow this; ignore */
  }

  const userId = ctx.from!.id;
  const chatId = ctx.chat!.id;

  // Teacher / admin login first.
  if (isAdminLogin(username, password)) {
    await saveTeacherConnection({ telegramUserId: userId, chatId, language: lang });
    ctx.session.role = "teacher";
    ctx.session.name = "Teacher";
    ctx.session.studentId = undefined;
    ctx.session.flow = undefined;
    await showTeacherMenu(ctx);
    return;
  }

  const student = await verifyStudentLogin(username, password);
  ctx.session.flow = undefined;
  if (!student) {
    await ctx.reply(t(lang, "login_failed"), { parse_mode: "HTML" });
    return;
  }

  await saveStudentConnection({
    telegramUserId: userId,
    chatId,
    studentId: student.id,
    name: student.name,
    language: lang,
  });
  ctx.session.role = "student";
  ctx.session.studentId = student.id;
  ctx.session.name = student.name;

  await ctx.reply(t(lang, "login_success", { name: esc(student.name) }), {
    parse_mode: "HTML",
  });
  await showMainMenu(ctx);
}

/** /logout — drop the persisted link and reset the session. */
export async function logoutCommand(ctx: BotContext): Promise<void> {
  try {
    if (ctx.from) await deleteConnection(ctx.from.id);
  } catch {
    /* ignore */
  }
  ctx.session.role = undefined;
  ctx.session.studentId = undefined;
  ctx.session.name = undefined;
  ctx.session.flow = undefined;
  await ctx.reply(t(ctx.session.lang, "logged_out"), { parse_mode: "HTML" });
}

import type { Api } from "grammy";
import type { BotContext } from "../bot/context.js";
import { listTeacherConnections } from "../data/connections.js";
import { esc } from "../util/format.js";

function compactError(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 900);
  return String(err).slice(0, 900);
}

function userLine(ctx?: BotContext): string {
  if (!ctx) return "";
  const from = ctx.from;
  const chat = ctx.chat;
  const name = [from?.first_name, from?.last_name].filter(Boolean).join(" ");
  const username = from?.username ? ` @${from.username}` : "";
  const sessionName = ctx.session?.name ? ` / ${ctx.session.name}` : "";
  const student = ctx.session?.studentId ? ` / studentId=${ctx.session.studentId}` : "";
  const role = ctx.session?.role ? ` / ${ctx.session.role}` : "";
  return [
    `<b>User:</b> ${esc(name || "Unknown")}${esc(username)}${esc(sessionName)}${esc(role)}${esc(student)}`,
    `<b>Telegram:</b> user=${from?.id ?? "?"} chat=${chat?.id ?? "?"}`,
  ].join("\n");
}

function flowLine(ctx?: BotContext): string {
  const flow = ctx?.session?.flow;
  if (!flow) return "";
  if (flow.kind === "tutor") {
    return `<b>Flow:</b> tutor topic=${flow.topicId} lesson=${esc(flow.lessonId)} awaiting=${flow.awaiting}`;
  }
  if (flow.kind === "quiz") {
    return `<b>Flow:</b> quiz assignment=${esc(flow.assignmentId)} q=${flow.index + 1}/${flow.questions.length}`;
  }
  return `<b>Flow:</b> ${flow.kind}`;
}

export async function notifyAdmins(
  api: Api,
  params: {
    title: string;
    ctx?: BotContext;
    details?: string;
    err?: unknown;
    onlyForStudents?: boolean;
  },
): Promise<void> {
  if (params.onlyForStudents && params.ctx?.session?.role === "teacher") return;

  let teachers: { chatId: number }[] = [];
  try {
    teachers = await listTeacherConnections();
  } catch {
    return;
  }
  if (!teachers.length) return;

  const lines = [`🚨 <b>${esc(params.title)}</b>`];
  const user = userLine(params.ctx);
  const flow = flowLine(params.ctx);
  if (user) lines.push(user);
  if (flow) lines.push(flow);
  if (params.details) lines.push(`<b>Details:</b> ${esc(params.details).slice(0, 1200)}`);
  const error = compactError(params.err);
  if (error) lines.push(`<b>Error:</b> <code>${esc(error)}</code>`);
  const text = lines.join("\n\n");

  await Promise.all(
    teachers.map(async ({ chatId }) => {
      try {
        await api.sendMessage(chatId, text, { parse_mode: "HTML" });
      } catch {
        /* teacher may have blocked the bot; ignore */
      }
    }),
  );
}

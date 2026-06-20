import { Bot, session } from "grammy";
import { config } from "./config.js";
import { t } from "./i18n.js";
import { initialSession } from "./bot/context.js";
import type { BotContext, SessionData } from "./bot/context.js";
import { getConnection } from "./data/connections.js";
import { fetchAssignmentById } from "./data/homework.js";
import { showMainMenu, showTeacherMenu } from "./bot/ui.js";
import { loginOnText, logoutCommand, startCommand } from "./bot/handlers/auth.js";
import {
  showHomeworkList,
  showProgress,
  showResults,
  showStudentReport,
  toggleReminders,
} from "./bot/handlers/student.js";
import { startReminderScheduler } from "./services/reminders.js";
import { startHomeworkWatcher } from "./services/homeworkWatcher.js";
import {
  quizChoice,
  quizOnText,
  quizOnVoice,
  quizQuit,
  quizSkip,
  startQuiz,
} from "./bot/handlers/quiz.js";
import {
  showStudentReports,
  showStudentsList,
  showTeacherReport,
} from "./bot/handlers/teacher.js";
import { setLanguage, showLanguagePicker } from "./bot/handlers/language.js";
import {
  learnCommand,
  showTopics,
  showLessons,
  showLanguageSetup,
  setTutorLanguage,
  startLesson,
  tutorNext,
  tutorOnText,
  tutorOnVoice,
  tutorQuizAnswer,
} from "./bot/handlers/tutor.js";

const bot = new Bot<BotContext>(config.botToken);

bot.use(
  session({
    initial: (): SessionData => initialSession(config.defaultLanguage),
  }),
);

// Rehydrate the persisted identity (telegramConnections) once per process.
bot.use(async (ctx, next) => {
  if (ctx.from && !ctx.session.loaded) {
    ctx.session.loaded = true;
    try {
      const conn = await getConnection(ctx.from.id);
      if (conn) {
        ctx.session.role = conn.role;
        ctx.session.studentId = conn.studentId;
        ctx.session.name = conn.name;
        if (conn.language) ctx.session.lang = conn.language;
      }
    } catch (err) {
      console.error("loadUser failed:", err);
    }
  }
  await next();
});

// A command (e.g. /menu, /start) always escapes an in-progress quiz or lesson.
bot.use(async (ctx, next) => {
  const text = ctx.message?.text;
  const kind = ctx.session.flow?.kind;
  if (text && text.startsWith("/") && (kind === "quiz" || kind === "tutor")) {
    ctx.session.flow = undefined;
  }
  await next();
});

/** Send the user to wherever "home" is for them. */
async function goHome(ctx: BotContext): Promise<void> {
  ctx.session.flow = undefined; // leaving any in-progress quiz/login
  if (ctx.session.role === "teacher") await showTeacherMenu(ctx);
  else if (ctx.session.role === "student") await showMainMenu(ctx);
  else await startCommand(ctx);
}

// ── Commands ──
bot.command("start", startCommand);
bot.command("menu", goHome);
bot.command("language", showLanguagePicker);
bot.command("learn", learnCommand);
bot.command("reminders", toggleReminders);
bot.command("logout", logoutCommand);
bot.command("help", (ctx) => ctx.reply(t(ctx.session.lang, "help"), { parse_mode: "HTML" }));

// ── Inline button dispatcher ──
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  try {
    // Quiz buttons acknowledge the tap themselves.
    if (data.startsWith("quiz:ans:")) {
      const parts = data.split(":");
      await quizChoice(ctx, Number(parts[2]), Number(parts[3]));
      return;
    }
    if (data === "quiz:skip") return await quizSkip(ctx);
    if (data === "quiz:quit") return await quizQuit(ctx);
    // Tutor quiz taps acknowledge themselves (with correct/incorrect text).
    if (data.startsWith("lrn:q:")) return await tutorQuizAnswer(ctx, Number(data.slice("lrn:q:".length)));

    // Everything else: stop the loading spinner first.
    await ctx.answerCallbackQuery();

    // ── AI tutor navigation ──
    if (data === "learn" || data === "lrn:topics") return await showTopics(ctx);
    if (data === "lrn:setup") return await showLanguageSetup(ctx);
    if (data === "lrn:lang:ru") return await setTutorLanguage(ctx, "Russian");
    if (data === "lrn:lang:en") return await setTutorLanguage(ctx, "English");
    if (data === "lrn:next") return await tutorNext(ctx);
    if (data.startsWith("lrn:t:")) return await showLessons(ctx, Number(data.slice("lrn:t:".length)));
    if (data.startsWith("lrn:l:")) {
      const rest = data.slice("lrn:l:".length); // "<topicId>:<lessonId>"
      const sep = rest.indexOf(":");
      if (sep !== -1) {
        return await startLesson(ctx, Number(rest.slice(0, sep)), rest.slice(sep + 1));
      }
    }

    if (data === "menu") return await goHome(ctx);
    if (data === "hw:list") return await showHomeworkList(ctx);
    if (data.startsWith("hw:open:")) {
      const assignment = await fetchAssignmentById(data.slice("hw:open:".length));
      if (!assignment) {
        await ctx.reply(t(ctx.session.lang, "error_generic"), { parse_mode: "HTML" });
        return;
      }
      return await startQuiz(ctx, assignment);
    }
    if (data === "results") return await showResults(ctx);
    if (data.startsWith("report:")) return await showStudentReport(ctx, data.slice("report:".length));
    if (data === "progress") return await showProgress(ctx);
    if (data === "lang:menu") return await showLanguagePicker(ctx);
    if (data === "lang:en") return await setLanguage(ctx, "en");
    if (data === "lang:ru") return await setLanguage(ctx, "ru");
    if (data === "t:students") return await showStudentsList(ctx);
    if (data.startsWith("t:student:")) {
      return await showStudentReports(ctx, data.slice("t:student:".length));
    }
    if (data.startsWith("t:report:")) {
      return await showTeacherReport(ctx, data.slice("t:report:".length));
    }
    if (data === "logout") return await logoutCommand(ctx);
  } catch (err) {
    console.error("callback error:", err);
    try {
      await ctx.reply(t(ctx.session.lang, "error_generic"), { parse_mode: "HTML" });
    } catch {
      /* ignore */
    }
  }
});

// ── Text routing (login / quiz / tutor / fallback) ──
bot.on("message:text", async (ctx) => {
  const flow = ctx.session.flow;
  if (flow?.kind === "login") return await loginOnText(ctx, ctx.message.text);
  if (flow?.kind === "quiz") return await quizOnText(ctx, ctx.message.text);
  if (flow?.kind === "tutor") return await tutorOnText(ctx, ctx.message.text);
  await goHome(ctx);
});

// ── Voice answers ──
const onVoice = async (ctx: BotContext) => {
  if (ctx.session.flow?.kind === "quiz") await quizOnVoice(ctx);
  else if (ctx.session.flow?.kind === "tutor") await tutorOnVoice(ctx);
};
bot.on("message:voice", onVoice);
bot.on("message:audio", onVoice);

bot.catch((err) => {
  console.error("Bot error while handling update:", err.error);
});

// Keep the long-running process alive on stray async errors instead of crashing.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

async function main(): Promise<void> {
  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Log in / open the bot" },
      { command: "menu", description: "Main menu" },
      { command: "learn", description: "AI English tutor (A1 course)" },
      { command: "language", description: "Change language" },
      { command: "reminders", description: "Lesson reminders on/off" },
      { command: "logout", description: "Log out" },
      { command: "help", description: "Help" },
    ]);
  } catch (err) {
    console.error("setMyCommands failed (continuing):", err);
  }

  // Force the Menu button to show the command list (clears any old web-app menu
  // button left over from a previous bot setup).
  try {
    await bot.api.setChatMenuButton({ menu_button: { type: "commands" } });
  } catch (err) {
    console.error("setChatMenuButton failed (continuing):", err);
  }

  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());

  await bot.start({
    onStart: (info) => {
      console.log(`✅ @${info.username} is running (long polling).`);
      startReminderScheduler(bot);
      startHomeworkWatcher(bot);
    },
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

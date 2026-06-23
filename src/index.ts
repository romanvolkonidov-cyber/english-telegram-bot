import { Bot, session } from "grammy";
import { config } from "./config.js";
import { t } from "./i18n.js";
import { initialSession } from "./bot/context.js";
import type { BotContext, SessionData } from "./bot/context.js";
import { firestoreSessionStorage } from "./bot/sessionStore.js";
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
import { notifyAdmins } from "./services/adminNotify.js";
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
import { startBonusGrant, bonusOnText } from "./bot/handlers/adminGrant.js";
import {
  learnCommand,
  showLevelPicker,
  showLevelPickerFor,
  showTopics,
  showCourse,
  showLessons,
  startLesson,
  tutorNext,
  tutorOnText,
  tutorOnVoice,
  tutorQuizAnswer,
  tutorOverageContinue,
  showBuyMenu,
  startPurchase,
  handleSuccessfulPayment,
} from "./bot/handlers/tutor.js";
import {
  wordGameCommand,
  showLevelMenu,
  startGameLevel,
  wordGameAnswer,
  nextGameRound,
  showGameBuyMenu,
  startGamePurchase,
  handleGamePayment,
  endGame,
  showLeaderboard,
} from "./bot/handlers/wordgame.js";

const bot = new Bot<BotContext>(config.botToken);

bot.use(
  session({
    initial: (): SessionData => initialSession(config.defaultLanguage),
    // Persist sessions in Firestore: they survive a restart (a paid lesson resumes
    // where it left off) and memory no longer grows without bound.
    storage: firestoreSessionStorage(),
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
    // One-time per session: clear any stale custom reply keyboard left on this
    // chat by a previous bot. Only for already-connected users (new users never
    // had it). Best-effort — never block the update.
    if (ctx.chat && ctx.session.role) {
      try {
        await ctx.api.sendMessage(ctx.chat.id, t(ctx.session.lang, "kb_removed"), {
          reply_markup: { remove_keyboard: true },
        });
      } catch {
        /* ignore */
      }
    }
  }
  await next();
});

// A command (e.g. /menu, /start) always escapes an in-progress quiz, lesson, or game.
bot.use(async (ctx, next) => {
  const text = ctx.message?.text;
  const kind = ctx.session.flow?.kind;
  if (
    text &&
    text.startsWith("/") &&
    (kind === "quiz" || kind === "tutor" || kind === "wordgame" || kind === "grant")
  ) {
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
bot.command("wordgame", wordGameCommand);
bot.command("leaderboard", showLeaderboard);
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
    if (data === "learn") return await learnCommand(ctx);
    if (data === "lrn:topics") return await showTopics(ctx);
    if (data === "lrn:lvl:A1") return await showTopics(ctx, "English", "A1");
    if (data === "lrn:lvl:A2") return await showTopics(ctx, "English", "A2");
    // Level picker (first self-study screen) and its language toggle / back button.
    if (data === "lrn:levels") return await showLevelPicker(ctx);
    if (data.startsWith("lrn:levels:")) return await showLevelPickerFor(ctx, data.slice("lrn:levels:".length));
    if (data === "lrn:lang:en") return await showLevelPickerFor(ctx, "en");
    if (data === "lrn:lang:pt") return await showLevelPickerFor(ctx, "pt");
    if (data.startsWith("lrn:c:")) {
      const parts = data.split(":"); // lrn:c:<code>:<level>
      return await showCourse(ctx, parts[2] ?? "en", parts[3] ?? "A1");
    }
    if (data === "lrn:next") return await tutorNext(ctx);
    if (data === "lrn:over") return await tutorOverageContinue(ctx);
    if (data === "lrn:buy") return await showBuyMenu(ctx, "menu");
    if (data.startsWith("buy:")) return await startPurchase(ctx, data.slice("buy:".length));
    if (data.startsWith("lrn:t:")) return await showLessons(ctx, Number(data.slice("lrn:t:".length)));
    if (data.startsWith("lrn:l:")) {
      const rest = data.slice("lrn:l:".length); // "<topicId>:<lessonId>"
      const sep = rest.indexOf(":");
      if (sep !== -1) {
        return await startLesson(ctx, Number(rest.slice(0, sep)), rest.slice(sep + 1));
      }
    }

    // ── Word game navigation ──
    if (data === "wg:levels") return await showLevelMenu(ctx);
    if (data.startsWith("wg:lv:")) {
      const parts = data.split(":");  // wg:lv:<from>:<to>
      return await startGameLevel(ctx, parts[2] ?? "A1", parts[3] ?? "A2");
    }
    if (data.startsWith("wg:ans:")) return await wordGameAnswer(ctx, Number(data.slice("wg:ans:".length)));
    if (data === "wg:next") return await nextGameRound(ctx);
    if (data === "wg:retry") return await nextGameRound(ctx);
    if (data === "wg:end") return await endGame(ctx);
    if (data === "wg:lb") return await showLeaderboard(ctx);
    if (data === "wg:shop") return await showGameBuyMenu(ctx, "menu");
    if (data.startsWith("wg:buy:")) return await startGamePurchase(ctx, data.slice("wg:buy:".length));

    if (data === "menu") return await goHome(ctx);
    if (data === "hw:list") return await showHomeworkList(ctx);
    if (data.startsWith("hw:open:")) {
      const assignment = await fetchAssignmentById(data.slice("hw:open:".length));
      if (!assignment) {
        await ctx.reply(t(ctx.session.lang, "error_generic"), { parse_mode: "HTML" });
        await notifyAdmins(ctx.api, {
          title: "Student saw homework open error",
          ctx,
          details: `Missing assignment ${data.slice("hw:open:".length)}`,
          onlyForStudents: true,
        });
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
    if (data.startsWith("t:bonus:lessons:")) {
      return await startBonusGrant(ctx, "lessons", data.slice("t:bonus:lessons:".length));
    }
    if (data.startsWith("t:bonus:rounds:")) {
      return await startBonusGrant(ctx, "rounds", data.slice("t:bonus:rounds:".length));
    }
    if (data === "logout") return await logoutCommand(ctx);
  } catch (err) {
    console.error("callback error:", err);
    try {
      await ctx.reply(t(ctx.session.lang, "error_generic"), { parse_mode: "HTML" });
      await notifyAdmins(ctx.api, {
        title: "Student saw callback error",
        ctx,
        details: `callback=${data}`,
        err,
        onlyForStudents: true,
      });
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
  if (flow?.kind === "grant") return await bonusOnText(ctx, ctx.message.text);
  await goHome(ctx);
});

// ── Voice answers ──
const onVoice = async (ctx: BotContext) => {
  if (ctx.session.flow?.kind === "quiz") await quizOnVoice(ctx);
  else if (ctx.session.flow?.kind === "tutor") await tutorOnVoice(ctx);
};
bot.on("message:voice", onVoice);
bot.on("message:audio", onVoice);

// ── Telegram Stars payments (AI tutor wallet) ──
// Approve every pre-checkout (we sell a fixed digital good); credit on success.
bot.on("pre_checkout_query", async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    console.error("answerPreCheckoutQuery failed:", err);
    await notifyAdmins(ctx.api, {
      title: "Payment pre-checkout failed",
      ctx,
      err,
      onlyForStudents: true,
    });
  }
});
bot.on("message:successful_payment", async (ctx) => {
  const payload = ctx.message?.successful_payment?.invoice_payload ?? "";
  if (payload.startsWith("wg_pay:")) return await handleGamePayment(ctx);
  return await handleSuccessfulPayment(ctx);
});

bot.catch(async (err) => {
  console.error("Bot error while handling update:", err.error);
  // Never leave the user staring at a silent stall when a handler throws: send a
  // best-effort friendly note. Wrapped so the error handler itself can't throw.
  try {
    await err.ctx.reply(t(err.ctx.session?.lang ?? config.defaultLanguage, "error_generic"), {
      parse_mode: "HTML",
    });
    await notifyAdmins(err.ctx.api, {
      title: "Student saw unhandled bot error",
      ctx: err.ctx,
      err: err.error,
      onlyForStudents: true,
    });
  } catch {
    /* ignore — chat may be gone or unreachable */
  }
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
      { command: "learn", description: "AI English tutor (A1 & A2 courses)" },
      { command: "wordgame", description: "Vocabulary word game" },
      { command: "leaderboard", description: "Word game weekly leaderboard" },
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

import { InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { t } from "../../i18n.js";
import { toMillis } from "../../util/format.js";
import { typing, view, showMainMenu } from "../ui.js";
import {
  backToMenuKeyboard,
  homeworkListKeyboard,
  resultsListKeyboard,
} from "../keyboards.js";
import {
  assignmentTitle,
  assignmentTopicIds,
  fetchHomeworkReports,
  fetchQuestionsForHomework,
  fetchReportById,
  fetchStudentHomework,
  pendingAssignments,
} from "../../data/homework.js";
import {
  getGameProfile,
  getLevelForXP,
  getXPProgress,
} from "../../data/gamification.js";
import { renderReport } from "../report.js";

/** Resolve the logged-in student id, or tell the user to log in. */
export function requireStudent(ctx: BotContext): string | null {
  if (ctx.session.role === "student" && ctx.session.studentId) return ctx.session.studentId;
  void ctx.reply(t(ctx.session.lang, "not_logged_in"), { parse_mode: "HTML" });
  return null;
}

export async function showHomeworkList(ctx: BotContext): Promise<void> {
  const studentId = requireStudent(ctx);
  if (!studentId) return;
  const lang = ctx.session.lang;
  await typing(ctx);

  const [assignments, reports] = await Promise.all([
    fetchStudentHomework(studentId),
    fetchHomeworkReports(studentId),
  ]);
  const pending = pendingAssignments(assignments, reports);

  if (pending.length === 0) {
    await view(ctx, t(lang, "hw_none"), backToMenuKeyboard(lang));
    return;
  }

  const counts = await Promise.all(
    pending.map((a) => fetchQuestionsForHomework(assignmentTopicIds(a)).then((q) => q.length)),
  );
  const items = pending.map((assignment, i) => ({ assignment, count: counts[i] ?? 0 }));

  await view(ctx, t(lang, "hw_list_title"), homeworkListKeyboard(lang, items));
}

export async function showResults(ctx: BotContext): Promise<void> {
  const studentId = requireStudent(ctx);
  if (!studentId) return;
  const lang = ctx.session.lang;
  await typing(ctx);

  const [reports, assignments] = await Promise.all([
    fetchHomeworkReports(studentId),
    fetchStudentHomework(studentId),
  ]);
  if (reports.length === 0) {
    await view(ctx, t(lang, "results_none"), backToMenuKeyboard(lang));
    return;
  }

  const titleMap = new Map(assignments.map((a) => [a.id, assignmentTitle(a)]));
  const sorted = reports
    .sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt))
    .slice(0, 20);
  const items = sorted.map((report) => ({
    report,
    title: titleMap.get(report.homeworkId) ?? "Homework",
  }));

  const kb = resultsListKeyboard(lang, items, "report");
  kb.row().text(t(lang, "btn_menu"), "menu");
  await view(ctx, t(lang, "results_title"), kb);
}

/** Send a full homework review (chunks + voice notes), then a back button. */
export async function sendReport(
  ctx: BotContext,
  reportId: string,
  opts: { isTeacher: boolean; backButton: { text: string; data: string } },
): Promise<void> {
  const lang = ctx.session.lang;
  await typing(ctx);
  const report = await fetchReportById(reportId);
  if (!report) {
    await ctx.reply(t(lang, "error_generic"), { parse_mode: "HTML" });
    return;
  }
  // Students may only view their own reports.
  if (!opts.isTeacher && report.studentId !== ctx.session.studentId) {
    await ctx.reply(t(lang, "error_generic"), { parse_mode: "HTML" });
    return;
  }

  const { chunks, voiceNotes } = await renderReport(lang, report);
  for (const chunk of chunks) {
    await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  }
  for (const note of voiceNotes) {
    try {
      await ctx.replyWithVoice(note.url, { caption: note.caption });
    } catch {
      // Web-recorded answers may be .webm/.mp4 — fall back to audio.
      try {
        await ctx.replyWithAudio(note.url, { caption: note.caption });
      } catch {
        /* if the stored URL can't be sent, skip silently */
      }
    }
  }
  const kb = new InlineKeyboard().text(opts.backButton.text, opts.backButton.data);
  await ctx.reply(t(lang, "review_end"), { reply_markup: kb });
}

export async function showStudentReport(ctx: BotContext, reportId: string): Promise<void> {
  const lang = ctx.session.lang;
  await sendReport(ctx, reportId, {
    isTeacher: false,
    backButton: { text: t(lang, "btn_back"), data: "results" },
  });
}

export async function showProgress(ctx: BotContext): Promise<void> {
  const studentId = requireStudent(ctx);
  if (!studentId) return;
  const lang = ctx.session.lang;
  await typing(ctx);

  const profile = await getGameProfile(studentId);
  const level = getLevelForXP(profile.xp);
  const xp = getXPProgress(profile.xp);

  const lines = [
    t(lang, "progress_title"),
    "",
    t(lang, "progress_level", { emoji: level.emoji, level: level.level, title: level.title }),
    xp.needed > 0
      ? t(lang, "progress_xp", { current: xp.current, needed: xp.needed })
      : t(lang, "progress_xp_max", { xp: profile.xp }),
    t(lang, "progress_coins", { coins: profile.shopCoins }),
    t(lang, "progress_streak", { streak: profile.currentStreak, best: profile.highestStreak }),
    t(lang, "progress_done", { n: profile.totalHomeworksCompleted }),
    t(lang, "progress_badges", { n: profile.unlockedBadges.length }),
    "",
    t(lang, "progress_web_hint"),
  ];
  await view(ctx, lines.join("\n"), backToMenuKeyboard(lang));
}

export { showMainMenu };

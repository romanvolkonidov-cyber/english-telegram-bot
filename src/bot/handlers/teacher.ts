import { InlineKeyboard } from "grammy";
import type { Api } from "grammy";
import type { BotContext } from "../context.js";
import { t } from "../../i18n.js";
import { esc, toMillis } from "../../util/format.js";
import { typing, view } from "../ui.js";
import { resultsListKeyboard, studentsListKeyboard } from "../keyboards.js";
import { fetchStudentById, fetchStudents } from "../../data/students.js";
import {
  assignmentTitle,
  fetchAllReports,
  fetchHomeworkReports,
  fetchReportById,
  fetchStudentHomework,
  markReportSeen,
} from "../../data/homework.js";
import { listTeacherConnections } from "../../data/connections.js";
import { sendReport } from "./student.js";

export function requireTeacher(ctx: BotContext): boolean {
  if (ctx.session.role === "teacher") return true;
  void ctx.reply(t(ctx.session.lang, "not_logged_in"), { parse_mode: "HTML" });
  return false;
}

export async function showStudentsList(ctx: BotContext): Promise<void> {
  if (!requireTeacher(ctx)) return;
  const lang = ctx.session.lang;
  await typing(ctx);

  const [students, reports] = await Promise.all([fetchStudents(), fetchAllReports()]);
  const unseen = new Map<string, number>();
  for (const r of reports) {
    if (!r.seenByTeacher) unseen.set(r.studentId, (unseen.get(r.studentId) ?? 0) + 1);
  }

  if (students.length === 0) {
    await view(ctx, t(lang, "teacher_no_students"));
    return;
  }

  const items = students
    .map((student) => ({ student, unseen: unseen.get(student.id) ?? 0 }))
    .sort((a, b) => b.unseen - a.unseen || a.student.name.localeCompare(b.student.name))
    .slice(0, 80);

  await view(ctx, t(lang, "teacher_students_title"), studentsListKeyboard(lang, items));
}

export async function showStudentReports(ctx: BotContext, studentId: string): Promise<void> {
  if (!requireTeacher(ctx)) return;
  const lang = ctx.session.lang;
  await typing(ctx);

  const [student, reports, assignments] = await Promise.all([
    fetchStudentById(studentId),
    fetchHomeworkReports(studentId),
    fetchStudentHomework(studentId),
  ]);
  const name = esc(student?.name ?? "Student");

  if (reports.length === 0) {
    const kb = new InlineKeyboard();
    addBonusRow(ctx, kb, studentId);
    kb.text(t(lang, "btn_back"), "t:students");
    await view(ctx, t(lang, "teacher_no_reports"), kb);
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

  const kb = resultsListKeyboard(lang, items, "t:report");
  kb.row();
  addBonusRow(ctx, kb, studentId);
  kb.text(t(lang, "btn_back"), "t:students");
  await view(ctx, t(lang, "teacher_reports_title", { name }), kb);
}

/** Append a "give bonus lessons / rounds" row to a student-screen keyboard. */
function addBonusRow(ctx: BotContext, kb: InlineKeyboard, studentId: string): void {
  const en = ctx.session.lang === "en";
  kb
    .text(en ? "🎁 + Lessons" : "🎁 + Уроки", `t:bonus:lessons:${studentId}`)
    .text(en ? "🎮 + Rounds" : "🎮 + Раунды", `t:bonus:rounds:${studentId}`)
    .row();
}

export async function showTeacherReport(ctx: BotContext, reportId: string): Promise<void> {
  if (!requireTeacher(ctx)) return;
  const lang = ctx.session.lang;

  const report = await fetchReportById(reportId);
  const backData = report?.studentId ? `t:student:${report.studentId}` : "t:students";

  await sendReport(ctx, reportId, {
    isTeacher: true,
    backButton: { text: t(lang, "btn_back"), data: backData },
  });

  try {
    await markReportSeen(reportId);
  } catch {
    /* ignore */
  }
}

/** Notify every teacher chat that a student just submitted homework. */
export async function notifyTeachersOfSubmission(
  api: Api,
  params: {
    studentName: string;
    topicName: string;
    score: number;
    correct: number;
    total: number;
    reportId: string;
  },
): Promise<void> {
  let teachers: { chatId: number; language: "en" | "ru" }[] = [];
  try {
    teachers = await listTeacherConnections();
  } catch {
    return;
  }

  await Promise.all(
    teachers.map(async ({ chatId, language }) => {
      const text = t(language, "teacher_notify", {
        name: esc(params.studentName),
        topic: esc(params.topicName),
        pct: params.score,
        correct: params.correct,
        total: params.total,
      });
      const kb = new InlineKeyboard().text(
        t(language, "teacher_notify_view"),
        `t:report:${params.reportId}`,
      );
      try {
        await api.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: kb });
      } catch {
        /* teacher may have blocked the bot; ignore */
      }
    }),
  );
}

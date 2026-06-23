import { InlineKeyboard } from "grammy";
import type { Language } from "../config.js";
import { t } from "../i18n.js";
import { formatDate, truncate } from "../util/format.js";
import type { HomeworkAssignment, HomeworkReport, Student } from "../types.js";
import { assignmentTitle } from "../data/homework.js";

export function mainMenuKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, "menu_homework"), "hw:list")
    .text(t(lang, "menu_results"), "results")
    .row()
    .text(t(lang, "menu_progress"), "progress")
    .row()
    .text(t(lang, "menu_learn"), "learn")
    .row()
    .text(t(lang, "menu_wordgame"), "wg:levels")
    .row()
    .text(t(lang, "menu_language"), "lang:menu")
    .text(t(lang, "menu_logout"), "logout");
}

export function backToMenuKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard().text(t(lang, "btn_menu"), "menu");
}

export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🇬🇧 English", "lang:en")
    .text("🇷🇺 Русский", "lang:ru");
}

export function homeworkListKeyboard(
  lang: Language,
  items: { assignment: HomeworkAssignment; count: number }[],
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const { assignment, count } of items) {
    const label = t(lang, "hw_item", {
      topic: truncate(assignmentTitle(assignment), 22),
      count,
      date: formatDate(assignment.assignedAt, lang),
    });
    kb.text(label, `hw:open:${assignment.id}`).row();
  }
  kb.text(t(lang, "btn_menu"), "menu");
  return kb;
}

/** Buttons shown while answering a free-text or voice question. */
export function answerControlsKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, "quiz_skip"), "quiz:skip")
    .text(t(lang, "quiz_cancel"), "quiz:quit");
}

export function multipleChoiceKeyboard(
  lang: Language,
  qIndex: number,
  options: string[],
): InlineKeyboard {
  const kb = new InlineKeyboard();
  options.forEach((opt, i) => {
    kb.text(truncate(opt, 60), `quiz:ans:${qIndex}:${i}`).row();
  });
  kb.text(t(lang, "quiz_skip"), "quiz:skip").text(t(lang, "quiz_cancel"), "quiz:quit");
  return kb;
}

export function resultsListKeyboard(
  lang: Language,
  reports: { report: HomeworkReport; title: string }[],
  prefix: "report" | "t:report",
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const { report, title } of reports) {
    const label = t(lang, "results_item", {
      topic: truncate(title, 24),
      pct: report.score ?? 0,
      date: formatDate(report.completedAt, lang),
    });
    kb.text(label, `${prefix}:${report.id}`).row();
  }
  return kb;
}

export function teacherMenuKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, "teacher_menu_learn"), "lrn:topics")
    .row()
    .text(t(lang, "teacher_menu_students"), "t:students")
    .row()
    .text(t(lang, "menu_language"), "lang:menu")
    .text(t(lang, "teacher_menu_logout"), "logout");
}

export function studentsListKeyboard(
  lang: Language,
  students: { student: Student; unseen: number }[],
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const { student, unseen } of students) {
    const label =
      unseen > 0
        ? t(lang, "teacher_student_btn_unseen", { name: truncate(student.name, 24), n: unseen })
        : t(lang, "teacher_student_btn", { name: truncate(student.name, 30) });
    kb.text(label, `t:student:${student.id}`).row();
  }
  kb.text(t(lang, "btn_menu"), "menu");
  return kb;
}

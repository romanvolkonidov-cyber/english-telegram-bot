import type { BotContext, Flow } from "../context.js";
import { t } from "../../i18n.js";
import { esc, toMillis } from "../../util/format.js";
import { showMainMenu } from "../ui.js";
import {
  answerControlsKeyboard,
  backToMenuKeyboard,
  multipleChoiceKeyboard,
} from "../keyboards.js";
import { questionMedia, questionPromptText } from "../question.js";
import {
  assignmentTitle,
  assignmentTopicIds,
  fetchHomeworkReports,
  fetchQuestionsForHomework,
  fetchStudentHomework,
  fetchTopics,
  submitHomework,
} from "../../data/homework.js";
import { awardHomeworkXP } from "../../data/gamification.js";
import {
  downloadTelegramFile,
  toBase64,
  uploadVoiceAnswer,
} from "../../services/voice.js";
import { evaluateVoiceAnswer } from "../../services/gemini.js";
import { notifyTeachersOfSubmission } from "./teacher.js";
import type { HomeworkAssignment, Question, SubmittedAnswer } from "../../types.js";

type QuizFlow = Extract<Flow, { kind: "quiz" }>;

function quizFlow(ctx: BotContext): QuizFlow | null {
  return ctx.session.flow?.kind === "quiz" ? ctx.session.flow : null;
}

function questionMode(q: Question): "choice" | "voice" | "text" {
  if (q.type === "voiceAnswer") return "voice";
  if ((q.options?.length ?? 0) > 0) return "choice";
  return "text";
}

async function sendMedia(
  ctx: BotContext,
  media: { type: string; url: string }[],
): Promise<void> {
  for (const m of media) {
    try {
      if (m.type === "audio") await ctx.replyWithAudio(m.url);
      else if (m.type === "video") await ctx.replyWithVideo(m.url);
      else await ctx.replyWithPhoto(m.url);
    } catch {
      /* a broken media URL shouldn't block the question */
    }
  }
}

/** Begin doing a homework assignment. */
export async function startQuiz(
  ctx: BotContext,
  assignment: HomeworkAssignment,
): Promise<void> {
  const lang = ctx.session.lang;
  const topicIds = assignmentTopicIds(assignment);
  const [questions, topics] = await Promise.all([
    fetchQuestionsForHomework(topicIds),
    fetchTopics(topicIds),
  ]);

  if (questions.length === 0) {
    await ctx.reply(t(lang, "hw_none"), {
      parse_mode: "HTML",
      reply_markup: backToMenuKeyboard(lang),
    });
    return;
  }

  const sentences: Record<string, string> = {};
  for (const [id, topic] of topics) if (topic.sentence) sentences[id] = topic.sentence;

  ctx.session.flow = {
    kind: "quiz",
    assignmentId: assignment.id,
    topicName: assignmentTitle(assignment),
    assignedAt: toMillis(assignment.assignedAt),
    startedAt: Date.now(),
    index: 0,
    questions,
    answers: [],
    sentences,
  };

  await ctx.reply(
    t(lang, "quiz_started", { topic: esc(assignmentTitle(assignment)), count: questions.length }),
    { parse_mode: "HTML" },
  );
  if (assignment.homeworkMediaFiles?.length) {
    await sendMedia(
      ctx,
      assignment.homeworkMediaFiles.filter((m) => m.url).map((m) => ({ type: m.type, url: m.url })),
    );
  }
  await renderCurrentQuestion(ctx);
}

async function renderCurrentQuestion(ctx: BotContext): Promise<void> {
  const flow = quizFlow(ctx);
  if (!flow) return;
  const lang = ctx.session.lang;
  const q = flow.questions[flow.index];
  if (!q) return;

  await sendMedia(ctx, questionMedia(q));

  const progress = t(lang, "quiz_progress", { i: flow.index + 1, n: flow.questions.length });
  const promptText = esc(questionPromptText(q, flow.sentences));
  const header = `${progress}\n\n<b>${promptText}</b>`;
  const mode = questionMode(q);

  if (mode === "choice") {
    await ctx.reply(`${header}\n\n${t(lang, "quiz_prompt_choice")}`, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: multipleChoiceKeyboard(lang, flow.index, q.options ?? []),
    });
  } else if (mode === "voice") {
    await ctx.reply(`${header}\n\n${t(lang, "quiz_prompt_voice")}`, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: answerControlsKeyboard(lang),
    });
  } else {
    const instruction =
      q.type === "fillInBlank" ? t(lang, "quiz_prompt_fill") : t(lang, "quiz_prompt_text");
    await ctx.reply(`${header}\n\n${instruction}`, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: answerControlsKeyboard(lang),
    });
  }
}

async function recordAndAdvance(ctx: BotContext, answer: SubmittedAnswer): Promise<void> {
  const flow = quizFlow(ctx);
  if (!flow) return;
  flow.answers.push(answer);
  flow.index += 1;
  if (flow.index < flow.questions.length) {
    await renderCurrentQuestion(ctx);
  } else {
    await submitQuiz(ctx);
  }
}

export async function quizOnText(ctx: BotContext, text: string): Promise<void> {
  const flow = quizFlow(ctx);
  if (!flow) return;
  const lang = ctx.session.lang;
  const q = flow.questions[flow.index];
  if (!q) return;
  const mode = questionMode(q);

  if (mode === "text") {
    await recordAndAdvance(ctx, { questionId: q.id, answer: text.trim() });
  } else if (mode === "choice") {
    await ctx.reply(t(lang, "quiz_prompt_choice"), { parse_mode: "HTML" });
  } else {
    await ctx.reply(t(lang, "quiz_expecting_voice"), { parse_mode: "HTML" });
  }
}

export async function quizChoice(
  ctx: BotContext,
  qIndex: number,
  optIndex: number,
): Promise<void> {
  const flow = quizFlow(ctx);
  if (!flow) {
    await ctx.answerCallbackQuery();
    return;
  }
  await ctx.answerCallbackQuery();
  if (qIndex !== flow.index) return; // stale button from a previous question
  const q = flow.questions[flow.index];
  const option = q?.options?.[optIndex];
  if (!q || option === undefined) return;
  try {
    await ctx.editMessageReplyMarkup(); // drop the buttons so it can't be retapped
  } catch {
    /* ignore */
  }
  await recordAndAdvance(ctx, { questionId: q.id, answer: option });
}

export async function quizSkip(ctx: BotContext): Promise<void> {
  const flow = quizFlow(ctx);
  if (!flow) {
    await ctx.answerCallbackQuery();
    return;
  }
  await ctx.answerCallbackQuery();
  const q = flow.questions[flow.index];
  if (!q) return;
  try {
    await ctx.editMessageReplyMarkup();
  } catch {
    /* ignore */
  }
  await recordAndAdvance(ctx, { questionId: q.id, answer: "" });
}

export async function quizQuit(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.flow = undefined;
  await ctx.reply(t(ctx.session.lang, "quiz_cancelled"), { parse_mode: "HTML" });
  await showMainMenu(ctx);
}

export async function quizOnVoice(ctx: BotContext): Promise<void> {
  const flow = quizFlow(ctx);
  if (!flow) return;
  const lang = ctx.session.lang;
  const q = flow.questions[flow.index];
  if (!q) return;

  if (questionMode(q) !== "voice") {
    const hint = questionMode(q) === "choice" ? "quiz_prompt_choice" : "quiz_expecting_text";
    await ctx.reply(t(lang, hint), { parse_mode: "HTML" });
    return;
  }

  const studentId = ctx.session.studentId;
  if (!studentId) return;

  await ctx.reply(t(lang, "quiz_voice_processing"), { parse_mode: "HTML" });

  let bytes: Uint8Array | null = null;
  try {
    const file = await ctx.getFile();
    if (file.file_path) bytes = await downloadTelegramFile(file.file_path);
  } catch (err) {
    console.error("voice download failed:", err);
  }

  if (!bytes) {
    await ctx.reply(t(lang, "quiz_voice_saved"), { parse_mode: "HTML" });
    await recordAndAdvance(ctx, { questionId: q.id, answer: "[voice-recorded]" });
    return;
  }

  const promptText = questionPromptText(q, flow.sentences) || q.text || "";

  const [evaluation, audioUrl] = await Promise.all([
    evaluateVoiceAnswer(toBase64(bytes), "audio/ogg", promptText).catch(() => null),
    uploadVoiceAnswer(bytes, studentId, flow.assignmentId, q.id, "audio/ogg").catch(
      () => undefined,
    ),
  ]);

  const answer: SubmittedAnswer = {
    questionId: q.id,
    answer: evaluation?.transcript || "[voice-recorded]",
    ...(audioUrl ? { audioUrl } : {}),
    ...(evaluation?.feedback ? { aiFeedback: evaluation.feedback } : {}),
    ...(evaluation?.transcript ? { transcript: evaluation.transcript } : {}),
  };

  if (evaluation?.feedback) {
    await ctx.reply(t(lang, "quiz_voice_feedback", { feedback: esc(evaluation.feedback) }), {
      parse_mode: "HTML",
    });
  } else {
    await ctx.reply(t(lang, "quiz_voice_saved"), { parse_mode: "HTML" });
  }

  await recordAndAdvance(ctx, answer);
}

async function submitQuiz(ctx: BotContext): Promise<void> {
  const flow = quizFlow(ctx);
  if (!flow) return;
  const lang = ctx.session.lang;
  const studentId = ctx.session.studentId;
  if (!studentId) return;

  await ctx.reply(t(lang, "quiz_submitting"), { parse_mode: "HTML" });

  const result = await submitHomework(flow.assignmentId, studentId, flow.answers, flow.questions);

  // Gamification (best-effort — never block the result on it).
  let award: Awaited<ReturnType<typeof awardHomeworkXP>> | null = null;
  try {
    const [assignments, reports] = await Promise.all([
      fetchStudentHomework(studentId),
      fetchHomeworkReports(studentId),
    ]);
    const totalAssigned = assignments.length;
    const totalCompleted = new Set(reports.map((r) => r.homeworkId)).size;
    const timeSpent = Math.round((Date.now() - flow.startedAt) / 1000);
    const wasEarly =
      flow.assignedAt > 0 && Date.now() - flow.assignedAt <= 24 * 60 * 60 * 1000;
    award = await awardHomeworkXP(
      studentId,
      result.correctAnswers,
      result.totalQuestions,
      timeSpent,
      totalAssigned,
      totalCompleted,
      wasEarly,
    );
  } catch (err) {
    console.error("gamification failed:", err);
  }

  const lines = [
    t(lang, "result_title"),
    t(lang, "result_score", {
      correct: result.correctAnswers,
      total: result.totalQuestions,
      pct: result.score,
    }),
  ];
  if (award) {
    lines.push(t(lang, "result_rewards", { xp: award.earnedXP, coins: award.earnedCoins }));
    if (award.leveledUp) {
      lines.push(
        t(lang, "result_levelup", {
          emoji: award.newLevel.emoji,
          level: award.newLevel.level,
          title: award.newLevel.title,
        }),
      );
    }
    if (award.streakOutcome === "kept") {
      lines.push(t(lang, "result_streak_kept", { n: award.currentStreak }));
    } else if (award.streakOutcome === "started" || award.streakOutcome === "reset") {
      lines.push(t(lang, "result_streak_started"));
    }
    if (award.newBadges.length > 0) {
      lines.push(
        t(lang, "result_badges", {
          badges: award.newBadges.map((b) => `${b.emoji} ${b.name}`).join(", "),
        }),
      );
    }
  }

  const topicName = flow.topicName;
  const studentName = ctx.session.name ?? "Student";
  ctx.session.flow = undefined;

  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    reply_markup: backToMenuKeyboard(lang),
  });

  try {
    await notifyTeachersOfSubmission(ctx.api, {
      studentName,
      topicName,
      score: result.score,
      correct: result.correctAnswers,
      total: result.totalQuestions,
      reportId: result.reportId,
    });
  } catch {
    /* ignore */
  }
}

export { renderCurrentQuestion };

import type { Language } from "../config.js";
import { t } from "../i18n.js";
import { esc, truncate } from "../util/format.js";
import {
  assignmentTitle,
  fetchAssignmentById,
  fetchQuestionsForHomework,
  fetchTopics,
  assignmentTopicIds,
  isAnswerCorrect,
} from "../data/homework.js";
import { correctAnswerText, questionPromptText } from "./question.js";
import type { HomeworkReport } from "../types.js";

export interface RenderedReport {
  chunks: string[];
  voiceNotes: { caption: string; url: string }[];
}

const MAX_CHUNK = 3500;

/** Pack a header plus per-question blocks into Telegram-sized message chunks. */
function packChunks(header: string, blocks: string[]): string[] {
  const chunks: string[] = [];
  let current = header;
  for (const block of blocks) {
    if (current.length + block.length + 2 > MAX_CHUNK) {
      chunks.push(current);
      current = block;
    } else {
      current += "\n\n" + block;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

/**
 * Build a full review of a completed homework: the score, every question with
 * the student's answer, correctness, the correct answer (when wrong), and any
 * voice transcript/feedback. Works for both students and teachers.
 */
export async function renderReport(
  lang: Language,
  report: HomeworkReport,
): Promise<RenderedReport> {
  const assignment = await fetchAssignmentById(report.homeworkId);
  const topicIds = assignment ? assignmentTopicIds(assignment) : [];
  const [questions, topics] = await Promise.all([
    topicIds.length ? fetchQuestionsForHomework(topicIds) : Promise.resolve([]),
    topicIds.length ? fetchTopics(topicIds) : Promise.resolve(new Map()),
  ]);
  const sentences: Record<string, string> = {};
  for (const [id, topic] of topics) if (topic.sentence) sentences[id] = topic.sentence;

  const title = assignment ? assignmentTitle(assignment) : "Homework";
  const header = t(lang, "report_header", {
    topic: esc(title),
    pct: report.score ?? 0,
    correct: report.correctAnswers ?? 0,
    total: report.totalQuestions ?? questions.length,
  });

  const answersById = new Map(
    (report.submittedAnswers ?? []).map((a) => [a.questionId, a]),
  );

  const blocks: string[] = [];
  const voiceNotes: { caption: string; url: string }[] = [];

  questions.forEach((question, idx) => {
    const i = idx + 1;
    const submitted = answersById.get(question.id);
    const prompt = esc(truncate(questionPromptText(question, sentences), 300));
    const isVoice = question.type === "voiceAnswer";

    const lines: string[] = [];
    if (isVoice) {
      lines.push(t(lang, "report_q_voice", { i, q: prompt }));
      if (submitted?.transcript) {
        lines.push(t(lang, "report_transcript", { t: esc(submitted.transcript) }));
      }
      if (submitted?.aiFeedback) {
        lines.push(t(lang, "report_feedback", { f: esc(submitted.aiFeedback) }));
      }
      if (submitted?.audioUrl) {
        voiceNotes.push({
          caption: t(lang, "report_voice_note", { i }),
          url: submitted.audioUrl,
        });
      }
    } else {
      const answerText = submitted?.answer?.trim();
      const correct = answerText ? isAnswerCorrect(question, answerText) : false;
      lines.push(
        t(lang, correct ? "report_q_correct" : "report_q_wrong", { i, q: prompt }),
      );
      lines.push(
        t(lang, "report_your_answer", {
          a: answerText ? esc(answerText) : t(lang, "report_no_answer"),
        }),
      );
      if (!correct) {
        lines.push(t(lang, "report_correct_answer", { a: esc(correctAnswerText(question)) }));
      }
    }
    blocks.push(lines.join("\n"));
  });

  return { chunks: packChunks(header, blocks), voiceNotes };
}

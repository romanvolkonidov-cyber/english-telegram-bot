import type { Question } from "../types.js";

/** The base sentence for a fill-in-the-blank question (may come from the topic). */
export function questionBaseSentence(
  question: Question,
  sentences: Record<string, string>,
): string | undefined {
  return question.sentence || sentences[question.topicId] || undefined;
}

/** Human-readable prompt text for a question (no answer options). */
export function questionPromptText(
  question: Question,
  sentences: Record<string, string>,
): string {
  if (question.type === "fillInBlank") {
    const sentence = questionBaseSentence(question, sentences);
    if (sentence) {
      const blank = question.text ? ` (blank ${question.text})` : "";
      return `${sentence}${blank}`;
    }
  }
  return question.question || question.text || "";
}

/** The correct answer as display text (resolving numeric indices into options). */
export function correctAnswerText(question: Question): string {
  if (typeof question.correctAnswer === "number" && question.options) {
    return question.options[question.correctAnswer] ?? String(question.correctAnswer);
  }
  return String(question.correctAnswer ?? "");
}

/** Media URLs attached to a question, de-duplicated (the same file is often
 *  stored in both `mediaFiles[].url` and `mediaUrl`). */
export function questionMedia(question: Question): { type: string; url: string }[] {
  const seen = new Set<string>();
  const media: { type: string; url: string }[] = [];
  const add = (type: string, url?: string) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      media.push({ type, url });
    }
  };
  if (question.mediaFiles?.length) for (const m of question.mediaFiles) add(m.type, m.url);
  add(question.mediaType || "image", question.mediaUrl);
  add("image", question.imageUrl);
  add("audio", question.audioUrl);
  add("video", question.videoUrl);
  return media;
}

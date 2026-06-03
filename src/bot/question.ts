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

/** Media URLs attached to a question, normalized to {type,url} pairs. */
export function questionMedia(question: Question): { type: string; url: string }[] {
  const media: { type: string; url: string }[] = [];
  if (question.mediaFiles?.length) {
    for (const m of question.mediaFiles) if (m.url) media.push({ type: m.type, url: m.url });
  }
  if (question.mediaUrl) media.push({ type: question.mediaType || "image", url: question.mediaUrl });
  if (question.imageUrl) media.push({ type: "image", url: question.imageUrl });
  if (question.audioUrl) media.push({ type: "audio", url: question.audioUrl });
  if (question.videoUrl) media.push({ type: "video", url: question.videoUrl });
  return media;
}

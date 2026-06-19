import type { LessonFocus } from "./curriculum.js";

/**
 * Persistent profile of a learner, stored in the tutor Firestore. Keyed by the
 * student's Telegram id (as a string) so the tutor works even for users who
 * are not linked homework students.
 */
export interface LearnerProfile {
  telegramId: string;
  name?: string;
  /** Language the learner speaks natively, e.g. "Russian". Used for bilingual help. */
  nativeLanguage: string;
  /** Self-reported or inferred CEFR-ish level. We only teach A1 for now. */
  level: "A0" | "A1";
  createdAt: number;
  updatedAt: number;
}

/** Progress on a single micro-lesson. */
export interface LessonProgress {
  /** `${telegramId}_${topicId}_${lessonId}`. */
  id: string;
  telegramId: string;
  topicId: number;
  lessonId: string;
  /** 0 = untouched, 1 = started, 2 = practiced, 3 = mastered. */
  mastery: 0 | 1 | 2 | 3;
  attempts: number;
  lastSeenAt: number;
}

/** A single exchange in the running lesson conversation (kept in memory). */
export interface TutorTurn {
  role: "tutor" | "student";
  text: string;
}

/** A quiz the AI asked, awaiting the student's tap. */
export interface PendingQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explain: string;
}

/**
 * The structured reply we ask Claude to produce on every turn, so the bot can
 * render it deterministically (message + optional quiz) and update mastery.
 */
export interface TutorReply {
  /** The tutor's message to the student (may mix English and the native language). */
  say: string;
  /** Clean English (no other language) to speak aloud as a voice note, or null. */
  voiceText: string | null;
  /** Short description of a picture to show (vocabulary lessons), or null. */
  image: string | null;
  /** Optional multiple-choice check. Null when the tutor just wants a free reply. */
  quiz: PendingQuiz | null;
  /** What we expect next: a free-text/voice answer, a quiz tap, or nothing. */
  expect: "free" | "quiz" | "none";
  /** Gentle correction of the student's previous message, if needed. */
  correction: string | null;
  /** Suggested change to this lesson's mastery (clamped by the engine). */
  masteryDelta: number;
  /** True when the lesson's goal has been met and we can move on. */
  lessonComplete: boolean;
}

export interface LessonContext {
  topicId: number;
  topicTitle: string;
  lessonId: string;
  lessonTitle: string;
  focus: LessonFocus;
  canDo: string;
  grammar?: string;
  vocab?: string[];
  fn?: string;
  note?: string;
}

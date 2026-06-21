import type { CEFRLevel, LessonFocus, TargetLanguage } from "./curriculum.js";

/**
 * Persistent profile of a learner, stored in the tutor Firestore. Keyed by the
 * student's Telegram id (as a string) so the tutor works even for users who
 * are not linked homework students.
 */
export interface LearnerProfile {
  telegramId: string;
  name?: string;
  /** Language the learner speaks natively, e.g. "Russian". Follows the bot's
   *  language (set from the main menu); used for bilingual help. */
  nativeLanguage: string;
  /** Self-reported or inferred CEFR-ish level. */
  level: "A0" | "A1" | "A2";
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
 * The structured reply we ask Claude to produce on every turn. Voice-first:
 * `say` is spoken to the student as a voice note; `board` is shown as text only
 * when they need to read it. The bot renders this deterministically.
 */
export interface TutorReply {
  /** What the tutor SAYS OUT LOUD — sent as a voice note (the primary channel). May be bilingual. */
  say: string;
  /** Optional text to DISPLAY — English words/sentences to read, an exercise prompt, spelling. Null when not needed. */
  board: string | null;
  /** Short description of a picture to show (vocabulary lessons), or null. */
  image: string | null;
  /** True when the picture is the subject of the task: the bot will generate it,
   *  let the tutor SEE it, and then ask a question grounded in what's actually shown. */
  imageAsk: boolean;
  /** Optional multiple-choice check. Null when the tutor just wants a free reply. */
  quiz: PendingQuiz | null;
  /** What we expect next: a spoken reply, a typed reply, a quiz tap, or nothing. */
  expect: "voice" | "text" | "quiz" | "none";
  /** Suggested change to this lesson's mastery (clamped by the engine). */
  masteryDelta: number;
  /** True when the lesson's goal has been met and we can move on. */
  lessonComplete: boolean;
}

export interface LessonContext {
  topicId: number;
  /** CEFR course this lesson belongs to (A1 / A2). */
  level: CEFRLevel;
  /** The language being taught (English / Portuguese). */
  target: TargetLanguage;
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

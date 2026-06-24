import type { Context, SessionFlavor } from "grammy";
import type { Language } from "../config.js";
import type { Question, SubmittedAnswer } from "../types.js";
import type { TutorTurn, PendingQuiz } from "../tutor/types.js";

/** Transient multi-step flows tracked in the (in-memory) session. */
export type Flow =
  | { kind: "login"; step: "username" | "password"; username?: string }
  | {
      // Student is typing a custom number of Stars to spend on word-game rounds.
      kind: "wgbuy";
    }
  | {
      // Admin grants bonus lessons or game rounds to a chosen student.
      kind: "grant";
      target: "lessons" | "rounds";
      studentId: string;
      studentName: string;
    }
  | {
      kind: "quiz";
      assignmentId: string;
      topicName: string;
      assignedAt: number;
      startedAt: number;
      index: number;
      questions: Question[];
      answers: SubmittedAnswer[];
      /** topicId -> base sentence, for fill-in-the-blank rendering. */
      sentences: Record<string, string>;
    }
  | {
      kind: "wordgame";
      fromLevel: string;
      toLevel: string;
      score: number;
      total: number;
      usedWords: string[];
      currentOptions?: string[];
      correctIndex?: number;
      currentExplain?: string;
      currentDistractorExplains?: Record<string, string>;
      currentWord?: string;
      roundCostUsd?: number;
      /** True while a round is being generated — blocks double-tap re-entry. */
      busy?: boolean;
    }
  | {
      kind: "tutor";
      topicId: number;
      lessonId: string;
      /** Cached mastery (0..3) for the current lesson, updated each turn. */
      mastery: number;
      /** Recent conversation, kept in memory for the running lesson. */
      history: TutorTurn[];
      /** A multiple-choice check awaiting the student's tap, if any. */
      pendingQuiz?: PendingQuiz | null;
      /** What the bot is waiting for from the student. */
      awaiting: "voice" | "text" | "quiz" | "none";
      /** True if this lesson is the free trial (not metered against the wallet). */
      free: boolean;
      /** Accumulated real API cost (USD) of this lesson so far. */
      lessonCostUsd: number;
      /** How many mistakes the student has made this lesson (for owner insight/logs). */
      mistakes: number;
      /** True once the student has agreed to let THIS lesson run past its included
       *  budget and draw the extra from their balance. */
      overageOk: boolean;
    };

export interface SessionData {
  lang: Language;
  /** Cached identity (rehydrated from telegramConnections on first touch). */
  role?: "student" | "teacher";
  studentId?: string;
  name?: string;
  /** Whether we've already tried to load the persisted connection. */
  loaded: boolean;
  flow?: Flow;
}

export type BotContext = Context & SessionFlavor<SessionData>;

export function initialSession(lang: Language): SessionData {
  return { lang, loaded: false };
}

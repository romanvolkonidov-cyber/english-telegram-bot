import type { Context, SessionFlavor } from "grammy";
import type { Language } from "../config.js";
import type { Question, SubmittedAnswer } from "../types.js";
import type { TutorTurn, PendingQuiz } from "../tutor/types.js";

/** Transient multi-step flows tracked in the (in-memory) session. */
export type Flow =
  | { kind: "login"; step: "username" | "password"; username?: string }
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

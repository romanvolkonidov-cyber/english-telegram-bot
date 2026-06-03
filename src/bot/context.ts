import type { Context, SessionFlavor } from "grammy";
import type { Language } from "../config.js";
import type { Question, SubmittedAnswer } from "../types.js";

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

import type { Language } from "./config.js";

/**
 * Data shapes mirror the Firestore documents written by the rv2class
 * website so the bot reads and writes the SAME records. Keep field names
 * identical — they are case-sensitive and shared across both apps.
 */

/** A Firestore Timestamp serialized to a plain object. */
export interface SerializedTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface Student {
  id: string;
  name: string;
  /** Login credentials (stored plaintext by the website — we match that). */
  username?: string;
  password?: string;
  teacher?: string;
  subjects?: { English?: boolean; IT?: boolean };
  price?: number;
  currency?: string;
  tag?: string;
  /** Soft-delete flag set by the website; such students are hidden everywhere. */
  deleted?: boolean;
}

export interface Topic {
  id: string;
  name: string;
  sentence?: string;
  text?: string;
  description?: string;
  courseId?: string;
  chapterId?: string;
  order?: number;
}

export interface MediaFile {
  filename: string;
  url: string;
  type: string; // "image" | "audio" | "video"
}

export interface HomeworkAssignment {
  id: string;
  studentId: string;
  topicId?: string;
  topicIds?: string[];
  courseId?: string;
  chapterId?: string;
  assignedAt?: SerializedTimestamp | string | null;
  status?: string; // "completed" | "pending" | undefined
  courseName?: string;
  chapterName?: string;
  topicName?: string;
  homeworkMediaFiles?: MediaFile[];
}

export type QuestionType =
  | "textAnswer"
  | "multipleChoice"
  | "fillInBlank"
  | "voiceAnswer";

export interface Question {
  id: string;
  topicId: string;
  text: string;
  sentence?: string;
  question?: string;
  options?: string[];
  correctAnswer: string | number;
  type?: QuestionType | string;
  mediaUrl?: string;
  mediaType?: string;
  mediaFiles?: MediaFile[];
  audioUrl?: string;
  videoUrl?: string;
  imageUrl?: string;
  explanation?: string;
  order?: number;
  createdAt?: string;
  maxSeconds?: number;
}

/** A single answer inside a homework report's `submittedAnswers` array. */
export interface SubmittedAnswer {
  questionId: string;
  answer: string;
  audioUrl?: string;
  aiFeedback?: string;
  transcript?: string;
}

export interface HomeworkReport {
  id: string;
  studentId: string;
  homeworkId: string;
  score?: number;
  completedAt?: SerializedTimestamp | string | null;
  submittedAnswers?: SubmittedAnswer[];
  correctAnswers?: number;
  totalQuestions?: number;
  hasVoiceAnswers?: boolean;
  seenByTeacher?: boolean;
  completedVia?: string; // we always write "bot"
}

/**
 * Link between a Telegram user and their identity in our system.
 * Stored in the `telegramConnections` collection (public-writable per the
 * shared Firestore rules). Document id is `etb_<telegramUserId>` so it never
 * collides with any legacy bot documents in the same collection.
 */
export interface Connection {
  telegramUserId: number;
  chatId: number;
  role: "student" | "teacher";
  studentId?: string; // set when role === "student"
  name?: string;
  language: Language;
  botSource: "english-telegram-bot";
  /** Lesson reminders opt-out (default on). */
  remindersEnabled?: boolean;
  /** Keys of reminders already sent, to avoid duplicates. */
  sentReminders?: string[];
  linkedAt?: unknown;
  lastActive?: unknown;
}

/** A weekly lesson, as stored by the website in `weeklySchedule`. */
export interface Lesson {
  id: string;
  studentId: string;
  /** 0 = Monday … 6 = Sunday. */
  dayIndex: number;
  /**
   * "HH:mm". If `timeIsLocal` is true this is local wall-clock in `timezone`
   * (the fixed, DST-correct format); otherwise it's legacy UTC.
   */
  time: string;
  timeIsLocal?: boolean;
  timezone?: string;
  subject?: string;
  teacher?: string;
}

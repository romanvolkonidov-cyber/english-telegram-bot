import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, ensureAuth } from "../firebase.js";
import type { Language } from "../config.js";
import type { Connection } from "../types.js";

const BOT_SOURCE = "english-telegram-bot" as const;

/** Namespaced doc id so we never collide with legacy telegramConnections docs. */
function connDocId(telegramUserId: number): string {
  return `etb_${telegramUserId}`;
}

export async function getConnection(
  telegramUserId: number,
): Promise<Connection | null> {
  await ensureAuth();
  const snap = await getDoc(doc(db, "telegramConnections", connDocId(telegramUserId)));
  if (!snap.exists()) return null;
  const data = snap.data() as Connection;
  if (data.botSource !== BOT_SOURCE) return null;
  return data;
}

export async function saveStudentConnection(params: {
  telegramUserId: number;
  chatId: number;
  studentId: string;
  name: string;
  language: Language;
}): Promise<void> {
  await ensureAuth();
  const data: Connection = {
    telegramUserId: params.telegramUserId,
    chatId: params.chatId,
    role: "student",
    studentId: params.studentId,
    name: params.name,
    language: params.language,
    botSource: BOT_SOURCE,
    linkedAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  };
  await setDoc(doc(db, "telegramConnections", connDocId(params.telegramUserId)), data);
}

export async function saveTeacherConnection(params: {
  telegramUserId: number;
  chatId: number;
  language: Language;
}): Promise<void> {
  await ensureAuth();
  const data: Connection = {
    telegramUserId: params.telegramUserId,
    chatId: params.chatId,
    role: "teacher",
    name: "Teacher",
    language: params.language,
    botSource: BOT_SOURCE,
    linkedAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  };
  await setDoc(doc(db, "telegramConnections", connDocId(params.telegramUserId)), data);
}

export async function setLanguage(
  telegramUserId: number,
  language: Language,
): Promise<void> {
  await ensureAuth();
  await updateDoc(doc(db, "telegramConnections", connDocId(telegramUserId)), {
    language,
    lastActive: serverTimestamp(),
  });
}

export async function deleteConnection(telegramUserId: number): Promise<void> {
  await ensureAuth();
  await deleteDoc(doc(db, "telegramConnections", connDocId(telegramUserId)));
}

export interface StudentConnection {
  telegramUserId: number;
  chatId: number;
  studentId: string;
  language: Language;
  remindersEnabled: boolean;
  sentReminders: string[];
}

/** All student chats registered with THIS bot (used for lesson reminders). */
export async function listStudentConnections(): Promise<StudentConnection[]> {
  await ensureAuth();
  const snap = await getDocs(
    query(collection(db, "telegramConnections"), where("role", "==", "student")),
  );
  return snap.docs
    .map((d) => d.data() as Connection)
    .filter((c) => c.botSource === BOT_SOURCE && c.studentId && typeof c.chatId === "number")
    .map((c) => ({
      telegramUserId: c.telegramUserId,
      chatId: c.chatId,
      studentId: c.studentId!,
      language: c.language,
      remindersEnabled: c.remindersEnabled !== false, // default on
      sentReminders: c.sentReminders ?? [],
    }));
}

export async function setRemindersEnabled(
  telegramUserId: number,
  enabled: boolean,
): Promise<void> {
  await ensureAuth();
  await updateDoc(doc(db, "telegramConnections", connDocId(telegramUserId)), {
    remindersEnabled: enabled,
    lastActive: serverTimestamp(),
  });
}

/**
 * Record reminder keys as sent. Prunes keys older than today so the array
 * stays small, then merges in the new keys.
 */
export async function recordSentReminders(
  telegramUserId: number,
  currentKeys: string[],
  newKeys: string[],
): Promise<void> {
  await ensureAuth();
  const today = new Date().toISOString().slice(0, 10);
  const kept = currentKeys.filter((k) => {
    const date = k.split(":")[1];
    return date !== undefined && date >= today;
  });
  const merged = Array.from(new Set([...kept, ...newKeys])).slice(-200);
  await updateDoc(doc(db, "telegramConnections", connDocId(telegramUserId)), {
    sentReminders: merged,
  });
}

/** All teacher chats registered with THIS bot (used for submission notifications). */
export async function listTeacherConnections(): Promise<
  { chatId: number; language: Language }[]
> {
  await ensureAuth();
  // Single-equality query (no composite index needed); filter source in code.
  const snap = await getDocs(
    query(collection(db, "telegramConnections"), where("role", "==", "teacher")),
  );
  return snap.docs
    .map((d) => d.data() as Connection)
    .filter((c) => c.botSource === BOT_SOURCE && typeof c.chatId === "number")
    .map((c) => ({ chatId: c.chatId, language: c.language }));
}

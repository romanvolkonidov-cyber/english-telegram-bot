import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { tutorDb, col } from "./firebase.js";
import type { LearnerProfile, LessonProgress } from "./types.js";

/**
 * Firestore-backed learner model. Profiles live in `learnerProfiles` and
 * per-lesson progress in `lessonProgress` (names are prefixed automatically
 * when running on the shared fallback project — see ./firebase.ts).
 */

function progressId(telegramId: string, topicId: number, lessonId: string): string {
  return `${telegramId}_${topicId}_${lessonId}`;
}

export async function getProfile(telegramId: string): Promise<LearnerProfile | null> {
  const db = await tutorDb();
  const snap = await getDoc(doc(db, col("learnerProfiles"), telegramId));
  return snap.exists() ? (snap.data() as LearnerProfile) : null;
}

/** Create the profile if missing, or patch fields on an existing one. */
export async function upsertProfile(
  telegramId: string,
  patch: Partial<Omit<LearnerProfile, "telegramId" | "createdAt">>,
): Promise<LearnerProfile> {
  const db = await tutorDb();
  const ref = doc(db, col("learnerProfiles"), telegramId);
  const existing = await getProfile(telegramId);
  const now = Date.now();
  const profile: LearnerProfile = {
    telegramId,
    nativeLanguage: existing?.nativeLanguage ?? "Russian",
    level: existing?.level ?? "A1",
    createdAt: existing?.createdAt ?? now,
    ...existing,
    ...patch,
    updatedAt: now,
  };
  await setDoc(ref, profile, { merge: true });
  return profile;
}

export async function getLessonProgress(
  telegramId: string,
  topicId: number,
  lessonId: string,
): Promise<LessonProgress | null> {
  const db = await tutorDb();
  const snap = await getDoc(
    doc(db, col("lessonProgress"), progressId(telegramId, topicId, lessonId)),
  );
  return snap.exists() ? (snap.data() as LessonProgress) : null;
}

/** All progress rows for a learner (used to render the topic/lesson map). */
export async function getAllProgress(telegramId: string): Promise<LessonProgress[]> {
  const db = await tutorDb();
  const q = query(
    collection(db, col("lessonProgress")),
    where("telegramId", "==", telegramId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as LessonProgress);
}

export async function setLessonMastery(
  telegramId: string,
  topicId: number,
  lessonId: string,
  mastery: 0 | 1 | 2 | 3,
): Promise<void> {
  const db = await tutorDb();
  const id = progressId(telegramId, topicId, lessonId);
  const prev = await getLessonProgress(telegramId, topicId, lessonId);
  const row: LessonProgress = {
    id,
    telegramId,
    topicId,
    lessonId,
    mastery,
    attempts: (prev?.attempts ?? 0) + 1,
    lastSeenAt: Date.now(),
  };
  await setDoc(doc(db, col("lessonProgress"), id), row, { merge: true });
}

/**
 * Find where the learner should go next: the first lesson that isn't mastered,
 * scanning topics/lessons in order. Returns null only if everything is done.
 */
export async function nextUnmastered(
  telegramId: string,
  curriculumOrder: { topicId: number; lessonId: string }[],
): Promise<{ topicId: number; lessonId: string } | null> {
  const progress = await getAllProgress(telegramId);
  const mastered = new Set(
    progress.filter((p) => p.mastery >= 3).map((p) => `${p.topicId}_${p.lessonId}`),
  );
  for (const slot of curriculumOrder) {
    if (!mastered.has(`${slot.topicId}_${slot.lessonId}`)) return slot;
  }
  return null;
}

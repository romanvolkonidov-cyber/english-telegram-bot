import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, ensureAuth } from "../firebase.js";
import { chunk, normalizeAnswerText } from "../util/format.js";
import type {
  HomeworkAssignment,
  HomeworkReport,
  Question,
  SubmittedAnswer,
  Topic,
} from "../types.js";

/** Topic ids for an assignment, tolerating both old (topicId) and new (topicIds) shapes. */
export function assignmentTopicIds(a: HomeworkAssignment): string[] {
  if (a.topicIds && a.topicIds.length > 0) return a.topicIds;
  if (a.topicId) return [a.topicId];
  return [];
}

/** A readable title for an assignment. */
export function assignmentTitle(a: HomeworkAssignment): string {
  return (
    a.topicName ||
    a.chapterName ||
    a.courseName ||
    "Homework"
  );
}

export async function fetchStudentHomework(
  studentId: string,
): Promise<HomeworkAssignment[]> {
  await ensureAuth();
  const q = query(
    collection(db, "telegramAssignments"),
    where("studentId", "==", studentId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as HomeworkAssignment[];
}

export async function fetchHomeworkReports(
  studentId: string,
): Promise<HomeworkReport[]> {
  await ensureAuth();
  const q = query(
    collection(db, "telegramHomeworkReports"),
    where("studentId", "==", studentId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as HomeworkReport[];
}

export async function fetchAssignmentById(
  assignmentId: string,
): Promise<HomeworkAssignment | null> {
  await ensureAuth();
  const snap = await getDoc(doc(db, "telegramAssignments", assignmentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as object) } as HomeworkAssignment;
}

export async function fetchReportById(reportId: string): Promise<HomeworkReport | null> {
  await ensureAuth();
  const snap = await getDoc(doc(db, "telegramHomeworkReports", reportId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as object) } as HomeworkReport;
}

/** Every completed-homework report (teacher overview). */
export async function fetchAllReports(): Promise<HomeworkReport[]> {
  await ensureAuth();
  const snap = await getDocs(collection(db, "telegramHomeworkReports"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as HomeworkReport[];
}

export async function markReportSeen(reportId: string): Promise<void> {
  await ensureAuth();
  await updateDoc(doc(db, "telegramHomeworkReports", reportId), { seenByTeacher: true });
}

export async function fetchTopics(topicIds: string[]): Promise<Map<string, Topic>> {
  await ensureAuth();
  const map = new Map<string, Topic>();
  await Promise.all(
    topicIds.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, "telegramTopics", id));
        if (snap.exists()) map.set(id, { id: snap.id, ...(snap.data() as object) } as Topic);
      } catch {
        /* ignore individual topic failures */
      }
    }),
  );
  return map;
}

/**
 * Fetch all questions for the given topic ids, sorted by `order`.
 * Firestore "in" supports up to 30 values, so we batch.
 */
export async function fetchQuestionsForHomework(
  topicIds: string[],
): Promise<Question[]> {
  await ensureAuth();
  if (!topicIds.length) return [];
  const batches = chunk(topicIds, 30);
  const results = await Promise.all(
    batches.map(async (ids) => {
      const q = query(
        collection(db, "telegramQuestions"),
        where("topicId", "in", ids),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Question[];
    }),
  );
  const all = results.flat();
  all.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
  return all;
}

/** How many homeworks the student still has to do (best-effort, for the menu). */
export async function countPendingHomework(studentId: string): Promise<number> {
  const [assignments, reports] = await Promise.all([
    fetchStudentHomework(studentId),
    fetchHomeworkReports(studentId),
  ]);
  return pendingAssignments(assignments, reports).length;
}

/** Assignments the student still has to do (no matching report and not marked completed). */
export function pendingAssignments(
  assignments: HomeworkAssignment[],
  reports: HomeworkReport[],
): HomeworkAssignment[] {
  const completedIds = new Set(reports.map((r) => r.homeworkId));
  return assignments.filter(
    (a) => !completedIds.has(a.id) && a.status !== "completed",
  );
}

/**
 * Score one answer against its question, replicating the website's logic:
 *  - voice answers are never auto-scored (AI handles them)
 *  - a numeric correctAnswer is an index into options
 *  - everything is compared via normalizeAnswerText
 */
export function isAnswerCorrect(question: Question, answer: string): boolean {
  if (question.type === "voiceAnswer") return false;
  if (typeof question.correctAnswer === "number" && question.options) {
    const correctOption = question.options[question.correctAnswer];
    return normalizeAnswerText(correctOption) === normalizeAnswerText(answer);
  }
  return normalizeAnswerText(question.correctAnswer) === normalizeAnswerText(answer);
}

export interface SubmitResult {
  reportId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
}

/**
 * Persist a completed homework: mark the assignment completed and write a
 * report to `telegramHomeworkReports`. Writes `completedVia: "bot"` so the
 * website can tell where the submission came from.
 */
export async function submitHomework(
  assignmentId: string,
  studentId: string,
  answers: SubmittedAnswer[],
  questions: Question[],
): Promise<SubmitResult> {
  await ensureAuth();

  let correctCount = 0;
  const totalCount = questions.length;
  for (const answer of answers) {
    const question = questions.find((q) => q.id === answer.questionId);
    if (!question) continue;
    if (question.type === "voiceAnswer") {
      // Voice answers are AI/teacher-reviewed, not auto-graded. Count a question
      // that was actually recorded as complete/correct (skipped ones aren't).
      if (answer.audioUrl || answer.transcript?.trim()) correctCount++;
      continue;
    }
    if (isAnswerCorrect(question, answer.answer)) correctCount++;
  }
  const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  await updateDoc(doc(db, "telegramAssignments", assignmentId), {
    status: "completed",
    completedAt: serverTimestamp(),
  });

  const reportRef = await addDoc(collection(db, "telegramHomeworkReports"), {
    studentId,
    homeworkId: assignmentId,
    score,
    correctAnswers: correctCount,
    totalQuestions: totalCount,
    submittedAnswers: answers,
    hasVoiceAnswers: answers.some((a) => Boolean(a.audioUrl)),
    completedAt: serverTimestamp(),
    completedVia: "bot",
  });

  return { reportId: reportRef.id, score, correctAnswers: correctCount, totalQuestions: totalCount };
}

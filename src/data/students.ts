import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db, ensureAuth } from "../firebase.js";
import { config } from "../config.js";
import type { Student } from "../types.js";

/**
 * Verify a student login. Mirrors the website exactly: usernames/passwords
 * are stored in plaintext on the `students` documents and compared directly.
 *
 * ⚠️ Plaintext credentials are a pre-existing property of this system, not a
 * choice made here. See README "Security notes" for the recommended upgrade.
 */
export async function verifyStudentLogin(
  username: string,
  password: string,
): Promise<Student | null> {
  await ensureAuth();
  const snapshot = await getDocs(collection(db, "students"));
  const match = snapshot.docs.find((d) => {
    const data = d.data() as Student;
    return data.username === username && data.password === password && data.deleted !== true;
  });
  if (!match) return null;
  return { id: match.id, ...(match.data() as Omit<Student, "id">) };
}

/** Check the teacher/admin login (defaults to the website's admin/2206). */
export function isAdminLogin(username: string, password: string): boolean {
  return username === config.adminUsername && password === config.adminPassword;
}

/** All students, sorted by name (used by the teacher view). */
export async function fetchStudents(): Promise<Student[]> {
  await ensureAuth();
  const snapshot = await getDocs(collection(db, "students"));
  const students = snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, "id">) }))
    .filter((s) => s.deleted !== true);
  return students.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function fetchStudentById(studentId: string): Promise<Student | null> {
  await ensureAuth();
  const snap = await getDoc(doc(db, "students", studentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Student, "id">) };
}

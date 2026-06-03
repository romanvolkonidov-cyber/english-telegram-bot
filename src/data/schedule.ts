import { collection, getDocs } from "firebase/firestore";
import { db, ensureAuth } from "../firebase.js";
import type { Lesson } from "../types.js";

/**
 * Read the weekly lesson schedule the website writes (`weeklySchedule`).
 * We only READ it — the bot never modifies lessons.
 *
 * Note on `time`: the website stores it as a UTC "HH:mm" string, so the bot
 * treats it as UTC when computing when a lesson happens. See the README
 * section "Lesson times & DST" for the caveat this inherits.
 */
export async function fetchAllLessons(): Promise<Lesson[]> {
  await ensureAuth();
  const snap = await getDocs(collection(db, "weeklySchedule"));
  return snap.docs
    .map((d) => {
      const data = d.data() as Partial<Lesson>;
      return {
        id: d.id,
        studentId: data.studentId ?? "",
        dayIndex: typeof data.dayIndex === "number" ? data.dayIndex : -1,
        time: data.time ?? "",
        timezone: data.timezone,
        subject: data.subject,
        teacher: data.teacher,
      } as Lesson;
    })
    .filter((l) => l.studentId && l.time && l.dayIndex >= 0);
}

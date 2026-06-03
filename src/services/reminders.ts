import type { Bot } from "grammy";
import type { BotContext } from "../bot/context.js";
import { config } from "../config.js";
import { t } from "../i18n.js";
import { esc } from "../util/format.js";
import { fetchAllLessons } from "../data/schedule.js";
import {
  listStudentConnections,
  recordSentReminders,
  type StudentConnection,
} from "../data/connections.js";

/** Convert a JS day (0=Sun) to the website's dayIndex (0=Mon … 6=Sun). */
function customDayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

/**
 * The next UTC instant for a lesson on `dayIndex` at `hhmm` (interpreted as
 * UTC, matching how the website stores `time`). Returns the soonest such
 * instant at or after `now`.
 */
export function nextOccurrenceUTC(
  dayIndex: number,
  hhmm: string,
  now = new Date(),
): Date | null {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  for (let add = 0; add <= 7; add++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + add);
    d.setUTCHours(h, m, 0, 0);
    if (customDayIndex(d) === dayIndex && d.getTime() >= now.getTime() - 30_000) return d;
  }
  return null;
}

/** Wall-clock "HH:mm" of an instant in the given IANA timezone (DST-correct). */
function formatLocal(instant: Date, timezone: string | undefined): string {
  for (const tz of [timezone, "UTC"]) {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: tz || "UTC",
      }).format(instant);
    } catch {
      /* invalid timezone — fall back to UTC */
    }
  }
  return instant.toISOString().slice(11, 16);
}

let running = false;

async function tick(bot: Bot<BotContext>): Promise<void> {
  if (running) return; // avoid overlapping runs
  running = true;
  try {
    const [lessons, students] = await Promise.all([
      fetchAllLessons(),
      listStudentConnections(),
    ]);
    if (!lessons.length || !students.length) return;

    const byStudent = new Map<string, StudentConnection[]>();
    for (const s of students) {
      const arr = byStudent.get(s.studentId) ?? [];
      arr.push(s);
      byStudent.set(s.studentId, arr);
    }

    const now = new Date();
    const pending = new Map<number, { conn: StudentConnection; keys: string[] }>();

    for (const lesson of lessons) {
      const conns = byStudent.get(lesson.studentId);
      if (!conns) continue;
      const instant = nextOccurrenceUTC(lesson.dayIndex, lesson.time, now);
      if (!instant) continue;
      const diffMin = Math.round((instant.getTime() - now.getTime()) / 60_000);
      const offset = config.reminderOffsets.find((o) => o === diffMin);
      if (offset === undefined) continue;

      const dateStr = instant.toISOString().slice(0, 10);
      const key = `${lesson.id}:${dateStr}:${offset}`;

      for (const conn of conns) {
        if (!conn.remindersEnabled) continue;
        const alreadySent =
          conn.sentReminders.includes(key) || pending.get(conn.telegramUserId)?.keys.includes(key);
        if (alreadySent) continue;

        const subject = lesson.subject
          ? esc(lesson.subject)
          : t(conn.language, "reminder_default_subject");
        const text = t(conn.language, "reminder_message", {
          subject,
          minutes: offset,
          time: formatLocal(instant, lesson.timezone),
        });

        try {
          await bot.api.sendMessage(conn.chatId, text, { parse_mode: "HTML" });
          const entry = pending.get(conn.telegramUserId) ?? { conn, keys: [] };
          entry.keys.push(key);
          pending.set(conn.telegramUserId, entry);
        } catch (err) {
          console.error("reminder send failed:", err);
        }
      }
    }

    await Promise.all(
      [...pending.values()].map((e) =>
        recordSentReminders(e.conn.telegramUserId, e.conn.sentReminders, e.keys).catch((err) =>
          console.error("recordSentReminders failed:", err),
        ),
      ),
    );
  } catch (err) {
    console.error("reminder tick failed:", err);
  } finally {
    running = false;
  }
}

/** Start the once-a-minute reminder loop. Safe to call once at startup. */
export function startReminderScheduler(bot: Bot<BotContext>): void {
  setTimeout(() => void tick(bot), 5_000);
  setInterval(() => void tick(bot), 60_000);
  console.log(
    `⏰ Reminder scheduler started (offsets: ${config.reminderOffsets.join(", ")} min before lessons).`,
  );
}

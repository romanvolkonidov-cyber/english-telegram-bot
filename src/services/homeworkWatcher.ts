import type { Bot } from "grammy";
import { Timestamp, collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import type { BotContext } from "../bot/context.js";
import { listStudentConnections } from "../data/connections.js";
import { t } from "../i18n.js";
import { esc } from "../util/format.js";
import { assignmentTitle } from "../data/homework.js";
import type { HomeworkAssignment } from "../types.js";

/**
 * Watch for newly-assigned homework and DM the student a notification.
 *
 * Uses a realtime Firestore listener bounded to assignments created after the
 * bot started, so it never loads the whole history. The first snapshot (any
 * docs already matching) is ignored — only genuinely new assignments trigger a
 * message. Best-effort: assignments created while the bot is down aren't
 * back-filled.
 */
export function startHomeworkWatcher(bot: Bot<BotContext>): void {
  const since = Timestamp.fromMillis(Date.now());
  const q = query(collection(db, "telegramAssignments"), where("assignedAt", ">", since));
  let initialized = false;

  onSnapshot(
    q,
    async (snap) => {
      if (!initialized) {
        initialized = true;
        return;
      }
      const added = snap.docChanges().filter((c) => c.type === "added");
      if (added.length === 0) return;

      let conns: Awaited<ReturnType<typeof listStudentConnections>>;
      try {
        conns = await listStudentConnections();
      } catch (err) {
        console.error("homework watcher: listConnections failed", err);
        return;
      }
      const byStudent = new Map(conns.map((c) => [c.studentId, c]));

      for (const change of added) {
        const a = { id: change.doc.id, ...(change.doc.data() as object) } as HomeworkAssignment;
        const conn = byStudent.get(a.studentId);
        if (!conn || !conn.remindersEnabled) continue;
        try {
          await bot.api.sendMessage(
            conn.chatId,
            t(conn.language, "new_homework", { topic: esc(assignmentTitle(a)) }),
            { parse_mode: "HTML" },
          );
        } catch (err) {
          console.error("homework watcher: notify failed", err);
        }
      }
    },
    (err) => console.error("homework watcher error:", err),
  );

  console.log("📚 New-homework watcher started.");
}

import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import type { StorageAdapter } from "grammy";
import { tutorDb, col } from "../tutor/firebase.js";
import type { SessionData } from "./context.js";

/**
 * Firestore-backed session storage for grammY. Two wins over the default
 * in-memory store:
 *  1. Sessions SURVIVE a process restart, so a paid lesson resumes exactly where
 *     it left off instead of vanishing if the bot restarts mid-lesson.
 *  2. Memory no longer grows without bound — the default MemorySessionStorage
 *     keeps every session that ever existed in RAM forever, a likely cause of an
 *     out-of-memory crash over time. With a storage adapter, sessions are read/
 *     written per update and not retained.
 *
 * Robustness choices:
 *  - Stored as a JSON string in one field, so Firestore never trips over
 *    `undefined` values (it rejects them) or nested-shape constraints.
 *  - Every op fails SOFT: a Firestore hiccup degrades to a fresh session (read)
 *    or a skipped persist (write) — it never throws into the update pipeline, so
 *    Firestore being briefly unavailable can't crash or stall the bot.
 *  - The running lesson's transcript is capped before storage so a very long
 *    lesson can't approach Firestore's 1 MB document limit. The tutor only ever
 *    feeds the model the last few turns, so this never affects teaching.
 */

const COLLECTION = "sessions";
const MAX_STORED_TURNS = 60;

/** Make a storage-safe copy: cap the (potentially long) tutor transcript. */
function trimForStorage(value: SessionData): SessionData {
  if (value.flow?.kind === "tutor" && value.flow.history.length > MAX_STORED_TURNS) {
    return { ...value, flow: { ...value.flow, history: value.flow.history.slice(-MAX_STORED_TURNS) } };
  }
  return value;
}

export function firestoreSessionStorage(): StorageAdapter<SessionData> {
  return {
    async read(key) {
      try {
        const db = await tutorDb();
        const snap = await getDoc(doc(db, col(COLLECTION), key));
        const raw = snap.exists() ? (snap.data().data as unknown) : undefined;
        return typeof raw === "string" ? (JSON.parse(raw) as SessionData) : undefined;
      } catch (err) {
        console.error("session read failed (using fresh session):", err);
        return undefined;
      }
    },
    async write(key, value) {
      try {
        const db = await tutorDb();
        await setDoc(doc(db, col(COLLECTION), key), {
          data: JSON.stringify(trimForStorage(value)),
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error("session write failed (continuing):", err);
      }
    },
    async delete(key) {
      try {
        const db = await tutorDb();
        await deleteDoc(doc(db, col(COLLECTION), key));
      } catch (err) {
        console.error("session delete failed (continuing):", err);
      }
    },
  };
}

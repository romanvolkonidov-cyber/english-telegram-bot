import { doc, getDoc, setDoc } from "firebase/firestore";
import { tutorDb, col } from "./firebase.js";

/**
 * Word-game image cache.
 *
 * Generating a picture is by far the most expensive part of a round (~$0.04 vs a
 * few tenths of a cent for the Claude call). The same everyday words recur across
 * students ("coffee", "happy", "rain"…), so we cache the Telegram **file_id** of
 * the first picture we send for a word and re-send that on every later round.
 *
 * Re-sending by file_id costs nothing and skips both the image API call AND the
 * upload — Telegram already has the bytes. We store only the small file_id string,
 * so this lives comfortably in Firestore (no blob storage needed).
 */

export interface CachedImage {
  word: string;
  fileId: string;
  createdAt: number;
}

/** Normalize a word to a stable cache key (lowercased, trimmed, spaces→_). */
function keyFor(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, "_");
}

/** The Telegram file_id of a previously-sent picture for this word, or null. */
export async function getCachedImageFileId(word: string): Promise<string | null> {
  const key = keyFor(word);
  if (!key) return null;
  try {
    const db = await tutorDb();
    const snap = await getDoc(doc(db, col("game_images"), key));
    if (snap.exists()) return (snap.data() as CachedImage).fileId ?? null;
  } catch {
    /* cache is best-effort — a miss just means we generate a fresh image */
  }
  return null;
}

/** Remember the file_id of the picture we just sent for this word. */
export async function cacheImageFileId(word: string, fileId: string): Promise<void> {
  const key = keyFor(word);
  if (!key || !fileId) return;
  try {
    const db = await tutorDb();
    await setDoc(doc(db, col("game_images"), key), {
      word: word.trim(),
      fileId,
      createdAt: Date.now(),
    } satisfies CachedImage);
  } catch {
    /* non-fatal — we just won't have it cached next time */
  }
}

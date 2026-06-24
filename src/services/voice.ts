import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { ensureAuth, storage } from "../firebase.js";
import { config } from "../config.js";
import { fetchWithRetry } from "./http.js";

/** Download the bytes of a Telegram file given its API file path. A bounded
 *  timeout + retry so a stalled file CDN can never hang a voice turn forever. */
export async function downloadTelegramFile(filePath: string): Promise<Uint8Array> {
  const url = `https://api.telegram.org/file/bot${config.botToken}/${filePath}`;
  const res = await fetchWithRetry(url, {}, { label: "Telegram file download", attempts: 3, timeoutMs: 20_000 });
  if (!res) throw new Error("Failed to download Telegram file (after retries)");
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Upload a voice answer to Firebase Storage under the same path scheme the
 * website uses, so recordings live alongside web ones and stay re-listenable.
 * Returns the public download URL.
 */
export async function uploadVoiceAnswer(
  bytes: Uint8Array,
  studentId: string,
  assignmentId: string,
  questionId: string,
  contentType = "audio/ogg",
): Promise<string> {
  await ensureAuth();
  const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("mp4") ? "mp4" : "webm";
  const path = `voiceAnswers/${studentId}/${assignmentId}/${questionId}_${Date.now()}.${ext}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, bytes, { contentType });
  return getDownloadURL(fileRef);
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

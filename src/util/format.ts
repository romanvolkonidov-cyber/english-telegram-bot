import type { SerializedTimestamp } from "../types.js";

/** Escape text for Telegram HTML parse mode. Use on ALL dynamic content. */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Normalize an answer for comparison. This is a byte-for-byte port of the
 * website's `normalizeAnswerText` (rv2class/lib/firebase.ts) so the bot
 * grades answers exactly the same way.
 */
export function normalizeAnswerText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/ /g, " ")
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Convert a Firestore-style timestamp (or ISO string) to epoch milliseconds. */
export function toMillis(
  value: SerializedTimestamp | string | number | null | undefined,
): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "object" && "seconds" in value) {
    return value.seconds * 1000;
  }
  return 0;
}

/** Short human date like "3 Jun" / "3 июн". */
export function formatDate(
  value: SerializedTimestamp | string | number | null | undefined,
  locale = "en",
): string {
  const ms = toMillis(value);
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** Split an array into fixed-size chunks (used for inline-keyboard rows). */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Truncate to a max length for button labels. */
export function truncate(s: string, max = 40): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

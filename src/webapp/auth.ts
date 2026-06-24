import crypto from "node:crypto";
import { config } from "../config.js";

/**
 * Validation of Telegram Mini App `initData`.
 *
 * The Mini App frontend receives a signed `initData` string from Telegram
 * (window.Telegram.WebApp.initData). We verify it server-side so the API can trust
 * WHO is playing without a separate login. The signature scheme (per Telegram docs):
 *
 *   secret_key   = HMAC_SHA256(key="WebAppData", message=BOT_TOKEN)
 *   data_check   = the initData params (except `hash`) sorted by key, joined as
 *                  "key=value" with "\n"
 *   expected     = HMAC_SHA256(key=secret_key, message=data_check)  (hex)
 *   valid        ⇔ expected === hash  AND  auth_date is recent
 *
 * Returns the authenticated Telegram user, or null when the data is missing,
 * tampered with, or too old.
 */

export interface WebAppUser {
  telegramId: string;
  firstName: string;
  username?: string;
  /** Telegram UI language code (e.g. "ru", "en") — used to pick the help language. */
  languageCode?: string;
}

/** Max age of an initData payload we'll accept (defends against replay of a leaked string). */
const MAX_AGE_SECONDS = 24 * 60 * 60; // 24h — Telegram refreshes initData per app open

export function validateInitData(initData: string): WebAppUser | null {
  if (!initData || !config.botToken) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get("hash");
  if (!hash) return null;

  // Build the data-check string: every field except `hash`, sorted, "k=v" per line.
  const pairs: string[] = [];
  for (const [key, value] of params) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const expected = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  // Constant-time compare to avoid timing leaks.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // Reject stale payloads.
  const authDate = Number.parseInt(params.get("auth_date") || "0", 10);
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > MAX_AGE_SECONDS) return null;

  // Extract the user object (JSON-encoded in the `user` param).
  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const u = JSON.parse(userRaw) as {
      id?: number;
      first_name?: string;
      username?: string;
      language_code?: string;
    };
    if (!u.id) return null;
    return {
      telegramId: String(u.id),
      firstName: u.first_name ?? "Player",
      username: u.username,
      languageCode: u.language_code,
    };
  } catch {
    return null;
  }
}

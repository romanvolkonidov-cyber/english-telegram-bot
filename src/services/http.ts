/**
 * Shared resilient HTTP for the Gemini media/STT calls. Google's generative
 * endpoints regularly return sporadic 500 (INTERNAL), 503 (UNAVAILABLE) and 429
 * (quota) errors that succeed on a quick retry, so every voice/image/STT call
 * goes through here: a hard per-request timeout plus automatic retries with
 * exponential backoff on transient failures (network errors, timeouts, and HTTP
 * 408/409/425/429/5xx/529). Non-retryable errors (400/401/403/404) fail fast.
 *
 * Returns the successful Response with its body unread (the caller parses it), or
 * null once every attempt is exhausted. (Claude has its own equivalent layer in
 * claude.ts, with extra handling for empty 200 bodies.)
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

/** Exponential backoff with jitter: ~0.6s, 1.2s, 2.4s … */
function backoffMs(attempt: number): number {
  return Math.round(0.6 * 2 ** (attempt - 1) * 1000 * (0.85 + Math.random() * 0.3));
}

export interface RetryOptions {
  /** Total attempts including the first (default 4). */
  attempts?: number;
  /** Per-request timeout in ms (default 30000). */
  timeoutMs?: number;
  /** Label used in error logs (e.g. "Gemini TTS"). */
  label?: string;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {},
): Promise<Response | null> {
  const attempts = opts.attempts ?? 4;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const label = opts.label ?? "request";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.ok) return res;
      const retryable = RETRYABLE_STATUS.has(res.status);
      const willRetry = retryable && attempt < attempts;
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      console.error(
        `${label} error: ${res.status} ${detail} (attempt ${attempt}/${attempts}` +
          `${willRetry ? ", retrying" : retryable ? ", gave up" : ""})`,
      );
      if (!willRetry) return null; // non-retryable, or out of attempts
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
    } catch (err) {
      const aborted = (err as { name?: string })?.name === "AbortError";
      console.error(
        `${label} ${aborted ? `timed out after ${timeoutMs}ms` : "network error"}` +
          ` (attempt ${attempt}/${attempts})${aborted ? "" : ": " + String(err)}`,
      );
      if (attempt === attempts) return null;
      await sleep(backoffMs(attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

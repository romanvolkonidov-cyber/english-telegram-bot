import { config, hasAnthropic, hasBedrock, hasClaudeAWS } from "../config.js";
import { claudeCostUsd } from "../tutor/pricing.js";

/**
 * Client for talking to Claude (the /learn AI tutor). Picks whichever backend is
 * configured — Claude Platform on AWS, Amazon Bedrock, or the direct Anthropic
 * API — and returns the reply text plus the real USD cost of the call (from the
 * response usage), so the tutor can meter spend against the student's wallet.
 * Raw fetch throughout, so no SDK dependency (mirrors services/gemini.ts).
 */

/** A content block — plain text, or an image for vision (grounded picture tasks). */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export interface ClaudeMessage {
  role: "user" | "assistant";
  /** A string for normal turns, or blocks when showing the tutor an image to look at. */
  content: string | ContentBlock[];
}

export interface ClaudeCall {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Cache the (large, stable) system prompt — supported on Anthropic & AWS. */
  cacheSystem?: boolean;
  /** Assistant turn prefill: Claude MUST continue from this string (e.g. "{" forces JSON). */
  prefill?: string;
}

export interface ClaudeResult {
  text: string;
  costUsd: number;
}

/** Parse a Messages-API response body (same shape on every backend). */
function parseResult(data: unknown): ClaudeResult | null {
  const d = data as {
    content?: { type: string; text?: string }[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  const text = (d.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
  if (!text) return null;
  const u = d.usage ?? {};
  const costUsd = claudeCostUsd({
    input: u.input_tokens,
    output: u.output_tokens,
    cacheRead: u.cache_read_input_tokens,
    cacheWrite: u.cache_creation_input_tokens,
  });
  return { text, costUsd };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** HTTP statuses worth retrying: rate limit, transient server errors, overload. */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 30_000; // well above normal tutor-turn latency (~5–15s)

/** Exponential backoff with jitter: ~0.8s, 1.6s, 3.2s … */
function backoffMs(attempt: number): number {
  return Math.round(0.8 * 2 ** (attempt - 1) * 1000 * (0.85 + Math.random() * 0.3));
}

/**
 * POST to a Messages-API endpoint with a hard per-request timeout and automatic
 * retries on transient failures: network errors, request timeouts, HTTP 429/5xx/
 * 529, and even a 200 with an empty/unusable body. Returns the parsed result, or
 * null only after every attempt is exhausted. This is the single resilience layer
 * behind every backend, so a brief API hiccup never reaches the student.
 */
async function postMessages(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  label: string,
): Promise<ClaudeResult | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.ok) {
        const parsed = parseResult(await res.json());
        if (parsed) return parsed;
        console.error(`${label}: 200 but empty/unusable body (attempt ${attempt}/${MAX_ATTEMPTS})`);
      } else {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        const retryable = RETRYABLE_STATUS.has(res.status);
        const willRetry = retryable && attempt < MAX_ATTEMPTS;
        console.error(
          `${label} API error: ${res.status} ${detail} (attempt ${attempt}/${MAX_ATTEMPTS}` +
            `${willRetry ? ", retrying" : retryable ? ", gave up" : ""})`,
        );
        if (!retryable) return null; // 400/401/403 etc. won't fix themselves
        const retryAfter = Number(res.headers.get("retry-after"));
        if (attempt < MAX_ATTEMPTS) {
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
        }
        continue;
      }
    } catch (err) {
      const aborted = (err as { name?: string })?.name === "AbortError";
      console.error(
        `${label} ${aborted ? `timed out after ${REQUEST_TIMEOUT_MS}ms` : "network error"}` +
          ` (attempt ${attempt}/${MAX_ATTEMPTS})${aborted ? "" : ": " + String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(attempt));
  }
  return null;
}

function withPrefill(messages: ClaudeMessage[], prefill?: string): ClaudeMessage[] {
  if (!prefill) return messages;
  return [...messages, { role: "assistant", content: prefill }];
}

/** When a prefill was sent (an assistant turn the model continues), the response
 *  body contains only the CONTINUATION — put the prefill back so callers always
 *  receive the complete text. (Backends that ignore prefill must NOT call this.) */
function prependPrefill(r: ClaudeResult | null, prefill?: string): ClaudeResult | null {
  if (r && prefill && !r.text.trimStart().startsWith(prefill.trim())) {
    r.text = prefill + r.text;
  }
  return r;
}

async function callBedrock(opts: ClaudeCall): Promise<ClaudeResult | null> {
  if (!config.bedrockModelId) {
    console.error("Bedrock is configured but BEDROCK_MODEL_ID is empty.");
    return null;
  }
  const url =
    `https://bedrock-runtime.${config.bedrockRegion}.amazonaws.com` +
    `/model/${encodeURIComponent(config.bedrockModelId)}/invoke`;
  return prependPrefill(
    await postMessages(
      url,
      {
        Authorization: `Bearer ${config.bedrockApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.6,
        system: opts.system,
        messages: withPrefill(opts.messages, opts.prefill),
      },
      "Bedrock",
    ),
    opts.prefill,
  );
}

async function callAnthropic(opts: ClaudeCall): Promise<ClaudeResult | null> {
  const system = opts.cacheSystem
    ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
    : opts.system;
  return prependPrefill(
    await postMessages(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      {
        model: config.claudeModel,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.6,
        system,
        messages: withPrefill(opts.messages, opts.prefill),
      },
      "Claude",
    ),
    opts.prefill,
  );
}

async function callClaudeAWS(opts: ClaudeCall): Promise<ClaudeResult | null> {
  const system = opts.cacheSystem
    ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
    : opts.system;
  const url = `https://aws-external-anthropic.${config.awsRegion}.api.aws/v1/messages`;
  return postMessages(
    url,
    {
      Authorization: `Bearer ${config.awsApiKey}`,
      "anthropic-workspace-id": config.awsWorkspaceId,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    {
      model: config.claudeModel, // bare first-party id, e.g. claude-opus-4-8
      max_tokens: opts.maxTokens ?? 1024,
      // temperature omitted — claude-opus-4-8 and later deprecate this parameter
      system,
      messages: opts.messages, // AWS gateway does not support assistant prefill
    },
    "Claude (AWS)",
  );
}

/** Send a request to whichever Claude backend is configured. */
export async function callClaude(opts: ClaudeCall): Promise<ClaudeResult | null> {
  if (hasClaudeAWS) return callClaudeAWS(opts);
  if (hasBedrock) return callBedrock(opts);
  if (hasAnthropic) return callAnthropic(opts);
  return null;
}

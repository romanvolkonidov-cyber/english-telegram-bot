import { config, hasAnthropic, hasBedrock } from "../config.js";

/**
 * Client for talking to Claude (the /learn AI tutor). Supports two backends and
 * picks whichever is configured:
 *   1. Amazon Bedrock ("Claude on AWS") — a bearer-token API key, model id in
 *      the URL, `anthropic_version: "bedrock-2023-05-31"` in the body.
 *   2. The direct Anthropic API — `x-api-key`, model in the body, prompt caching.
 * Raw fetch either way, so no SDK dependency (mirrors services/gemini.ts).
 */

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeCall {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Cache the (large, stable) system prompt — direct Anthropic API only. */
  cacheSystem?: boolean;
}

/** Pull the text out of a Messages-API response body (same shape on both backends). */
function extractText(data: unknown): string | null {
  const blocks = (data as { content?: { type: string; text?: string }[] }).content ?? [];
  const text = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  return text.trim() || null;
}

async function callBedrock(opts: ClaudeCall): Promise<string | null> {
  if (!config.bedrockModelId) {
    console.error("Bedrock is configured but BEDROCK_MODEL_ID is empty.");
    return null;
  }
  const url =
    `https://bedrock-runtime.${config.bedrockRegion}.amazonaws.com` +
    `/model/${encodeURIComponent(config.bedrockModelId)}/invoke`;
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.6,
    system: opts.system,
    messages: opts.messages,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.bedrockApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Bedrock API error:", res.status, await res.text());
      return null;
    }
    return extractText(await res.json());
  } catch (err) {
    console.error("callBedrock error:", err);
    return null;
  }
}

async function callAnthropic(opts: ClaudeCall): Promise<string | null> {
  const system = opts.cacheSystem
    ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
    : opts.system;

  const body: Record<string, unknown> = {
    model: config.claudeModel,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.6,
    system,
    messages: opts.messages,
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Claude API error:", res.status, await res.text());
      return null;
    }
    return extractText(await res.json());
  } catch (err) {
    console.error("callClaude error:", err);
    return null;
  }
}

/** Send a request to whichever Claude backend is configured. */
export async function callClaude(opts: ClaudeCall): Promise<string | null> {
  if (hasBedrock) return callBedrock(opts);
  if (hasAnthropic) return callAnthropic(opts);
  return null;
}

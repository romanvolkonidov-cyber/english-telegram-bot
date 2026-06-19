import { config, hasAnthropic } from "../config.js";

/**
 * Thin client for the Anthropic Messages API (used by the /learn AI tutor).
 * Uses raw fetch so we add no dependency, mirroring services/gemini.ts.
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
  /** Cache the (large, stable) system prompt to cut cost on every follow-up turn. */
  cacheSystem?: boolean;
}

export async function callClaude(opts: ClaudeCall): Promise<string | null> {
  if (!hasAnthropic) return null;

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

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    return text.trim() || null;
  } catch (err) {
    console.error("callClaude error:", err);
    return null;
  }
}

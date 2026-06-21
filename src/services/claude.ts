import { config, hasAnthropic, hasBedrock, hasClaudeAWS } from "../config.js";
import { claudeCostUsd } from "../tutor/pricing.js";

/**
 * Client for talking to Claude (the /learn AI tutor). Picks whichever backend is
 * configured — Claude Platform on AWS, Amazon Bedrock, or the direct Anthropic
 * API — and returns the reply text plus the real USD cost of the call (from the
 * response usage), so the tutor can meter spend against the student's wallet.
 * Raw fetch throughout, so no SDK dependency (mirrors services/gemini.ts).
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
  /** Cache the (large, stable) system prompt — supported on Anthropic & AWS. */
  cacheSystem?: boolean;
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

async function callBedrock(opts: ClaudeCall): Promise<ClaudeResult | null> {
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
    return parseResult(await res.json());
  } catch (err) {
    console.error("callBedrock error:", err);
    return null;
  }
}

async function callAnthropic(opts: ClaudeCall): Promise<ClaudeResult | null> {
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
    return parseResult(await res.json());
  } catch (err) {
    console.error("callClaude error:", err);
    return null;
  }
}

async function callClaudeAWS(opts: ClaudeCall): Promise<ClaudeResult | null> {
  const system = opts.cacheSystem
    ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
    : opts.system;
  const body: Record<string, unknown> = {
    model: config.claudeModel, // bare first-party id, e.g. claude-sonnet-4-6
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.6,
    system,
    messages: opts.messages,
  };
  const url = `https://aws-external-anthropic.${config.awsRegion}.api.aws/v1/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.awsApiKey}`,
        "anthropic-workspace-id": config.awsWorkspaceId,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Claude (AWS) API error:", res.status, await res.text());
      return null;
    }
    return parseResult(await res.json());
  } catch (err) {
    console.error("callClaudeAWS error:", err);
    return null;
  }
}

/** Send a request to whichever Claude backend is configured. */
export async function callClaude(opts: ClaudeCall): Promise<ClaudeResult | null> {
  if (hasClaudeAWS) return callClaudeAWS(opts);
  if (hasBedrock) return callBedrock(opts);
  if (hasAnthropic) return callAnthropic(opts);
  return null;
}

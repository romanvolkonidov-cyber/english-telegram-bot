import "dotenv/config";

/**
 * Central configuration, loaded from environment variables.
 *
 * The Firebase config below is the SAME public web config used by the
 * rv2class website and the rv-website admin panel (Firebase project
 * "tracking-budget-app"). It is a public client config — security is
 * enforced by Firestore/Storage rules, not by hiding these values — so it
 * is safe to keep in source. Real secrets (bot token, Gemini key) come
 * from the environment and are never committed.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

export type Language = "en" | "ru";

const defaultLanguage = (process.env.DEFAULT_LANGUAGE || "en").toLowerCase();

/** Parse "60,10" → [60, 10] (minutes before a lesson to remind). */
function parseOffsets(raw: string | undefined): number[] {
  const parsed = (raw || "60,10")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length ? Array.from(new Set(parsed)).sort((a, b) => b - a) : [60, 10];
}

export const config = {
  botToken: required("BOT_TOKEN"),

  /** Optional — voice answers still work without it (no instant AI feedback). */
  geminiApiKey: (process.env.GEMINI_API || "").trim(),

  /** Anthropic key powering the /learn AI tutor. Without it, /learn is disabled. */
  anthropicApiKey: (process.env.ANTHROPIC_API_KEY || "").trim(),

  /** Claude model used to teach (direct Anthropic API). */
  claudeModel: (process.env.CLAUDE_MODEL || "claude-opus-4-8").trim(),

  /**
   * Alternative to the direct Anthropic API: Amazon Bedrock ("Claude on AWS").
   * A Bedrock API key is a single bearer token (not an sk-ant- key), used against
   * the Bedrock endpoint with `Authorization: Bearer`. Set the key, the AWS
   * region you enabled Claude in, and the model/inference-profile id.
   */
  bedrockApiKey: (process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.BEDROCK_API_KEY || "").trim(),
  bedrockRegion: (process.env.AWS_REGION || process.env.BEDROCK_REGION || "us-east-1").trim(),
  bedrockModelId: (
    process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
  ).trim(),

  /**
   * Claude Platform on AWS ("Claude on AWS") — Anthropic-operated, full API
   * parity. The long-term API key is used as a bearer token against
   * aws-external-anthropic.<region>.api.aws, with an anthropic-workspace-id
   * header. Model ids are the bare first-party strings (see claudeModel).
   */
  awsApiKey: (process.env.ANTHROPIC_AWS_API_KEY || "").trim(),
  awsWorkspaceId: (process.env.ANTHROPIC_AWS_WORKSPACE_ID || "").trim(),
  awsRegion: (process.env.AWS_REGION || "us-east-1").trim(),

  /** Gemini model for the tutor's voice (TTS) — reuses GEMINI_API. */
  geminiTtsModel: (process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts").trim(),
  geminiTtsVoice: (process.env.GEMINI_TTS_VOICE || "Kore").trim(),
  /** Image model for vocabulary pictures (reuses GEMINI_API). Defaults to a
   *  Gemini flash-image model (generateContent). Set IMAGEN_IMAGE_MODEL=imagen-4…
   *  to use Imagen via the :predict endpoint instead. media.ts auto-detects which. */
  imagenImageModel: (process.env.IMAGEN_IMAGE_MODEL || "gemini-2.5-flash-image").trim(),

  /** Teacher login used inside the bot. Defaults match the website. */
  adminUsername: (process.env.ADMIN_USERNAME || "admin").trim(),
  adminPassword: (process.env.ADMIN_PASSWORD || "2206").trim(),

  defaultLanguage: (defaultLanguage === "ru" ? "ru" : "en") as Language,

  /** Minutes before a lesson to send reminders (e.g. [60, 10]). */
  reminderOffsets: parseOffsets(process.env.REMINDER_OFFSETS),

  /** Also send a 09:00 (lesson-local) "today" reminder when the lesson is at/after 09:00. */
  morningReminder: (process.env.MORNING_REMINDER || "true").toLowerCase() !== "false",

  /** Shared Firebase project with the website (tracking-budget-app). */
  firebase: {
    apiKey: "AIzaSyApqg1eUjbt0ZBzn3JNEPtfLz6gI4314xQ",
    authDomain: "tracking-budget-app.firebaseapp.com",
    databaseURL: "https://tracking-budget-app-default-rtdb.firebaseio.com",
    projectId: "tracking-budget-app",
    storageBucket: "tracking-budget-app.appspot.com",
    messagingSenderId: "912992088190",
    appId: "1:912992088190:web:926c8826b3bc39e2eb282f",
  },

  /**
   * Separate Firebase project for the AI tutor (keeps learner data apart from
   * the homework/budget backend). Filled from TUTOR_FB_* env vars. If left
   * blank, the tutor falls back to the shared project above, namespacing its
   * collections with a `tutor_` prefix so nothing collides.
   */
  tutorFirebase: {
    apiKey: (process.env.TUTOR_FB_API_KEY || "").trim(),
    authDomain: (process.env.TUTOR_FB_AUTH_DOMAIN || "").trim(),
    projectId: (process.env.TUTOR_FB_PROJECT_ID || "").trim(),
    storageBucket: (process.env.TUTOR_FB_STORAGE_BUCKET || "").trim(),
    messagingSenderId: (process.env.TUTOR_FB_SENDER_ID || "").trim(),
    appId: (process.env.TUTOR_FB_APP_ID || "").trim(),
  },
} as const;

export const hasGemini = config.geminiApiKey.length > 0;

/** A direct Anthropic API key is configured. */
export const hasAnthropic = config.anthropicApiKey.length > 0;

/** An Amazon Bedrock ("Claude on AWS") key is configured. */
export const hasBedrock = config.bedrockApiKey.length > 0;

/** Claude Platform on AWS (Anthropic-operated) is configured. */
export const hasClaudeAWS =
  config.awsApiKey.length > 0 && config.awsWorkspaceId.length > 0;

/** The /learn AI tutor works if any Claude backend is configured. */
export const hasTutorLLM = hasAnthropic || hasBedrock || hasClaudeAWS;

/** Whether a dedicated tutor Firebase project is configured (vs. shared fallback). */
export const hasTutorFirebase =
  config.tutorFirebase.apiKey.length > 0 && config.tutorFirebase.projectId.length > 0;

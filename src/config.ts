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

  /**
   * DeepSeek key (env var DEEPSEEK). When set, it takes PRIORITY over every Claude
   * backend for the tutor and word game — DeepSeek is far cheaper. It speaks the
   * Anthropic Messages API via https://api.deepseek.com/anthropic, so the same
   * request/response plumbing in services/claude.ts is reused unchanged.
   */
  deepseekApiKey: (process.env.DEEPSEEK || process.env.DEEPSEEK_API_KEY || "").trim(),

  /** DeepSeek model for both the tutor and the word game. v4-flash is fast & cheap. */
  deepseekModel: (process.env.DEEPSEEK_MODEL || "deepseek-v4-flash").trim(),

  /**
   * Telegram Mini App (the word game web app).
   * - webappUrl: the HTTPS URL Telegram opens (e.g. https://bot.wellversed.live). When
   *   set, the bot's menu button becomes an "Open" Web App button and the word-game
   *   entry points launch the Mini App instead of the in-chat flow.
   * - webappOrigin: the browser origin allowed to call the API (CORS). Usually the
   *   same as webappUrl's origin.
   * - webappApiPort: local port the in-process API server listens on (a reverse proxy
   *   like Caddy terminates TLS and forwards api.<domain> here).
   */
  webappUrl: (process.env.WEBAPP_URL || "").trim(),
  webappOrigin: (process.env.WEBAPP_ORIGIN || process.env.WEBAPP_URL || "").trim(),
  webappApiPort: Number.parseInt(process.env.WEBAPP_API_PORT || "8081", 10),

  /** Telegram user IDs that play the Mini App for free (owner/testers). Comma-separated. */
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  /** Claude model used to teach (direct Anthropic API). */
  claudeModel: (process.env.CLAUDE_MODEL || "claude-sonnet-4-6").trim(),

  /** Cheaper/faster model for simple checks (e.g. the word-game verification pass). */
  claudeFastModel: (process.env.CLAUDE_FAST_MODEL || "claude-haiku-4-5-20251001").trim(),

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

/** A DeepSeek key is configured (preferred backend — cheapest). */
export const hasDeepseek = config.deepseekApiKey.length > 0;

/** The word-game Mini App URL is configured (enables the Web App launch + API). */
export const hasWebapp = config.webappUrl.length > 0;

/** A direct Anthropic API key is configured. */
export const hasAnthropic = config.anthropicApiKey.length > 0;

/** An Amazon Bedrock ("Claude on AWS") key is configured. */
export const hasBedrock = config.bedrockApiKey.length > 0;

/** Claude Platform on AWS (Anthropic-operated) is configured. */
export const hasClaudeAWS =
  config.awsApiKey.length > 0 && config.awsWorkspaceId.length > 0;

/**
 * The /learn AI tutor + word game run on DeepSeek only — Claude is turned off
 * (too expensive). hasAnthropic/hasBedrock/hasClaudeAWS are kept above so Claude
 * can be re-enabled later, but they no longer gate the tutor.
 */
export const hasTutorLLM = hasDeepseek;

/** Whether a dedicated tutor Firebase project is configured (vs. shared fallback). */
export const hasTutorFirebase =
  config.tutorFirebase.apiKey.length > 0 && config.tutorFirebase.projectId.length > 0;

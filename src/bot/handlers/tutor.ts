import { InlineKeyboard, InputFile } from "grammy";
import type { BotContext, Flow } from "../context.js";
import { startLoadingHints } from "../loadingHints.js";
import { esc } from "../../util/format.js";
import { config, hasTutorLLM, hasGemini } from "../../config.js";
import {
  getTopic,
  getLesson,
  nextLesson,
  topicsBy,
  levelsForCourse,
  type MicroLesson,
  type CEFRLevel,
  type TargetLanguage,
} from "../../tutor/curriculum.js";
import {
  getAllProgress,
  getLessonProgress,
  setLessonMastery,
  upsertProfile,
} from "../../tutor/learnerModel.js";
import {
  getTutorReply,
  describeImageTurn,
  extractLearnedWords,
  nextMastery,
  type TutorTurnResult,
} from "../../tutor/engine.js";
import type { LearnerProfile, LessonContext } from "../../tutor/types.js";
import { downloadTelegramFile, toBase64 } from "../../services/voice.js";
import { transcribeSpeech } from "../../services/gemini.js";
import { synthesizeSpeech, generateImage, type GeneratedImage } from "../../services/media.js";
import { notifyAdmins } from "../../services/adminNotify.js";
import {
  getWallet,
  debit,
  refund,
  creditAllowance,
  markFreeLessonUsed,
} from "../../tutor/wallet.js";
import {
  PACKAGES,
  packageById,
  approxLessons,
  starsPerLesson,
  MEDIA_COST_USD,
  LESSON_BUDGET_USD,
  STAR_NET_USD,
  FREE_TRIAL_ENABLED,
} from "../../tutor/pricing.js";

type TutorFlow = Extract<Flow, { kind: "tutor" }>;

function tutorFlow(ctx: BotContext): TutorFlow | null {
  return ctx.session.flow?.kind === "tutor" ? ctx.session.flow : null;
}

const MARKS = ["▫️", "▪️", "🔸", "✅"] as const;
function mark(mastery: number): string {
  return MARKS[Math.max(0, Math.min(3, mastery))]!;
}

function telegramId(ctx: BotContext): string {
  return String(ctx.from?.id ?? "");
}

/** Convert the tutor's light Markdown to valid Telegram HTML (Bot API rich text). */
function renderTutorHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/__(.+?)__/g, "<u>$1</u>")
      .replace(/\*(?!\s)([^*\n]+?)(?<!\s)\*/g, "<i>$1</i>")
      .replace(/~~(.+?)~~/g, "<s>$1</s>")
      .replace(/`(.+?)`/g, "<code>$1</code>");

  const out: string[] = [];
  let quote: string[] = [];
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote>${quote.join("\n")}</blockquote>`);
      quote = [];
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    // Horizontal rule (---, ***) → drop (Telegram can't render it).
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushQuote();
      continue;
    }
    // Markdown table separator row (|---|:--:|) → drop.
    if (line.includes("|") && /^\s*\|?[\s:|-]+\|?\s*$/.test(line)) {
      flushQuote();
      continue;
    }
    // Heading (#, ##, …) → bold line.
    const h = line.match(/^\s*#{1,6}\s+(.+)$/);
    if (h) {
      flushQuote();
      out.push(`<b>${inline(h[1]!)}</b>`);
      continue;
    }
    // Blockquote line ("> …") → grouped into one <blockquote>.
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) {
      quote.push(inline(q[1]!));
      continue;
    }
    flushQuote();
    // Table row "| a | b |" → de-pipe into spaced cells.
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => inline(c.trim()))
        .filter(Boolean);
      out.push(cells.join("  "));
      continue;
    }
    // Bullet ("- " / "* ") → "• ".
    const b = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (b) {
      out.push(`${b[1]}• ${inline(b[2]!)}`);
      continue;
    }
    out.push(inline(line));
  }
  flushQuote();
  return out.join("\n");
}

// Whether Telegram's sendRichMessage is available for this bot (cached after the
// first attempt; null = unknown, false = method not enabled → use HTML instead).
let richMessageAvailable: boolean | null = null;

/**
 * Try Telegram's new sendRichMessage (full Markdown: tables, headings, quotes,
 * details, etc.). Returns true if sent. Called via raw fetch since grammY has no
 * typed wrapper yet. Disables itself permanently if the method isn't enabled.
 */
async function sendRichMarkdown(
  ctx: BotContext,
  markdown: string,
  keyboard?: InlineKeyboard,
): Promise<boolean> {
  if (richMessageAvailable === false) return false;
  const chatId = ctx.chat?.id;
  if (!chatId || !markdown.trim()) return false;
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      rich_message: { markdown },
    };
    if (keyboard) body.reply_markup = { inline_keyboard: keyboard.inline_keyboard };
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendRichMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; error_code?: number; description?: string };
    if (data.ok) {
      richMessageAvailable = true;
      return true;
    }
    // Method not found / not enabled → stop trying for the rest of the process.
    const desc = (data.description || "").toLowerCase();
    if (data.error_code === 404 || desc.includes("not found") || desc.includes("unknown")) {
      richMessageAvailable = false;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Send a tutor message with formatting. Prefer Telegram rich messages (native
 * tables/headings/quotes); fall back to parse_mode HTML, then plain text.
 */
async function replyRich(
  ctx: BotContext,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  if (await sendRichMarkdown(ctx, text, keyboard)) return;
  try {
    await ctx.reply(renderTutorHtml(text), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard,
    });
  } catch {
    try {
      await ctx.reply(text, { reply_markup: keyboard });
    } catch {
      /* ignore */
    }
  }
}

/** Pick Russian or English text by the bot's current language (set in the menu). */
function tr(ctx: BotContext, ru: string, en: string): string {
  return ctx.session.lang === "en" ? en : ru;
}

/** Short codes used in callback data for the target language of a course. */
const TARGET_CODE: Record<TargetLanguage, string> = { English: "en", Portuguese: "pt" };
function codeToTarget(code: string): TargetLanguage {
  return code === "pt" ? "Portuguese" : "English";
}
/** Localized display name of a target language. */
function targetName(ctx: BotContext, t: TargetLanguage): string {
  return t === "Portuguese"
    ? tr(ctx, "Португальский", "Portuguese")
    : tr(ctx, "Английский", "English");
}

/** Build/refresh the learner profile, syncing the tutor's help language to the
 *  BOT's language (chosen from the main menu): ru → Russian, en → English. */
async function ensureProfile(ctx: BotContext): Promise<LearnerProfile> {
  const id = telegramId(ctx);
  const nativeLanguage = ctx.session.lang === "en" ? "English" : "Russian";
  return upsertProfile(id, {
    name: ctx.session.name ?? ctx.from?.first_name,
    nativeLanguage,
    level: "A1",
  });
}

function lessonContext(topicId: number, lesson: MicroLesson): LessonContext {
  const topic = getTopic(topicId)!;
  return {
    topicId,
    level: topic.level,
    target: topic.target,
    topicTitle: topic.title,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    focus: lesson.focus,
    canDo: lesson.canDo,
    grammar: lesson.grammar,
    vocab: lesson.vocab,
    fn: lesson.fn,
    note: lesson.note,
  };
}

// ── Menus ───────────────────────────────────────────────────────────────────

/** Entry point: /learn. */
export async function learnCommand(ctx: BotContext): Promise<void> {
  if (!hasTutorLLM) {
    await ctx.reply(
      "🤖 The AI tutor isn't set up yet. Add a Claude key — either ANTHROPIC_API_KEY, " +
        "or Claude-on-AWS (ANTHROPIC_AWS_API_KEY + ANTHROPIC_AWS_WORKSPACE_ID).",
    );
    return;
  }
  await ensureProfile(ctx);
  await showLevelPicker(ctx);
}

const LEVEL_LABEL: Record<CEFRLevel, { ru: string; en: string }> = {
  A1: { ru: "Начальный", en: "Beginner" },
  A2: { ru: "Элементарный", en: "Elementary" },
  B1: { ru: "Средний", en: "Intermediate" },
};

/** First self-study screen: choose a level. Topics/lessons appear only after this. */
export async function showLevelPicker(
  ctx: BotContext,
  target: TargetLanguage = "English",
): Promise<void> {
  ctx.session.flow = undefined;
  const isAdmin = ctx.session.role === "teacher";
  // Portuguese is offered to teachers/admin only; students always get English.
  if (target === "Portuguese" && !isAdmin) target = "English";
  const levels = levelsForCourse(target);
  const code = TARGET_CODE[target];

  const kb = new InlineKeyboard();
  for (const lv of levels) {
    const label = LEVEL_LABEL[lv];
    kb.text(`${lv} — ${tr(ctx, label.ru, label.en)}`, `lrn:c:${code}:${lv}`).row();
  }
  // Teachers can switch the target language; the picker then reloads its levels.
  if (isAdmin) {
    kb.text(`${target === "English" ? "🔵 " : ""}🇬🇧 English`, "lrn:lang:en")
      .text(`${target === "Portuguese" ? "🔵 " : ""}🇵🇹 Português`, "lrn:lang:pt")
      .row();
  }
  kb.text(tr(ctx, "🏠 Меню", "🏠 Menu"), "menu");

  const name = targetName(ctx, target);
  await ctx.reply(
    tr(
      ctx,
      `📚 <b>${name} — выбери уровень</b>\nС какого уровня начнём? Потом откроются темы и уроки.`,
      `📚 <b>${name} — choose your level</b>\nWhere shall we start? Topics and lessons open after you pick.`,
    ),
    { parse_mode: "HTML", reply_markup: kb },
  );
}

/** Callback entry: show a course by its short code (en/pt) + level. */
export async function showCourse(ctx: BotContext, code: string, level: string): Promise<void> {
  const lv: CEFRLevel = level === "B1" ? "B1" : level === "A2" ? "A2" : "A1";
  await showTopics(ctx, codeToTarget(code), lv);
}

/** Teacher switches the target language on the level picker. */
export async function showLevelPickerFor(ctx: BotContext, code: string): Promise<void> {
  await showLevelPicker(ctx, codeToTarget(code));
}

export async function showTopics(
  ctx: BotContext,
  target: TargetLanguage = "English",
  level: CEFRLevel = "A1",
): Promise<void> {
  ctx.session.flow = undefined; // leaving any running lesson
  const id = telegramId(ctx);
  const isAdmin = ctx.session.role === "teacher";
  // Portuguese is offered to teachers/admin only; students always get English.
  if (target === "Portuguese" && !isAdmin) target = "English";
  const levels = levelsForCourse(target);
  if (!levels.includes(level)) level = levels[0] ?? "A1";
  const code = TARGET_CODE[target];

  const [progress, wallet] = await Promise.all([
    getAllProgress(id).catch(() => []),
    isAdmin ? Promise.resolve(null) : getWallet(id).catch(() => null),
  ]);
  const masteredByTopic = new Map<number, number>();
  for (const p of progress) {
    if (p.mastery >= 3) masteredByTopic.set(p.topicId, (masteredByTopic.get(p.topicId) ?? 0) + 1);
  }

  const kb = new InlineKeyboard();
  // Number topics within their course (so each level's first unit shows as "1").
  topicsBy(target, level).forEach((topic, i) => {
    const done = masteredByTopic.get(topic.id) ?? 0;
    const tick = done >= topic.lessons.length ? "✅ " : "";
    kb.text(`${tick}${i + 1}. ${topic.title} (${done}/${topic.lessons.length})`, `lrn:t:${topic.id}`).row();
  });
  // Back to the level picker (the first self-study screen) — language/level are
  // chosen there now, so the topic list stays focused on this one level.
  kb.text(tr(ctx, "⬅️ Уровни", "⬅️ Levels"), `lrn:levels:${code}`).row();

  // Wallet line and buy button: hidden for admin (teacher).
  let walletLine = "";
  if (!isAdmin) {
    const balanceLessons = approxLessons(wallet?.balanceUsd ?? 0);
    walletLine =
      FREE_TRIAL_ENABLED && !wallet?.freeLessonUsed
        ? tr(ctx, "🎁 <b>Первый урок бесплатно!</b>", "🎁 <b>First lesson is free!</b>")
        : tr(
            ctx,
            `💎 На балансе: <b>≈ ${balanceLessons} ур.</b>`,
            `💎 Balance: <b>≈ ${balanceLessons} lessons</b>`,
          );
    kb.text(tr(ctx, "💎 Купить уроки", "💎 Buy lessons"), "lrn:buy").row();
  }

  const name = targetName(ctx, target);
  const header = tr(
    ctx,
    `📚 <b>${name} ${level} — выбери тему</b>\nИдём шаг за шагом. Нажми тему, затем урок.`,
    `📚 <b>${name} ${level} — choose a topic</b>\nWe'll go step by step. Tap a topic, then a lesson.`,
  );
  const fullText = walletLine ? `${header}\n\n${walletLine}` : header;
  await ctx.reply(fullText, { parse_mode: "HTML", reply_markup: kb });
}

export async function showLessons(ctx: BotContext, topicId: number): Promise<void> {
  ctx.session.flow = undefined;
  const topic = getTopic(topicId);
  if (!topic) return await showTopics(ctx);

  const progress = await getAllProgress(telegramId(ctx)).catch(() => []);
  const masteryByLesson = new Map(
    progress.filter((p) => p.topicId === topicId).map((p) => [p.lessonId, p.mastery]),
  );

  const kb = new InlineKeyboard();
  for (const lesson of topic.lessons) {
    const m = masteryByLesson.get(lesson.id) ?? 0;
    kb.text(`${mark(m)} ${lesson.title}`, `lrn:l:${topicId}:${lesson.id}`).row();
  }
  kb.text(tr(ctx, "⬅️ Темы", "⬅️ Topics"), `lrn:c:${TARGET_CODE[topic.target]}:${topic.level}`);

  await ctx.reply(
    `📖 <b>${esc(topic.title)}</b>\n${esc(topic.summary)}`,
    { parse_mode: "HTML", reply_markup: kb },
  );
}

// ── Lesson lifecycle ─────────────────────────────────────────────────────────

export async function startLesson(
  ctx: BotContext,
  topicId: number,
  lessonId: string,
): Promise<void> {
  const lesson = getLesson(topicId, lessonId);
  const topic = getTopic(topicId);
  if (!lesson || !topic) return await showTopics(ctx);

  // Wallet check: the first lesson ever is free; after that a lesson needs balance.
  // Admin (teacher) can start lessons without payment.
  const id = telegramId(ctx);
  const wallet = await getWallet(id).catch(() => null);
  const isAdmin = ctx.session.role === "teacher";
  const free = isAdmin || (FREE_TRIAL_ENABLED && !wallet?.freeLessonUsed);
  if (!isAdmin && !free && (wallet?.balanceUsd ?? 0) <= 0) {
    // Free trial spent and balance empty — student must top up before starting.
    return await showBuyMenu(ctx, "no_balance");
  }

  const prev = await getLessonProgress(id, topicId, lessonId).catch(() => null);
  const startMastery = Math.max(1, prev?.mastery ?? 0) as 1 | 2 | 3;

  ctx.session.flow = {
    kind: "tutor",
    topicId,
    lessonId,
    mastery: startMastery,
    history: [],
    pendingQuiz: null,
    awaiting: "none",
    free,
    lessonCostUsd: 0,
    mistakes: 0,
    overageOk: false,
  };
  await setLessonMastery(id, topicId, lessonId, startMastery).catch(() => {});
  if (free) await markFreeLessonUsed(id).catch(() => {});

  const lessonsLeft = approxLessons(wallet?.balanceUsd ?? 0);
  const note = free
    ? tr(ctx, "🎁 <i>Первый урок — бесплатно!</i>", "🎁 <i>First lesson is free!</i>")
    : tr(
        ctx,
        `💎 <i>На балансе: ≈ ${lessonsLeft} ур.</i>`,
        `💎 <i>Balance: ≈ ${lessonsLeft} lessons</i>`,
      );
  await ctx.reply(
    `▶️ <b>${esc(topic.title)} — ${esc(lesson.title)}</b>\n🎯 <i>${esc(lesson.canDo)}</i>\n${note}`,
    { parse_mode: "HTML" },
  );
  await notifyAdmins(ctx.api, {
    title: "Self-study lesson started",
    ctx,
    details:
      `${topic.target} ${topic.level}: ${topic.title} — ${lesson.title} ` +
      `(topic=${topicId}, lesson=${lessonId}, ${free ? "free/admin" : "paid"})`,
  });
  const stopThinking = keepThinking(ctx);
  const cancelHints = startLoadingHints(ctx); // "I'm running…" pics if the first turn is slow
  try {
    const profile = await ensureProfile(ctx);
    const flow = tutorFlow(ctx);
    if (flow) await advance(ctx, flow, profile, lesson);
  } finally {
    cancelHints();
    stopThinking(); // always clear the typing indicator — otherwise it loops forever
  }
}

/** Send a chat action every 4 s until the returned stop function is called.
 *  Telegram actions expire after 5 s, so a single send vanishes long before Claude
 *  or TTS finishes. Returns a cleanup fn — always call it in a finally block. */
function keepThinking(
  ctx: BotContext,
  action: Parameters<typeof ctx.replyWithChatAction>[0] = "typing",
): () => void {
  ctx.replyWithChatAction(action).catch(() => {});
  const id = setInterval(() => ctx.replyWithChatAction(action).catch(() => {}), 4000);
  return () => clearInterval(id);
}

/** Send already-generated picture bytes. Returns true if it went through. */
async function sendPhotoBytes(ctx: BotContext, image: GeneratedImage): Promise<boolean> {
  const ext = image.mimeType.includes("jpeg") || image.mimeType.includes("jpg") ? "jpg" : "png";
  try {
    await ctx.replyWithPhoto(new InputFile(Buffer.from(image.bytes), `picture.${ext}`));
    return true;
  } catch (err) {
    console.error("tutor send photo failed:", err);
    await notifyAdmins(ctx.api, {
      title: "Tutor picture upload failed",
      ctx,
      details: `Telegram rejected generated ${image.mimeType} image (${image.bytes.length} bytes).`,
      err,
      onlyForStudents: true,
    });
    return false;
  }
}

/** Generate and send an illustrative picture. Returns true if one was sent. */
async function sendImage(ctx: BotContext, prompt: string): Promise<boolean> {
  const stop = keepThinking(ctx, "upload_photo");
  try {
    const img = await generateImage(prompt);
    if (img) return await sendPhotoBytes(ctx, img);
    await notifyAdmins(ctx.api, {
      title: "Tutor picture generation failed",
      ctx,
      details: `Prompt: ${prompt}`,
      onlyForStudents: true,
    });
  } catch (err) {
    console.error("tutor image failed:", err);
    await notifyAdmins(ctx.api, {
      title: "Tutor picture generation error",
      ctx,
      details: `Prompt: ${prompt}`,
      err,
      onlyForStudents: true,
    });
  } finally {
    stop();
  }
  return false;
}

/** Add some real API cost to the running lesson tally and debit the wallet
 *  (unless this is the free trial lesson). The single source of truth for spend. */
async function chargeUsd(
  ctx: BotContext,
  flow: TutorFlow,
  usd: number,
  label: string,
): Promise<boolean> {
  if (usd <= 0) return false;
  flow.lessonCostUsd = Math.round((flow.lessonCostUsd + usd) * 1e4) / 1e4;
  console.log(
    `[tutor] ${label} $${usd.toFixed(4)} | lesson $${flow.lessonCostUsd.toFixed(4)} | ` +
      `budget $${LESSON_BUDGET_USD} | mistakes ${flow.mistakes} | free=${flow.free}`,
  );
  if (flow.free) return true;
  try {
    await debit(telegramId(ctx), usd);
    return true;
  } catch {
    return false;
  }
}

/** Undo a charge for a tutor turn that failed before it produced anything useful. */
async function refundUsd(
  ctx: BotContext,
  flow: TutorFlow,
  usd: number,
  label: string,
  walletCharged = true,
): Promise<void> {
  if (usd <= 0) return;
  flow.lessonCostUsd = Math.max(0, Math.round((flow.lessonCostUsd - usd) * 1e4) / 1e4);
  console.log(
    `[tutor] refund ${label} $${usd.toFixed(4)} | lesson $${flow.lessonCostUsd.toFixed(4)} | ` +
      `budget $${LESSON_BUDGET_USD} | free=${flow.free}`,
  );
  if (!flow.free && walletCharged) await refund(telegramId(ctx), usd).catch(() => {});
}

/** Charge for one tutor turn: Claude tokens + (if produced) a voice note and a picture. */
async function meterTurn(
  ctx: BotContext,
  flow: TutorFlow,
  claudeUsd: number,
  ttsCount: number,
  imageSent: boolean,
): Promise<void> {
  const cost =
    claudeUsd + ttsCount * MEDIA_COST_USD.tts + (imageSent ? MEDIA_COST_USD.image : 0);
  await chargeUsd(ctx, flow, cost, "turn");
  if (ctx.session.role === "teacher") {
    const parts = [`Claude $${claudeUsd.toFixed(4)}`];
    if (ttsCount > 0) parts.push(`TTS ×${ttsCount} $${(ttsCount * MEDIA_COST_USD.tts).toFixed(4)}`);
    if (imageSent) parts.push(`img $${MEDIA_COST_USD.image.toFixed(4)}`);
    await ctx.reply(
      `💸 $${cost.toFixed(4)} (${parts.join(" + ")}) | lesson total $${flow.lessonCostUsd.toFixed(4)}`,
    ).catch(() => {});
  }
}

/** Cheap pre-check before spending: can we spend at all? The free trial is
 *  capped at one lesson's budget; a paid lesson needs some balance. (The
 *  per-lesson "overusage" consent is handled separately, after the student's
 *  input is recorded — see overageAllowed.) */
async function gate(ctx: BotContext, flow: TutorFlow): Promise<boolean> {
  if (flow.free) {
    if (flow.lessonCostUsd < LESSON_BUDGET_USD) return true;
    await showBuyMenu(ctx, "free_done"); // free trial used up
    return false;
  }
  const w = await getWallet(telegramId(ctx)).catch(() => null);
  if (w && w.balanceUsd > 0) return true;
  await showBuyMenu(ctx, "no_balance");
  return false;
}

/** Longest text we send to TTS in one call. A whole grammar explanation (the first
 *  lesson turn) can be thousands of characters; sending that as ONE request makes
 *  Gemini TTS slow and flaky, and when it fails across every fallback model the
 *  student waited minutes only to get a wall of text. We speak in sentence-sized
 *  chunks instead: each call is fast and reliable, and the first voice note lands
 *  in a few seconds. */
const MAX_TTS_CHARS = 700;

/** Split text into chunks of ≤ maxLen, breaking on sentence boundaries where
 *  possible (falling back to whitespace, then a hard cut) so speech sounds natural. */
function chunkForSpeech(text: string, maxLen: number): string[] {
  const clean = text.trim();
  if (clean.length <= maxLen) return clean ? [clean] : [];
  // Split into sentences (keep the punctuation), then greedily pack into chunks.
  const sentences = clean.match(/[^.!?。！？\n]+[.!?。！？]*\s*|\n+/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (let piece of sentences) {
    // A single sentence longer than maxLen: hard-split it on spaces.
    while (piece.length > maxLen) {
      const slice = piece.slice(0, maxLen);
      const cut = slice.lastIndexOf(" ");
      const head = cut > maxLen * 0.5 ? slice.slice(0, cut) : slice;
      if (cur) push();
      chunks.push(head.trim());
      piece = piece.slice(head.length);
    }
    if ((cur + piece).length > maxLen) push();
    cur += piece;
  }
  push();
  return chunks;
}

/**
 * Speak text as voice notes (the primary channel). Long text is delivered as
 * several voice notes, sent as each is ready so the first one lands quickly. If a
 * chunk can't be synthesized, the rest is shown as text rather than stalling.
 * Returns the number of voice notes sent (0 = nothing spoken; caller shows text).
 */
async function speak(ctx: BotContext, text: string): Promise<number> {
  if (!text.trim()) return 0;
  const chunks = chunkForSpeech(text, MAX_TTS_CHARS);
  const stop = keepThinking(ctx, "record_voice");
  let sent = 0;
  try {
    for (let i = 0; i < chunks.length; i++) {
      let ogg: Uint8Array | null = null;
      try {
        ogg = await synthesizeSpeech(chunks[i]!);
      } catch (err) {
        console.error("tutor voice failed:", err);
      }
      if (ogg) {
        await ctx.replyWithVoice(new InputFile(ogg, "tutor.ogg"));
        sent += 1;
      } else {
        // This chunk failed — show it and everything after it as text, then stop
        // (don't keep hammering TTS for the remaining chunks).
        const rest = chunks.slice(i).join(" ");
        await replyRich(ctx, rest);
        break;
      }
    }
  } finally {
    stop();
  }
  return sent;
}

/** Render a tutor turn: speak it (primary), show text only when needed, set up next.
 *  `preImage`, when given, is a picture already generated upstream (a grounded
 *  picture task) — send those bytes instead of drawing a new one. */
async function renderReply(
  ctx: BotContext,
  result: TutorTurnResult | null,
  preImage?: GeneratedImage | null,
): Promise<boolean> {
  const flow = tutorFlow(ctx);
  if (!flow) return false;

  if (!result) {
    // The tutor couldn't be generated (a rare API outage, after several retries). Don't
    // charge for it, don't touch history, and reassure the student — sending any message
    // re-runs this turn from the same place, so the lesson simply continues.
    await ctx.reply(
      tr(
        ctx,
        "⏳ Небольшая заминка на стороне ИИ — он сейчас перегружен. Обычно это проходит за пару минут. " +
          "Твой прогресс и баланс в полной сохранности — просто отправь свой ответ ещё раз 🙏",
        "⏳ A brief hiccup on the AI's side — it's momentarily overloaded. This usually clears up within a couple of minutes. " +
          "Your progress and balance are completely safe — just send your answer again 🙏",
      ),
    );
    await notifyAdmins(ctx.api, {
      title: "Student saw tutor connection error",
      ctx,
      details: "Tutor generation returned null after retries.",
      onlyForStudents: true,
    });
    return false;
  }
  const reply = result.reply;

  // Update mastery from this turn; a negative delta means the student slipped up.
  const updated = nextMastery(flow.mastery, reply.masteryDelta, reply.lessonComplete);
  flow.mastery = updated;
  if (reply.masteryDelta < 0) flow.mistakes += 1;
  await setLessonMastery(telegramId(ctx), flow.topicId, flow.lessonId, updated).catch(() => {});

  // Remember what was said (and shown) for conversation continuity.
  flow.history.push({
    role: "tutor",
    text: reply.say + (reply.board ? `\n[shown] ${reply.board}` : ""),
  });

  // Optional picture (pre-generated upstream, or drawn now), then SPEAK (primary).
  const imgSent = preImage
    ? await sendPhotoBytes(ctx, preImage)
    : reply.image
      ? await sendImage(ctx, reply.image)
      : false;
  // speak() delivers everything: voice notes for what it can synthesize, and a
  // text fallback for anything it can't — so we never double-post or stall here.
  const voiceNotes = await speak(ctx, reply.say);

  // Meter the real cost of everything we just produced (Claude + voice + picture).
  await meterTurn(ctx, flow, result.costUsd, voiceNotes, imgSent);

  // Lesson finished.
  if (reply.lessonComplete) {
    flow.pendingQuiz = null;
    flow.awaiting = "none";
    if (reply.board) await replyRich(ctx, reply.board);
    const next = nextLesson(flow.topicId, flow.lessonId);
    const topic = getTopic(flow.topicId);
    const back = topic ? `lrn:c:${TARGET_CODE[topic.target]}:${topic.level}` : "lrn:topics";
    const kb = new InlineKeyboard();
    if (next) kb.text(tr(ctx, "▶️ Следующий урок", "▶️ Next lesson"), "lrn:next").row();
    kb.text(tr(ctx, "📖 Уроки", "📖 Lessons"), `lrn:t:${flow.topicId}`).text(
      tr(ctx, "📚 Темы", "📚 Topics"),
      back,
    );
    await ctx.reply(tr(ctx, "🎉 Урок пройден — отличная работа!", "🎉 Lesson complete — nice work!"), {
      reply_markup: kb,
    });
    // Report per-lesson profitability to admins after every lesson.
    {
      const pack = PACKAGES[0];
      const netPerLesson = pack ? (pack.stars / pack.lessons) * STAR_NET_USD : 0;
      const profit = flow.free ? -flow.lessonCostUsd : netPerLesson - flow.lessonCostUsd;
      const studentName = ctx.session.name ?? ctx.from?.first_name ?? "Unknown";
      const label = flow.free ? "free/trial" : `net $${netPerLesson.toFixed(2)}`;
      // Words the student practised this lesson (best-effort; owner-only insight).
      const lessonObj = getLesson(flow.topicId, flow.lessonId);
      const learned = lessonObj
        ? await extractLearnedWords(lessonContext(flow.topicId, lessonObj), flow.history).catch(
            () => [] as string[],
          )
        : [];
      const wordsLine = learned.length ? `\n📖 Words learned: ${learned.join(", ")}` : "";
      await notifyAdmins(ctx.api, {
        title: "💰 Lesson complete",
        ctx,
        details:
          `Student: ${studentName}\n` +
          `Cost: $${flow.lessonCostUsd.toFixed(4)} | ${label} | P&L: ${profit >= 0 ? "+" : ""}$${profit.toFixed(4)}` +
          wordsLine,
      }).catch(() => {});
    }
    return true;
  }

  // Multiple-choice check.
  if (reply.quiz) {
    flow.pendingQuiz = reply.quiz;
    flow.awaiting = "quiz";
    const kb = new InlineKeyboard();
    reply.quiz.options.forEach((opt, i) => {
      kb.text(`${String.fromCharCode(65 + i)}. ${opt}`, `lrn:q:${i}`).row();
    });
    const q = (reply.board ? `${reply.board}\n\n` : "") + `❓ ${reply.quiz.question}`;
    await replyRich(ctx, q, kb);
    return true;
  }

  // Normal turn — just show the board (if any). The tutor's spoken message already
  // tells the student exactly what to do, so we add NO generic "type/voice" hint
  // (that was confusing — "reply with a voice message" with nothing to reply).
  flow.pendingQuiz = null;
  flow.awaiting = reply.expect === "text" ? "text" : reply.expect === "none" ? "none" : "voice";
  if (reply.board) await replyRich(ctx, reply.board);
  return true;
}

/**
 * Produce and render the tutor's next turn. For a grounded picture task the tutor
 * asks to SHOW a picture (imageAsk); we draw it, let the tutor SEE the real bytes,
 * and have it ask a question based on what's actually there — then render that.
 */
async function advance(
  ctx: BotContext,
  flow: TutorFlow,
  profile: LearnerProfile,
  lesson: MicroLesson,
): Promise<boolean> {
  const lc = lessonContext(flow.topicId, lesson);
  // Keep a micro-lesson finite. Once the student has practised enough (sooner if
  // they're clearly doing well), nudge the tutor to recap and finish; if it still
  // won't stop, force completion. This ends the "paddling in circles" and protects
  // the lesson budget.
  const studentTurns = flow.history.filter((t) => t.role === "student").length;
  const wrapUp =
    studentTurns >= 14 || (flow.mastery >= 3 && studentTurns >= 8)
      ? '[WRAP UP THE LESSON NOW: the student has practised enough and is doing well. Do NOT start another exercise and do NOT re-explain anything. Give a short, warm recap of today\'s goal, praise their progress, and set "lessonComplete": true.]'
      : undefined;
  const first = await getTutorReply(profile, lc, flow.history, wrapUp);
  if (!first) return await renderReply(ctx, null);
  // Hard backstop: never let one micro-lesson run away.
  if (studentTurns >= 16) first.reply.lessonComplete = true;

  if (first.reply.imageAsk && first.reply.image) {
    const stopUpload = keepThinking(ctx, "upload_photo");
    const gen = await generateImage(first.reply.image).catch(() => null);
    stopUpload();
    if (gen) {
      // Let the tutor look at the ACTUAL picture (declaring its real MIME type so the
      // vision model accepts it), then ask about what it really shows.
      const grounded = await describeImageTurn(
        profile,
        lc,
        flow.history,
        gen.bytes,
        gen.mimeType,
        first.reply.image,
        first.reply.say,
      );
      if (grounded) {
        const rendered = await renderReply(
          ctx,
          { reply: grounded.reply, costUsd: first.costUsd + grounded.costUsd },
          gen,
        );
        // Leave a note of what the picture showed, so later turns keep the context.
        const last = flow.history[flow.history.length - 1];
        if (rendered && last?.role === "tutor") last.text += `\n[picture shown: ${first.reply.image}]`;
        return rendered;
      }
      await notifyAdmins(ctx.api, {
        title: "Tutor grounded picture viewing failed",
        ctx,
        details: `Generated ${gen.mimeType} image (${gen.bytes.length} bytes), but Claude did not produce a grounded picture task. Prompt: ${first.reply.image}`,
        onlyForStudents: true,
      });
      // If Claude could not look at the generated image and produce a grounded task, do
      // not show the student's vague "look at the picture" lead-in. Continue with a
      // normal exercise so the lesson stays coherent.
      const retry = await getTutorReply(
        profile,
        lc,
        flow.history,
        "[The app generated a picture, but the tutor could not reliably inspect it. Do NOT use, show, or mention a picture. First respond to the student's last answer above, then give a normal spoken or written exercise.]",
      );
      if (retry) {
        retry.reply.image = null;
        retry.reply.imageAsk = false;
        return await renderReply(ctx, retry);
      }
      return await renderReply(ctx, null);
    }
    await notifyAdmins(ctx.api, {
      title: "Tutor grounded picture generation failed",
      ctx,
      details: `Prompt: ${first.reply.image}`,
      onlyForStudents: true,
    });
    // Image generation FAILED. Don't render the "look at the picture" lead-in (there is
    // no picture). Retry once with a one-off nudge (NOT stored in history) so the tutor
    // first responds to the student's last answer, then gives a non-picture exercise.
    const retry = await getTutorReply(
      profile,
      lc,
      flow.history,
      "[The picture could not be shown this time. Do NOT use or mention a picture. First respond to the student's last answer above (praise/correct it), then give a normal spoken or written exercise.]",
    );
    if (retry) {
      retry.reply.image = null;
      retry.reply.imageAsk = false;
      return await renderReply(ctx, retry);
    }
    // Both the picture AND the recovery generation failed — show a clean "try again"
    // rather than a broken "look at the picture" turn with no picture. History stays clean.
    return await renderReply(ctx, null);
  }
  return await renderReply(ctx, first);
}

// ── Student input ────────────────────────────────────────────────────────────

export async function tutorOnText(ctx: BotContext, text: string): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return;
  if (flow.awaiting === "quiz") {
    await ctx.reply(
      tr(
        ctx,
        "👆 Нажми одну из кнопок с вариантами выше (или /menu, чтобы выйти из урока).",
        "👆 Tap one of the answer buttons above (or /menu to leave the lesson).",
      ),
    );
    return;
  }
  if (!(await gate(ctx, flow))) return; // out of balance — buy menu shown
  const historyLen = flow.history.length;
  flow.history.push({ role: "student", text: text.trim() });
  const stopThinking = keepThinking(ctx);
  try {
    const profile = await ensureProfile(ctx);
    const lesson = getLesson(flow.topicId, flow.lessonId);
    if (!lesson) {
      flow.history.splice(historyLen);
      return;
    }
    const rendered = await advance(ctx, flow, profile, lesson);
    if (!rendered) flow.history.splice(historyLen);
  } finally {
    stopThinking();
  }
}

export async function tutorOnVoice(ctx: BotContext): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return;
  if (flow.awaiting === "quiz") {
    await ctx.reply(
      tr(
        ctx,
        "👆 Нажми одну из кнопок с вариантами выше, чтобы ответить.",
        "👆 Tap one of the answer buttons above to answer the question.",
      ),
    );
    return;
  }
  if (!hasGemini) {
    await ctx.reply(
      tr(
        ctx,
        "🎤 Голос пока не настроен — боту нужен ключ GEMINI_API, чтобы слышать и говорить. " +
          "Пока что напиши ответ текстом. ⌨️",
        "🎤 Voice isn't set up yet — the bot needs a GEMINI_API key to hear you and to " +
          "speak. For now, please type your answer. ⌨️",
      ),
    );
    return;
  }
  if (!(await gate(ctx, flow))) return; // out of balance — buy menu shown

  const stopTranscribe = keepThinking(ctx);
  let transcript: string | null = null;
  try {
    const file = await ctx.getFile();
    if (file.file_path) {
      const bytes = await downloadTelegramFile(file.file_path);
      transcript = await transcribeSpeech(toBase64(bytes), "audio/ogg");
    }
  } catch (err) {
    console.error("tutor voice failed:", err);
  } finally {
    stopTranscribe();
  }

  if (!transcript) {
    // Don't ask the student to repeat themselves — just treat it as an attempt
    // and let Claude continue the lesson naturally.
    await chargeUsd(ctx, flow, MEDIA_COST_USD.stt, "stt");
    const historyLen = flow.history.length;
    flow.history.push({ role: "student", text: "[student spoke — audio was unclear, but accept the attempt and continue the lesson warmly]" });
    const stopThinking = keepThinking(ctx);
    try {
      const profile = await ensureProfile(ctx);
      const lesson = getLesson(flow.topicId, flow.lessonId);
      if (!lesson) { flow.history.splice(historyLen); return; }
      const rendered = await advance(ctx, flow, profile, lesson);
      if (!rendered) flow.history.splice(historyLen);
    } finally {
      stopThinking();
    }
    return;
  }
  const walletCharged = await chargeUsd(ctx, flow, MEDIA_COST_USD.stt, "stt"); // we transcribed their voice

  const historyLen = flow.history.length;
  flow.history.push({ role: "student", text: `[spoken aloud] ${transcript}` });
  const stopThinking = keepThinking(ctx);
  try {
    const profile = await ensureProfile(ctx);
    const lesson = getLesson(flow.topicId, flow.lessonId);
    if (!lesson) {
      flow.history.splice(historyLen);
      await refundUsd(ctx, flow, MEDIA_COST_USD.stt, "stt", walletCharged);
      return;
    }
    const rendered = await advance(ctx, flow, profile, lesson);
    if (!rendered) {
      flow.history.splice(historyLen);
      await refundUsd(ctx, flow, MEDIA_COST_USD.stt, "stt", walletCharged);
    }
  } finally {
    stopThinking();
  }
}

export async function tutorQuizAnswer(ctx: BotContext, optIndex: number): Promise<void> {
  const flow = tutorFlow(ctx);
  const quiz = flow?.pendingQuiz;
  if (!flow || !quiz) {
    await ctx.answerCallbackQuery();
    return;
  }
  const correct = optIndex === quiz.correctIndex;
  await ctx.answerCallbackQuery({
    text: correct ? tr(ctx, "✅ Верно!", "✅ Correct!") : tr(ctx, "❌ Не совсем", "❌ Not quite"),
  });
  try {
    await ctx.editMessageReplyMarkup(); // lock the buttons
  } catch {
    /* ignore */
  }

  const chosen = quiz.options[optIndex] ?? "";
  const right = quiz.options[quiz.correctIndex] ?? "";
  const verdict = correct
    ? tr(ctx, `✅ Верно: ${chosen}`, `✅ Correct: ${chosen}`)
    : tr(
        ctx,
        `❌ Твой ответ: ${chosen}\n✅ Правильно: ${right}`,
        `❌ You chose: ${chosen}\n✅ Answer: ${right}`,
      );
  await ctx.reply(quiz.explain ? `${verdict}\n\n${quiz.explain}` : verdict);

  flow.pendingQuiz = null;
  flow.awaiting = "none";
  flow.history.push({
    role: "student",
    text: `I answered the quiz "${quiz.question}" with "${chosen}" — that was ${correct ? "correct" : "incorrect"}.`,
  });

  if (!(await gate(ctx, flow))) return; // out of balance — buy menu shown
  const stopThinking = keepThinking(ctx);
  try {
    const profile = await ensureProfile(ctx);
    const lesson = getLesson(flow.topicId, flow.lessonId);
    if (!lesson) return;
    await advance(ctx, flow, profile, lesson);
  } finally {
    stopThinking();
  }
}

/** Continue a lesson past its included budget after the student agreed (lrn:over). */
export async function tutorOverageContinue(ctx: BotContext): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return await showTopics(ctx);
  flow.overageOk = true; // draw the extra from balance for the rest of this lesson
  const stopThinking = keepThinking(ctx);
  try {
    const profile = await ensureProfile(ctx);
    const lesson = getLesson(flow.topicId, flow.lessonId);
    if (!lesson) return;
    await advance(ctx, flow, profile, lesson); // the student's turn is already in history
  } finally {
    stopThinking();
  }
}

/** "Next lesson" after completing one. */
export async function tutorNext(ctx: BotContext): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return await showTopics(ctx);
  const next = nextLesson(flow.topicId, flow.lessonId);
  if (!next) {
    await ctx.reply(
      tr(
        ctx,
        "🏁 Это весь курс A1 — потрясающая работа! Выбери любую тему для повторения.",
        "🏁 That's the whole A1 course — amazing work! Pick any topic to review.",
      ),
    );
    return await showTopics(ctx);
  }
  await startLesson(ctx, next.topicId, next.lessonId);
}

// ── Stars wallet: buying lessons ──────────────────────────────────────────────

type Pkg = (typeof PACKAGES)[number];

/** Localized "N lessons · tag" label for a package (menu + invoice). */
function pkgLabel(ctx: BotContext, p: Pkg): string {
  const noun = tr(ctx, p.lessons === 1 ? "урок" : "уроков", p.lessons === 1 ? "lesson" : "lessons");
  const tag = p.id === "pack" ? tr(ctx, " · выгодно 🔥", " · best deal 🔥") : "";
  return `${p.lessons} ${noun}${tag}`;
}

/**
 * Show the top-up menu: a single lesson OR a discounted package, with the
 * current balance (as "≈ N lessons"), the per-lesson price and the savings on
 * bigger packs. Shown when the balance runs out ("no_balance"), the free trial
 * is finished ("free_done"), or on request ("menu").
 */
export async function showBuyMenu(
  ctx: BotContext,
  reason: "no_balance" | "menu" | "free_done",
): Promise<void> {
  const wallet = await getWallet(telegramId(ctx)).catch(() => null);
  const bal = approxLessons(wallet?.balanceUsd ?? 0);

  const lead =
    reason === "no_balance"
      ? tr(
          ctx,
          "⏸️ <b>Звёзды закончились — урок на паузе.</b>\nДобавь звёзды, и продолжим с того же места.",
          "⏸️ <b>Out of stars — the lesson is paused.</b>\nTop up and we'll continue right where we left off.",
        )
      : reason === "free_done"
        ? tr(
            ctx,
            "🎁 <b>Бесплатный урок пройден — отлично!</b>\nЧтобы заниматься дальше, выбери вариант:",
            "🎁 <b>Free lesson finished — great job!</b>\nTo keep learning, pick an option:",
          )
        : tr(ctx, "💎 <b>Уроки английского за звёзды</b>", "💎 <b>English lessons with Stars</b>");

  const blurb = tr(
    ctx,
    "🎧 Живой ИИ-репетитор: говорит голосом, показывает картинки и подстраивается под тебя.",
    "🎧 A live AI tutor: speaks to you, shows pictures and adapts to you.",
  );

  // Single lesson is the baseline; bigger packs are cheaper per lesson.
  const basePerLesson = starsPerLesson(PACKAGES.find((p) => p.id === "single") ?? PACKAGES[0]!);

  const lines = [
    lead,
    "",
    blurb,
    "",
    tr(ctx, `📊 Сейчас на балансе: <b>≈ ${bal} ур.</b>`, `📊 Your balance: <b>≈ ${bal} lessons</b>`),
    "",
  ];
  const perWord = tr(ctx, "⭐/урок", "⭐/lesson");
  const kb = new InlineKeyboard();
  for (const p of PACKAGES) {
    const per = starsPerLesson(p);
    const off = basePerLesson > 0 ? Math.round((1 - per / basePerLesson) * 100) : 0;
    const deal = off > 0 ? `  · −${off}%` : "";
    lines.push(`• <b>${esc(pkgLabel(ctx, p))}</b> — ${p.stars} ⭐  (${per} ${perWord}${deal})`);
    const icon = p.id === "single" ? "🎟" : "📦";
    const btnNoun = tr(ctx, "ур", "less");
    kb.text(`${icon} ${p.lessons} ${btnNoun} · ${p.stars} ⭐`, `buy:${p.id}`).row();
  }
  kb.text(tr(ctx, "⬅️ Назад к темам", "⬅️ Back to topics"), "lrn:topics");

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
}

/** Send a Telegram Stars invoice for the chosen package. */
export async function startPurchase(ctx: BotContext, pkgId: string): Promise<void> {
  const pkg = packageById(pkgId);
  const chatId = ctx.chat?.id;
  if (!pkg || !chatId) return;
  const label = pkgLabel(ctx, pkg);
  try {
    await ctx.api.raw.sendInvoice({
      chat_id: chatId,
      title: label,
      description: tr(
        ctx,
        `${pkg.lessons} ${pkg.lessons === 1 ? "урок" : "уроков"} английского с ИИ-репетитором — ` +
          "голос, картинки, адаптивно. Звёзды тратятся по мере занятий, остаток сохраняется.",
        `${pkg.lessons} English ${pkg.lessons === 1 ? "lesson" : "lessons"} with an AI tutor — ` +
          "voice, pictures, adaptive. Stars are spent as you learn; the rest is kept.",
      ),
      payload: `pkg_${pkg.id}`,
      provider_token: "", // empty = Telegram Stars
      currency: "XTR",
      prices: [{ label, amount: pkg.stars }],
    });
  } catch (err) {
    console.error("sendInvoice failed:", err);
    await notifyAdmins(ctx.api, {
      title: "Student saw payment invoice error",
      ctx,
      details: `Package: ${pkg.id} (${pkg.stars} Stars)`,
      err,
      onlyForStudents: true,
    });
    await ctx.reply(
      tr(
        ctx,
        "⚠️ Не получилось открыть оплату. Попробуй ещё раз чуть позже.",
        "⚠️ Couldn't open the payment. Please try again shortly.",
      ),
    );
  }
}

/** Credit the wallet after a successful Stars payment, then invite them to continue. */
export async function handleSuccessfulPayment(ctx: BotContext): Promise<void> {
  const sp = ctx.message?.successful_payment;
  if (!sp) return;
  const payload = sp.invoice_payload || "";
  const pkgId = payload.startsWith("pkg_") ? payload.slice(4) : payload;
  const pkg = packageById(pkgId);
  if (!pkg) {
    await ctx.reply(tr(ctx, "✅ Оплата получена, спасибо!", "✅ Payment received, thank you!"));
    await notifyAdmins(ctx.api, {
      title: "Stars payment received with unknown package",
      ctx,
      details: `payload=${payload || "(empty)"}`,
    });
    return;
  }
  const wallet = await creditAllowance(telegramId(ctx), pkg.allowanceUsd).catch(() => null);
  const lessons = approxLessons(wallet?.balanceUsd ?? pkg.allowanceUsd);
  // If they topped up mid-lesson, they've effectively agreed to keep going — don't
  // re-ask for overage consent on the very next turn.
  const flow = tutorFlow(ctx);
  if (flow) flow.overageOk = true;
  const tail = flow
    ? tr(ctx, "Продолжаем урок — просто отправь свой ответ 🎤", "Let's continue — just send your answer 🎤")
    : tr(ctx, "Выбери тему и начнём! /learn", "Pick a topic and let's start! /learn");
  await ctx.reply(
    tr(
      ctx,
      `✅ <b>Готово! Баланс пополнен.</b>\n💎 Теперь у тебя ≈ <b>${lessons} ур.</b>\n\n${tail}`,
      `✅ <b>Done! Balance topped up.</b>\n💎 You now have ≈ <b>${lessons} lessons</b>.\n\n${tail}`,
    ),
    { parse_mode: "HTML" },
  );
  await notifyAdmins(ctx.api, {
    title: "Stars payment received",
    ctx,
    details:
      `${pkg.title}: ${pkg.stars} Stars, allowance $${pkg.allowanceUsd.toFixed(2)}, ` +
      `balance ≈ ${lessons} lessons`,
  });
}

import { InlineKeyboard, InputFile } from "grammy";
import type { BotContext, Flow } from "../context.js";
import { esc } from "../../util/format.js";
import { config, hasTutorLLM, hasGemini } from "../../config.js";
import {
  CURRICULUM,
  getTopic,
  getLesson,
  nextLesson,
  type MicroLesson,
} from "../../tutor/curriculum.js";
import {
  getAllProgress,
  getLessonProgress,
  setLessonMastery,
  upsertProfile,
  getProfile,
} from "../../tutor/learnerModel.js";
import { getTutorReply, nextMastery, type TutorTurnResult } from "../../tutor/engine.js";
import type { LearnerProfile, LessonContext } from "../../tutor/types.js";
import { downloadTelegramFile, toBase64 } from "../../services/voice.js";
import { transcribeSpeech } from "../../services/gemini.js";
import { synthesizeSpeech, generateImage } from "../../services/media.js";
import { getWallet, debit, creditAllowance, markFreeLessonUsed } from "../../tutor/wallet.js";
import { PACKAGES, packageById, approxLessons, MEDIA_COST_USD } from "../../tutor/pricing.js";

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

/** Load the learner profile. Default everyone to Russian help (most A1 students
 *  need it); respect an explicit English/Russian choice once they make one. */
async function ensureProfile(ctx: BotContext): Promise<LearnerProfile> {
  const id = telegramId(ctx);
  const existing = await getProfile(id).catch(() => null);
  if (existing?.langConfirmed) return existing;
  return upsertProfile(id, {
    name: ctx.session.name ?? ctx.from?.first_name,
    nativeLanguage: "Russian",
    level: "A1",
  });
}

function lessonContext(topicId: number, lesson: MicroLesson): LessonContext {
  const topic = getTopic(topicId)!;
  return {
    topicId,
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
  await showTopics(ctx);
}

/** Store the learner's help-language choice, then show the topic list. */
export async function setTutorLanguage(
  ctx: BotContext,
  lang: "Russian" | "English",
): Promise<void> {
  await upsertProfile(telegramId(ctx), { nativeLanguage: lang, langConfirmed: true }).catch(
    () => {},
  );
  await showTopics(ctx);
}

export async function showTopics(ctx: BotContext): Promise<void> {
  ctx.session.flow = undefined; // leaving any running lesson
  const id = telegramId(ctx);
  const [progress, profile, wallet] = await Promise.all([
    getAllProgress(id).catch(() => []),
    getProfile(id).catch(() => null),
    getWallet(id).catch(() => null),
  ]);
  const masteredByTopic = new Map<number, number>();
  for (const p of progress) {
    if (p.mastery >= 3) masteredByTopic.set(p.topicId, (masteredByTopic.get(p.topicId) ?? 0) + 1);
  }

  const kb = new InlineKeyboard();
  for (const topic of CURRICULUM) {
    const done = masteredByTopic.get(topic.id) ?? 0;
    const tick = done >= topic.lessons.length ? "✅ " : "";
    kb.text(`${tick}${topic.id}. ${topic.title} (${done}/${topic.lessons.length})`, `lrn:t:${topic.id}`).row();
  }
  // Wallet line: free first lesson, or remaining balance as "≈ N lessons".
  const balanceLessons = approxLessons(wallet?.balanceUsd ?? 0);
  const walletLine = !wallet?.freeLessonUsed
    ? "🎁 <b>Первый урок бесплатно!</b>"
    : `💎 На балансе: <b>≈ ${balanceLessons} ур.</b>`;
  kb.text("💎 Купить уроки", "lrn:buy").row();

  // Default is Russian help; offer a one-tap switch to English (and back).
  const inEnglish = (profile?.nativeLanguage ?? "Russian").toLowerCase() === "english";
  if (inEnglish) kb.text("🇷🇺 Объяснять по-русски", "lrn:lang:ru");
  else kb.text("🇬🇧 Switch to English", "lrn:lang:en");

  await ctx.reply(
    `📚 <b>English A1 — choose a topic</b>\nWe'll go step by step. Tap a topic, then a lesson.\n\n${walletLine}`,
    { parse_mode: "HTML", reply_markup: kb },
  );
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
  kb.text("⬅️ Topics", "lrn:topics");

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
  const id = telegramId(ctx);
  const wallet = await getWallet(id).catch(() => null);
  const free = !wallet?.freeLessonUsed;
  if (!free && (wallet?.balanceUsd ?? 0) <= 0) {
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
  };
  await setLessonMastery(id, topicId, lessonId, startMastery).catch(() => {});
  if (free) await markFreeLessonUsed(id).catch(() => {});

  const note = free
    ? "🎁 <i>Первый урок — бесплатно!</i>"
    : `💎 <i>На балансе: ≈ ${approxLessons(wallet?.balanceUsd ?? 0)} ур.</i>`;
  await ctx.reply(
    `▶️ <b>${esc(topic.title)} — ${esc(lesson.title)}</b>\n🎯 <i>${esc(lesson.canDo)}</i>\n${note}`,
    { parse_mode: "HTML" },
  );
  await think(ctx);

  const profile = await ensureProfile(ctx);
  const reply = await getTutorReply(profile, lessonContext(topicId, lesson), []);
  await renderReply(ctx, reply);
}

/** Show a typing indicator (best-effort). */
async function think(ctx: BotContext): Promise<void> {
  try {
    await ctx.replyWithChatAction("typing");
  } catch {
    /* non-fatal */
  }
}

/** Generate and send an illustrative picture. Returns true if one was sent. */
async function sendImage(ctx: BotContext, prompt: string): Promise<boolean> {
  try {
    await ctx.replyWithChatAction("upload_photo");
  } catch {
    /* non-fatal */
  }
  try {
    const img = await generateImage(prompt);
    if (img) {
      await ctx.replyWithPhoto(new InputFile(img, "vocab.png"));
      return true;
    }
  } catch (err) {
    console.error("tutor image failed:", err);
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
): Promise<void> {
  if (usd <= 0) return;
  flow.lessonCostUsd = Math.round((flow.lessonCostUsd + usd) * 1e4) / 1e4;
  console.log(
    `[tutor] ${label} $${usd.toFixed(4)} | lesson $${flow.lessonCostUsd.toFixed(4)} | free=${flow.free}`,
  );
  if (!flow.free) await debit(telegramId(ctx), usd).catch(() => {});
}

/** Charge for one tutor turn: Claude tokens + (if produced) a voice note and a picture. */
async function meterTurn(
  ctx: BotContext,
  flow: TutorFlow,
  claudeUsd: number,
  spoke: boolean,
  imageSent: boolean,
): Promise<void> {
  const cost =
    claudeUsd + (spoke ? MEDIA_COST_USD.tts : 0) + (imageSent ? MEDIA_COST_USD.image : 0);
  await chargeUsd(ctx, flow, cost, "turn");
}

/** Can this lesson keep spending? Free lessons always can; otherwise need balance. */
async function gate(ctx: BotContext, flow: TutorFlow): Promise<boolean> {
  if (flow.free) return true;
  const w = await getWallet(telegramId(ctx)).catch(() => null);
  if (w && w.balanceUsd > 0) return true;
  await showBuyMenu(ctx, "no_balance");
  return false;
}

/** Speak text as a voice note (the primary channel). Returns true if sent. */
async function speak(ctx: BotContext, text: string): Promise<boolean> {
  if (!text.trim()) return false;
  try {
    await ctx.replyWithChatAction("record_voice");
  } catch {
    /* non-fatal */
  }
  try {
    const ogg = await synthesizeSpeech(text);
    if (ogg) {
      await ctx.replyWithVoice(new InputFile(ogg, "tutor.ogg"));
      return true;
    }
  } catch (err) {
    console.error("tutor voice failed:", err);
  }
  return false;
}

/** Show the on-screen text for a turn (the board + an optional reply hint). */
async function showBoard(ctx: BotContext, board: string | null, hint: string): Promise<void> {
  const md = [board, hint].filter(Boolean).join("\n\n");
  if (md) await replyRich(ctx, md);
}

/** Render a tutor turn: speak it (primary), show text only when needed, set up next. */
async function renderReply(ctx: BotContext, result: TutorTurnResult | null): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return;

  if (!result) {
    await ctx.reply("⚠️ I had trouble reaching the tutor. Try again in a moment, or /menu to exit.");
    return;
  }
  const reply = result.reply;

  // Update mastery from this turn.
  const updated = nextMastery(flow.mastery, reply.masteryDelta, reply.lessonComplete);
  flow.mastery = updated;
  await setLessonMastery(telegramId(ctx), flow.topicId, flow.lessonId, updated).catch(() => {});

  // Remember what was said (and shown) for conversation continuity.
  flow.history.push({
    role: "tutor",
    text: reply.say + (reply.board ? `\n[shown] ${reply.board}` : ""),
  });

  // Optional picture, then SPEAK (primary). Fall back to text only if voice fails.
  const imgSent = reply.image ? await sendImage(ctx, reply.image) : false;
  const spoke = await speak(ctx, reply.say);
  if (!spoke) await replyRich(ctx, reply.say);

  // Meter the real cost of everything we just produced (Claude + voice + picture).
  await meterTurn(ctx, flow, result.costUsd, spoke, imgSent);

  // Lesson finished.
  if (reply.lessonComplete) {
    flow.pendingQuiz = null;
    flow.awaiting = "none";
    if (reply.board) await replyRich(ctx, reply.board);
    const next = nextLesson(flow.topicId, flow.lessonId);
    const kb = new InlineKeyboard();
    if (next) kb.text("▶️ Next lesson", "lrn:next").row();
    kb.text("📖 Lessons", `lrn:t:${flow.topicId}`).text("📚 Topics", "lrn:topics");
    await ctx.reply("🎉 Lesson complete — nice work!", { reply_markup: kb });
    return;
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
    return;
  }

  // Normal turn — show the board (if any). Only nudge to TYPE (voice is the default).
  flow.pendingQuiz = null;
  const want: "voice" | "text" | "none" =
    reply.expect === "text" ? "text" : reply.expect === "none" ? "none" : "voice";
  flow.awaiting = want;
  await showBoard(
    ctx,
    reply.board,
    want === "text" ? "⌨️ *Type your answer.*" : want === "voice" ? "🎤 *Reply with a voice message.*" : "",
  );
}

// ── Student input ────────────────────────────────────────────────────────────

export async function tutorOnText(ctx: BotContext, text: string): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return;
  if (flow.awaiting === "quiz") {
    await ctx.reply("👆 Tap one of the answer buttons above (or /menu to leave the lesson).");
    return;
  }
  if (!(await gate(ctx, flow))) return; // out of balance — buy menu shown
  flow.history.push({ role: "student", text: text.trim() });
  await think(ctx);
  const profile = await ensureProfile(ctx);
  const lesson = getLesson(flow.topicId, flow.lessonId);
  if (!lesson) return;
  const reply = await getTutorReply(profile, lessonContext(flow.topicId, lesson), flow.history);
  await renderReply(ctx, reply);
}

export async function tutorOnVoice(ctx: BotContext): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return;
  if (flow.awaiting === "quiz") {
    await ctx.reply("👆 Tap one of the answer buttons above to answer the question.");
    return;
  }
  if (!hasGemini) {
    await ctx.reply(
      "🎤 Voice isn't set up yet — the bot needs a GEMINI_API key to hear you and to " +
        "speak. For now, please type your answer. ⌨️",
    );
    return;
  }
  if (!(await gate(ctx, flow))) return; // out of balance — buy menu shown

  await think(ctx);
  let transcript: string | null = null;
  try {
    const file = await ctx.getFile();
    if (file.file_path) {
      const bytes = await downloadTelegramFile(file.file_path);
      transcript = await transcribeSpeech(toBase64(bytes), "audio/ogg");
    }
  } catch (err) {
    console.error("tutor voice failed:", err);
  }

  if (!transcript) {
    await ctx.reply("🎧 I couldn't quite catch that. Could you say it again, or type it?");
    return;
  }
  await chargeUsd(ctx, flow, MEDIA_COST_USD.stt, "stt"); // we transcribed their voice

  flow.history.push({ role: "student", text: `[spoken aloud] ${transcript}` });
  const profile = await ensureProfile(ctx);
  const lesson = getLesson(flow.topicId, flow.lessonId);
  if (!lesson) return;
  const reply = await getTutorReply(profile, lessonContext(flow.topicId, lesson), flow.history);
  await renderReply(ctx, reply);
}

export async function tutorQuizAnswer(ctx: BotContext, optIndex: number): Promise<void> {
  const flow = tutorFlow(ctx);
  const quiz = flow?.pendingQuiz;
  if (!flow || !quiz) {
    await ctx.answerCallbackQuery();
    return;
  }
  const correct = optIndex === quiz.correctIndex;
  await ctx.answerCallbackQuery({ text: correct ? "✅ Correct!" : "❌ Not quite" });
  try {
    await ctx.editMessageReplyMarkup(); // lock the buttons
  } catch {
    /* ignore */
  }

  const chosen = quiz.options[optIndex] ?? "";
  const right = quiz.options[quiz.correctIndex] ?? "";
  const verdict = correct
    ? `✅ Correct: ${chosen}`
    : `❌ You chose: ${chosen}\n✅ Answer: ${right}`;
  await ctx.reply(quiz.explain ? `${verdict}\n\n${quiz.explain}` : verdict);

  flow.pendingQuiz = null;
  flow.awaiting = "none";
  flow.history.push({
    role: "student",
    text: `I answered the quiz "${quiz.question}" with "${chosen}" — that was ${correct ? "correct" : "incorrect"}.`,
  });

  if (!(await gate(ctx, flow))) return; // out of balance — buy menu shown
  await think(ctx);
  const profile = await ensureProfile(ctx);
  const lesson = getLesson(flow.topicId, flow.lessonId);
  if (!lesson) return;
  const reply = await getTutorReply(profile, lessonContext(flow.topicId, lesson), flow.history);
  await renderReply(ctx, reply);
}

/** "Next lesson" after completing one. */
export async function tutorNext(ctx: BotContext): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return await showTopics(ctx);
  const next = nextLesson(flow.topicId, flow.lessonId);
  if (!next) {
    await ctx.reply("🏁 That's the whole A1 course — amazing work! Pick any topic to review.");
    return await showTopics(ctx);
  }
  await startLesson(ctx, next.topicId, next.lessonId);
}

// ── Stars wallet: buying lessons ──────────────────────────────────────────────

const BUY_BLURB =
  "🎧 Живой ИИ-репетитор: говорит голосом, показывает картинки и подстраивается под тебя. " +
  "Звёзды списываются только за реально проведённое время — остаток не сгорает.";

/**
 * Show the top-up menu: a single lesson OR a discounted package, with the
 * current balance (as "≈ N lessons") and the per-lesson price for each option.
 * Shown when the balance runs out mid-lesson ("no_balance") or on request ("menu").
 */
export async function showBuyMenu(
  ctx: BotContext,
  reason: "no_balance" | "menu",
): Promise<void> {
  const wallet = await getWallet(telegramId(ctx)).catch(() => null);
  const balanceLessons = approxLessons(wallet?.balanceUsd ?? 0);

  const lead =
    reason === "no_balance"
      ? "⏸️ <b>Звёзды закончились — урок на паузе.</b>\nДобавь звёзды, и продолжим с того же места."
      : "💎 <b>Уроки английского за звёзды</b>";

  // Find the cheapest per-lesson price so we can flag the best deal.
  const perLessonOf = (p: (typeof PACKAGES)[number]) =>
    Math.round(p.stars / Math.max(1, approxLessons(p.allowanceUsd)));
  const cheapest = Math.min(...PACKAGES.map(perLessonOf));

  const lines = [lead, "", BUY_BLURB, "", `📊 Сейчас на балансе: <b>≈ ${balanceLessons} ур.</b>`, ""];
  const kb = new InlineKeyboard();
  for (const p of PACKAGES) {
    const lessons = Math.max(1, approxLessons(p.allowanceUsd));
    const perLesson = perLessonOf(p);
    const flag = p.id !== "single" && perLesson === cheapest ? " 🔥" : "";
    lines.push(
      `• <b>${esc(p.title)}</b> — ${p.stars} ⭐  (≈ ${lessons} ур., ${perLesson} ⭐/урок)${flag}`,
    );
    const icon = p.id === "single" ? "🎟" : "📦";
    kb.text(`${icon} ${lessons} ур · ${p.stars} ⭐`, `buy:${p.id}`).row();
  }
  lines.push("", "💡 Чем больше пакет — тем дешевле каждый урок.");
  kb.text("⬅️ Назад к темам", "lrn:topics");

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
}

/** Send a Telegram Stars invoice for the chosen package. */
export async function startPurchase(ctx: BotContext, pkgId: string): Promise<void> {
  const pkg = packageById(pkgId);
  const chatId = ctx.chat?.id;
  if (!pkg || !chatId) return;
  const lessons = Math.max(1, approxLessons(pkg.allowanceUsd));
  try {
    await ctx.api.raw.sendInvoice({
      chat_id: chatId,
      title: pkg.title,
      description:
        `≈ ${lessons} уроков английского с ИИ-репетитором — голос, картинки, адаптивно. ` +
        "Звёзды тратятся по мере занятий, остаток сохраняется.",
      payload: `pkg_${pkg.id}`,
      provider_token: "", // empty = Telegram Stars
      currency: "XTR",
      prices: [{ label: pkg.title, amount: pkg.stars }],
    });
  } catch (err) {
    console.error("sendInvoice failed:", err);
    await ctx.reply("⚠️ Не получилось открыть оплату. Попробуй ещё раз чуть позже.");
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
    await ctx.reply("✅ Оплата получена, спасибо!");
    return;
  }
  const wallet = await creditAllowance(telegramId(ctx), pkg.allowanceUsd).catch(() => null);
  const lessons = approxLessons(wallet?.balanceUsd ?? pkg.allowanceUsd);
  const tail = tutorFlow(ctx)
    ? "Продолжаем урок — просто отправь свой ответ 🎤"
    : "Выбери тему и начнём! /learn";
  await ctx.reply(
    `✅ <b>Готово! Баланс пополнен.</b>\n💎 Теперь у тебя ≈ <b>${lessons} ур.</b>\n\n${tail}`,
    { parse_mode: "HTML" },
  );
}

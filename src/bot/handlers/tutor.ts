import { InlineKeyboard, InputFile } from "grammy";
import type { BotContext, Flow } from "../context.js";
import { esc } from "../../util/format.js";
import { hasTutorLLM, hasGemini } from "../../config.js";
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
import { getTutorReply, nextMastery } from "../../tutor/engine.js";
import type { LearnerProfile, LessonContext, TutorReply } from "../../tutor/types.js";
import { downloadTelegramFile, toBase64 } from "../../services/voice.js";
import { transcribeSpeech } from "../../services/gemini.js";
import { synthesizeSpeech, generateImage } from "../../services/media.js";

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

/** Render the tutor's light Markdown (**bold**, *italic*, `code`) as Telegram HTML. */
function renderTutorHtml(text: string): string {
  let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  s = s.replace(/\*(.+?)\*/g, "<i>$1</i>");
  s = s.replace(/`(.+?)`/g, "<code>$1</code>");
  return s;
}

/** Send a tutor message with formatting; fall back to plain text if HTML fails. */
async function replyRich(
  ctx: BotContext,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
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
  const [progress, profile] = await Promise.all([
    getAllProgress(id).catch(() => []),
    getProfile(id).catch(() => null),
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
  // Default is Russian help; offer a one-tap switch to English (and back).
  const inEnglish = (profile?.nativeLanguage ?? "Russian").toLowerCase() === "english";
  if (inEnglish) kb.text("🇷🇺 Объяснять по-русски", "lrn:lang:ru");
  else kb.text("🇬🇧 Switch to English", "lrn:lang:en");

  await ctx.reply(
    "📚 <b>English A1 — choose a topic</b>\nWe'll go step by step. Tap a topic, then a lesson.",
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

  const prev = await getLessonProgress(telegramId(ctx), topicId, lessonId).catch(() => null);
  const startMastery = Math.max(1, prev?.mastery ?? 0) as 1 | 2 | 3;

  ctx.session.flow = {
    kind: "tutor",
    topicId,
    lessonId,
    mastery: startMastery,
    history: [],
    pendingQuiz: null,
    awaiting: "none",
  };
  await setLessonMastery(telegramId(ctx), topicId, lessonId, startMastery).catch(() => {});

  await ctx.reply(
    `▶️ <b>${esc(topic.title)} — ${esc(lesson.title)}</b>\n🎯 <i>${esc(lesson.canDo)}</i>`,
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

/** Generate and send an illustrative picture (best-effort; silent on failure). */
async function sendImage(ctx: BotContext, prompt: string): Promise<void> {
  try {
    await ctx.replyWithChatAction("upload_photo");
  } catch {
    /* non-fatal */
  }
  try {
    const img = await generateImage(prompt);
    if (img) await ctx.replyWithPhoto(new InputFile(img, "vocab.png"));
  } catch (err) {
    console.error("tutor image failed:", err);
  }
}

/** Speak an English line as a voice note (best-effort; silent on failure). */
async function sendVoice(ctx: BotContext, text: string): Promise<void> {
  try {
    await ctx.replyWithChatAction("record_voice");
  } catch {
    /* non-fatal */
  }
  try {
    const ogg = await synthesizeSpeech(text);
    if (ogg) await ctx.replyWithVoice(new InputFile(ogg, "tutor.ogg"));
  } catch (err) {
    console.error("tutor voice failed:", err);
  }
}

/** Render a tutor turn: persist mastery, show the message, set up what's next. */
async function renderReply(ctx: BotContext, reply: TutorReply | null): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return;

  if (!reply) {
    await ctx.reply("⚠️ I had trouble reaching the tutor. Try again in a moment, or /menu to exit.");
    return;
  }

  // Update mastery from this turn.
  const updated = nextMastery(flow.mastery, reply.masteryDelta, reply.lessonComplete);
  flow.mastery = updated;
  await setLessonMastery(telegramId(ctx), flow.topicId, flow.lessonId, updated).catch(() => {});

  // Record the tutor's turn for conversation continuity.
  const assistantText = (reply.correction ? `(${reply.correction})\n` : "") + reply.say;
  flow.history.push({ role: "tutor", text: assistantText });

  // A gentle correction, then an optional picture.
  if (reply.correction) await replyRich(ctx, `✏️ ${reply.correction}`);
  if (reply.image) await sendImage(ctx, reply.image);

  // Lesson finished.
  if (reply.lessonComplete) {
    flow.pendingQuiz = null;
    flow.awaiting = "none";
    if (reply.say.trim()) await replyRich(ctx, reply.say);
    if (reply.voiceText) await sendVoice(ctx, reply.voiceText);
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
    if (reply.say.trim()) await replyRich(ctx, reply.say);
    if (reply.voiceText) await sendVoice(ctx, reply.voiceText);
    const kb = new InlineKeyboard();
    reply.quiz.options.forEach((opt, i) => {
      kb.text(`${String.fromCharCode(65 + i)}. ${opt}`, `lrn:q:${i}`).row();
    });
    await replyRich(ctx, `❓ ${reply.quiz.question}`, kb);
    return;
  }

  // Normal turn — ask for a spoken or typed reply, and show which.
  flow.pendingQuiz = null;
  const want: "voice" | "text" | "none" =
    reply.expect === "text" ? "text" : reply.expect === "none" ? "none" : "voice";
  flow.awaiting = want;
  const hintHtml =
    want === "voice"
      ? "\n\n🎤 <i>Reply with a voice message.</i>"
      : want === "text"
        ? "\n\n⌨️ <i>Type your answer.</i>"
        : "";
  try {
    await ctx.reply(renderTutorHtml(reply.say) + hintHtml, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  } catch {
    const plain =
      want === "voice"
        ? "\n\n🎤 Reply with a voice message."
        : want === "text"
          ? "\n\n⌨️ Type your answer."
          : "";
    try {
      await ctx.reply(reply.say + plain);
    } catch {
      /* ignore */
    }
  }
  if (reply.voiceText) await sendVoice(ctx, reply.voiceText);
}

// ── Student input ────────────────────────────────────────────────────────────

export async function tutorOnText(ctx: BotContext, text: string): Promise<void> {
  const flow = tutorFlow(ctx);
  if (!flow) return;
  if (flow.awaiting === "quiz") {
    await ctx.reply("👆 Tap one of the answer buttons above (or /menu to leave the lesson).");
    return;
  }
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

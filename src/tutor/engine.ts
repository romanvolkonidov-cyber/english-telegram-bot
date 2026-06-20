import { callClaude, type ClaudeMessage } from "../services/claude.js";
import type { LearnerProfile, LessonContext, TutorReply, TutorTurn } from "./types.js";

/**
 * The conversation engine: turns the curriculum + learner state into a Claude
 * prompt, and parses Claude's structured reply back into something the bot can
 * render and grade. All teaching content is generated here at runtime.
 */

/** How many recent turns of history to send (keeps prompts small and cheap). */
const HISTORY_WINDOW = 12;

export function buildSystemPrompt(profile: LearnerProfile, lesson: LessonContext): string {
  const native = profile.nativeLanguage || "Russian";
  const bilingual =
    native.toLowerCase() === "english"
      ? "Teach entirely in English, kept very simple (A1). Only drop in a word of the student's own language if they are truly stuck."
      : `The student is a ${native}-speaking beginner who cannot yet follow a lesson run only in English. Conduct the lesson in ${native}: greetings, instructions, explanations, encouragement and corrections all in ${native}. English is the TARGET — the target words, example sentences, and whatever you ask the student to say or write are in English (add a short ${native} gloss when it helps). Keep ${native} as the working language throughout A1; do NOT drift into English-only.`;

  const facts = [
    `Topic: ${lesson.topicTitle}`,
    `Lesson: ${lesson.lessonTitle} (focus: ${lesson.focus})`,
    `Goal — the student should be able to: ${lesson.canDo}`,
    lesson.grammar ? `Grammar target: ${lesson.grammar}` : "",
    lesson.vocab?.length ? `Target vocabulary: ${lesson.vocab.join(", ")}` : "",
    lesson.fn ? `Communication function: ${lesson.fn}` : "",
    lesson.note ? `Teaching hint: ${lesson.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a warm, patient, funny human English tutor giving a live one-on-one online lesson to a complete beginner (CEFR A1).

TEACHING STYLE
- Sound like a real person in a live lesson, not a textbook. Keep each message short (2–5 sentences).
- Be encouraging and human: praise real effort, use light humor, never be cold or robotic.
- Be Socratic: get the student producing English. Ask ONE thing at a time, then wait.
- Always correct mistakes kindly: note what was off and show the natural version, but lead with what was good.
- Adapt to the student: if they struggle, slow down, simplify, give a hint or a clearer example; if they're confident, speed up and raise the challenge.
- ${bilingual}
- YOU SPEAK TO THE STUDENT. Everything in "say" becomes a VOICE message — this is how you communicate, like a real tutor talking out loud. Write "say" the way you'd actually say it: natural, warm, short. No markdown or asterisks in "say" (it is spoken, not shown).
- Put in "board" ONLY what the student needs to SEE in writing — the English word or sentence to read/repeat, or a written-exercise prompt. Most speaking turns need no board (leave it null). You may use *italic*/**bold** in "board" since it is displayed.
- VOICE vs TEXT reply — set "expect": "voice" when you want the student to SPEAK (the default — conversation, pronunciation, speaking practice); "text" when you want them to TYPE (spelling, writing, word-order exercises).
- The student may answer by voice or text either way — accept whatever they send.

THIS LESSON
${facts}
Teach toward the goal: briefly introduce the point, give one or two clear examples, then have the student try it. Use a short multiple-choice check when it helps. When the student can reach the goal reliably (usually after a few good tries), set "lessonComplete": true and congratulate them.

OUTPUT — respond with ONLY a JSON object (no markdown, no code fences, no text outside it):
{
  "say": string,                 // what you SAY OUT LOUD (becomes a voice message). Natural spoken language, no markdown. Speak any correction of the student here, kindly.
  "board": string | null,         // text to SHOW on screen — the English word/sentence to read, or a written-exercise prompt. null on pure speaking turns. Keep it short.
  "image": string | null,         // a few words describing ONE simple picture (e.g. "a red apple"); only for concrete vocabulary; null otherwise
  "quiz": null | { "question": string, "options": [string, ...2-4 items], "correctIndex": number, "explain": string },
  "expect": "voice" | "text" | "quiz" | "none",   // "voice" = you want them to SPEAK (default); "text" = you want them to TYPE; "quiz" if you asked a multiple-choice question; "none" to just continue
  "masteryDelta": number,         // how much this turn moved them toward the goal, from -1 to +2
  "lessonComplete": boolean
}
Set "expect" to "quiz" whenever "quiz" is not null. "say" is always spoken — keep it short and natural. Use "board" only when the student must SEE something written. Use "image" mainly in vocabulary lessons.`;
}

function toMessages(history: TutorTurn[]): ClaudeMessage[] {
  const recent = history.slice(-HISTORY_WINDOW);
  return recent.map((turn) => ({
    role: turn.role === "tutor" ? "assistant" : "user",
    content: turn.text,
  }));
}

/** Pull a JSON object out of the model's reply, tolerating stray text/fences. */
function parseReply(raw: string): TutorReply {
  let text = raw.trim();
  // Strip code fences if the model added them despite instructions.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1]!.trim();
  // Otherwise grab the outermost braces.
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }

  try {
    const obj = JSON.parse(text) as Partial<TutorReply>;
    const quiz =
      obj.quiz &&
      typeof obj.quiz.question === "string" &&
      Array.isArray(obj.quiz.options) &&
      obj.quiz.options.length >= 2
        ? {
            question: obj.quiz.question,
            options: obj.quiz.options.slice(0, 4).map(String),
            correctIndex: Math.max(
              0,
              Math.min(obj.quiz.options.length - 1, Number(obj.quiz.correctIndex) || 0),
            ),
            explain: typeof obj.quiz.explain === "string" ? obj.quiz.explain : "",
          }
        : null;
    return {
      say: typeof obj.say === "string" && obj.say.trim() ? obj.say.trim() : raw.trim(),
      board: typeof obj.board === "string" && obj.board.trim() ? obj.board.trim() : null,
      image: typeof obj.image === "string" && obj.image.trim() ? obj.image.trim() : null,
      quiz,
      expect: quiz
        ? "quiz"
        : obj.expect === "text" || obj.expect === "none" || obj.expect === "voice"
          ? obj.expect
          : "voice",
      masteryDelta: Number.isFinite(obj.masteryDelta as number) ? Number(obj.masteryDelta) : 0,
      lessonComplete: Boolean(obj.lessonComplete),
    };
  } catch {
    // Not valid JSON — fall back to treating the whole thing as the message.
    return {
      say: raw.trim(),
      board: null,
      image: null,
      quiz: null,
      expect: "voice",
      masteryDelta: 0,
      lessonComplete: false,
    };
  }
}

/** Ask the tutor for its next turn. Returns null only if the AI is unreachable. */
export async function getTutorReply(
  profile: LearnerProfile,
  lesson: LessonContext,
  history: TutorTurn[],
): Promise<TutorReply | null> {
  const messages = toMessages(history);
  // Claude requires the first message to be from the user; seed one if needed.
  if (messages.length === 0 || messages[0]!.role !== "user") {
    messages.unshift({ role: "user", content: "Let's start the lesson." });
  }
  const raw = await callClaude({
    system: buildSystemPrompt(profile, lesson),
    messages,
    maxTokens: 900,
    temperature: 0.6,
    cacheSystem: true,
  });
  if (raw === null) return null;
  return parseReply(raw);
}

/** Move mastery toward the new value, clamped to 0..3; completion jumps to 3. */
export function nextMastery(prev: number, delta: number, complete: boolean): 0 | 1 | 2 | 3 {
  if (complete) return 3;
  const next = Math.round(prev + delta);
  return Math.max(0, Math.min(3, next)) as 0 | 1 | 2 | 3;
}

import { callClaude, type ClaudeMessage } from "../services/claude.js";
import { toBase64 } from "../services/voice.js";
import type { LearnerProfile, LessonContext, TutorReply, TutorTurn } from "./types.js";

/**
 * The conversation engine: turns the curriculum + learner state into a Claude
 * prompt, and parses Claude's structured reply back into something the bot can
 * render and grade. All teaching content is generated here at runtime.
 */

/** How many recent turns of history to send (keeps prompts small and cheap). */
const HISTORY_WINDOW = 12;

/** The tutor's persona: a female English name, presented as the owner's assistant. */
const TUTOR_NAME = "Emily";
const OWNER_NAME = "Roman";

export function buildSystemPrompt(profile: LearnerProfile, lesson: LessonContext): string {
  const level = lesson.level || "A1";
  const target = lesson.target || "English";
  const levelDesc =
    level === "A2"
      ? "an elementary learner (CEFR A2): they already know the basics — the present tense, everyday vocabulary, simple questions — and are ready for the past, the future, plans, and slightly longer sentences"
      : "a complete beginner (CEFR A1)";
  const native = profile.nativeLanguage || "Russian";
  const immersion = native.toLowerCase() === target.toLowerCase(); // help language == target
  const moreTarget =
    level === "A2"
      ? ` Since the student is A2, you can use a little more simple ${target} for familiar things, but switch back to ${native} the moment something is new or hard.`
      : "";
  const bilingual = immersion
    ? `Teach entirely in ${target}, kept simple and clear for CEFR ${level}. Only drop in a word of the student's own language if they are truly stuck.`
    : `The student is a ${native}-speaking learner of ${target} at CEFR ${level} who cannot yet follow a whole lesson run only in ${target}. Conduct the lesson in ${native}: greetings, instructions, explanations, encouragement and corrections all in ${native}. ${target} is the TARGET — the target words, example sentences, and whatever you ask the student to say or write are in ${target} (add a short ${native} gloss when it helps). Keep ${native} as the working language at this level; do NOT drift into ${target}-only.${moreTarget}`;

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

  return `You are a warm, patient, funny human ${target} tutor giving a live one-on-one online lesson to ${levelDesc}.

TEACHING STYLE
- YOUR IDENTITY: your name is ${TUTOR_NAME} and you are ${OWNER_NAME}'s ${target} assistant. At the VERY START of a lesson (your first message, when the student hasn't said anything yet) greet the student and introduce yourself ONCE, in ${native}, as ${TUTOR_NAME}, ${OWNER_NAME}'s ${target} assistant — then begin teaching. Do NOT introduce yourself again on any later turn.
- ANSWER QUESTIONS anytime. The student may ask you anything about ${target} — grammar, a word, pronunciation, why a rule works, a translation, how to say something. When they ask, ANSWER it clearly and helpfully first (in ${native}, with ${target} examples), then continue the lesson. Welcome questions warmly like a real tutor. If they ask something truly unrelated to learning ${target}, answer briefly or kindly steer back.
- Sound like a real person in a live lesson, not a textbook. Keep messages focused; an explanation can run a little longer, but break it into digestible pieces — never a wall of text.
- Be encouraging and human: praise real effort, use light humor, never be cold or robotic.
- TEACH FIRST, then be Socratic. Present and explain the point clearly before you ask the student to produce it — never jump straight to "say X". Once it's taught, ask one thing at a time and let them practice.
- Always correct mistakes kindly: note what was off and show the natural version, but lead with what was good.
- Adapt to the student: if they struggle, slow down, simplify, give a hint or a clearer example; if they're confident, speed up and raise the challenge.
- ${bilingual}
- YOU SPEAK TO THE STUDENT. Everything in "say" becomes a VOICE message — this is how you communicate, like a real tutor talking out loud. Write "say" the way you'd actually say it: natural, warm, short. No markdown or asterisks in "say" (it is spoken, not shown).
- Alongside your voice you can SHOW short written text via "board" — the ${target} word/sentence, the rule, or example sentences the student needs to SEE. It appears as a normal chat message right after your voice. NEVER call it "the board" or tell the student to "look at the board" (никакой «доски») — just present it naturally (e.g. "вот примеры:" / "смотри:"). Leave "board" null on pure speaking turns.
- FORMAT "board" with rich Markdown (Telegram renders it): **bold** for key forms, *italic* for the ${native} gloss or a note, \`code\` for a single target word, "> " to put the rule in a quote box, "- " for lists, an occasional small "### " sub-heading, and a Markdown TABLE for things like a verb conjugation, e.g.

| Subject | be | Example |
|---|---|---|
| I | am | I am reading |

  Keep boards compact and clean — a short quote-box rule plus a small table or a few example lines is ideal.
- VOICE FIRST — speaking is the most important skill. MOST practice should have the student SAY their answer out loud (set "expect":"voice"). Use "expect":"text" only for genuinely written tasks (spelling, word order, a written fill-in-the-blank) and "quiz" for multiple choice.
- MAKE THE ACTION CRYSTAL-CLEAR AND SPECIFIC. The app does NOT add any "reply" hint — YOUR words are the only instruction, so the student must know EXACTLY what to do. End every turn by telling them precisely what to do and with which words: «Скажи вслух: I am reading.» / «Скажи это предложение про себя вслух.» / «Напиши пропущенное слово.» / «Выбери правильный вариант ниже.» NEVER end with a vague «ответь» / «попробуй» / "reply" with nothing concrete to reply. Give exactly ONE such instruction per turn.
- EVERY turn must end with that one concrete task or question to do RIGHT NOW. After an explanation, do NOT stop at «понятно?» alone — either ask a check the student can actually answer («Скажи «понятно», если ясно, или задай вопрос»), or (better) give the first small exercise immediately with an exact instruction. Never leave the student wondering what to reply.
- The student may answer by voice or text either way — accept whatever they send.

THIS LESSON
${facts}

TARGET — you are teaching ${target}. The hints above (vocabulary, grammar, function) name the THEME and the communicative GOAL, sometimes written with English examples. Teach the ${target} words and the ${target} grammar that achieve the can-do goal; convert EVERY hint into ${target}${
    target === "English" ? "" : ` (e.g. greetings, numbers, the present tense — taught in ${target}, NOT in English)`
  }. Follow the can-do GOAL above the exact grammar label. Any examples written in English in this prompt only show the FORMAT — always produce your own examples in ${target}.

SCOPE — teach and test ONLY what belongs to this lesson:
- Practise ONLY this lesson's grammar/vocabulary target plus what the student already learned in EARLIER lessons. NEVER introduce or test anything not yet taught — no new grammar, no new words, nothing borrowed from a later lesson. For example, do NOT ask «как часто / how often» (frequency), comparatives, the past, the future, etc., unless this or an earlier lesson actually taught it. Every example and every exercise must use only structures the student already knows. If an answer would need an untaught word/structure, pick a different exercise.
- But within that scope teach the target COMPLETELY — do not teach only a fragment. If the target is a verb form, cover ALL the persons and patterns it includes (e.g. simple present affirmative = I/you/we/they + base verb AND he/she/it + verb-s: works, lives, studies), not just «I/you/we/they». Give examples and practice for every form in the target. Still, don't spill into a DIFFERENT lesson's target (e.g. if this lesson is statements, don't drift into questions or the negative).

HOW TO TEACH IT — follow this arc across several turns; do NOT skip to practice:
1. PRESENT — give a COMPLETE explanation, not a vague intro. For a grammar lesson the student must come away knowing all three: (a) the MEANING / when to use it; (b) the FORM — the exact structure or formula (e.g. present continuous = am/is/are + verb-ing, and which subject takes am / is / are); and (c) 3–4 example sentences for different subjects, each with a short ${native} gloss. Explain it in ${native} by voice, and show the formula + the examples as written text. It must be genuinely enough to understand and use the rule before any practice — don't just name it and jump to one example. Deliver the WHOLE explanation in THIS one turn (voice explains meaning + form; the written formula and examples go in "board") and finish it with a quick check like «Понятно? Давай попробуем!» — never give a teaser such as «давай объясню по порядку» and stop. (Vocabulary: for EACH new word SHOW a picture of it — set "image" to that word/object — together with the meaning and an example; a beginner remembers a word far better when they SEE it. Pronunciation: model the sound, then example words.)
2. CHECK. Ask whether it's clear or if they have questions (e.g. "Понятно? Есть вопросы?"), and answer simply before moving on.
3. PRACTICE — make it RICH, VARIED and PRACTICAL. There is NO fixed number of exercises: keep going until the student is genuinely solid on the goal. ROTATE exercise types so it never feels repetitive, and use real-life A1 sentences (ordering food, texting a friend, describing a photo, daily routine), not abstract drills. One exercise per turn; react to each answer, correct kindly, then give the next. Rotate among:
   • Multiple choice — use the "quiz" field (renders as tap-buttons).
   • Fill the gap — a sentence with a blank in "board"; ask for the missing word(s). Make it a REAL task: if you put a verb in brackets, choose a subject/form where the answer DIFFERS from the bracketed word (third-person -s «She ___ (live)» → lives; a negative «He ___ (not / like)» → doesn't like; an irregular past «I ___ (go) yesterday» → went). NEVER make a gap whose answer is simply the word already in brackets (e.g. «They ___ (live)» → "live") — that is trivial copying, not practice.
   • Unscramble — jumbled words in "board" (e.g. «cooking / is / she / dinner»); ask them to put them in order.
   • Picture task — set "image" to a real-life scene AND set "imageAsk": true. The bot draws it, shows it to YOU, and THEN you ask the student about what is ACTUALLY in the picture — to describe it using the words/grammar they've learned, or via a multiple-choice grounded in it. Keep "say" a brief lead-in here (e.g. «Посмотри на картинку…»); you'll ask the real question once you see it.
   • Listening — ONLY when the words to hear live in "say" (spoken) and appear NOWHERE in writing: put a SHORT ${target} line or mini-dialogue in "say" (${target} only; do NOT repeat it in "board" or in quiz options), then ask about it. If the sentences are written anywhere (in "board" or as quiz options), it is NOT a listening task — never say «послушай»/"listen"; say «прочитай и выбери»/"read and choose".
   • Reading — a 2–4 sentence paragraph in "board", then a question about it.
   • Free production — they say their own real sentences out loud.
   Default answers to SPEAKING (expect "voice"); use "text" only for fill-the-gap / unscramble / spelling, and "quiz" for multiple choice.
   ADAPT to performance: when the student gets something wrong, gently correct it and give ANOTHER exercise of the SAME type (then a similar one) until they get it right before moving on — spend extra time on whatever is hard, and move quickly past what they've clearly mastered. Reflect this in "masteryDelta" (negative on a miss, positive on a clean answer).
4. Finish only when the student can do every part of the goal correctly and consistently — including the types they struggled with at first. Give the student plenty of room to make mistakes (around ten is completely normal): each time, re-explain simply and give another of the same type until they get it. If they're still struggling after a lot of practice (roughly 30+ exchanges), don't loop forever: consolidate the key point, praise their effort, set "lessonComplete": true, and suggest doing this lesson again next time.
Present the full explanation first; never ask the student to produce the target before you've taught it. End EVERY turn with one clear, SPECIFIC next step that tells the student exactly what to do and how (say it aloud / type it / choose an option) — never a vague «ответь». Set "expect" to match. Never leave them unsure what to do next.

OUTPUT — respond with ONLY a raw JSON object: no code fences, no \`\`\`, no text before or after it. It MUST be valid JSON — inside every string value write any line break as \\n (escaped) and NEVER put a real line break inside a string value; and to quote a ${target} word inside your speech use single quotes 'like this' (never raw double-quotes inside a value — they corrupt the JSON). For example, a board with a table is one string: "board": "**Present Simple**\\n\\n| Subject | Verb |\\n|---|---|\\n| I | work |".
{
  "say": string,                 // what you SAY OUT LOUD (becomes a voice message). Natural spoken language, no markdown. Speak any correction of the student here, kindly.
  "board": string | null,         // text to SHOW on screen — the ${target} word/sentence to read, or a written-exercise prompt. null on pure speaking turns. Keep it short.
  "image": string | null,         // a few words describing ONE clear picture to draw. Use for a NEW VOCABULARY word, or occasionally a scene to describe — NOT on plain grammar-practice turns. null when no picture is needed.
  "imageAsk": boolean,            // true ONLY when the picture IS the task (student must describe / answer about it): the bot shows it to you first, then you ask about what's really in it. false for a plain illustration.
  "quiz": null | { "question": string, "options": [string, ...2-4 items], "correctIndex": number, "explain": string },
  "expect": "voice" | "text" | "quiz",   // what the student should do next: "voice" = SPEAK (default), "text" = TYPE, "quiz" = answer the multiple-choice you included
  "masteryDelta": number,         // how much this turn moved them toward the goal, from -1 to +2
  "lessonComplete": boolean
}
Every turn MUST end by inviting the student to act: finish your spoken message with a short check or question (e.g. «Понятно? Давай попробуем!») and set "expect" to "quiz" (if you included one) else "voice" or "text". "say" is always spoken. Use "board" for text the student must SEE (never call it a "board" out loud). Use "image" mainly to picture a NEW VOCABULARY word, and occasionally for a "describe the picture" task (set "imageAsk": true so you SEE the real picture first). Do NOT request a picture on ordinary grammar-practice turns — leave "image" null there.`;
}

function toMessages(history: TutorTurn[]): ClaudeMessage[] {
  const recent = history.slice(-HISTORY_WINDOW);
  return recent.map((turn) => ({
    role: turn.role === "tutor" ? "assistant" : "user",
    content: turn.text,
  }));
}

/** True if a string is actually a leaked JSON object rather than spoken text. */
function looksLikeJson(s: string | null): boolean {
  if (!s) return false;
  const t = s.trimStart();
  return t.startsWith("{") && /"(say|board|expect|masteryDelta|lessonComplete)"\s*:/.test(t);
}

function unescapeJson(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\");
}

/** Pull one `"key": "value"` string field out of a JSON-ish blob, tolerating
 *  literal newlines inside the value (which break strict JSON.parse). */
function salvageString(blob: string, key: string): string | null {
  const m = blob.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  const v = m ? unescapeJson(m[1]!).trim() : "";
  return v ? v : null;
}

/** Pull a candidate JSON object out of the model's reply (strip fences / prose). */
function extractJsonCandidate(raw: string): string {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1]!.trim();
  if (!t.startsWith("{")) {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end > start) t = t.slice(start, end + 1);
  }
  return t;
}

/**
 * Turn the model's reply into a TutorReply. Robust by design: the model often
 * emits multi-line `board` values with real line breaks (invalid JSON) or gets
 * truncated, so strict JSON.parse fails — in that case we salvage each field by
 * regex. Returns null when no usable `say` can be extracted, so the caller can
 * retry the generation instead of ever showing a raw-JSON blob or a confusing
 * "could you repeat?" line (which, if shown, poisons the history).
 */
function parseReply(raw: string): TutorReply | null {
  const candidate = extractJsonCandidate(raw);
  let obj: Partial<TutorReply> | null = null;
  try {
    obj = JSON.parse(candidate) as Partial<TutorReply>;
  } catch {
    obj = null;
  }

  const sayStr =
    (obj && typeof obj.say === "string" && obj.say.trim() ? obj.say.trim() : null) ??
    salvageString(candidate, "say") ??
    salvageString(raw, "say");
  const boardStr =
    (obj && typeof obj.board === "string" && obj.board.trim() ? obj.board.trim() : null) ??
    salvageString(candidate, "board");
  const imageStr =
    (obj && typeof obj.image === "string" && obj.image.trim() ? obj.image.trim() : null) ??
    salvageString(candidate, "image");

  const quiz =
    obj?.quiz &&
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

  const expectRaw =
    (obj && typeof obj.expect === "string" ? obj.expect : null) ??
    raw.match(/"expect"\s*:\s*"(voice|text|quiz)"/)?.[1] ??
    null;
  const masteryDelta =
    obj && Number.isFinite(obj.masteryDelta as number)
      ? Number(obj.masteryDelta)
      : Number(raw.match(/"masteryDelta"\s*:\s*(-?\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const lessonComplete =
    obj && typeof obj.lessonComplete === "boolean"
      ? obj.lessonComplete
      : /"lessonComplete"\s*:\s*true/.test(raw);

  const image = looksLikeJson(imageStr) ? null : imageStr;
  const board = looksLikeJson(boardStr) ? null : boardStr;
  if (!sayStr || looksLikeJson(sayStr)) return null; // unusable — caller retries

  return {
    say: sayStr,
    board,
    image,
    imageAsk: (obj ? Boolean(obj.imageAsk) : /"imageAsk"\s*:\s*true/.test(raw)) && image !== null,
    quiz,
    expect: quiz ? "quiz" : expectRaw === "text" ? "text" : "voice",
    masteryDelta,
    lessonComplete,
  };
}

/** Reply plus the real USD cost of producing it (for wallet metering). */
export interface TutorTurnResult {
  reply: TutorReply;
  costUsd: number;
}

/** Ask the tutor for its next turn. Returns null only if the AI is unreachable. */
export async function getTutorReply(
  profile: LearnerProfile,
  lesson: LessonContext,
  history: TutorTurn[],
  nudge?: string,
): Promise<TutorTurnResult | null> {
  const messages = toMessages(history);
  // Claude requires the first message to be from the user; seed one if needed.
  if (messages.length === 0 || messages[0]!.role !== "user") {
    messages.unshift({ role: "user", content: "Let's start the lesson." });
  }
  if (nudge) messages.push({ role: "user", content: nudge });
  const system = buildSystemPrompt(profile, lesson);
  const call = () =>
    callClaude({ system, messages, maxTokens: 1200, temperature: 0.6, cacheSystem: true });

  const result = await call();
  if (!result) return null;
  let reply = parseReply(result.text);
  let costUsd = result.costUsd;
  // Most parse failures are a single bad generation (e.g. an unescaped quote/newline
  // breaking the JSON). Retry once before giving up — never show a "repeat?" fallback,
  // which would land in history and make the model echo it.
  if (!reply) {
    const retry = await call();
    if (retry) {
      costUsd += retry.costUsd;
      reply = parseReply(retry.text);
    }
  }
  if (!reply) return null; // give up cleanly; the bot shows a "try again" and history stays clean
  return { reply, costUsd };
}

/**
 * Grounded picture task: the tutor asked to SHOW a picture and ask about it. The
 * bot has now generated that picture and passes the actual bytes here so the
 * tutor can LOOK at it and ask a question (or build a multiple-choice) about what
 * is really in the image — not just what it requested. Returns the grounded turn.
 */
export async function describeImageTurn(
  profile: LearnerProfile,
  lesson: LessonContext,
  history: TutorTurn[],
  image: Uint8Array,
  mediaType: string,
  scenePrompt: string,
): Promise<TutorTurnResult | null> {
  const messages = toMessages(history);
  if (messages.length === 0 || messages[0]!.role !== "user") {
    messages.unshift({ role: "user", content: "Let's start the lesson." });
  }
  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text:
          `[This is the picture you asked to show the student (you requested: "${scenePrompt}"). ` +
          "LOOK at it carefully and base your task ONLY on what is ACTUALLY visible. " +
          "Give ONE task about it using this lesson's words and grammar, of a kind you can grade later " +
          "WITHOUT seeing the picture again: EITHER a multiple-choice grounded in the image (use the " +
          '"quiz" field — correctIndex must match what is really shown), OR ask them to DESCRIBE the ' +
          `picture / say a sentence about it in ${lesson.target} (any correct ${lesson.target} sentence is fine). Avoid open factual ` +
          "questions whose answer can't be checked without the image. If the image differs from what you " +
          'asked for, adapt to it. Reply in the SAME JSON format, with "image" null and "imageAsk" false.]',
      },
      { type: "image", source: { type: "base64", media_type: mediaType, data: toBase64(image) } },
    ],
  });
  const result = await callClaude({
    system: buildSystemPrompt(profile, lesson),
    messages,
    maxTokens: 900,
    temperature: 0.5,
    cacheSystem: true,
  });
  if (!result) return null;
  const reply = parseReply(result.text);
  if (!reply) return null;
  // The picture is already on screen; never re-trigger generation from this turn.
  reply.image = null;
  reply.imageAsk = false;
  return { reply, costUsd: result.costUsd };
}

/** Move mastery toward the new value, clamped to 0..3; completion jumps to 3. */
export function nextMastery(prev: number, delta: number, complete: boolean): 0 | 1 | 2 | 3 {
  if (complete) return 3;
  const next = Math.round(prev + delta);
  return Math.max(0, Math.min(3, next)) as 0 | 1 | 2 | 3;
}

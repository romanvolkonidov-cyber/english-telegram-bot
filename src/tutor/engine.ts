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

/** The tutor's persona: a female English name. */
const TUTOR_NAME = "Violet";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function buildSystemPrompt(profile: LearnerProfile, lesson: LessonContext): string {
  const level = lesson.level || "A1";
  const target = lesson.target || "English";
  const levelDesc =
    level === "B1"
      ? "an intermediate learner (CEFR B1): they can already handle everyday conversation, the main tenses (present, past, future), and connected sentences — and are ready for the present perfect, narrative past, conditionals, the passive, modals of deduction/obligation, relative clauses, and gerund vs infinitive, in longer and more natural discourse"
      : level === "A2"
        ? "an elementary learner (CEFR A2): they already know the basics — the present tense, everyday vocabulary, simple questions — and are ready for the past, the future, plans, and slightly longer sentences"
        : "a complete beginner (CEFR A1)";
  const native = profile.nativeLanguage || "Russian";
  // Greet the student by THEIR name when we know it. Never leak any other name
  // (e.g. the bot owner's) — without a known name, greet warmly with no name.
  const studentName = (profile.name || "").trim();
  const nameGuidance = studentName
    ? `The student's name is ${studentName} — you may greet them by it.`
    : `You do NOT know the student's name — greet them warmly WITHOUT using any name, and never guess or invent one.`;
  const immersion = native.toLowerCase() === target.toLowerCase(); // help language == target
  const nativeIsRussian = native.toLowerCase().startsWith("rus");
  // The illustrative phrases throughout this prompt are written in Russian. When the
  // student's language is NOT Russian, spell out that those are only examples — otherwise
  // the model tends to open the lesson in Russian even though the help language is set
  // to something else.
  const langWarn = nativeIsRussian
    ? ""
    : ` This prompt shows some example phrases written in Russian (e.g. «Скажи вслух», «Понятно?») — those are ONLY illustrations of tone; ALWAYS express them in ${native}, and NEVER address the student in Russian.`;
  const moreTarget =
    level === "B1"
      ? ` Since the student is B1, you can run more of the lesson in simple ${target} — explanations, instructions, and examples — dropping back to ${native} only to clarify something genuinely new, tricky, or abstract.`
      : level === "A2"
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
    lesson.vocab?.length
      ? `Vocabulary seed (these are EXAMPLES, not the full list — teach these AND more on the same theme): ${lesson.vocab.join(", ")}`
      : "",
    lesson.fn ? `Communication function: ${lesson.fn}` : "",
    lesson.note ? `Teaching hint: ${lesson.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a warm, patient, funny human ${target} tutor giving a live one-on-one online lesson to ${levelDesc}. You teach natural, everyday AMERICAN English — the real language Americans speak: contractions, common phrasal verbs, everyday expressions (gonna, wanna, kinda — in context, at A2+), real-life vocabulary. Not stiff textbook English. Not British English. American.

LANGUAGE — your working/help language is ${native}, and you use it from your VERY FIRST message onward. Write EVERYTHING you address to the student in ${native}: the greeting, your self-introduction, explanations, instructions, praise and corrections. The ${target} you are teaching appears only as the target words/sentences and as whatever you ask the student to say, write, or read.${langWarn}

TEACHING STYLE
- YOUR IDENTITY: your name is ${TUTOR_NAME} and you are the student's friendly personal ${target} assistant. ${nameGuidance} At the VERY START of a lesson (your first message, when the student hasn't said anything yet) greet the student and introduce yourself ONCE, in ${native}, as ${TUTOR_NAME}, their ${target} assistant — then, in ONE short sentence, tell them the real-life payoff of today's lesson: what they will actually be able to DO after it (e.g. «После урока сможешь заказать кофе по-английски» or «Ты научишься рассказывать о себе в аэропорту»). Keep it concrete and motivating, then begin teaching. Do NOT introduce yourself again on any later turn.
- ANSWER QUESTIONS anytime. The student may ask you anything about ${target} — grammar, a word, pronunciation, why a rule works, a translation, how to say something. When they ask, ANSWER it clearly and helpfully first (in ${native}, with ${target} examples), then continue the lesson. Welcome questions warmly like a real tutor. If they ask something truly unrelated to learning ${target}, answer briefly or kindly steer back.
- AMERICAN ENGLISH — always model the American pronunciation, American spelling (color not colour, apartment not flat, subway not tube, elevator not lift, etc.), and American idioms. Every example sentence should sound like something a real American would actually say in daily life. Avoid stiff or formal constructions unless the lesson specifically calls for formal register.
- PRACTICAL EVERYDAY LANGUAGE — every lesson, whatever its focus (grammar, vocabulary, pronunciation), MUST arm the student with at least 2–3 complete, ready-to-use sentences they can say out loud in a real situation TODAY. Not isolated words. Not abstract rules. Real sentences: ordering at a coffee shop, texting a friend, shopping, talking about weekend plans, describing your apartment. Introduce these sentences early and make sure the student can produce them by the end. If there are two equally correct options, always pick the one that sounds more natural in casual American speech.
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
- WHEN YOU SHOW ${target} TEXT TO READ, never leave it at a bare «посмотри»/"look at this" — always give a concrete thing to DO with it. A natural, friendly move is to ask the student to READ IT ALOUD and send it as a voice message (set "expect":"voice"), e.g. «Прочитай это вслух и пришли голосовым.» Reading aloud is great speaking practice. At this presenting/reading stage keep it light — let them read and warmly encourage them; you don't need to nit-pick every sound. Save detailed correction for the focused practice exercises.
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
1. PRESENT — give a COMPLETE, PROFESSIONAL-QUALITY explanation, not a surface-level intro. This is a real language programme, not street chat — the student deserves a thorough explanation that gives genuine understanding, not just a rough idea. For a grammar lesson the student must come away knowing all five: (a) the MEANING — what this form EXPRESSES and WHEN to use it (the communicative situation, not just an abstract label); (b) the FORM — the exact structure or formula stated precisely (e.g. present continuous = subject + am/is/are + verb-ing, with which pronoun takes am / is / are spelled out); (c) the UNDERLYING LOGIC — a brief, clear 'why': why the language works this way (e.g. 'am/is/are' shows WHO is doing it; '-ing' shows it's happening RIGHT NOW). One or two plain sentences of reasoning make a rule stick far better than blind memorisation; (d) 5–6 DIVERSE real-life example sentences covering the full range of the pattern — different subjects, different everyday situations, each with a short ${native} gloss — not just the simplest case but the whole picture; (e) ONE common mistake students make and the quick fix (e.g. 'часто забывают «is» и говорят «She reading» — это неправильно; правильно: «She IS reading»'). Explain all of this in ${native} by voice, and show the formula + every example + the mistake tip as written text in "board". It must be genuinely solid: a student who grasps it should understand the logic and feel confident. But keep the language simple and accessible for this level — depth and clarity together, never complexity for its own sake. Deliver the WHOLE explanation in THIS one turn (voice explains meaning + form + logic; formula, all examples, and mistake tip go in "board") and finish with a quick check like «Понятно? Давай попробуем!» — never give a teaser such as «давай объясню по порядку» and stop. PRESENT IT ONCE: after you have taught the rule, do NOT explain it again or re-show the rule/table later in the same lesson — the student has already seen it; if they slip, give a quick one-line reminder, never the whole lecture again. (Vocabulary: the seed words above are only EXAMPLES — teach a GENEROUS set of at least 10–12 common, useful ${target} words on this theme (include the seeds, then add more that fit the theme and the student's level). Introduce them in small batches of 3–4 at a time, and for EACH new word SHOW a picture of it — set "image" to that word/object — with the meaning and a short example; a beginner remembers a word far better when they SEE it. Practise a batch briefly, then move on to the NEXT batch of new words — do NOT spend the whole lesson drilling the same handful, and do not keep re-testing words the student already says confidently. Pronunciation: model the sound, then example words. SENTENCE WRAP-UP: once ALL the word batches have been introduced and briefly drilled, close the vocabulary presentation with exactly 3 turns of SENTENCE PRACTICE — short, useful real-life American sentences that use the new words. Each turn: show one simple sentence on the board using a word from this lesson (in a real everyday context: a coffee shop order, a text to a friend, a supermarket situation — whatever fits the topic), say it aloud, then ask the student to say it back (expect "voice"). These 3 turns are the bridge between «I learned the word» and «I can actually use it»; make them feel immediately useful.)
2. CHECK. Ask whether it's clear or if they have questions (e.g. "Понятно? Есть вопросы?"), and answer simply before moving on.
3. PRACTICE — make it RICH, VARIED and PRACTICAL. There is NO fixed number of exercises: keep going until the student is genuinely solid on the goal. BRIDGE FROM THE EXPLANATION: your FIRST 1–2 exercises must use the exact sentences or words from your opening explanation — transform one of your own board examples into a fill-the-gap or unscramble, or ask the student to produce a sentence using one of the exact words you just showed. This anchors practice directly to what was just taught; the student recognises the material and builds confidence before moving to fresh contexts. After those bridging exercises, introduce new situations that apply the same pattern. ROTATE exercise types so it never feels repetitive, and use real-life A1 sentences (ordering food, texting a friend, describing a photo, daily routine), not abstract drills. One exercise per turn; react to each answer, correct kindly, then give the next. Rotate among:
   • Multiple choice — use the "quiz" field (renders as tap-buttons).
   • Fill the gap — a sentence with a blank in "board"; ask for the missing word(s). Make it a REAL task: if you put a verb in brackets, choose a subject/form where the answer DIFFERS from the bracketed word (third-person -s «She ___ (live)» → lives; a negative «He ___ (not / like)» → doesn't like; an irregular past «I ___ (go) yesterday» → went). NEVER make a gap whose answer is simply the word already in brackets (e.g. «They ___ (live)» → "live") — that is trivial copying, not practice.
   • Unscramble — jumbled words in "board" (e.g. «cooking / is / she / dinner»); ask them to put them in order.
   • Picture task — set "image" to a real-life scene AND set "imageAsk": true. The bot draws it, shows it to YOU, and THEN you ask the student about what is ACTUALLY in the picture — to describe it using the words/grammar they've learned, or via a multiple-choice grounded in it. Keep "say" a brief lead-in here (e.g. «Посмотри на картинку…»); you'll ask the real question once you see it.
   • Listening — ONLY when the words to hear live in "say" (spoken) and appear NOWHERE in writing: put a SHORT ${target} line or mini-dialogue in "say" (${target} only; do NOT repeat it in "board" or in quiz options), then ask about it. If the sentences are written anywhere (in "board" or as quiz options), it is NOT a listening task — never say «послушай»/"listen"; say «прочитай и выбери»/"read and choose".
   • Reading — a 2–4 sentence paragraph in "board", then a question about it.
   • Free production — they say their own real sentences out loud.
   Default answers to SPEAKING (expect "voice"); use "text" only for fill-the-gap / unscramble / spelling, and "quiz" for multiple choice.
   ADAPT to performance: when the student gets something wrong, gently correct it and give ANOTHER, slightly DIFFERENT exercise on the same point — vary the wording every time; never make them redo the identical item over and over. Spend a little extra time on what's hard, and move quickly past what they've clearly mastered. Reflect this in "masteryDelta" (negative on a miss, positive on a clean answer).
   DON'T TRAP THE STUDENT IN REPETITION — never ask them to repeat the SAME word or sentence more than once or twice. If it's still not right after two tries, give a quick tip (or simply model it and let them move on) and continue warmly; you can come back to it in a later turn. Endless «ещё раз» / "say it again" is exactly how students get annoyed and quit.
   PRONUNCIATION IS NOT PASS/FAIL — accents and tricky sounds differ from person to person and improve slowly over time. Accept ANY reasonable attempt, praise the effort, offer at most ONE gentle tip, then MOVE ON. Never demand a perfect repeat and never loop on the same sound; reassure the student that small imperfections are completely normal.- NEVER ASK TO RESEND A VOICE MESSAGE — voice answers go through automatic transcription which is imperfect. Whatever appears as "[spoken aloud …]" is the student's attempt: grade it generously based on the intent, give feedback on it, and continue. Even if the transcript looks garbled or unclear, treat it as an honest try. NEVER say anything like "I didn't catch that", "could you repeat?", "try again" or "send your voice message again" — just respond to what you got.4. KEEP IT FOCUSED AND BRING IT TO AN END. This is a SHORT micro-lesson, not an endless session. As soon as the student has shown they can do the goal — roughly 6–10 good answers across a few different exercise types — WRAP UP: give a short, warm recap of what they practised today, praise them, and close with ONE concrete sentence reminding them of the real-life payoff they can now use (e.g. «Теперь ты можешь попросить счёт в любом ресторане»), then set "lessonComplete": true. Ending on a success is good teaching; do NOT keep piling on exercises once they're clearly getting it. A student who is doing well should finish in about 8–12 exchanges total. Only a genuinely struggling student needs more — give them plenty of room (around ten mistakes is normal) — but even then never drag past ~20 exchanges: consolidate the key point, praise the effort, set "lessonComplete": true, and suggest repeating the lesson next time.
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

function looksLikeStudentImageMisread(reply: TutorReply): boolean {
  const text = `${reply.say}\n${reply.board ?? ""}`.toLowerCase();
  return (
    /\b(your|you)\s+(picture|photo|image|drawing)\b/.test(text) ||
    /\b(picture|photo|image)\s+you\s+(sent|uploaded|showed|shared)\b/.test(text) ||
    /\byou\s+(sent|uploaded|showed|shared)\s+(a|an|this|the)?\s*(picture|photo|image)\b/.test(text) ||
    /ты\s+(прислал|прислала|отправил|отправила|показал|показала).{0,24}(картин|фото|изображен)/i.test(text) ||
    /(твоя|твоё|твое|ваша|ваше).{0,16}(картин|фото|изображен)/i.test(text)
  );
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

/** The fields of a TutorReply, used to anchor where one value ends and the next
 *  begins when salvaging a value that contains stray unescaped double-quotes. */
const REPLY_KEYS = "say|board|image|imageAsk|quiz|expect|masteryDelta|lessonComplete";

/**
 * Pull one `"key": "value"` string field out of a JSON-ish blob. Robust to the
 * two ways the model breaks strict JSON: literal newlines inside the value, and
 * UNescaped inner double-quotes (e.g. quoting an English word with "). The primary
 * regex captures lazily up to the next known field key or the closing brace, so an
 * inner " no longer truncates the value; a strict well-formed match is the fallback.
 */
function salvageString(blob: string, key: string): string | null {
  // Primary: value runs until the next known key ("…", "board": …) or the end "}".
  const loose = blob.match(
    new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"(?:${REPLY_KEYS})"\\s*:|\\}\\s*$)`),
  );
  if (loose) {
    const v = unescapeJson(loose[1]!).trim();
    if (v) return v;
  }
  // Fallback: a strictly well-formed JSON string value (escaped quotes only).
  const strict = blob.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (strict) {
    const v = unescapeJson(strict[1]!).trim();
    if (v) return v;
  }
  return null;
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
function parseReply(raw: string, allowProse = true): TutorReply | null {
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

  // Last resort: if Claude returned plain prose (no JSON keys at all), use the raw
  // text as the spoken message so the lesson doesn't stall. Only when allowed (the
  // caller forbids this on early attempts so it can escalate for proper JSON first).
  const isPlainProse =
    allowProse &&
    !raw.trimStart().startsWith("{") &&
    !/("say"|"board"|"expect"|"masteryDelta"|"lessonComplete")\s*:/.test(raw);
  const finalSay = sayStr ?? (isPlainProse ? raw.trim().slice(0, 1000) : null);

  if (!finalSay || looksLikeJson(finalSay)) return null; // unusable — caller retries

  return {
    say: finalSay,
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
  // Remind the model to respond with JSON on every turn — plain prose is a
  // known failure mode when the long system prompt is served from cache.
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && typeof lastMsg.content === "string") {
    lastMsg.content += "\n\n[Respond with ONLY a valid JSON object as specified in the system prompt.]";
  }
  const system = buildSystemPrompt(profile, lesson);

  // Retry BOTH transient API failures (overload/network) AND unparseable generations
  // (an unescaped quote/newline can corrupt one response). The real cost of every
  // attempt is accumulated so the wallet is metered fairly. We never fall back to a
  // canned "could you repeat?" line — that would land in history and be echoed forever.
  let costUsd = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await callClaude({
      system,
      messages,
      maxTokens: 1200,
      temperature: attempt === 0 ? 0.6 : 0.3, // calmer sampling on a retry → cleaner JSON
      cacheSystem: true,
      prefill: "{",
    });
    // callClaude already retried transient API errors internally; a null here means a
    // genuine outage, so we stop rather than hammer it.
    if (!result) {
      console.error(`Tutor reply failed: Claude returned no usable response (attempt ${attempt + 1}/3).`);
      return null;
    }
    costUsd += result.costUsd;
    // callClaude already restored any prefill, so the text is complete on every backend.
    // Accept plain prose only on the LAST attempt — earlier ones escalate for real JSON.
    const reply = parseReply(result.text, attempt === 2);
    if (reply) return { reply, costUsd };
    console.error(
      `Tutor reply parse failed (attempt ${attempt + 1}/3): ` +
        result.text.replace(/\s+/g, " ").slice(0, 300),
    );
    // Escalate: some backends (e.g. AWS, which can't use assistant prefill) occasionally
    // reply in prose instead of JSON. Show the model its bad output and explicitly demand
    // JSON-only next time. These corrective messages are LOCAL — never saved to history.
    if (attempt < 2) {
      messages.push({ role: "assistant", content: result.text.slice(0, 400) });
      messages.push({
        role: "user",
        content:
          "That was not valid JSON. Reply to the SAME point again, but output ONLY the JSON " +
          "object specified in the system prompt — start with { and end with }, with the keys " +
          "say, board, image, imageAsk, quiz, expect, masteryDelta, lessonComplete. No text before or after.",
      });
      await sleep(300);
    }
  }
  return null; // give up cleanly; the bot shows a soft retry note and history stays clean
}

/**
 * After a lesson finishes, pull the list of target-language words/phrases the
 * student actually practised, from the lesson transcript. Used for the admin
 * "words learned" report — best-effort, returns [] if the call fails. Kept cheap
 * (tiny output, temperature 0) and NOT metered to the student: it's an owner tool.
 */
export async function extractLearnedWords(
  lesson: LessonContext,
  history: TutorTurn[],
): Promise<string[]> {
  const target = lesson.target || "English";
  const transcript = history
    .map((t) => `${t.role}: ${t.text}`)
    .join("\n")
    .slice(-6000);
  if (!transcript.trim()) return [];
  const result = await callClaude({
    system: `You extract vocabulary from a ${target} lesson transcript. Return ONLY a JSON array of strings.`,
    messages: [
      {
        role: "user",
        content:
          `List the ${target} words and short phrases that were TAUGHT or PRACTISED in this lesson ` +
          `(only ${target}-language items the student learned — not the help-language glosses). ` +
          `Return ONLY a JSON array like ["word","phrase"], max 20 items, no duplicates.\n\n` +
          `Transcript:\n${transcript}`,
      },
    ],
    maxTokens: 300,
    temperature: 0,
    prefill: "[",
  });
  if (!result) return [];
  try {
    const raw = result.text.trimStart();
    const text = raw.startsWith("[") ? raw : "[" + raw;
    const end = text.lastIndexOf("]");
    const arr = JSON.parse(end !== -1 ? text.slice(0, end + 1) : text) as unknown;
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))].slice(0, 20);
  } catch {
    return [];
  }
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
  leadIn?: string,
): Promise<TutorTurnResult | null> {
  const messages = toMessages(history);
  if (messages.length === 0 || messages[0]!.role !== "user") {
    messages.unshift({ role: "user", content: "Let's start the lesson." });
  }
  // Record the tutor's own lead-in ("look at this picture…") as an assistant turn, so
  // the picture that follows is clearly understood as the one YOU asked to show — not
  // something the student sent. This prevents the image being mistaken for an answer.
  if (leadIn?.trim()) messages.push({ role: "assistant", content: leadIn.trim() });
  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text:
          "[APP-GENERATED TEACHING IMAGE — NOT A STUDENT MESSAGE. This image is carried in a user-role " +
          "message only because the API accepts image blocks there; semantically it is app/developer context. " +
          "The student has NOT answered anything, has NOT sent a photo, and has NOT uploaded this image. " +
          `The picture below was generated by the app at YOUR request (you asked for: "${scenePrompt}") ` +
          "so you can show it and ask about it. NEVER say or imply that the student sent/shared/showed/uploaded it. " +
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
  // The image makes this call pricier, so retry just once — but cover both an API
  // hiccup and an unparseable reply, accumulating cost. On total failure the caller
  // still shows the picture with the original lead-in (a graceful fallback).
  const system = buildSystemPrompt(profile, lesson);
  let costUsd = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callClaude({
      system,
      messages,
      maxTokens: 900,
      temperature: attempt === 0 ? 0.5 : 0.3,
      cacheSystem: true,
    });
    if (!result) {
      console.error(`Tutor image turn failed: Claude returned no usable response (attempt ${attempt + 1}/2).`);
      return null; // callClaude already retried transient errors
    }
    costUsd += result.costUsd;
    const reply = parseReply(result.text);
    if (reply) {
      if (looksLikeStudentImageMisread(reply)) {
        console.error(
          `Tutor image turn misread app image as student image (attempt ${attempt + 1}/2): ` +
            result.text.replace(/\s+/g, " ").slice(0, 300),
        );
        if (attempt < 1) {
          await sleep(300);
          continue;
        }
        return null;
      }
      // The picture is already on screen; never re-trigger generation from this turn.
      reply.image = null;
      reply.imageAsk = false;
      return { reply, costUsd };
    }
    console.error(
      `Tutor image turn parse failed (attempt ${attempt + 1}/2): ` +
        result.text.replace(/\s+/g, " ").slice(0, 300),
    );
    if (attempt < 1) await sleep(300);
  }
  return null;
}

/** Move mastery toward the new value, clamped to 0..3; completion jumps to 3. */
export function nextMastery(prev: number, delta: number, complete: boolean): 0 | 1 | 2 | 3 {
  if (complete) return 3;
  const next = Math.round(prev + delta);
  return Math.max(0, Math.min(3, next)) as 0 | 1 | 2 | 3;
}

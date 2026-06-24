import { callClaude } from "../services/claude.js";

/** CEFR level pairs available in the game. */
export const GAME_LEVELS: { from: string; to: string; label: string }[] = [
  { from: "A1", to: "A2", label: "A1 → A2" },
  { from: "A2", to: "B1", label: "A2 → B1" },
  { from: "B1", to: "B2", label: "B1 → B2" },
  { from: "B2", to: "C1", label: "B2 → C1" },
  { from: "C1", to: "C2", label: "C1 → C2" },
];

export interface GameRound {
  word: string;
  definition: string;
  options: string[];      // 4 options, shuffled
  correctIndex: number;
  explain: string;        // why the correct option is the best synonym
  /** Why each distractor is NOT correct. Keys are the distractor words. */
  distractorExplains: Record<string, string>;
  /** Real USD cost of the LLM calls for this round (generation + verification). */
  costUsd: number;
}

const SYSTEM = `You are an English vocabulary trainer generating word game rounds. Return ONLY valid JSON — no markdown, no code fences.`;

/** Pull a JSON object out of a model reply, tolerating ```json fences and stray
 *  prose (Haiku via the AWS gateway can't use the "{" prefill, so it sometimes
 *  wraps JSON in a code block). Returns null if no parseable object is found. */
function parseJsonObject<T>(raw: string): T | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Generate a round, then verify it with a cheap fast model. The verifier checks
 * the two failure modes that actually hurt the game: (1) the "correct" option must
 * really be a synonym of the word, and (2) none of the distractors may ALSO be a
 * synonym (a question must have exactly one right answer). If a round fails, we
 * regenerate once. Verification is fail-open: if the verifier is unreachable we
 * keep the round rather than dead-end the player. All call costs are accumulated.
 */
export async function generateRound(
  fromLevel: string,
  toLevel: string,
  nativeLanguage: string,
  usedWords: string[],
): Promise<GameRound | null> {
  let last: GameRound | null = null;
  let verifyCost = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const round = await generateRoundOnce(fromLevel, toLevel, nativeLanguage, usedWords);
    if (!round) continue;
    last = round;
    const correct = round.options[round.correctIndex] ?? "";
    const distractors = round.options.filter((_, i) => i !== round.correctIndex);
    const v = await verifyRound(round.word, correct, distractors);
    verifyCost += v.costUsd;
    if (v.valid) return { ...round, costUsd: round.costUsd + verifyCost };
  }
  // No round passed verification in 2 tries — show the last one anyway (better than
  // a dead-end; the generation prompt already aims for correctness), cost included.
  return last ? { ...last, costUsd: last.costUsd + verifyCost } : null;
}

/**
 * Cheap second-opinion check on a generated round. Returns valid=false only when
 * the verifier is confident the correct answer is wrong OR another option is also
 * a synonym. Fail-open (valid=true) on any outage/parse error.
 */
async function verifyRound(
  word: string,
  correct: string,
  distractors: string[],
): Promise<{ valid: boolean; costUsd: number }> {
  const prompt =
    `You are vetting a multiple-choice synonym question for an English learner. Judge it like a dictionary, not loosely.\n` +
    `WORD: "${word}"\n` +
    `Marked correct answer: "${correct}"\n` +
    `Other options: ${distractors.map((d) => `"${d}"`).join(", ")}\n\n` +
    `Rules for a VALID question:\n` +
    `- "correct" must be a genuine, dictionary-grade synonym of WORD — interchangeable in a normal sentence with essentially the same meaning. If it's only loosely related, a different sense, or a near-miss, it is NOT valid.\n` +
    `- NONE of the other options may be a synonym of WORD (there must be exactly ONE defensible right answer).\n` +
    `Return ONLY this JSON: {"correctIsSynonym": true|false, "otherSynonyms": ["any other option that is ALSO a real synonym of WORD"]}`;
  const result = await callClaude({
    system: "You are a precise English lexicographer. Be strict. Return ONLY valid JSON, no prose.",
    messages: [{ role: "user", content: prompt }],
    maxTokens: 150,
    temperature: 0,
    prefill: "{",
  });
  if (!result) return { valid: true, costUsd: 0 }; // verifier down → don't block play
  const obj = parseJsonObject<{ correctIsSynonym?: boolean; otherSynonyms?: unknown[] }>(result.text);
  if (!obj) return { valid: true, costUsd: result.costUsd }; // unparseable → keep the round
  const others = Array.isArray(obj.otherSynonyms) ? obj.otherSynonyms : [];
  const valid = obj.correctIsSynonym === true && others.length === 0;
  return { valid, costUsd: result.costUsd };
}

/** Generate a single candidate round (one LLM call). */
async function generateRoundOnce(
  fromLevel: string,
  toLevel: string,
  nativeLanguage: string,
  usedWords: string[],
): Promise<GameRound | null> {
  // Show the model the recent history so it actively varies the word it picks —
  // this is the main defense against the game looping over the same few words.
  const avoid =
    usedWords.length > 0
      ? `\nAlready shown to this learner — DO NOT reuse ANY of these, pick something clearly different:\n${usedWords.slice(-60).join(", ")}.`
      : "";

  const prompt =
    `Generate one vocabulary-synonym game round for an English learner.\n` +
    `The MAIN WORD must be a genuine CEFR ${fromLevel} item; the SYNONYM must be a step up at CEFR ${toLevel}.\n` +
    `Student's native language: ${nativeLanguage}${avoid}\n\n` +
    `Return ONLY this JSON object:\n` +
    `{\n` +
    `  "word": "a genuine CEFR ${fromLevel} English word or short phrase",\n` +
    `  "definition": "an ACCURATE, precise meaning in ${nativeLanguage} (max 8 words) — not a loose approximation",\n` +
    `  "correct": "the best CEFR ${toLevel} synonym (a word OR phrase)",\n` +
    `  "distractors": ["${toLevel} item related but NOT a synonym", "another ${toLevel} non-synonym", "a third ${toLevel} non-synonym"],\n` +
    `  "explain": "2 short sentences in ${nativeLanguage}: (1) the PRECISE meaning of word and of correct — do NOT oversimplify (e.g. 'miserable' is 'extremely unhappy/wretched', NOT just 'sad'); (2) the real nuance — how correct differs from word (strength, register, connotation, or a typical collocation)",\n` +
    `  "distractorExplains": { "<each distractor word>": "1 sentence in ${nativeLanguage} explaining exactly why this word does NOT fit — what it actually means and why it cannot replace word in this context" }\n` +
    `}\n\n` +
    `Rules:\n` +
    `- ACCURACY ABOVE ALL: use only well-established, dictionary-grade synonyms. If you are not fully certain that word and correct are genuinely interchangeable, pick a different, clearer pair. A careful teacher with a dictionary must agree.\n` +
    `- correct: EXACTLY ONE genuine synonym of word — interchangeable in a normal sentence with the same meaning — at CEFR ${toLevel} and clearly more advanced than word. There must be ONLY ONE defensible right answer.\n` +
    `- distractors: 3 CHALLENGING ${toLevel} words/phrases that are plausible and tempting but are CLEARLY NOT synonyms of word (a careful teacher would mark each one wrong). Same topic/register, or look/sound similar. Never a true synonym, never equal to correct, no duplicates. CRITICAL: all four options (correct + 3 distractors) must have clearly different meanings from each other — no two of the four may be synonyms or near-synonyms of one another, so no two options on screen could be swapped for each other.\n` +
    `- word: the difficulty level is the POINT of the game. It MUST genuinely belong to CEFR ${fromLevel} — not easier. For B1/B2/C1 that means a real ${fromLevel} word, NOT a beginner A1/A2 word. A single word or a short phrase are both fine.\n` +
    `- VARIETY IS CRITICAL: choose a fresh word each round and rotate across many topics (work, emotions, nature, society, abstract ideas, science, daily life, travel, opinions). Do NOT default to the same handful of words or always to phrasal verbs — surprise the player every time.\n` +
    `- keep everything 100% clean and appropriate for ALL ages: nothing rude, scary, sexual, violent, political, or offensive.\n` +
    `- all four options must be different.\n` +
    `- definition: short but accurate; explain: precise and genuinely informative (max 2 sentences).`;

  const result = await callClaude({
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 500,
    temperature: 1.0, // high sampling → more variety in the chosen word
    prefill: "{",
  });
  if (!result) return null;

  interface RoundJSON {
    word?: string;
    definition?: string;
    correct?: string;
    distractors?: unknown[];
    explain?: string;
    distractorExplains?: Record<string, unknown>;
  }

  const obj = parseJsonObject<RoundJSON>(result.text);

  if (
    !obj?.word?.trim() ||
    !obj.correct?.trim() ||
    !Array.isArray(obj.distractors) ||
    obj.distractors.length < 3
  ) {
    return null;
  }

  // Build the option pool, dropping any distractor that duplicates the correct
  // answer (case-insensitively) or another distractor — otherwise two buttons
  // could both be "correct", or a real synonym could slip in as a wrong answer.
  const correct = obj.correct.trim();
  const seen = new Set([correct.toLowerCase()]);
  const distractors: string[] = [];
  for (const d of obj.distractors.map((x) => String(x).trim())) {
    const key = d.toLowerCase();
    if (!d || seen.has(key)) continue;
    seen.add(key);
    distractors.push(d);
    if (distractors.length === 3) break;
  }
  // Need a full set of plausible wrong answers; a degenerate round isn't worth showing.
  if (distractors.length < 3) return null;

  // Shuffle the four options, tracking the correct item's index explicitly so we
  // don't rely on post-shuffle string search (which could fail with duplicate text).
  const pool = [correct, ...distractors];
  let correctIndex = 0; // correct starts at pool[0]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    if (correctIndex === i) correctIndex = j;
    else if (correctIndex === j) correctIndex = i;
  }

  // Pull distractor explanations from the model (string values only).
  const rawDE = obj.distractorExplains ?? {};
  const distractorExplains: Record<string, string> = {};
  for (const d of distractors) {
    const v = rawDE[d];
    if (typeof v === "string" && v.trim()) distractorExplains[d] = v.trim();
  }

  return {
    word: obj.word.trim(),
    definition: (obj.definition ?? "").trim(),
    options: pool,
    correctIndex,
    explain: (obj.explain ?? "").trim(),
    distractorExplains,
    costUsd: result.costUsd,
  };
}

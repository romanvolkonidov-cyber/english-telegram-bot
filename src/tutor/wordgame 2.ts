import { callClaude } from "../services/claude.js";
import { config } from "../config.js";

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
  /** Claude cost only — the image cost is added by the handler, and is $0 on a
   *  cache hit (see gameImages.ts). */
  costUsd: number;
  /** A real-life scene/object to picture for this word; the handler turns it into
   *  an image (or reuses a cached one). */
  imagePrompt: string;
}

const SYSTEM = `You are an English vocabulary trainer generating word game rounds. Return ONLY valid JSON — no markdown, no code fences.`;

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
    `Check a synonym question for an English learner game.\n` +
    `WORD: "${word}"\n` +
    `Marked correct answer: "${correct}"\n` +
    `Other options (these should NOT be synonyms of WORD): ${distractors.map((d) => `"${d}"`).join(", ")}\n\n` +
    `A synonym can replace WORD in a sentence with essentially the same meaning. Be strict but fair.\n` +
    `Return ONLY this JSON: {"correctIsSynonym": true|false, "otherSynonyms": ["any of the other options that are ALSO a synonym of WORD"]}`;
  const result = await callClaude({
    system: "You are a precise English lexicographer. Return ONLY valid JSON, no prose.",
    messages: [{ role: "user", content: prompt }],
    maxTokens: 150,
    temperature: 0,
    prefill: "{",
    model: config.claudeFastModel,
  });
  if (!result) return { valid: true, costUsd: 0 }; // verifier down → don't block play
  try {
    const raw = result.text.trimStart();
    const text = raw.startsWith("{") ? raw : "{" + raw;
    const end = text.lastIndexOf("}");
    const obj = JSON.parse(end !== -1 ? text.slice(0, end + 1) : text) as {
      correctIsSynonym?: boolean;
      otherSynonyms?: unknown[];
    };
    const others = Array.isArray(obj.otherSynonyms) ? obj.otherSynonyms : [];
    const valid = obj.correctIsSynonym === true && others.length === 0;
    return { valid, costUsd: result.costUsd };
  } catch {
    return { valid: true, costUsd: result.costUsd }; // unparseable → keep the round
  }
}

/** Generate a single candidate round (one Claude call). */
async function generateRoundOnce(
  fromLevel: string,
  toLevel: string,
  nativeLanguage: string,
  usedWords: string[],
): Promise<GameRound | null> {
  const avoid =
    usedWords.length > 0
      ? `\nAvoid these already-used words: ${usedWords.slice(-30).join(", ")}.`
      : "";

  const prompt =
    `Generate one vocabulary-synonym game round.\n` +
    `Main item level: ${fromLevel}  |  Synonym level: ${toLevel}\n` +
    `Student language: ${nativeLanguage}${avoid}\n\n` +
    `Return ONLY this JSON object:\n` +
    `{\n` +
    `  "word": "a common ${fromLevel} English word OR short phrase",\n` +
    `  "definition": "brief meaning in ${nativeLanguage} (max 8 words)",\n` +
    `  "imagePrompt": "vivid 6-word English scene or object for the item",\n` +
    `  "correct": "the best ${toLevel} synonym (a word OR phrase)",\n` +
    `  "distractors": ["${toLevel} item related but NOT a synonym", "another ${toLevel} non-synonym", "a third ${toLevel} non-synonym"],\n` +
    `  "explain": "2 short sentences in ${nativeLanguage}: (1) confirm the answer and say what word + correct both mean; (2) a useful nuance — how correct differs from word (register, strength, connotation, or a typical collocation) so the student really understands the pair, not just matches it"\n` +
    `}\n\n` +
    `Rules:\n` +
    `- word: an everyday ${fromLevel} item — a single word OR a short PHRASE. Phrases are encouraged and make the game richer: collocations (e.g. "make a decision", "heavy rain"), phrasal verbs (e.g. "give up", "find out"), and common fixed expressions. Mix it up across rounds; plain words are fine too. Prefer something concrete/picturable when you can.\n` +
    `- correct: EXACTLY ONE genuine synonym of word — a word OR phrase that could replace it in a sentence with the same meaning, at ${toLevel} (e.g. word "give up" → correct "quit"; word "big" → "enormous"; word "make a decision" → "decide"). There must be only ONE defensible right answer.\n` +
    `- distractors: 3 CHALLENGING ${toLevel} words/phrases — plausible and tempting (same topic/register, or a collocation/phrasal verb that LOOKS or SOUNDS synonymous but isn't, e.g. "give up" vs "give away"). Never a true synonym of word, never equal to correct, no duplicates.\n` +
    `- you MAY make ONE distractor a light, playful choice — a sound-alike or look-alike near-miss — to make it fun. Keep it 100% clean and appropriate for ALL ages: nothing rude, scary, sexual, violent, political, or offensive.\n` +
    `- all four options must be different\n` +
    `- imagePrompt: a real-life scene/object that could be a photograph (no text); wholesome and age-appropriate\n` +
    `- definition: keep very short; explain: clear and genuinely informative (max 2 sentences)`;

  const result = await callClaude({
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 400,
    temperature: 0.9,
    prefill: "{",
  });
  if (!result) return null;

  interface RoundJSON {
    word?: string;
    definition?: string;
    imagePrompt?: string;
    correct?: string;
    distractors?: unknown[];
    explain?: string;
  }

  let obj: RoundJSON | null = null;

  try {
    const raw = result.text.trimStart();
    const text = raw.startsWith("{") ? raw : "{" + raw;
    const end = text.lastIndexOf("}");
    obj = JSON.parse(end !== -1 ? text.slice(0, end + 1) : text) as RoundJSON;
  } catch {
    return null;
  }

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

  // Shuffle the four options and track where the correct one lands.
  const pool = [correct, ...distractors];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const correctIndex = pool.indexOf(correct);

  return {
    word: obj.word.trim(),
    definition: (obj.definition ?? "").trim(),
    options: pool,
    correctIndex,
    explain: (obj.explain ?? "").trim(),
    costUsd: result.costUsd,
    imagePrompt: (obj.imagePrompt ?? obj.word).trim(),
  };
}

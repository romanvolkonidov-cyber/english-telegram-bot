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
  /** Claude cost only — the image cost is added by the handler, and is $0 on a
   *  cache hit (see gameImages.ts). */
  costUsd: number;
  /** A real-life scene/object to picture for this word; the handler turns it into
   *  an image (or reuses a cached one). */
  imagePrompt: string;
}

const SYSTEM = `You are an English vocabulary trainer generating word game rounds. Return ONLY valid JSON — no markdown, no code fences.`;

/**
 * Ask Claude to pick a word at `fromLevel`, then produce a correct synonym at
 * `toLevel` plus three plausible-but-wrong distractors. An image prompt is
 * generated so we can show a picture of the main word.
 */
export async function generateRound(
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
    `  "explain": "one sentence in ${nativeLanguage}: why correct is the best synonym"\n` +
    `}\n\n` +
    `Rules:\n` +
    `- word: an everyday ${fromLevel} item — a single word OR a short PHRASE. Phrases are encouraged and make the game richer: collocations (e.g. "make a decision", "heavy rain"), phrasal verbs (e.g. "give up", "find out"), and common fixed expressions. Mix it up across rounds; plain words are fine too. Prefer something concrete/picturable when you can.\n` +
    `- correct: EXACTLY ONE genuine synonym of word — a word OR phrase that could replace it in a sentence with the same meaning, at ${toLevel} (e.g. word "give up" → correct "quit"; word "big" → "enormous"; word "make a decision" → "decide"). There must be only ONE defensible right answer.\n` +
    `- distractors: 3 CHALLENGING ${toLevel} words/phrases — plausible and tempting (same topic/register, or a collocation/phrasal verb that LOOKS or SOUNDS synonymous but isn't, e.g. "give up" vs "give away"). Never a true synonym of word, never equal to correct, no duplicates.\n` +
    `- you MAY make ONE distractor a light, playful choice — a sound-alike or look-alike near-miss — to make it fun. Keep it 100% clean and appropriate for ALL ages: nothing rude, scary, sexual, violent, political, or offensive.\n` +
    `- all four options must be different\n` +
    `- imagePrompt: a real-life scene/object that could be a photograph (no text); wholesome and age-appropriate\n` +
    `- definition and explain: keep short and clear`;

  const result = await callClaude({
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 300,
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

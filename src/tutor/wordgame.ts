import { callClaude } from "../services/claude.js";
import { generateImage, type GeneratedImage } from "../services/media.js";
import { MEDIA_COST_USD } from "./pricing.js";

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
  costUsd: number;
  image: GeneratedImage | null;
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
    `Generate one word-synonym game round.\n` +
    `Main word level: ${fromLevel}  |  Synonym level: ${toLevel}\n` +
    `Student language: ${nativeLanguage}${avoid}\n\n` +
    `Return ONLY this JSON object:\n` +
    `{\n` +
    `  "word": "a common, concrete ${fromLevel} English word",\n` +
    `  "definition": "brief meaning in ${nativeLanguage} (max 8 words)",\n` +
    `  "imagePrompt": "vivid 6-word English scene or object for the word",\n` +
    `  "correct": "the best ${toLevel} synonym",\n` +
    `  "distractors": ["${toLevel} word related but NOT a synonym", "another ${toLevel} non-synonym", "a third ${toLevel} non-synonym"],\n` +
    `  "explain": "one sentence in ${nativeLanguage}: why correct is the best synonym"\n` +
    `}\n\n` +
    `Rules:\n` +
    `- word: everyday practical vocabulary (body, food, feelings, actions, places)\n` +
    `- correct: genuinely more sophisticated synonym at ${toLevel}\n` +
    `- distractors: plausible ${toLevel} words from the same topic, but NOT synonyms\n` +
    `- definition and explain: keep short and clear`;

  const result = await callClaude({
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 300,
    temperature: 0.9,
    prefill: "{",
  });
  if (!result) return null;

  let obj: {
    word?: string;
    definition?: string;
    imagePrompt?: string;
    correct?: string;
    distractors?: unknown[];
    explain?: string;
  } | null = null;

  try {
    const raw = result.text.trimStart();
    const text = raw.startsWith("{") ? raw : "{" + raw;
    const end = text.lastIndexOf("}");
    obj = JSON.parse(end !== -1 ? text.slice(0, end + 1) : text) as typeof obj;
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

  // Shuffle the four options and track where the correct one lands.
  const pool = [obj.correct, ...obj.distractors.slice(0, 3).map(String)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const correctIndex = pool.indexOf(obj.correct);

  const image = await generateImage(obj.imagePrompt ?? obj.word).catch(() => null);
  const imageCost = image ? MEDIA_COST_USD.image : 0;

  return {
    word: obj.word.trim(),
    definition: (obj.definition ?? "").trim(),
    options: pool,
    correctIndex,
    explain: (obj.explain ?? "").trim(),
    costUsd: result.costUsd + imageCost,
    image,
  };
}

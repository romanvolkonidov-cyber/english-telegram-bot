/**
 * Economics for the prepaid "Stars wallet" that funds the /learn AI tutor.
 *
 * A student buys Telegram Stars; that becomes a USD **API allowance** in their
 * wallet. Each lesson burns its REAL measured API cost from the allowance, so a
 * student can never burn more API than they paid for. The margin between what a
 * package is worth to you (stars × STAR_NET_USD) and the allowance it grants is
 * your profit — and it's guaranteed positive for every package below.
 *
 * All money values are USD. Tune the numbers freely — they're all here.
 */

/** What ONE Telegram Star is worth to YOU on withdrawal, after Telegram's cut.
 *  Verify your real payout rate and adjust (commonly ≈ $0.013). */
export const STAR_NET_USD = 0.013;

/** Claude token prices ($ per token) — Sonnet 4.6 (the default teaching model). */
const CLAUDE_RATES = {
  input: 3 / 1_000_000,
  output: 15 / 1_000_000,
  cacheRead: 0.3 / 1_000_000,
  cacheWrite: 3.75 / 1_000_000,
};

export interface ClaudeUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/** Exact Claude cost for one API call, from the response usage. */
export function claudeCostUsd(u: ClaudeUsage): number {
  return (
    (u.input ?? 0) * CLAUDE_RATES.input +
    (u.output ?? 0) * CLAUDE_RATES.output +
    (u.cacheRead ?? 0) * CLAUDE_RATES.cacheRead +
    (u.cacheWrite ?? 0) * CLAUDE_RATES.cacheWrite
  );
}

/** Deliberately-generous flat media costs (USD), so we never under-charge. */
export const MEDIA_COST_USD = {
  tts: 0.01, // one spoken voice note
  image: 0.04, // one generated picture
  stt: 0.01, // transcribing one student voice message
};

/** Rough cost of a typical adaptive lesson (voice every turn, a few pictures,
 *  ~20 exchanges) — used to show the balance as "≈ N lessons". Real spend is
 *  metered per turn, so this only affects the displayed estimate. */
export const TYPICAL_LESSON_USD = 0.5;

/**
 * Top-up packages. `allowanceUsd` = how much API the student may burn; profit =
 * stars × STAR_NET_USD − allowanceUsd (always > 0 here). Bigger packs give more
 * allowance per star = cheaper lessons, which nudges students toward packages.
 */
export interface StarPackage {
  id: string;
  stars: number;
  allowanceUsd: number;
  title: string;
}

// Each package's profit = stars × STAR_NET_USD − allowanceUsd, all > 0:
//   single 100⭐→$1.30 net − $0.70 = $0.60   (≈ 1 lesson  · 100⭐/lesson)
//   pack   600⭐→$7.80 net − $5.50 = $2.30   (≈ 11 lessons ·  55⭐/lesson)
//   big   1400⭐→$18.20 net − $13.00 = $5.20  (≈ 26 lessons ·  54⭐/lesson)
// Bigger packs grant more allowance per star ⇒ cheaper per lesson ⇒ nudge to packages.
export const PACKAGES: StarPackage[] = [
  { id: "single", stars: 100, allowanceUsd: 0.7, title: "1 урок английского" },
  { id: "pack", stars: 600, allowanceUsd: 5.5, title: "Пакет уроков (выгодно)" },
  { id: "big", stars: 1400, allowanceUsd: 13.0, title: "Большой пакет (макс. выгода)" },
];

export function packageById(id: string): StarPackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

/** Show a USD allowance as an approximate number of lessons. */
export function approxLessons(balanceUsd: number): number {
  return Math.max(0, Math.floor(balanceUsd / TYPICAL_LESSON_USD));
}

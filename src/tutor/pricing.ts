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

/** Claude token prices ($ per token) — Opus 4.8 (the default teaching model). */
const CLAUDE_RATES = {
  input: 15 / 1_000_000,
  output: 75 / 1_000_000,
  cacheRead: 1.5 / 1_000_000,
  cacheWrite: 18.75 / 1_000_000,
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

/** Deliberately-generous flat media costs (USD), so the metered spend is always
 *  ≥ what the media actually costs us (the gap is extra margin). */
export const MEDIA_COST_USD = {
  tts: 0.01, // one spoken voice note
  image: 0.04, // one generated picture
  stt: 0.004, // transcribing one student voice message
};

/** Expected cost of one typical lesson — used to display approximate lesson
 *  counts to students and to cap the free trial. Lessons are NOT hard-stopped
 *  at this value; actual spend varies and is reported after each lesson. */
export const LESSON_BUDGET_USD = 1.5;

/** Give every new student ONE free lesson (best conversion hook). The free
 *  lesson is hard-capped at LESSON_BUDGET_USD so it can never run away, and is
 *  recovered on the student's first purchase. Flip to false to require payment
 *  from the very first lesson. */
export const FREE_TRIAL_ENABLED = true;

/**
 * Top-up packages. A package grants `lessons × LESSON_BUDGET_USD` of API
 * allowance — the most a student can ever burn. Bigger packs cost fewer stars
 * per lesson (500 → 450), which makes the pack clearly the better deal.
 */
export interface StarPackage {
  id: string;
  stars: number;
  /** Advertised lessons — the guaranteed MINIMUM (a frugal lesson costs less,
   *  so students often get more). */
  lessons: number;
  /** API allowance granted = lessons × LESSON_BUDGET_USD. */
  allowanceUsd: number;
  /** Short Russian label for the buy menu and the Stars invoice. */
  title: string;
}

export const PACKAGES: StarPackage[] = [
  { id: "pack", stars: 2000, lessons: 10, allowanceUsd: 15.0, title: "10 уроков 🔥" },
];

export function packageById(id: string): StarPackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

/** Net USD a package is worth to us after Telegram's withdrawal cut. */
export function packageNetUsd(p: StarPackage): number {
  return p.stars * STAR_NET_USD;
}

/** Guaranteed profit on a package = what we receive − the most we let them burn. */
export function packageProfitUsd(p: StarPackage): number {
  return Math.round((packageNetUsd(p) - p.allowanceUsd) * 100) / 100;
}

/** Stars the student effectively pays per lesson (lower = better deal). */
export function starsPerLesson(p: StarPackage): number {
  return Math.round(p.stars / p.lessons);
}

/** Show a USD allowance as an approximate number of lessons (the guaranteed min). */
export function approxLessons(balanceUsd: number): number {
  return Math.max(0, Math.floor(balanceUsd / LESSON_BUDGET_USD));
}

// ── Profit guarantee (checked at boot) ───────────────────────────────────────
// A student can NEVER burn more API than `allowanceUsd` (spend is metered and the
// lesson pauses at zero balance), and we receive `packageNetUsd` for the package.
// So as long as allowance < net for every package, profit is mathematically
// guaranteed regardless of lesson length, thinking tokens, mistakes, or retries.
// If a package is ever mis-priced into a loss, crash at startup rather than sell it.
for (const p of PACKAGES) {
  if (p.allowanceUsd !== Math.round(p.lessons * LESSON_BUDGET_USD * 100) / 100) {
    throw new Error(
      `Package "${p.id}" allowance ($${p.allowanceUsd}) != lessons×budget ` +
        `($${(p.lessons * LESSON_BUDGET_USD).toFixed(2)}).`,
    );
  }
  if (p.allowanceUsd >= packageNetUsd(p)) {
    throw new Error(
      `Package "${p.id}" would sell at a LOSS: allowance $${p.allowanceUsd} ≥ ` +
        `net $${packageNetUsd(p).toFixed(2)}. Raise stars or lower allowance.`,
    );
  }
}

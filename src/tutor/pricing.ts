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

/** Per-token prices ($ per token) for one LLM backend. */
export interface TokenRates {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Claude token prices — Sonnet 4.6. */
const CLAUDE_RATES: TokenRates = {
  input: 3 / 1_000_000,
  output: 15 / 1_000_000,
  cacheRead: 0.30 / 1_000_000,
  cacheWrite: 3.75 / 1_000_000,
};

/** DeepSeek token prices — deepseek-v4-flash. No separate cache-write price, so a
 *  cache miss bills at the standard input rate (cacheWrite == input). Roughly 20×
 *  cheaper on input and 50×+ cheaper on output than Sonnet. */
export const DEEPSEEK_RATES: TokenRates = {
  input: 0.14 / 1_000_000,
  output: 0.28 / 1_000_000,
  cacheRead: 0.0028 / 1_000_000,
  cacheWrite: 0.14 / 1_000_000,
};

export interface ClaudeUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/** Exact cost for one API call, from the response usage and the backend's rates. */
export function tokenCostUsd(u: ClaudeUsage, rates: TokenRates = CLAUDE_RATES): number {
  return (
    (u.input ?? 0) * rates.input +
    (u.output ?? 0) * rates.output +
    (u.cacheRead ?? 0) * rates.cacheRead +
    (u.cacheWrite ?? 0) * rates.cacheWrite
  );
}

/** Exact Claude cost for one API call (kept for callers that bill Claude rates). */
export function claudeCostUsd(u: ClaudeUsage): number {
  return tokenCostUsd(u, CLAUDE_RATES);
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
export const LESSON_BUDGET_USD = 0.10;

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

// Both packs are priced at the same 10 ⭐/lesson; the big one is just a larger
// bundle. allowanceUsd = lessons × LESSON_BUDGET_USD. With DeepSeek a real lesson
// costs a fraction of the budget, so these advertised counts are the guaranteed
// minimum — students typically get many more lessons per pack.
export const PACKAGES: StarPackage[] = [
  { id: "small", stars: 60, lessons: 6, allowanceUsd: 0.60, title: "6 уроков" },
  { id: "pack", stars: 150, lessons: 15, allowanceUsd: 1.50, title: "15 уроков 🔥" },
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
  // Require net revenue to clear the allowance (the most a student can burn) by at
  // least 25% — a student can NEVER burn more API than allowanceUsd, so this makes
  // every package mathematically profitable with a ≥25% margin.
  if (packageNetUsd(p) < p.allowanceUsd * 1.25) {
    throw new Error(
      `Package "${p.id}" misses the 25% margin: net $${packageNetUsd(p).toFixed(2)} < ` +
        `allowance×1.25 $${(p.allowanceUsd * 1.25).toFixed(2)}. Raise stars or lower allowance.`,
    );
  }
}

// ── Word-synonym game pricing (flat rate) ─────────────────────────────────────
//
// The game is TEXT-ONLY now (image generation removed), so a round costs almost
// nothing. Pricing is deliberately simple: ONE flat price per round, the same for
// every package and the custom top-up. STAR_NET_USD is what a Star is actually
// worth to us *after* Telegram's cut and conversion — not the price the student
// pays Telegram.

/**
 * Conservative estimate of one round's REAL API cost, now that the game is
 * text-only: ~$0.01 voice note (MEDIA_COST_USD.tts) + ~$0.0003 DeepSeek (two short
 * JSON calls: generate + verify), rounded up for safety. Metered live per round
 * for the profit reports — this constant only drives the boot guard below.
 */
export const GAME_ROUND_COST_USD = 0.012;

/** Profit we want on top of real expenses, as a fraction over cost. */
export const GAME_TARGET_MARGIN = 0.25;

/**
 * THE one knob: a flat price per round, used for every package AND the custom
 * top-up (no per-package discounts). The boot guard refuses to start unless it
 * clears cost + the 25% margin:
 *   net ≥ cost × 1.25  ⇒  2 × $0.013 = $0.026 ≥ $0.012 × 1.25 = $0.015 ✓
 * Change this single number to reprice the whole game.
 */
export const GAME_FLAT_STARS_PER_ROUND = 2;

/** Alias kept for the buy-menu / "free value" hook that shows a per-round price. */
export const GAME_STARS_PER_ROUND = GAME_FLAT_STARS_PER_ROUND;

/**
 * Free trial rounds. Text-only, so each free round now costs us only
 * ~GAME_ROUND_COST_USD (~$0.012) → 20 free rounds ≈ $0.24 of acquisition cost.
 */
export const GAME_FREE_ROUNDS = 20;

/** Admins get a profit report every N rounds a given student plays. */
export const GAME_REPORT_EVERY_ROUNDS = 20;

export interface GamePackage {
  id: string;
  stars: number;
  rounds: number;
  title: string;
}

/**
 * Purchasable top-up packages — all at the SAME flat GAME_FLAT_STARS_PER_ROUND.
 * Bigger packs simply bundle more rounds (no per-round discount). Each pack's
 * stars MUST equal rounds × GAME_FLAT_STARS_PER_ROUND (asserted at boot).
 */
export const GAME_PACKAGES: GamePackage[] = [
  { id: "wg_s", stars: 40,  rounds: 20,  title: "20 раундов"     },
  { id: "wg_m", stars: 120, rounds: 60,  title: "60 раундов 🔥"  },
  { id: "wg_l", stars: 200, rounds: 100, title: "100 раундов 💎" },
];

/** Custom top-up bills at the same flat rate as the packages. */
export const GAME_CUSTOM_STARS_PER_ROUND = GAME_FLAT_STARS_PER_ROUND;

/** Smallest custom top-up we accept (40 ⭐ ≈ 20 rounds at the flat rate). */
export const GAME_CUSTOM_MIN_STARS = 40;

/** Largest custom top-up we accept in a single invoice (keeps amounts sane). */
export const GAME_CUSTOM_MAX_STARS = 1000;

/** Paid rounds a custom Stars amount buys (floored — any leftover Stars are extra
 *  margin; the buy UI shows the exact round count before the student pays). */
export function roundsForCustomStars(stars: number): number {
  return Math.floor(stars / GAME_CUSTOM_STARS_PER_ROUND);
}

export function gamePackageById(id: string): GamePackage | undefined {
  return GAME_PACKAGES.find((p) => p.id === id);
}

/** Stars the student effectively pays per round in this package (lower = better). */
export function gameStarsPerRound(p: GamePackage): number {
  return Math.round(p.stars / p.rounds);
}

/** Net USD we receive for the package after Telegram's cut + conversion. */
export function gamePackageNetUsd(p: GamePackage): number {
  return p.stars * STAR_NET_USD;
}

/** The most this package can cost us in real API spend (rounds × est. round cost). */
export function gamePackageCostUsd(p: GamePackage): number {
  return p.rounds * GAME_ROUND_COST_USD;
}

/** Estimated profit on a package = net revenue − real API cost. */
export function gamePackageProfitUsd(p: GamePackage): number {
  return Math.round((gamePackageNetUsd(p) - gamePackageCostUsd(p)) * 100) / 100;
}

// ── Game profit guarantee (checked at boot) ──────────────────────────────────
// One flat per-round price drives the whole game. Two checks keep every sale
// profitable: (1) the flat rate clears cost + the 25% margin; (2) every package is
// priced at EXACTLY that flat rate, so the menu's "same price for every pack"
// promise is real. Crash at startup rather than ship a mis-priced game.
if (GAME_FLAT_STARS_PER_ROUND * STAR_NET_USD < GAME_ROUND_COST_USD * (1 + GAME_TARGET_MARGIN)) {
  throw new Error(
    `GAME_FLAT_STARS_PER_ROUND (${GAME_FLAT_STARS_PER_ROUND} ⭐) misses the margin: net ` +
      `$${(GAME_FLAT_STARS_PER_ROUND * STAR_NET_USD).toFixed(4)} < cost+margin ` +
      `$${(GAME_ROUND_COST_USD * (1 + GAME_TARGET_MARGIN)).toFixed(4)}. Raise the flat rate.`,
  );
}
for (const p of GAME_PACKAGES) {
  if (p.stars !== p.rounds * GAME_FLAT_STARS_PER_ROUND) {
    throw new Error(
      `Game pack "${p.id}" is not at the flat rate: ${p.stars} ⭐ != ` +
        `${p.rounds} × ${GAME_FLAT_STARS_PER_ROUND} = ${p.rounds * GAME_FLAT_STARS_PER_ROUND} ⭐.`,
    );
  }
}

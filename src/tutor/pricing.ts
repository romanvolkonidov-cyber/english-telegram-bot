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
  cacheRead: 0.30 / 1_000_000,
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
export const LESSON_BUDGET_USD = 0.15;

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
  { id: "pack", stars: 150, lessons: 10, allowanceUsd: 1.50, title: "10 уроков 🔥" },
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

// ── Word-synonym game pricing ─────────────────────────────────────────────────
//
// The economics here are spelled out so the margin is auditable, because the
// game's margin is thin (an image dominates the per-round cost). Everything is
// derived from three knobs: the real cost of a round, the profit margin we want,
// and what a Star is actually worth to us (STAR_NET_USD) — i.e. what lands in our
// account in USD *after* Telegram's cut and the conversion to USDT, NOT the price
// the student pays Telegram.

/**
 * Conservative estimate of one round's REAL API cost:
 *   ~$0.04 image (MEDIA_COST_USD.image) + ~$0.02 Claude (a short structured-JSON
 *   call; comfortably covers Sonnet 4.6 and stays close even on a pricier model).
 * The actual cost is metered live per round and used for the profit reports — this
 * constant only drives pricing and the boot-time guarantee below.
 */
export const GAME_ROUND_COST_USD = 0.06;

/** Profit we want on top of real expenses, as a fraction of our net revenue. */
export const GAME_TARGET_MARGIN = 0.25;

/**
 * Minimum Stars we must charge per round so that, after Telegram + conversion,
 * net revenue (stars × STAR_NET_USD) covers cost AND the target margin:
 *   net ≥ cost × (1 + margin)  ⇒  stars ≥ cost × (1 + margin) / STAR_NET_USD
 * At cost $0.06, margin 25 %, STAR_NET_USD $0.013 → ceil(5.77) = 6 ⭐/round.
 */
export const GAME_MIN_STARS_PER_ROUND = Math.ceil(
  (GAME_ROUND_COST_USD * (1 + GAME_TARGET_MARGIN)) / STAR_NET_USD,
);

/** Nominal single-round price, used for the "free value" hook in the buy menu. */
export const GAME_STARS_PER_ROUND = GAME_MIN_STARS_PER_ROUND;

/**
 * Free trial rounds. NOTE: each free round still costs us ~GAME_ROUND_COST_USD,
 * so 20 free rounds ≈ $1.20 of real acquisition cost per new student. That cost
 * surfaces in the first milestone report (no revenue yet → shown as a loss).
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
 * Purchasable top-up packages. Priced at 7–8 ⭐/round (above the 6 ⭐ floor) so the
 * margin clears 25 % with headroom; bigger pack = cheaper per round = better deal.
 * The boot-time guard below refuses to start if any pack would miss the margin.
 */
export const GAME_PACKAGES: GamePackage[] = [
  { id: "wg_s", stars: 160, rounds: 20, title: "20 раундов"     }, // 8 ⭐/round
  { id: "wg_m", stars: 420, rounds: 60, title: "60 раундов 🔥"  }, // 7 ⭐/round
];

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
// Unlike a lesson, a round's cost isn't hard-capped — but it's small and bounded
// (one short Claude call + one image). As long as each package's net revenue
// clears its estimated cost plus the target margin, every sale is profitable.
// Crash at startup rather than ship a pack that would erode the margin.
for (const p of GAME_PACKAGES) {
  if (gameStarsPerRound(p) < GAME_MIN_STARS_PER_ROUND) {
    throw new Error(
      `Game pack "${p.id}" is ${gameStarsPerRound(p)} ⭐/round, below the ` +
        `${GAME_MIN_STARS_PER_ROUND} ⭐ floor needed for a ${GAME_TARGET_MARGIN * 100}% margin.`,
    );
  }
  const required = gamePackageCostUsd(p) * (1 + GAME_TARGET_MARGIN);
  if (gamePackageNetUsd(p) < required) {
    throw new Error(
      `Game pack "${p.id}" misses the margin: net $${gamePackageNetUsd(p).toFixed(2)} < ` +
        `cost+margin $${required.toFixed(2)}. Raise stars or lower rounds.`,
    );
  }
}

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { tutorDb, col } from "./firebase.js";
import { STAR_NET_USD } from "./pricing.js";

/**
 * Prepaid wallet for the AI tutor. `balanceUsd` is the remaining API allowance
 * (what the student has paid to be able to burn). `freeLessonUsed` gates the
 * one free trial lesson. Keyed by Telegram id.
 */
export interface Wallet {
  telegramId: string;
  balanceUsd: number;
  freeLessonUsed: boolean;
  gameBalanceUsd: number;
  gameFreeUsed: boolean;
  createdAt: number;
  updatedAt: number;
}

export async function getWallet(telegramId: string): Promise<Wallet> {
  const db = await tutorDb();
  const snap = await getDoc(doc(db, col("wallets"), telegramId));
  if (snap.exists()) {
    const d = snap.data() as Wallet;
    // back-fill new fields for existing wallets
    if (d.gameBalanceUsd === undefined) d.gameBalanceUsd = 0;
    if (d.gameFreeUsed === undefined) d.gameFreeUsed = false;
    return d;
  }
  return {
    telegramId,
    balanceUsd: 0,
    freeLessonUsed: false,
    gameBalanceUsd: 0,
    gameFreeUsed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function save(wallet: Wallet): Promise<void> {
  const db = await tutorDb();
  await setDoc(doc(db, col("wallets"), wallet.telegramId), { ...wallet, updatedAt: Date.now() }, {
    merge: true,
  });
}

/** Add API allowance (after a successful Stars purchase). */
export async function creditAllowance(telegramId: string, usd: number): Promise<Wallet> {
  const w = await getWallet(telegramId);
  w.balanceUsd = Math.round((w.balanceUsd + usd) * 1e4) / 1e4;
  await save(w);
  return w;
}

/** Subtract the real API cost a lesson turn just incurred. */
export async function debit(telegramId: string, usd: number): Promise<Wallet> {
  const w = await getWallet(telegramId);
  w.balanceUsd = Math.round((w.balanceUsd - usd) * 1e4) / 1e4;
  await save(w);
  return w;
}

/** Return allowance when a metered tutor operation failed before benefiting the learner. */
export async function refund(telegramId: string, usd: number): Promise<Wallet> {
  const w = await getWallet(telegramId);
  w.balanceUsd = Math.round((w.balanceUsd + usd) * 1e4) / 1e4;
  await save(w);
  return w;
}

/** Mark the free trial lesson as used (idempotent). */
export async function markFreeLessonUsed(telegramId: string): Promise<void> {
  const w = await getWallet(telegramId);
  if (!w.freeLessonUsed) {
    w.freeLessonUsed = true;
    await save(w);
  }
}

/** Add game allowance after a Stars purchase. */
export async function creditGameAllowance(telegramId: string, usd: number): Promise<Wallet> {
  const w = await getWallet(telegramId);
  w.gameBalanceUsd = Math.round((w.gameBalanceUsd + usd) * 1e4) / 1e4;
  await save(w);
  return w;
}

/** Debit the game wallet for one round's actual API cost. */
export async function debitGame(telegramId: string, usd: number): Promise<Wallet> {
  const w = await getWallet(telegramId);
  w.gameBalanceUsd = Math.round((w.gameBalanceUsd - usd) * 1e4) / 1e4;
  await save(w);
  return w;
}

/** Mark the game free trial as used (idempotent). */
export async function markGameFreeUsed(telegramId: string): Promise<void> {
  const w = await getWallet(telegramId);
  if (!w.gameFreeUsed) {
    w.gameFreeUsed = true;
    await save(w);
  }
}

// ── Word-game wallet ──────────────────────────────────────────────────────────

export interface GameWallet {
  telegramId: string;
  freeRoundsUsed: number;   // how many free rounds have been consumed
  paidRoundsLeft: number;   // purchased rounds remaining
  totalRoundsPlayed: number;
  /** Lifetime real API cost (USD) this student has incurred playing. */
  realCostUsd: number;
  /** Real cost accumulated since the last admin milestone report (reset on report). */
  costSinceReport: number;
  /** Lifetime Stars this student has spent on game top-ups. */
  lifetimeStarsPaid: number;
  // ── Scoring (endless play: no fixed end, so we track running stats) ──
  /** Lifetime answers given and correct answers. */
  lifetimeAnswered: number;
  lifetimeCorrect: number;
  /** Current consecutive-correct streak and the best ever reached. */
  currentStreak: number;
  bestStreak: number;
  /** ISO week the weeklyCorrect counter belongs to (resets when the week rolls over). */
  weekKey: string;
  weeklyCorrect: number;
  /** Name shown on the leaderboard (first name / nickname). */
  displayName: string;
  /** Recently-served words (most recent last), so the generator avoids repeats
   *  ACROSS sessions/launches — the main defense against seeing the same words. */
  recentWords?: string[];
  updatedAt: number;
}

/** How many recent words to remember per player for repeat-avoidance. */
export const RECENT_WORDS_CAP = 120;

/** One leaderboard row. */
export interface LeaderRow {
  telegramId: string;
  displayName: string;
  weeklyCorrect: number;
  bestStreak: number;
}

/** ISO-8601 week key like "2026-W26" — the basis for the weekly leaderboard. */
export function isoWeekKey(ms: number): string {
  const d = new Date(ms);
  // Move to the Thursday of this week, then count weeks from year start (ISO rule).
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Sun=0 → 7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** A periodic profit snapshot for one student, emitted every N rounds played. */
export interface GameMilestone {
  totalRounds: number;
  batchRounds: number;
  /** Real API cost of the rounds in this batch (Claude + image, measured). */
  batchCostUsd: number;
  lifetimeCostUsd: number;
  lifetimeStarsPaid: number;
  /** What we actually netted from those Stars (after Telegram + conversion). */
  lifetimeNetUsd: number;
  /** Lifetime profit = net revenue − real cost (negative while on the free trial). */
  lifetimeProfitUsd: number;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 1e2) / 1e2;

async function getGameWalletRaw(telegramId: string): Promise<GameWallet> {
  const db = await tutorDb();
  const snap = await getDoc(doc(db, col("game_wallets"), telegramId));
  if (snap.exists()) {
    const d = snap.data() as GameWallet;
    // Back-fill fields added after a wallet was first created.
    if (d.realCostUsd === undefined) d.realCostUsd = 0;
    if (d.costSinceReport === undefined) d.costSinceReport = 0;
    if (d.lifetimeStarsPaid === undefined) d.lifetimeStarsPaid = 0;
    if (d.lifetimeAnswered === undefined) d.lifetimeAnswered = 0;
    if (d.lifetimeCorrect === undefined) d.lifetimeCorrect = 0;
    if (d.currentStreak === undefined) d.currentStreak = 0;
    if (d.bestStreak === undefined) d.bestStreak = 0;
    if (d.weekKey === undefined) d.weekKey = "";
    if (d.weeklyCorrect === undefined) d.weeklyCorrect = 0;
    if (d.displayName === undefined) d.displayName = "";
    if (d.recentWords === undefined) d.recentWords = [];
    return d;
  }
  return {
    telegramId,
    freeRoundsUsed: 0,
    paidRoundsLeft: 0,
    totalRoundsPlayed: 0,
    realCostUsd: 0,
    costSinceReport: 0,
    lifetimeStarsPaid: 0,
    lifetimeAnswered: 0,
    lifetimeCorrect: 0,
    currentStreak: 0,
    bestStreak: 0,
    weekKey: "",
    weeklyCorrect: 0,
    displayName: "",
    recentWords: [],
    updatedAt: Date.now(),
  };
}

async function saveGameWallet(gw: GameWallet): Promise<void> {
  const db = await tutorDb();
  await setDoc(doc(db, col("game_wallets"), gw.telegramId), { ...gw, updatedAt: Date.now() }, { merge: true });
}

export async function getGameWallet(telegramId: string): Promise<GameWallet> {
  return getGameWalletRaw(telegramId);
}

/**
 * Is a round available WITHOUT spending it? Checked before we call the API, so we
 * never burn money generating a round for a student who can't play it. The round
 * is only actually consumed by commitGameRound, after a successful generation.
 */
export async function peekGameRound(
  telegramId: string,
  freeRoundsTotal: number,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const gw = await getGameWalletRaw(telegramId);
  return gw.freeRoundsUsed < freeRoundsTotal || gw.paidRoundsLeft > 0;
}

/**
 * Consume one round AND record its real cost — call this only after a round was
 * successfully generated and shown. Decrements a free round first, then a paid
 * one. Returns a GameMilestone every `milestoneEvery` rounds (for an admin profit
 * report), otherwise null. Admins play free and untracked (returns null).
 */
export async function commitGameRound(
  telegramId: string,
  costUsd: number,
  freeRoundsTotal: number,
  isAdmin: boolean,
  milestoneEvery: number,
  word?: string,
): Promise<GameMilestone | null> {
  // Always remember the served word for cross-session repeat-avoidance — even for
  // admins (who don't consume rounds), so testing also gets fresh words.
  if (word?.trim()) {
    const gw0 = await getGameWalletRaw(telegramId);
    gw0.recentWords = [...(gw0.recentWords ?? []), word.trim()].slice(-RECENT_WORDS_CAP);
    if (isAdmin) {
      await saveGameWallet(gw0);
      return null;
    }
    // fall through using gw0 for the rest (avoids a second read)
    return await finishCommit(gw0, costUsd, freeRoundsTotal, milestoneEvery);
  }
  if (isAdmin) return null;
  const gw = await getGameWalletRaw(telegramId);
  return await finishCommit(gw, costUsd, freeRoundsTotal, milestoneEvery);
}

/** Apply a consumed round (decrement balance, book cost, maybe emit a milestone). */
async function finishCommit(
  gw: GameWallet,
  costUsd: number,
  freeRoundsTotal: number,
  milestoneEvery: number,
): Promise<GameMilestone | null> {
  if (gw.freeRoundsUsed < freeRoundsTotal) gw.freeRoundsUsed += 1;
  else if (gw.paidRoundsLeft > 0) gw.paidRoundsLeft -= 1;
  // If neither is available (a rare peek/commit race) we still count the round —
  // the API cost was already incurred, so it must be reflected in the books.

  gw.totalRoundsPlayed += 1;
  gw.realCostUsd = round4(gw.realCostUsd + costUsd);
  gw.costSinceReport = round4(gw.costSinceReport + costUsd);

  let milestone: GameMilestone | null = null;
  if (milestoneEvery > 0 && gw.totalRoundsPlayed % milestoneEvery === 0) {
    const netUsd = round2(gw.lifetimeStarsPaid * STAR_NET_USD);
    milestone = {
      totalRounds: gw.totalRoundsPlayed,
      batchRounds: milestoneEvery,
      batchCostUsd: round4(gw.costSinceReport),
      lifetimeCostUsd: round4(gw.realCostUsd),
      lifetimeStarsPaid: gw.lifetimeStarsPaid,
      lifetimeNetUsd: netUsd,
      lifetimeProfitUsd: round2(netUsd - gw.realCostUsd),
    };
    gw.costSinceReport = 0;
  }

  await saveGameWallet(gw);
  return milestone;
}

/** Add purchased rounds (and the Stars paid for them) to the wallet. */
export async function creditGameRounds(
  telegramId: string,
  rounds: number,
  stars: number,
): Promise<GameWallet> {
  const gw = await getGameWalletRaw(telegramId);
  gw.paidRoundsLeft += rounds;
  gw.lifetimeStarsPaid += stars;
  await saveGameWallet(gw);
  return gw;
}

/**
 * Record the outcome of one answer and return the updated streak figures (for the
 * "🔥 streak" line shown after each answer). Updates lifetime totals and the
 * weekly leaderboard counter, rolling the weekly count over when the week changes.
 */
export async function recordGameAnswer(
  telegramId: string,
  correct: boolean,
  displayName: string,
): Promise<{ currentStreak: number; bestStreak: number; weeklyCorrect: number }> {
  const gw = await getGameWalletRaw(telegramId);

  const wk = isoWeekKey(Date.now());
  if (gw.weekKey !== wk) {
    gw.weekKey = wk;
    gw.weeklyCorrect = 0;
  }

  gw.lifetimeAnswered += 1;
  if (correct) {
    gw.lifetimeCorrect += 1;
    gw.currentStreak += 1;
    if (gw.currentStreak > gw.bestStreak) gw.bestStreak = gw.currentStreak;
    gw.weeklyCorrect += 1;
  } else {
    gw.currentStreak = 0;
  }
  if (displayName) gw.displayName = displayName.slice(0, 32);

  await saveGameWallet(gw);
  return { currentStreak: gw.currentStreak, bestStreak: gw.bestStreak, weeklyCorrect: gw.weeklyCorrect };
}

/**
 * Top players this week, by correct answers. Endless play has no finish line, so
 * the board ranks weekly correct answers (ties broken by best streak) and resets
 * every week to stay competitive. Best-effort: returns [] if the query fails
 * (e.g. a composite index hasn't been created yet).
 */
export async function getWeeklyLeaderboard(topN: number): Promise<LeaderRow[]> {
  try {
    const db = await tutorDb();
    const wk = isoWeekKey(Date.now());
    const q = query(
      collection(db, col("game_wallets")),
      where("weekKey", "==", wk),
      orderBy("weeklyCorrect", "desc"),
      limit(topN),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as GameWallet)
      .filter((w) => w.weeklyCorrect > 0)
      .map((w) => ({
        telegramId: w.telegramId,
        displayName: w.displayName || "Player",
        weeklyCorrect: w.weeklyCorrect,
        bestStreak: w.bestStreak,
      }));
  } catch (err) {
    console.error("leaderboard query failed (composite index may be missing):", err);
    return [];
  }
}

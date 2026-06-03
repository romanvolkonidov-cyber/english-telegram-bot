import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db, ensureAuth } from "../firebase.js";

/**
 * Port of rv2class/lib/gamification.ts (the parts the bot needs). The XP,
 * coin, streak and badge math is kept identical so homework done in the bot
 * affects `studentGameProfiles` exactly as the website would.
 */

export interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  xpRequired: number;
}

export const LEVELS: LevelInfo[] = [
  { level: 1, title: "Sprout", emoji: "🌱", xpRequired: 0 },
  { level: 2, title: "Seedling", emoji: "🌿", xpRequired: 120 },
  { level: 3, title: "Blossom", emoji: "🌾", xpRequired: 300 },
  { level: 4, title: "Sapling", emoji: "🌳", xpRequired: 560 },
  { level: 5, title: "Oak", emoji: "🌲", xpRequired: 900 },
  { level: 6, title: "Trail Scout", emoji: "🧭", xpRequired: 1320 },
  { level: 7, title: "Pathfinder", emoji: "🗺️", xpRequired: 1820 },
  { level: 8, title: "Peak Climber", emoji: "⛰️", xpRequired: 2400 },
  { level: 9, title: "Sky Learner", emoji: "☁️", xpRequired: 3060 },
  { level: 10, title: "Star Scholar", emoji: "⭐", xpRequired: 3800 },
  { level: 11, title: "Nova Mind", emoji: "🌠", xpRequired: 4620 },
  { level: 12, title: "Radiant Thinker", emoji: "✨", xpRequired: 5520 },
  { level: 13, title: "Wisdom Keeper", emoji: "📘", xpRequired: 6500 },
  { level: 14, title: "Arc Mentor", emoji: "🌀", xpRequired: 7560 },
  { level: 15, title: "Sage", emoji: "🦉", xpRequired: 8700 },
  { level: 16, title: "Master Sage", emoji: "🔮", xpRequired: 9920 },
  { level: 17, title: "Sky Captain", emoji: "🛩️", xpRequired: 11220 },
  { level: 18, title: "Crown Bearer", emoji: "👑", xpRequired: 12600 },
  { level: 19, title: "Rune Reader", emoji: "📜", xpRequired: 14060 },
  { level: 20, title: "Visionary", emoji: "🔭", xpRequired: 15600 },
  { level: 21, title: "Polaris", emoji: "🌌", xpRequired: 17220 },
  { level: 22, title: "Aurora", emoji: "🌈", xpRequired: 18920 },
  { level: 23, title: "Thunder Mind", emoji: "⚡", xpRequired: 20700 },
  { level: 24, title: "Oracle", emoji: "🧠", xpRequired: 22560 },
  { level: 25, title: "Titan", emoji: "🛡️", xpRequired: 24500 },
  { level: 26, title: "Mythic", emoji: "🐉", xpRequired: 26520 },
  { level: 27, title: "Eclipse", emoji: "🌘", xpRequired: 28620 },
  { level: 28, title: "Solaris", emoji: "☀️", xpRequired: 30800 },
  { level: 29, title: "Legend", emoji: "🏅", xpRequired: 33060 },
  { level: 30, title: "Living Legend", emoji: "🦅", xpRequired: 35400 },
  { level: 31, title: "Celestial", emoji: "🪐", xpRequired: 37820 },
  { level: 32, title: "Galaxy Mind", emoji: "🌌", xpRequired: 40320 },
  { level: 33, title: "Eternal Scholar", emoji: "📚", xpRequired: 42900 },
  { level: 34, title: "Infinity", emoji: "♾️", xpRequired: 45560 },
  { level: 35, title: "Grandmaster+", emoji: "🏆", xpRequired: 48300 },
];

export function getLevelForXP(xp: number): LevelInfo {
  let current = LEVELS[0]!;
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpRequired) current = lvl;
    else break;
  }
  return current;
}

export function getNextLevel(currentLevel: number): LevelInfo | null {
  const idx = LEVELS.findIndex((l) => l.level === currentLevel);
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1]! : null;
}

export function getXPProgress(xp: number): { current: number; needed: number } {
  const level = getLevelForXP(xp);
  const next = getNextLevel(level.level);
  if (!next) return { current: xp - level.xpRequired, needed: 0 };
  return { current: xp - level.xpRequired, needed: next.xpRequired - level.xpRequired };
}

export function getYearWeekString(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

export function parseYearWeek(yearWeek: string): { year: number; week: number } {
  const [y, w] = yearWeek.split("-W");
  return { year: parseInt(y ?? "0", 10), week: parseInt(w ?? "0", 10) };
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  condition: (p: GameProfile) => boolean;
}

export const BADGES: Badge[] = [
  { id: "first_steps", name: "First Steps", emoji: "🌱", condition: (p) => p.totalHomeworksCompleted >= 1 },
  { id: "bookworm", name: "Bookworm", emoji: "📚", condition: (p) => p.totalHomeworksCompleted >= 5 },
  { id: "rising_star", name: "Rising Star", emoji: "🌟", condition: (p) => p.totalHomeworksCompleted >= 10 },
  { id: "perfectionist", name: "Perfectionist", emoji: "💯", condition: (p) => p.perfectScores >= 1 },
  { id: "on_fire", name: "On Fire", emoji: "🔥", condition: (p) => p.perfectScores >= 3 },
  { id: "sharpshooter", name: "Sharpshooter", emoji: "🎯", condition: (p) => p.highScores >= 5 },
  { id: "speed_learner", name: "Speed Learner", emoji: "⚡", condition: (p) => p.bestTimerBonus >= 15 },
  { id: "deep_roots", name: "Deep Roots", emoji: "🌳", condition: (p) => p.totalHomeworksCompleted >= 20 },
  { id: "scholar", name: "Scholar", emoji: "🏆", condition: (p) => getLevelForXP(p.xp).level >= 5 },
  { id: "grand_master", name: "Grand Master", emoji: "👑", condition: (p) => getLevelForXP(p.xp).level >= 10 },
  { id: "early_bird", name: "Early Bird", emoji: "🐦", condition: (p) => p.earlyCompletions >= 1 },
  { id: "full_bloom", name: "Full Bloom", emoji: "🌸", condition: (p) => p.treeHealth >= 100 },
];

export interface GameProfile {
  studentId: string;
  xp: number;
  shopCoins: number;
  totalHomeworksCompleted: number;
  perfectScores: number;
  highScores: number;
  bestTimerBonus: number;
  earlyCompletions: number;
  treeHealth: number;
  unlockedBadges: string[];
  currentStreak: number;
  highestStreak: number;
  lastHomeworkWeek: string | null;
}

const DEFAULT_PROFILE: Omit<GameProfile, "studentId"> = {
  xp: 0,
  shopCoins: 0,
  totalHomeworksCompleted: 0,
  perfectScores: 0,
  highScores: 0,
  bestTimerBonus: 0,
  earlyCompletions: 0,
  treeHealth: 50,
  unlockedBadges: [],
  currentStreak: 0,
  highestStreak: 0,
  lastHomeworkWeek: null,
};

export async function getGameProfile(studentId: string): Promise<GameProfile> {
  const fallback: GameProfile = { studentId, ...DEFAULT_PROFILE };
  if (!studentId) return fallback;
  try {
    await ensureAuth();
    const ref = doc(db, "studentGameProfiles", studentId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { studentId, ...DEFAULT_PROFILE, ...(snap.data() as object) } as GameProfile;
    }
    await setDoc(ref, { ...DEFAULT_PROFILE, lastUpdated: serverTimestamp() });
    return fallback;
  } catch (err) {
    console.error("Error getting game profile:", err);
    return fallback;
  }
}

async function updateGameProfile(
  studentId: string,
  updates: Partial<GameProfile>,
): Promise<void> {
  await ensureAuth();
  await setDoc(
    doc(db, "studentGameProfiles", studentId),
    { ...updates, lastUpdated: serverTimestamp() },
    { merge: true },
  );
}

export interface XPBreakdown {
  totalXP: number;
  coinsEarned: number;
}

export function calculateXP(
  correctAnswers: number,
  totalQuestions: number,
  timeSpentSeconds: number,
  expectedTimeSeconds: number,
): XPBreakdown {
  const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  const correctAnswerXP = correctAnswers * 10;
  const completionXP = 5;
  const perfectBonusXP = score === 100 ? 25 : 0;
  const highScoreBonusXP = score >= 80 && score < 100 ? 15 : 0;

  let timerBonusXP = 0;
  if (expectedTimeSeconds > 0 && timeSpentSeconds < expectedTimeSeconds) {
    const ratio = 1 - timeSpentSeconds / expectedTimeSeconds;
    timerBonusXP = Math.round(ratio * 20);
  }

  const totalXP =
    correctAnswerXP + completionXP + perfectBonusXP + highScoreBonusXP + timerBonusXP;
  return { totalXP, coinsEarned: Math.floor(totalXP / 10) };
}

export interface AwardResult {
  earnedXP: number;
  earnedCoins: number;
  leveledUp: boolean;
  newLevel: LevelInfo;
  newBadges: Badge[];
  streakOutcome: "started" | "kept" | "same_week" | "reset";
  currentStreak: number;
  timerBonus: number;
}

/**
 * Award XP, coins, streak and badges for a completed homework. Faithful port
 * of `awardHomeworkXP`, including the punctuality multiplier that inspects
 * pending assignments.
 */
export async function awardHomeworkXP(
  studentId: string,
  correctAnswers: number,
  totalQuestions: number,
  timeSpentSeconds: number,
  totalAssigned: number,
  totalCompleted: number,
  wasEarlyCompletion: boolean,
): Promise<AwardResult> {
  const profile = await getGameProfile(studentId);
  const previousLevel = getLevelForXP(profile.xp);
  const expectedTime = totalQuestions * 30;

  const xpBreakdown = calculateXP(correctAnswers, totalQuestions, timeSpentSeconds, expectedTime);
  const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

  profile.xp += xpBreakdown.totalXP;
  profile.totalHomeworksCompleted += 1;
  if (score === 100) profile.perfectScores += 1;
  if (score >= 90) profile.highScores += 1;

  // Recompute timer bonus to track the personal best (matches the website).
  let timerBonusXP = 0;
  if (expectedTime > 0 && timeSpentSeconds < expectedTime) {
    timerBonusXP = Math.round((1 - timeSpentSeconds / expectedTime) * 20);
  }
  if (timerBonusXP > profile.bestTimerBonus) profile.bestTimerBonus = timerBonusXP;
  if (wasEarlyCompletion) profile.earlyCompletions += 1;

  // Streak logic
  const currentWeekStr = getYearWeekString(new Date());
  let streakOutcome: AwardResult["streakOutcome"] = "started";
  if (profile.lastHomeworkWeek) {
    const last = parseYearWeek(profile.lastHomeworkWeek);
    const curr = parseYearWeek(currentWeekStr);
    const estimatedGapWeeks = Math.max(
      0,
      (curr.year - last.year) * 52 + (curr.week - last.week),
    );
    if (
      (curr.year === last.year && curr.week === last.week + 1) ||
      (curr.year === last.year + 1 && curr.week === 1 && last.week >= 52)
    ) {
      profile.currentStreak += 1;
      streakOutcome = "kept";
    } else if (curr.year === last.year && curr.week === last.week) {
      streakOutcome = "same_week";
    } else {
      const missedWeeks = Math.max(1, estimatedGapWeeks - 1);
      profile.currentStreak = 1;
      profile.shopCoins += Math.min(30, missedWeeks * 4);
      streakOutcome = "reset";
    }
  } else {
    profile.currentStreak = 1;
    streakOutcome = "started";
  }
  profile.lastHomeworkWeek = currentWeekStr;
  if (profile.currentStreak > profile.highestStreak) {
    profile.highestStreak = profile.currentStreak;
  }

  profile.treeHealth =
    totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 50;

  // Badges
  const newBadges: Badge[] = [];
  for (const badge of BADGES) {
    if (!profile.unlockedBadges.includes(badge.id) && badge.condition(profile)) {
      profile.unlockedBadges.push(badge.id);
      newBadges.push(badge);
    }
  }

  // Coin multipliers
  const streakMultiplier = profile.currentStreak >= 3 ? 1.2 : 1.0;
  const isWeekend = [0, 6].includes(new Date().getDay());
  const weekendMultiplier = isWeekend ? 1.5 : 1.0;

  let hasOverdue = false;
  try {
    const pendingSnap = await getDocs(
      query(
        collection(db, "telegramAssignments"),
        where("studentId", "==", studentId),
        where("status", "==", "pending"),
      ),
    );
    const now = Date.now();
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    hasOverdue = pendingSnap.docs.some((d) => {
      const data = d.data() as { assignedAt?: { seconds?: number } | string };
      const assignedTime =
        data.assignedAt && typeof data.assignedAt === "object" && data.assignedAt.seconds
          ? data.assignedAt.seconds * 1000
          : new Date(data.assignedAt as string).getTime();
      return now - assignedTime > ONE_WEEK;
    });
  } catch {
    /* punctuality is a bonus only; ignore failures */
  }
  const punctualityMultiplier = !hasOverdue ? 1.3 : 1.0;

  const baseCoins = xpBreakdown.coinsEarned;
  const totalCoins = Math.floor(
    baseCoins * streakMultiplier * punctualityMultiplier * weekendMultiplier,
  );
  profile.shopCoins += totalCoins;

  const newLevel = getLevelForXP(profile.xp);
  const leveledUp = newLevel.level > previousLevel.level;

  await updateGameProfile(studentId, {
    xp: profile.xp,
    shopCoins: profile.shopCoins,
    totalHomeworksCompleted: profile.totalHomeworksCompleted,
    perfectScores: profile.perfectScores,
    highScores: profile.highScores,
    bestTimerBonus: profile.bestTimerBonus,
    earlyCompletions: profile.earlyCompletions,
    treeHealth: profile.treeHealth,
    unlockedBadges: profile.unlockedBadges,
    currentStreak: profile.currentStreak,
    highestStreak: profile.highestStreak,
    lastHomeworkWeek: profile.lastHomeworkWeek,
  });

  return {
    earnedXP: xpBreakdown.totalXP,
    earnedCoins: totalCoins,
    leveledUp,
    newLevel,
    newBadges,
    streakOutcome,
    currentStreak: profile.currentStreak,
    timerBonus: timerBonusXP,
  };
}

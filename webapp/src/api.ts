import { tg } from "./telegram";

/** Backend base URL. Set at build time (Vercel env); local dev hits the VPS-style port. */
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8081";

// ── Response shapes (mirror src/webapp/server.ts) ──────────────────────────────
export interface Level {
  from: string;
  to: string;
  label: string;
}
export interface StateResp {
  name: string;
  nativeLanguage: string;
  isAdmin: boolean;
  freeLeft: number | null;
  paidLeft: number | null;
  bestStreak: number;
  weeklyCorrect: number;
  levels: Level[];
  starsPerRound: number;
}
export interface RoundResp {
  word: string;
  definition: string;
  options: string[];
  toLevel: string;
  freeLeft: number | null;
  paidLeft: number | null;
}
export interface AnswerResp {
  correct: boolean;
  correctIndex: number;
  correctWord: string;
  explain: string;
  /** Why the chosen distractor is wrong (only present when correct === false). */
  wrongExplain?: string;
}
export interface LeaderRow {
  displayName: string;
  weeklyCorrect: number;
  bestStreak: number;
  me: boolean;
}
export interface ShopResp {
  starsPerRound: number;
  packages: { id: string; stars: number; rounds: number; title: string }[];
  custom: { starsPerRound: number; minStars: number; maxStars: number };
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string) {
    super(`API ${status}${code ? ` (${code})` : ""}`);
    this.status = status;
    this.code = code;
  }
}

function authHeader(): Record<string, string> {
  return { authorization: `tma ${tg?.initData ?? ""}` };
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "content-type": "application/json", ...authHeader(), ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    let code: string | undefined;
    try {
      code = ((await res.json()) as { error?: string }).error;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code);
  }
  return (await res.json()) as T;
}

export const api = {
  state: () => req<StateResp>("/api/state"),
  round: (fromLevel: string, toLevel: string, usedWords: string[]) =>
    req<RoundResp>("/api/round", { method: "POST", body: JSON.stringify({ fromLevel, toLevel, usedWords }) }),
  answer: (optIndex: number) =>
    req<AnswerResp>("/api/answer", { method: "POST", body: JSON.stringify({ optIndex }) }),
  leaderboard: () => req<{ rows: LeaderRow[] }>("/api/leaderboard"),
  shop: () => req<ShopResp>("/api/shop"),
  buy: (body: { packId?: string; customStars?: number }) =>
    req<{ invoiceLink: string }>("/api/buy", { method: "POST", body: JSON.stringify(body) }),
};


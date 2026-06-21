import { doc, getDoc, setDoc } from "firebase/firestore";
import { tutorDb, col } from "./firebase.js";

/**
 * Prepaid wallet for the AI tutor. `balanceUsd` is the remaining API allowance
 * (what the student has paid to be able to burn). `freeLessonUsed` gates the
 * one free trial lesson. Keyed by Telegram id.
 */
export interface Wallet {
  telegramId: string;
  balanceUsd: number;
  freeLessonUsed: boolean;
  createdAt: number;
  updatedAt: number;
}

export async function getWallet(telegramId: string): Promise<Wallet> {
  const db = await tutorDb();
  const snap = await getDoc(doc(db, col("wallets"), telegramId));
  if (snap.exists()) return snap.data() as Wallet;
  return {
    telegramId,
    balanceUsd: 0,
    freeLessonUsed: false,
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

/** Mark the free trial lesson as used (idempotent). */
export async function markFreeLessonUsed(telegramId: string): Promise<void> {
  const w = await getWallet(telegramId);
  if (!w.freeLessonUsed) {
    w.freeLessonUsed = true;
    await save(w);
  }
}

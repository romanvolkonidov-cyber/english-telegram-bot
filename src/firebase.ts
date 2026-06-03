import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { config } from "./config.js";

/**
 * Initializes the Firebase **client** SDK and signs in anonymously.
 *
 * Why the client SDK + anonymous auth (and not the Admin SDK)?
 *  - The shared Firestore rules require `request.auth != null` for writing
 *    `studentGameProfiles`, and Storage requires it for uploading voice
 *    answers. Anonymous auth satisfies that, exactly like the website does.
 *  - No service-account key is needed, so the bot runs with zero extra
 *    secrets beyond the bot token.
 */

const app = getApps().length === 0 ? initializeApp(config.firebase) : getApps()[0]!;
const auth = getAuth(app);

export const db = getFirestore(app);
export const storage = getStorage(app);

const authReady: Promise<void> = new Promise((resolve) => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Anonymous auth failed:", err);
      }
    }
    resolve();
  });
});

/** Await this before any Firestore/Storage call that needs an authed user. */
export const ensureAuth = async (): Promise<void> => {
  await authReady;
};

export { app, auth };

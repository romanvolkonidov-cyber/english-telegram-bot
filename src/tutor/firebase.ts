import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { config, hasTutorFirebase } from "../config.js";

/**
 * Firestore access for the AI tutor.
 *
 * If TUTOR_FB_* env vars are set we spin up a *second*, independent Firebase
 * app ("tutor") so learner data lives in its own project. Otherwise we reuse
 * the shared app and prefix every collection with `tutor_`, keeping the tutor's
 * data cleanly separated from the homework/budget collections.
 */

let appPromise: Promise<FirebaseApp> | null = null;

function tutorApp(): Promise<FirebaseApp> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    if (!hasTutorFirebase) {
      // Reuse the shared (default) app, ensuring its anonymous auth is ready.
      const { ensureAuth } = await import("../firebase.js");
      await ensureAuth();
      return getApps().length ? getApp() : initializeApp(config.firebase);
    }
    const existing = getApps().find((a) => a.name === "tutor");
    const app = existing ?? initializeApp(config.tutorFirebase, "tutor");
    // Anonymous auth so Firestore rules requiring request.auth != null pass.
    await new Promise<void>((resolve) => {
      const auth = getAuth(app);
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          try {
            await signInAnonymously(auth);
          } catch (err) {
            console.error("Tutor anonymous auth failed:", err);
          }
        }
        resolve();
      });
    });
    return app;
  })();
  return appPromise;
}

let dbPromise: Promise<Firestore> | null = null;

/** Get the tutor Firestore instance (auth is ensured for the dedicated project). */
export async function tutorDb(): Promise<Firestore> {
  if (!dbPromise) dbPromise = tutorApp().then((app) => getFirestore(app));
  return dbPromise;
}

/**
 * Collection name resolver. With a dedicated project we use plain names; on the
 * shared fallback we prefix with `tutor_` to avoid colliding with the homework
 * collections that live in the same Firestore.
 */
export function col(name: string): string {
  return hasTutorFirebase ? name : `tutor_${name}`;
}

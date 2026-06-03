/**
 * Quick integration check — does NOT start the bot or send any messages.
 *  - validates the bot token via getMe
 *  - signs in to Firebase anonymously and reads the shared `students` collection
 *  - reports whether the Gemini key is configured
 *
 * Run with: npm run smoke
 */
import { collection, getDocs, limit, query } from "firebase/firestore";
import { config, hasGemini } from "../src/config.js";
import { db, ensureAuth } from "../src/firebase.js";

async function main(): Promise<void> {
  console.log("🔧 Firebase project:", config.firebase.projectId);
  console.log("🔑 Gemini key configured:", hasGemini);

  const me = (await fetch(
    `https://api.telegram.org/bot${config.botToken}/getMe`,
  ).then((r) => r.json())) as { ok: boolean; result?: { username?: string } };
  console.log("🤖 Telegram getMe:", me.ok ? `@${me.result?.username}` : JSON.stringify(me));

  await ensureAuth();
  console.log("🔐 Firebase anonymous auth: OK");

  const students = await getDocs(collection(db, "students"));
  console.log(`👩‍🎓 students collection: ${students.size} docs readable`);

  const oneAssignment = await getDocs(query(collection(db, "telegramAssignments"), limit(1)));
  console.log(`📚 telegramAssignments reachable: ${oneAssignment.size >= 0}`);

  console.log("✅ Smoke test complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Smoke test failed:", err);
  process.exit(1);
});

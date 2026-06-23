/**
 * Diagnose a bonus-grant that "didn't work": reads the real Firestore data and
 * shows whether a student has a Telegram login and what's actually in their wallet.
 *
 *   npx tsx scripts/inspect-student.ts                 # list all student logins
 *   npx tsx scripts/inspect-student.ts <studentId>     # detail by homework studentId
 *   npx tsx scripts/inspect-student.ts <telegramId>    # detail by Telegram user id
 *
 * The wallet is keyed by Telegram id. A grant credits that key; the student reads
 * the same key. So if the wallet below shows the balance/rounds you granted, the
 * student CAN study/play — and any remaining "out" message means the running bot
 * is stale code. If there's NO matching connection, the student never logged in,
 * so there was no wallet to credit.
 */
import { listStudentConnections } from "../src/data/connections.js";
import { getWallet, getGameWallet } from "../src/tutor/wallet.js";

const arg = (process.argv[2] || "").trim();

const conns = await listStudentConnections();
console.log(`Total student Telegram logins: ${conns.length}\n`);

if (!arg) {
  console.log("studentId           telegramUserId    chatId");
  console.log("--------------------------------------------------");
  for (const c of conns) {
    console.log(`${String(c.studentId).padEnd(20)}${String(c.telegramUserId).padEnd(18)}${c.chatId}`);
  }
  console.log(`\nRe-run with one of these ids for wallet detail.`);
  process.exit(0);
}

const matches = conns.filter(
  (c) => c.studentId === arg || String(c.telegramUserId) === arg,
);

if (matches.length === 0) {
  console.log(`❌ No Telegram login matches "${arg}".`);
  console.log(`   → This student never logged into the bot, so there is NO wallet to credit.`);
  console.log(`   → Fix: have them open the bot and log in, THEN grant the bonus.`);
  process.exit(0);
}

for (const c of matches) {
  const key = String(c.telegramUserId);
  const w = await getWallet(key);
  const gw = await getGameWallet(key);
  console.log(`✅ studentId=${c.studentId}  telegramUserId=${key}  chatId=${c.chatId}`);
  console.log(
    `   Lessons:  balance=$${w.balanceUsd.toFixed(2)}  freeLessonUsed=${w.freeLessonUsed}` +
      `  → ${w.balanceUsd > 0 ? "CAN study" : "blocked (no balance)"}`,
  );
  console.log(
    `   Game:     paidRoundsLeft=${gw.paidRoundsLeft}  freeRoundsUsed=${gw.freeRoundsUsed}` +
      `  → ${gw.paidRoundsLeft > 0 ? "CAN play" : "no paid rounds"}\n`,
  );
}
process.exit(0);

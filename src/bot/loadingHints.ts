import { InputFile } from "grammy";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { BotContext } from "./context.js";

/**
 * Staged "I'm on my way" loading animation for the slow first message (the first
 * lesson turn or the first game round, which need a Claude call + image + voice).
 *
 * - After 2 s of waiting: send `still far.png` ("I'm running to you…").
 * - If 3 s more pass (5 s total) and the real content STILL isn't ready: send
 *   `closer.png` ("Almost there!").
 *
 * The caller cancels the moment the real content is ready, so a fast turn shows
 * nothing. Both images live at the project root; captions follow the bot language.
 */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FAR_IMG = path.join(ROOT, "still far.png");
const CLOSER_IMG = path.join(ROOT, "closer.png");

export function startLoadingHints(ctx: BotContext): () => void {
  const en = ctx.session.lang === "en";
  const farCaption = en ? "🏃 I'm running to you…" : "🏃 Бегу к тебе…";
  const closerCaption = en ? "🏃 Almost there!" : "🏃 Уже почти!";

  const timers: ReturnType<typeof setTimeout>[] = [];
  timers.push(
    setTimeout(() => {
      ctx.replyWithPhoto(new InputFile(FAR_IMG), { caption: farCaption }).catch(() => {});
    }, 2000),
  );
  timers.push(
    setTimeout(() => {
      ctx.replyWithPhoto(new InputFile(CLOSER_IMG), { caption: closerCaption }).catch(() => {});
    }, 5000),
  );

  return () => {
    for (const t of timers) clearTimeout(t);
  };
}

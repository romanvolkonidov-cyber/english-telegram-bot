/**
 * Tiny sound-effect engine using the Web Audio API — no audio files, no network,
 * no latency, and it can't fail a request. Tones are synthesized on the fly. All
 * playback respects the user's sound toggle (persisted in localStorage).
 */

const KEY = "wg_sound_on";

let enabled = (() => {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? true : v === "1"; // default ON
  } catch {
    return true;
  }
})();

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

type ACtor = typeof AudioContext;
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    // Mobile browsers start the context "suspended" until a user gesture — our SFX
    // always fire from taps, so resuming here is allowed.
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One enveloped tone. */
function blip(freq: number, durMs: number, gain = 0.05, type: OscillatorType = "sine"): void {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + durMs / 1000);
}

export const sfx = {
  /** Subtle tick on selecting/navigating. */
  tap(): void {
    blip(320, 55, 0.025, "sine");
  },
  /** Bright rising two-note for a correct answer. */
  correct(): void {
    blip(660, 110, 0.05);
    setTimeout(() => blip(880, 150, 0.05), 90);
  },
  /** Soft low tone for a wrong answer (gentle, not punishing). */
  wrong(): void {
    blip(196, 200, 0.045, "triangle");
  },
  /** Little ascending arpeggio to celebrate a streak milestone. */
  streak(): void {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 130, 0.05), i * 75));
  },
};

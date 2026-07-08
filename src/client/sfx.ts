import { isSoundEnabled } from "@/client/soundSettings";

/**
 * Procedural 8-bit-style SFX via the Web Audio API — no assets, no deps.
 * Triggered only by user actions (taps), so the AudioContext starts within a
 * gesture and isn't blocked. Silently no-ops when sound is off or unsupported.
 */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

function tone(freq: number, startOffset: number, duration: number, gain = 0.06): void {
  const context = audioContext();
  if (!context) return;
  const osc = context.createOscillator();
  const amp = context.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  const t0 = context.currentTime + startOffset;
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(context.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Short confirmation blip when something is logged. */
export function playDing(): void {
  if (!isSoundEnabled()) return;
  tone(880, 0, 0.09);
  tone(1320, 0.06, 0.08);
}

/** Ascending arpeggio for a level-up / stage-up. */
export function playLevelUp(): void {
  if (!isSoundEnabled()) return;
  [523, 659, 784, 1047].forEach((freq, index) => tone(freq, index * 0.1, 0.16, 0.07));
}

/** A small flourish for a boss defeat / goal hit. */
export function playVictory(): void {
  if (!isSoundEnabled()) return;
  [784, 784, 1047].forEach((freq, index) => tone(freq, index * 0.12, 0.18, 0.07));
}

/** Two-note "rest is over" ping when the rest timer hits zero. */
export function playRestDone(): void {
  if (!isSoundEnabled()) return;
  tone(988, 0, 0.1);
  tone(1480, 0.09, 0.14, 0.07);
}

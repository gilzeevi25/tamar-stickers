"use client";

/**
 * Tiny WebAudio chime helpers — no asset files, just synth tones.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function tone(freq: number, durMs: number, when = 0, gain = 0.18) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000 + 0.05);
}

export function playTap() {
  tone(880, 80, 0, 0.12);
}

export function playRecordStart() {
  tone(660, 90);
}

export function playRecordStop() {
  tone(520, 90);
}

export function playSuccess() {
  tone(660, 120, 0);
  tone(880, 140, 0.12);
  tone(1320, 220, 0.26, 0.2);
}

export function playError() {
  tone(220, 200, 0, 0.15);
}

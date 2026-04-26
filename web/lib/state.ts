"use client";

import { create } from "zustand";

export type Screen =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "transcribing" }
  | { kind: "showTranscript"; hebrew: string }
  | { kind: "thinking"; hebrew: string }
  | {
      kind: "preview";
      hebrew: string;
      imageB64: string;
      prevEnglish: string;
      attempt: number;
    }
  | {
      kind: "refining";
      hebrew: string;
      prevEnglish: string;
      attempt: number;
    }
  | { kind: "printing"; progress: number }
  | { kind: "done" }
  | { kind: "error"; message: string };

interface AppState {
  screen: Screen;
  setScreen: (s: Screen) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: { kind: "idle" },
  setScreen: (screen) => set({ screen }),
  reset: () => set({ screen: { kind: "idle" } }),
}));

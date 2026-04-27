"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";

const STORAGE_KEY = "tamar.idToken";
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface AuthState {
  idToken: string | null;
  email: string | null;
  error: string | null;
  hydrated: boolean;
  hydrate: () => void;
  setCredential: (jwt: string) => void;
  setError: (msg: string | null) => void;
  signOut: () => void;
}

function decodeEmail(jwt: string): string | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { email?: string; exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  idToken: null,
  email: null,
  error: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const email = decodeEmail(stored);
      if (email) {
        set({ idToken: stored, email, hydrated: true });
        return;
      }
      sessionStorage.removeItem(STORAGE_KEY);
    }
    set({ hydrated: true });
  },
  setCredential: (jwt) => {
    const email = decodeEmail(jwt);
    if (!email) {
      set({ error: "טוקן לא תקין. נסי שוב." });
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, jwt);
    set({ idToken: jwt, email, error: null });
  },
  setError: (msg) => set({ error: msg }),
  signOut: () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
      const w = window as unknown as {
        google?: { accounts?: { id?: { disableAutoSelect?: () => void } } };
      };
      w.google?.accounts?.id?.disableAutoSelect?.();
    }
    set({ idToken: null, email: null, error: null });
  },
}));

export function getIdToken(): string | null {
  return useAuthStore.getState().idToken;
}

interface GoogleIdLib {
  initialize: (config: {
    client_id: string;
    callback: (resp: { credential: string }) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "small" | "medium" | "large";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      locale?: string;
    },
  ) => void;
  prompt: () => void;
  disableAutoSelect: () => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdLib } };
  }
}

function getGoogleIdLib(): GoogleIdLib | null {
  if (typeof window === "undefined") return null;
  return window.google?.accounts?.id ?? null;
}

/** Polls until the GSI script (loaded in layout.tsx) has attached itself. */
function waitForGsi(timeoutMs = 8000): Promise<GoogleIdLib> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const lib = getGoogleIdLib();
      if (lib) return resolve(lib);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("gsi_not_loaded"));
      }
      setTimeout(tick, 80);
    };
    tick();
  });
}

/**
 * Mounts a Google sign-in button into `containerRef`. Re-renders on
 * sign-out so the button reappears.
 */
export function useGoogleSignInButton(
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const setCredential = useAuthStore((s) => s.setCredential);
  const setError = useAuthStore((s) => s.setError);
  const idToken = useAuthStore((s) => s.idToken);
  const initialized = useRef(false);

  useEffect(() => {
    if (idToken) return;
    if (!GOOGLE_CLIENT_ID) {
      setError("חסר GOOGLE_CLIENT_ID. צריך להגדיר NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
      return;
    }

    let cancelled = false;
    waitForGsi()
      .then((lib) => {
        if (cancelled) return;
        if (!initialized.current) {
          lib.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (resp) => setCredential(resp.credential),
            auto_select: false,
          });
          initialized.current = true;
        }
        const el = containerRef.current;
        if (el) {
          el.innerHTML = "";
          lib.renderButton(el, {
            type: "standard",
            theme: "filled_blue",
            size: "large",
            text: "signin_with",
            shape: "pill",
            width: 280,
          });
        }
      })
      .catch(() => setError("לא הצלחתי לטעון את התחברות גוגל."));

    return () => {
      cancelled = true;
    };
  }, [containerRef, idToken, setCredential, setError]);
}

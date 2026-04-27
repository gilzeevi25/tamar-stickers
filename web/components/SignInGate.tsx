"use client";

import { useEffect, useRef } from "react";

import { useAuthStore, useGoogleSignInButton } from "@/lib/auth";

export function SignInGate({ children }: { children: React.ReactNode }) {
  const idToken = useAuthStore((s) => s.idToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const error = useAuthStore((s) => s.error);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useGoogleSignInButton(buttonRef);

  if (!hydrated) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <span className="block h-12 w-12 rounded-full border-4 border-coral/30 border-t-coral animate-spin" />
      </main>
    );
  }

  if (idToken) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-extrabold text-ink">מדבקות של תמר</h1>
      <p className="text-ink/70">צריך להתחבר כדי להמשיך</p>
      <div ref={buttonRef} dir="ltr" />
      {error && (
        <p className="text-sm text-coral max-w-xs" dir="rtl">
          {error}
        </p>
      )}
    </main>
  );
}

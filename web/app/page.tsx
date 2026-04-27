"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { Celebration } from "@/components/Celebration";
import { ErrorView } from "@/components/ErrorView";
import { PreviewCard } from "@/components/PreviewCard";
import { PrinterStatus, type ConnectionState } from "@/components/PrinterStatus";
import { PrintingScreen } from "@/components/PrintingScreen";
import { RecordButton } from "@/components/RecordButton";
import { SignInGate } from "@/components/SignInGate";
import { ThinkingAnimation } from "@/components/ThinkingAnimation";
import { TranscriptBubble } from "@/components/TranscriptBubble";
import {
  ApiError,
  AuthError,
  RefusalError,
  generate,
  refine,
  transcribe,
  warmup,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { usePushToTalk } from "@/lib/audio";
import { type PrinterHandle, connectPrinter, printImage } from "@/lib/printer";
import { playError, playRecordStart, playRecordStop, playSuccess } from "@/lib/sound";
import { type Screen, useAppStore } from "@/lib/state";

const TRANSCRIPT_HOLD_MS = 800;
const DONE_HOLD_MS = 2000;

function getHebrew(screen: Screen): string | null {
  switch (screen.kind) {
    case "showTranscript":
    case "thinking":
    case "refining":
    case "preview":
      return screen.hebrew;
    default:
      return null;
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function Page() {
  return (
    <SignInGate>
      <MainApp />
    </SignInGate>
  );
}

function MainApp() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const reset = useAppStore((s) => s.reset);
  const email = useAuthStore((s) => s.email);
  const signOut = useAuthStore((s) => s.signOut);

  const ptt = usePushToTalk();
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const printerRef = useRef<PrinterHandle | null>(null);
  const [warming, setWarming] = useState(true);

  // Wake the Render free-tier dyno as early as possible.
  useEffect(() => {
    let mounted = true;
    const t = setTimeout(() => {
      if (mounted) setWarming(false);
    }, 30_000);
    warmup().finally(() => {
      if (mounted) setWarming(false);
    });
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, []);

  // Disconnection handler.
  useEffect(() => {
    const handle = printerRef.current;
    if (!handle) return;
    const onDisconnect = () => {
      setConnection("idle");
      setDeviceName(null);
      printerRef.current = null;
    };
    handle.device.addEventListener("gattserverdisconnected", onDisconnect);
    return () => {
      handle.device.removeEventListener(
        "gattserverdisconnected",
        onDisconnect,
      );
    };
  }, [connection]);

  const handleConnected = useCallback((handle: PrinterHandle) => {
    printerRef.current?.disconnect();
    printerRef.current = handle;
    setDeviceName(handle.device.name ?? "מדפסת");
    setConnection("ready");
  }, []);

  const handleConnectionError = useCallback((msg: string) => {
    setConnection("error");
    console.warn("printer connect failed:", msg);
  }, []);

  // ---- main pipeline ----

  const runPipeline = useCallback(
    async (audio: Blob) => {
      setScreen({ kind: "transcribing" });
      try {
        const { hebrew } = await transcribe(audio);
        setScreen({ kind: "showTranscript", hebrew });
        await new Promise((r) => setTimeout(r, TRANSCRIPT_HOLD_MS));
        setScreen({ kind: "thinking", hebrew });
        const { english_prompt, image_b64 } = await generate(hebrew);
        setScreen({
          kind: "preview",
          hebrew,
          imageB64: image_b64,
          prevEnglish: english_prompt,
          attempt: 1,
        });
      } catch (err) {
        playError();
        if (err instanceof AuthError) {
          // Token rejected — SignInGate will reappear since the store cleared.
          return;
        }
        if (err instanceof RefusalError) {
          setScreen({ kind: "error", message: err.hebrew });
        } else if (err instanceof ApiError && err.status === 400) {
          setScreen({
            kind: "error",
            message: "ההקלטה הייתה קצרה מדי. תנסי שוב, ארוך יותר 🎤",
          });
        } else {
          setScreen({
            kind: "error",
            message: "משהו השתבש. אפשר לנסות שוב!",
          });
        }
      }
    },
    [setScreen],
  );

  const handleRefine = useCallback(async () => {
    if (screen.kind !== "preview") return;
    const { hebrew, prevEnglish, attempt } = screen;
    setScreen({
      kind: "refining",
      hebrew,
      prevEnglish,
      attempt: attempt + 1,
    });
    try {
      const { english_prompt, image_b64 } = await refine(
        hebrew,
        prevEnglish,
        attempt + 1,
      );
      setScreen({
        kind: "preview",
        hebrew,
        imageB64: image_b64,
        prevEnglish: english_prompt,
        attempt: attempt + 1,
      });
    } catch (err) {
      playError();
      if (err instanceof AuthError) return;
      if (err instanceof RefusalError) {
        setScreen({ kind: "error", message: err.hebrew });
      } else {
        setScreen({
          kind: "error",
          message: "לא הצלחתי לצייר עכשיו. ננסה שוב?",
        });
      }
    }
  }, [screen, setScreen]);

  const handlePrint = useCallback(async () => {
    if (screen.kind !== "preview") return;
    const png = base64ToBytes(screen.imageB64);

    let handle = printerRef.current;
    if (!handle) {
      // No printer yet — open the picker (must be a user-gesture, which this is).
      try {
        setConnection("connecting");
        handle = await connectPrinter();
        printerRef.current = handle;
        setDeviceName(handle.device.name ?? "מדפסת");
        setConnection("ready");
      } catch (err) {
        setConnection("error");
        playError();
        setScreen({
          kind: "error",
          message: "לא הצלחתי להתחבר למדפסת. תוודאי שהיא דולקת ובלוטות' פתוח.",
        });
        return;
      }
    }

    setScreen({ kind: "printing", progress: 0 });
    try {
      await printImage(handle, png, {
        onProgress: (rows, total) => {
          setScreen({ kind: "printing", progress: rows / total });
        },
      });
      playSuccess();
      setScreen({ kind: "done" });
      await new Promise((r) => setTimeout(r, DONE_HOLD_MS));
      reset();
    } catch (err) {
      playError();
      setScreen({
        kind: "error",
        message: "ההדפסה לא הצליחה. נבדוק את המדפסת ונדפיס שוב.",
      });
    }
  }, [screen, setScreen, reset]);

  // ---- mic gestures ----

  const onPressStart = useCallback(async () => {
    if (screen.kind !== "idle") return;
    try {
      await ptt.start();
      playRecordStart();
      setScreen({ kind: "recording", startedAt: Date.now() });
    } catch {
      playError();
      setScreen({
        kind: "error",
        message: "צריך הרשאה למיקרופון. תאשרי בהגדרות הדפדפן 🎤",
      });
    }
  }, [ptt, screen.kind, setScreen]);

  const onPressEnd = useCallback(async () => {
    if (screen.kind !== "recording") return;
    playRecordStop();
    const blob = await ptt.stop();
    if (!blob || blob.size < 1500) {
      setScreen({
        kind: "error",
        message: "ההקלטה הייתה קצרה. תלחצי ארוך יותר ותגידי בקול 🎤",
      });
      return;
    }
    runPipeline(blob);
  }, [ptt, screen.kind, runPipeline, setScreen]);

  // ---- render ----

  const currentHebrew = getHebrew(screen);

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="flex items-start justify-between p-4 gap-3">
        <PrinterStatus
          state={connection}
          deviceName={deviceName}
          onConnected={handleConnected}
          onError={handleConnectionError}
        />
        <div className="flex items-center gap-2">
          {warming && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-full bg-sun/80 px-3 py-2 text-sm font-bold text-ink shadow-toy"
            >
              מתחממת... ☀️
            </motion.span>
          )}
          {email && (
            <button
              type="button"
              onClick={signOut}
              className="rounded-full bg-white/80 px-3 py-2 text-xs font-bold text-ink/70 shadow-toy"
              title={email}
            >
              יציאה
            </button>
          )}
        </div>
      </header>

      <div className="px-6 pt-2 pb-6 flex justify-center">
        <AnimatePresence>
          {currentHebrew && (
            <TranscriptBubble key="persistent-transcript" hebrew={currentHebrew} />
          )}
        </AnimatePresence>
      </div>

      <section className="flex-1 flex items-center justify-center px-6 pb-12">
        <AnimatePresence mode="wait">
          {screen.kind === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <RecordButton
                isRecording={false}
                onPressStart={onPressStart}
                onPressEnd={onPressEnd}
              />
            </motion.div>
          )}

          {screen.kind === "recording" && (
            <motion.div
              key="recording"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <RecordButton
                isRecording
                onPressStart={onPressStart}
                onPressEnd={onPressEnd}
              />
            </motion.div>
          )}

          {screen.kind === "transcribing" && (
            <motion.div
              key="transcribing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                className="block h-12 w-12 rounded-full border-4 border-coral/30 border-t-coral"
              />
              <p className="text-lg font-bold text-ink/70">מקשיבה...</p>
            </motion.div>
          )}

          {(screen.kind === "thinking" || screen.kind === "refining") && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ThinkingAnimation />
            </motion.div>
          )}

          {screen.kind === "preview" && (
            <motion.div
              key={`preview-${screen.attempt}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PreviewCard
                imageB64={screen.imageB64}
                attempt={screen.attempt}
                onApprove={handlePrint}
                onRefine={handleRefine}
                onReset={reset}
              />
            </motion.div>
          )}

          {screen.kind === "printing" && (
            <motion.div
              key="printing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PrintingScreen progress={screen.progress} />
            </motion.div>
          )}

          {screen.kind === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Celebration />
            </motion.div>
          )}

          {screen.kind === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ErrorView message={screen.message} onReset={reset} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

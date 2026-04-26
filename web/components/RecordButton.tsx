"use client";

import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { useCallback } from "react";

interface Props {
  isRecording: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
}

export function RecordButton({ isRecording, onPressStart, onPressEnd }: Props) {
  const press = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(50);
      }
      onPressStart();
    },
    [onPressStart],
  );

  const release = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      onPressEnd();
    },
    [onPressEnd],
  );

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-coral animate-pulse-ring" />
            <span
              className="absolute inset-0 rounded-full bg-coral animate-pulse-ring"
              style={{ animationDelay: "0.4s" }}
            />
          </>
        )}
        <motion.button
          type="button"
          aria-label="הקלטה"
          onPointerDown={press}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={(e) => {
            if (isRecording) release(e);
          }}
          onContextMenu={(e) => e.preventDefault()}
          animate={
            isRecording
              ? { scale: 1.08 }
              : {
                  scale: [1, 1.05, 1],
                  transition: {
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut",
                  },
                }
          }
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative h-60 w-60 rounded-full bg-coral text-white shadow-toy-lg flex items-center justify-center select-none"
        >
          <Mic size={96} strokeWidth={2.4} />
        </motion.button>
      </div>
      <p className="text-2xl font-extrabold text-ink/90 flex items-center gap-2">
        <span>תלחצי ותגידי</span>
        <span aria-hidden>🎤</span>
      </p>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Palette, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const PHRASES = [
  "חושבת...",
  "מציירת בראש...",
  "מערבבת צבעים...",
  "מוסיפה קסם...",
  "מחפשת רעיון...",
  "מצביעה במכחול...",
  "מקשטת בנצנצים...",
  "ממציאה משהו מיוחד...",
];

function pickNext(prev: string): string {
  let next = prev;
  while (next === prev) {
    next = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  }
  return next;
}

interface Sparkle {
  id: number;
  x: number;
  delay: number;
  drift: number;
  size: number;
}

export function ThinkingAnimation() {
  const [phrase, setPhrase] = useState(PHRASES[0]);
  const phraseRef = useRef(phrase);
  phraseRef.current = phrase;

  useEffect(() => {
    const id = setInterval(() => {
      setPhrase((p) => pickNext(p));
    }, 1200);
    return () => clearInterval(id);
  }, []);

  const sparkles = useMemo<Sparkle[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: 8 + Math.random() * 84,
        delay: Math.random() * 3,
        drift: -30 + Math.random() * 60,
        size: 10 + Math.random() * 14,
      })),
    [],
  );

  return (
    <div className="relative flex flex-col items-center gap-8 w-full max-w-sm">
      <div className="absolute inset-x-0 -top-12 h-[280px] pointer-events-none overflow-hidden">
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="absolute bottom-0 animate-drift"
            style={{
              left: `${s.x}%`,
              animationDelay: `${s.delay}s`,
              ["--drift-x" as string]: `${s.drift}px`,
              fontSize: `${s.size}px`,
            }}
          >
            ✨
          </span>
        ))}
      </div>

      <motion.div
        animate={{ y: [0, -10, 0], rotate: [-6, 6, -6] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="relative h-40 w-40 rounded-full bg-sun shadow-toy flex items-center justify-center"
      >
        <Palette size={84} className="text-ink" strokeWidth={2.2} />
        <Sparkles
          size={32}
          className="absolute -top-2 -right-2 text-coral"
          strokeWidth={2.4}
        />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.p
          key={phrase}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-3xl font-extrabold text-ink"
        >
          {phrase}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

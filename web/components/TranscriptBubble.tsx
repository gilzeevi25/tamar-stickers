"use client";

import { motion } from "framer-motion";

interface Props {
  hebrew: string;
}

export function TranscriptBubble({ hebrew }: Props) {
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative rounded-toy bg-white px-7 py-5 shadow-toy max-w-sm"
    >
      <p className="text-xs font-bold text-coral mb-1">אמרת:</p>
      <p className="text-2xl font-extrabold text-ink leading-snug">
        {hebrew} <span aria-hidden>🎤</span>
      </p>
      <span
        className="absolute -bottom-3 right-10 h-6 w-6 bg-white rotate-45 rounded-sm shadow-toy"
        aria-hidden
      />
    </motion.div>
  );
}

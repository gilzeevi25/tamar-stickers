"use client";

import { motion } from "framer-motion";

interface Props {
  message: string;
  onReset: () => void;
}

export function ErrorView({ message, onReset }: Props) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="flex flex-col items-center gap-6 text-center max-w-sm"
    >
      <span className="text-6xl">😅</span>
      <p className="text-xl font-bold text-ink leading-snug">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-full bg-coral text-white font-extrabold px-8 py-4 shadow-toy text-lg"
      >
        ננסה שוב
      </button>
    </motion.div>
  );
}

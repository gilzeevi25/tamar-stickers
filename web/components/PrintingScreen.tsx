"use client";

import { motion } from "framer-motion";
import { Printer } from "lucide-react";

interface Props {
  progress: number;
}

export function PrintingScreen({ progress }: Props) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
        className="h-32 w-32 rounded-full bg-mint shadow-toy flex items-center justify-center text-white"
      >
        <Printer size={72} strokeWidth={2.2} />
      </motion.div>

      <div className="w-64 h-3 rounded-full bg-ink/10 overflow-hidden">
        <motion.div
          className="h-full bg-mint rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(pct * 100)}%` }}
          transition={{ ease: "linear", duration: 0.2 }}
        />
      </div>
      <p className="text-xl font-extrabold text-ink/80">מדפיסה...</p>
    </div>
  );
}

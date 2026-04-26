"use client";

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useEffect } from "react";

export function Celebration() {
  useEffect(() => {
    const fire = (origin: { x: number; y: number }) =>
      confetti({
        particleCount: 80,
        spread: 80,
        startVelocity: 45,
        origin,
        colors: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#2D3047"],
        scalar: 1.1,
      });
    fire({ x: 0.2, y: 0.4 });
    fire({ x: 0.8, y: 0.4 });
    setTimeout(() => fire({ x: 0.5, y: 0.3 }), 250);
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
      className="flex flex-col items-center gap-4"
    >
      <motion.span
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
        className="text-7xl"
      >
        🎉
      </motion.span>
      <p className="text-3xl font-extrabold text-ink">המדבקה מוכנה!</p>
    </motion.div>
  );
}

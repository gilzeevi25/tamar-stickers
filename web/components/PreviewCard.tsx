"use client";

import { motion } from "framer-motion";

import { ActionButtons } from "./ActionButtons";

interface Props {
  imageB64: string;
  attempt: number;
  onApprove: () => void;
  onRefine: () => void;
  onReset: () => void;
}

export function PreviewCard({
  imageB64,
  attempt,
  onApprove,
  onRefine,
  onReset,
}: Props) {
  const showRefine = attempt < 3;
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm">
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="rounded-toy bg-white p-4 shadow-toy-lg border border-ink/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${imageB64}`}
          alt="המדבקה שיצרנו"
          className="w-72 h-72 object-contain rounded-2xl"
          draggable={false}
        />
      </motion.div>

      <ActionButtons
        showRefine={showRefine}
        onApprove={onApprove}
        onRefine={onRefine}
        onReset={onReset}
      />

      {!showRefine && (
        <p className="text-sm text-ink/60">אפשר להתחיל מחדש 🌱</p>
      )}
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { Check, RefreshCw, X } from "lucide-react";

interface Props {
  showRefine: boolean;
  onApprove: () => void;
  onRefine: () => void;
  onReset: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 20 };

interface ActionProps {
  bg: string;
  icon: React.ReactNode;
  label: string;
  onTap: () => void;
  delay: number;
  textColor?: string;
}

function Action({ bg, icon, label, onTap, delay, textColor }: ActionProps) {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      onPointerDown={() => {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(20);
        }
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ ...spring, delay }}
      className="flex flex-col items-center gap-2"
    >
      <span
        className={`w-24 h-24 rounded-full ${bg} shadow-toy flex items-center justify-center ${textColor ?? "text-white"}`}
      >
        {icon}
      </span>
      <span className="text-base font-bold text-ink/80">{label}</span>
    </motion.button>
  );
}

export function ActionButtons({
  showRefine,
  onApprove,
  onRefine,
  onReset,
}: Props) {
  return (
    <div className="flex items-start justify-center gap-6">
      <Action
        bg="bg-mint"
        icon={<Check size={48} strokeWidth={3} />}
        label="להדפיס!"
        onTap={onApprove}
        delay={0}
      />
      {showRefine && (
        <Action
          bg="bg-coral"
          icon={<X size={48} strokeWidth={3} />}
          label="לא בדיוק..."
          onTap={onRefine}
          delay={0.1}
        />
      )}
      <Action
        bg="bg-sun"
        icon={<RefreshCw size={44} strokeWidth={2.6} />}
        label="מהתחלה"
        onTap={onReset}
        delay={showRefine ? 0.2 : 0.1}
        textColor="text-ink"
      />
    </div>
  );
}

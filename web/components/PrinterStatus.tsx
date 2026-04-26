"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import {
  PrinterHandle,
  connectPrinter,
  isWebBluetoothSupported,
} from "@/lib/printer";

export type ConnectionState = "idle" | "connecting" | "ready" | "error";

interface Props {
  state: ConnectionState;
  deviceName: string | null;
  onConnected: (handle: PrinterHandle) => void;
  onError: (msg: string) => void;
}

const LABELS: Record<ConnectionState, { icon: string; text: string }> = {
  idle: { icon: "🔌", text: "התחברי למדפסת" },
  connecting: { icon: "📡", text: "מתחברת..." },
  ready: { icon: "🖨️", text: "מוכן" },
  error: { icon: "⚠️", text: "תנסי שוב" },
};

export function PrinterStatus({
  state,
  deviceName,
  onConnected,
  onError,
}: Props) {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isWebBluetoothSupported());
  }, []);

  const tryConnect = useCallback(async () => {
    if (!supported) {
      onError("Web Bluetooth לא נתמך — בואי נפתח באנדרואיד");
      return;
    }
    try {
      const handle = await connectPrinter();
      onConnected(handle);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "connect_failed";
      onError(msg);
    }
  }, [supported, onConnected, onError]);

  const label = LABELS[state];
  const display = state === "ready" && deviceName ? deviceName : label.text;

  return (
    <motion.button
      type="button"
      onClick={tryConnect}
      disabled={state === "connecting"}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow-toy text-sm font-bold text-ink/80 disabled:opacity-70"
    >
      <span aria-hidden>{label.icon}</span>
      <span className="max-w-[140px] truncate">{display}</span>
    </motion.button>
  );
}

"use client";

import { useEffect, useState } from "react";

import { SignInGate } from "@/components/SignInGate";
import {
  connectPrinter,
  getLastDeviceName,
  isWebBluetoothSupported,
} from "@/lib/printer";

export default function ParentPage() {
  return (
    <SignInGate>
      <ParentSettings />
    </SignInGate>
  );
}

function ParentSettings() {
  const [supported, setSupported] = useState(true);
  const [lastName, setLastName] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    setSupported(isWebBluetoothSupported());
    setLastName(getLastDeviceName());
  }, []);

  async function pairPrinter() {
    setStatus("מתחברת...");
    try {
      const handle = await connectPrinter();
      setStatus(`התחברנו ל־${handle.device.name ?? "מדפסת"} ✅`);
      setLastName(handle.device.name ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      setStatus(`כשל: ${msg}`);
    }
  }

  return (
    <main className="min-h-[100dvh] p-6 max-w-md mx-auto">
      <h1 className="text-3xl font-extrabold text-ink mb-6">הגדרות הורים</h1>

      <section className="bg-white rounded-toy shadow-toy p-5 mb-4">
        <h2 className="text-xl font-bold mb-2">מדפסת</h2>
        <p className="text-sm text-ink/70 mb-4">
          המדפסת האחרונה: {lastName ?? "אין עדיין"}
        </p>
        <button
          type="button"
          onClick={pairPrinter}
          disabled={!supported}
          className="rounded-full bg-coral text-white font-bold px-6 py-3 shadow-toy disabled:opacity-50"
        >
          חברי מדפסת חדשה
        </button>
        {!supported && (
          <p className="mt-3 text-sm text-coral">
            הדפדפן הזה לא תומך ב־Web Bluetooth. אפשר להשתמש ב־Chrome על אנדרואיד.
          </p>
        )}
        {status && <p className="mt-3 text-sm text-ink/80">{status}</p>}
      </section>

      <section className="bg-white rounded-toy shadow-toy p-5">
        <h2 className="text-xl font-bold mb-2">כתובת השרת</h2>
        <code className="block text-xs bg-cream p-3 rounded-xl break-all">
          {process.env.NEXT_PUBLIC_API_URL ?? "(לא מוגדר)"}
        </code>
      </section>
    </main>
  );
}

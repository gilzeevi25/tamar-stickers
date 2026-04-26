"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PushToTalk {
  isRecording: boolean;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  permission: "unknown" | "granted" | "denied";
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof window === "undefined" || !window.MediaRecorder) return undefined;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

export function usePushToTalk(): PushToTalk {
  const [isRecording, setIsRecording] = useState(false);
  const [permission, setPermission] = useState<PushToTalk["permission"]>(
    "unknown",
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stoppedRef = useRef<((b: Blob | null) => void) | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    const stream = await navigator.mediaDevices
      .getUserMedia({ audio: true })
      .catch((err) => {
        setPermission("denied");
        throw err;
      });
    setPermission("granted");
    streamRef.current = stream;

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = mimeType ?? "audio/webm";
      const blob =
        chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type })
          : null;
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setIsRecording(false);
      stoppedRef.current?.(blob);
      stoppedRef.current = null;
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    return new Promise<Blob | null>((resolve) => {
      stoppedRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  return { isRecording, start, stop, permission };
}

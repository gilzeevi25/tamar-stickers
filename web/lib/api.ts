"use client";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface TranscribeResponse {
  hebrew: string;
  duration_ms: number;
}

export interface GenerateResponse {
  english_prompt: string;
  image_b64: string;
}

export class RefusalError extends Error {
  constructor(public hebrew: string) {
    super(hebrew);
    this.name = "RefusalError";
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(res: Response): Promise<never> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }

  if (res.status === 422 && body && typeof body === "object") {
    const detail = (body as { detail?: unknown }).detail;
    if (detail && typeof detail === "object" && "refusal_hebrew" in detail) {
      const ref = (detail as { refusal_hebrew?: unknown }).refusal_hebrew;
      if (typeof ref === "string") throw new RefusalError(ref);
    }
  }
  throw new ApiError(`api_error_${res.status}`, res.status);
}

export async function warmup(): Promise<void> {
  // Best-effort. Render free tier takes ~50s to wake; we kick it on app load.
  try {
    await fetch(`${BASE}/api/warmup`, { method: "GET" });
  } catch {
    /* ignore */
  }
}

export async function transcribe(audio: Blob): Promise<TranscribeResponse> {
  const form = new FormData();
  form.append("audio", audio, "audio.webm");
  const res = await fetch(`${BASE}/api/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as TranscribeResponse;
}

export async function generate(hebrew: string): Promise<GenerateResponse> {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hebrew }),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as GenerateResponse;
}

export async function refine(
  hebrew: string,
  prev_english: string,
  attempt: number,
): Promise<GenerateResponse> {
  const res = await fetch(`${BASE}/api/refine`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hebrew, prev_english, attempt }),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as GenerateResponse;
}

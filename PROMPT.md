# tamar-stickers
# Project Brief: A Hebrew Voice → AI → Cat Printer PWA

## What we're building

A phone-based PWA where a 7-year-old Hebrew-speaking girl can speak into the phone, see an AI-generated coloring sticker, and print it on a Bluetooth thermal cat printer. Inspired by Stickerbox.com but built from scratch, runs entirely on her Android phone, no subscription, full Hebrew RTL.

**Hardware target:** Cat-printer-family BLE thermal printer (GB02/GB03/MX10/MXTP — all use the same BLE protocol). 384px width, 200dpi.

## Tech stack

**Frontend (`/web/`)**
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS for styling
- Framer Motion for animations
- Web Bluetooth API for printer
- MediaRecorder API for audio capture
- Deployed to Vercel free tier
- PWA manifest with home-screen install

**Backend (`/api/`)**
- Python 3.11 + FastAPI
- `openai` (Whisper STT)
- `anthropic` (Claude for prompt engineering)
- `replicate` (Flux Schnell image gen)
- `Pillow` (resize, dither, threshold)
- Deployed to Render free tier
- All API keys live in Render env vars only — never reach the frontend

**Repo structure**

```
plugabet-stickers/
├── web/                         # Next.js PWA
│   ├── app/
│   │   ├── page.tsx             # main kid-facing screen
│   │   ├── layout.tsx           # RTL, Hebrew font, manifest
│   │   ├── globals.css
│   │   └── parent/page.tsx      # optional: history, settings
│   ├── components/
│   │   ├── RecordButton.tsx
│   │   ├── ThinkingAnimation.tsx
│   │   ├── PreviewCard.tsx
│   │   ├── ActionButtons.tsx    # ✅ ❌ 🔄
│   │   └── PrinterStatus.tsx
│   ├── lib/
│   │   ├── api.ts               # backend client
│   │   ├── audio.ts             # MediaRecorder hook
│   │   ├── printer.ts           # Web Bluetooth + cat protocol
│   │   └── state.ts             # Zustand store for screen state
│   ├── public/
│   │   ├── manifest.json
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── next.config.js
├── api/                         # FastAPI backend
│   ├── main.py                  # FastAPI app, routes
│   ├── pipeline/
│   │   ├── stt.py               # Whisper wrapper
│   │   ├── prompt.py            # Claude prompt engineering
│   │   ├── image.py             # Replicate + Pillow post-processing
│   │   └── refine.py            # refinement chain logic
│   ├── prompts/
│   │   ├── hebrew_to_lineart.md # system prompt for initial generation
│   │   └── refine.md            # system prompt for refinement chain
│   ├── requirements.txt
│   ├── render.yaml              # Render deploy config
│   └── .env.example
├── .gitignore
└── README.md
```

---

## User flow (this is the spec — implement exactly this)

```
[idle screen: big mic button]
        │
        │  girl taps & holds mic
        ▼
[recording: pulsing waveform]
        │
        │  girl releases
        ▼
[transcribing spinner — small, near the mic]
        │
        │  POST /api/transcribe → returns Hebrew text
        ▼
[show transcript in a speech bubble for 1.5s]
        │  "אמרת: חתול שרוכב על אופניים 🎤"
        │  (auto-advances, no tap needed)
        ▼
[thinking animation: sparkles, magic wand, varied phrases]
        │
        │  POST /api/generate → returns english_prompt + image PNG (base64)
        ▼
[preview card: image + 3 big buttons]
        │   ✅ green check    →  print via Web Bluetooth
        │   ❌ red X          →  refine: backend re-interprets, returns new image
        │   🔄 yellow redo    →  back to idle, fresh start
        ▼
[printing animation while bytes stream to printer]
        │
        ▼
[celebration: confetti, "המדבקה מוכנה!" with print sound, 2s]
        │
        ▼
[back to idle]
```

**Refinement (❌) behavior:** No new voice input needed. Backend receives `{hebrew, prev_english_prompt, prev_attempt_count}` and uses Claude to generate a new English prompt that explicitly diverges from the previous attempt (different style, different angle, simpler subject). This is the "chain of prompts" — Claude internally critiques the previous prompt and produces a refined one. After 3 failed attempts, suggest 🔄 instead.

---

## Backend specification

### Endpoints

#### `POST /api/transcribe`
- **Body:** multipart audio file (webm/opus from MediaRecorder)
- **Response:** `{ "hebrew": "חתול שרוכב על אופניים", "duration_ms": 2800 }`
- **Implementation:** OpenAI Whisper API (`whisper-1`), `language="he"` hint
- **Validation:** reject if audio < 300ms or > 15s

#### `POST /api/generate`
- **Body:** `{ "hebrew": "חתול שרוכב על אופניים" }`
- **Response:** `{ "english_prompt": "...", "image_b64": "iVBORw0KG..." }`
- **Steps:**
  1. Send Hebrew → Claude (Haiku 4.5) with `hebrew_to_lineart.md` system prompt → English prompt
  2. Check for `REFUSE:` prefix → return 422 with Hebrew refusal message
  3. Send English prompt → Replicate Flux Schnell (4 steps, square)
  4. Download PNG → Pillow: resize to 384px wide, convert to grayscale, threshold to 1-bit, Floyd-Steinberg dither
  5. Return base64

#### `POST /api/refine`
- **Body:** `{ "hebrew": "...", "prev_english": "...", "attempt": 2 }`
- **Response:** same shape as `/api/generate`
- **Implementation:** uses `refine.md` system prompt that takes the previous attempt and produces a deliberately different interpretation. Higher temperature (0.9 vs 0.4 for initial).

#### `GET /api/health`
- Liveness check for Render

### CORS

Allow only `process.env.FRONTEND_URL` (the Vercel deployment) and `localhost:3000` for dev.

### System prompts (write these to disk, load at startup)

**`prompts/hebrew_to_lineart.md`:**
```
You are a prompt engineer for a children's coloring sticker printer. The user is
a Hebrew-speaking 7-year-old child describing what they want printed.

Convert their Hebrew description to an English image generation prompt that produces:
- A black-and-white coloring book illustration
- Thick, clean outlines (2-3px)
- NO shading, NO gray fills, NO crosshatching — pure line art only
- White background, no border, single subject centered
- Simple cartoon style, age-appropriate, joyful

Output ONLY the English prompt as a single line. No preamble, no explanation,
no quotes.

EXAMPLES:
Input: "חתול שרוכב על אופניים"
Output: Black and white coloring book line art of a happy cartoon cat riding a bicycle, thick clean outlines, no shading, white background, simple style, centered

Input: "פרפר עם כתר"
Output: Black and white coloring book line art of a cute butterfly wearing a small crown, thick clean outlines, no shading, white background, simple style, centered

REFUSAL: If the request involves violence, weapons, scary monsters, blood,
drugs, or anything inappropriate for a young child, respond with:
REFUSE: <one sentence in Hebrew gently explaining we can draw something else>

Example refusal:
Input: "מפלצת עם דם"
Output: REFUSE: בואי נצייר משהו שמח! מה דעתך על דרקון חמוד או פיה?
```

**`prompts/refine.md`:**
```
You are refining a children's sticker prompt because the previous attempt was
not what the child wanted. Your job is to produce a DIFFERENT interpretation.

You will receive:
- ORIGINAL Hebrew request from the child
- PREVIOUS English prompt that didn't work
- ATTEMPT number (2 or 3)

Produce a new English prompt that:
- Still matches the Hebrew intent
- Differs meaningfully from the previous attempt: try a different pose, scene,
  expression, or composition
- For attempt 2: change the action/pose/setting
- For attempt 3: simplify dramatically — fewer elements, more iconic

All other rules from the original system prompt still apply (line art, thick
outlines, no shading, white background, single subject, centered).

Output ONLY the new English prompt. No preamble.
```

### Image post-processing (`pipeline/image.py`)

```python
from PIL import Image
import io

PRINTER_WIDTH_PX = 384  # cat printer hardware width

def prepare_for_thermal(png_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(png_bytes)).convert("L")
    # resize keeping aspect, fit to printer width
    w, h = img.size
    new_h = int(h * PRINTER_WIDTH_PX / w)
    img = img.resize((PRINTER_WIDTH_PX, new_h), Image.LANCZOS)
    # boost contrast before dither — line art prints sharper
    img = img.point(lambda p: 0 if p < 200 else 255)
    # convert to 1-bit with Floyd-Steinberg
    img = img.convert("1", dither=Image.FLOYDSTEINBERG)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()
```

### Render deployment (`api/render.yaml`)

```yaml
services:
  - type: web
    name: plugabet-stickers-api
    runtime: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: OPENAI_API_KEY
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: REPLICATE_API_TOKEN
        sync: false
      - key: FRONTEND_URL
        sync: false
```

⚠️ **Render free tier cold starts** (~50s). Add a `/warmup` endpoint and have the frontend ping it when the app loads. Document this in the README.

---

## Frontend specification

### Aesthetic direction

**Tone: playful/toy-like, NOT generic kid UI.** The default trap here is "Comic Sans + primary colors + Microsoft Paint shapes." Do not fall in. Aim for something that feels like a premium Japanese stationery brand for kids — soft, considered, warm, with a single strong personality color.

**Concrete design tokens:**

- **Palette:** off-white background `#FFF9F2`, warm coral primary `#FF6B6B`, mint accent `#4ECDC4`, sunshine yellow accent `#FFE66D`, deep navy ink `#2D3047`. No grays — use tinted neutrals only.
- **Typography:** load Hebrew web fonts. Display: **Heebo 800** or **Rubik 700** (both have great Hebrew + Latin support). Body: **Heebo 400**. Avoid Arial, Open Sans, Inter.
- **Shapes:** generous rounded corners (24px+ on cards, fully circular buttons). Soft drop shadows: `0 12px 32px -8px rgba(45, 48, 71, 0.15)`. No hard edges anywhere except intentional accents.
- **Motion:** every state transition animated with Framer Motion `spring` (stiffness 300, damping 20). Big things bounce. Idle state has a gentle `breathe` animation on the mic button (scale 1.0 ↔ 1.05, 2s cycle).

### Screen states

Use Zustand for a single state machine:

```ts
type Screen =
  | { kind: "idle" }
  | { kind: "recording", startedAt: number }
  | { kind: "transcribing" }
  | { kind: "showTranscript", hebrew: string }
  | { kind: "thinking", hebrew: string }
  | { kind: "preview", hebrew: string, imageB64: string, prevEnglish: string, attempt: number }
  | { kind: "refining", hebrew: string, prevEnglish: string, attempt: number }
  | { kind: "printing", progress: number }
  | { kind: "done" }
  | { kind: "error", message: string };
```

### Component specs

**`<RecordButton>`** (idle state)
- 240×240 circle, coral fill
- Microphone icon (lucide-react `Mic`, size 96, white)
- Label below in Hebrew: "תלחצי ותגידי" with a 🎤 emoji
- Press-and-hold gesture: `onPointerDown` starts recording, `onPointerUp` stops
- Haptic feedback on press start (`navigator.vibrate(50)`)
- Breathing animation when idle, pulsing red ring when recording

**`<ThinkingAnimation>`**
- Center: animated SVG of a magic wand or lightbulb with sparkles, floating gently
- Cycling Hebrew phrases every 1.2s: "חושבת...", "מציירת בראש...", "מערבבת צבעים...", "מוסיפה קסם..."
- Phrases come from a pool of 8+, shuffled, never repeating consecutively
- Sparkle particles drift upward in the background

**`<PreviewCard>`**
- Top: big rounded card with the generated image (white bg, 1px ink border)
- Below the card: three buttons in a row, equal size, large tap targets (96×96 minimum)
  - ✅ Mint circle, white check icon — "להדפיס!"
  - ❌ Coral circle, white X icon — "לא בדיוק..."
  - 🔄 Yellow circle, navy refresh icon — "מהתחלה"
- Buttons enter staggered: check first (the happy path), then the others 100ms apart
- After 3 failed attempts, hide ❌ and show only ✅ and 🔄 with a subtle hint: "אפשר להתחיל מחדש 🌱"

**`<PrinterStatus>`** (top-right corner, always visible)
- Small pill showing connection state: 🔌 disconnected / 📡 connecting / 🖨️ ready
- Tap to connect/reconnect (triggers `navigator.bluetooth.requestDevice`)
- Persists last device ID in localStorage so reconnects are 1-tap

### Hebrew RTL setup

In `app/layout.tsx`:

```tsx
<html lang="he" dir="rtl">
  <body className="font-heebo bg-cream text-ink antialiased">
```

Tailwind config: extend `fontFamily` with Heebo, register the Hebrew font subsets in `app/layout.tsx` via `next/font/google`.

### PWA manifest

```json
{
  "name": "מדבקות פלוגבת",
  "short_name": "מדבקות",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF9F2",
  "theme_color": "#FF6B6B",
  "orientation": "portrait",
  "lang": "he",
  "dir": "rtl",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Web Bluetooth + Cat Printer Protocol

### What you're talking to

The cat printer family (GB01, GB02, GB03, GT01, YT01, MX05, MX06, MX08, MX10, MXTP) all use the **same BLE protocol**. Reference implementation: https://github.com/NaitLee/Cat-Printer (Python + JS). Port the JS portion to TypeScript.

### Critical UUIDs

```ts
const PRINTER_SERVICE_UUID = "0000ae30-0000-1000-8000-00805f9b34fb";
const PRINTER_WRITE_UUID   = "0000ae01-0000-1000-8000-00805f9b34fb";
const PRINTER_NOTIFY_UUID  = "0000ae02-0000-1000-8000-00805f9b34fb";
const NAME_PREFIXES = ["GB", "GT", "YT", "MX"];
```

### Connection flow

```ts
const device = await navigator.bluetooth.requestDevice({
  filters: NAME_PREFIXES.map(p => ({ namePrefix: p })),
  optionalServices: [PRINTER_SERVICE_UUID],
});
const server = await device.gatt!.connect();
const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
const writeChar = await service.getCharacteristic(PRINTER_WRITE_UUID);
```

### Print protocol (from Cat-Printer)

- Image must be 1-bit, exactly 384px wide
- Send commands in chunks of ≤100 bytes (BLE MTU constraint)
- Use `writeValueWithoutResponse` (not `writeValue`) — way faster
- Header: lattice command, get device state, set energy/quality, set "lattice begin"
- Body: each row = 48 bytes, prefixed with `[0x51, 0x75, 0x00, 0x00, 0x00, 0x30, 0x00]` and CRC
- Footer: feed paper, lattice end

**Don't write this from scratch.** Port `printer.py` from Cat-Printer to TS — about 200 lines. Or fork `kitty-printer` (existing JS implementation) and adapt.

### Permissions gotcha

Web Bluetooth requires HTTPS (Vercel handles this) AND a user gesture to open the device picker. Wire the printer-connect button so it's only triggered by an explicit tap, never on page load.

---

## Implementation phases

Build in this order. Don't skip ahead — each phase produces a testable artifact.

### Phase 1 — Backend skeleton (1 hour)
1. Create `api/` with FastAPI, single `/health` endpoint
2. Add Whisper, Anthropic, Replicate clients
3. Implement `/transcribe` end-to-end with curl test
4. Implement `/generate` end-to-end with curl test, verify PNG comes back
5. Deploy to Render, confirm live

### Phase 2 — Frontend shell (1 hour)
1. `create-next-app web/` with TS + Tailwind
2. Hebrew RTL layout, Heebo font, color palette
3. State machine in Zustand, all 8 states stubbed
4. Hardcoded path through screens for design verification (no backend yet)

### Phase 3 — Wire frontend to backend (1 hour)
1. `lib/audio.ts` — push-to-talk hook returning Blob on release
2. `lib/api.ts` — typed client for all 3 endpoints
3. Real flow: idle → record → transcribe → show transcript → thinking → preview
4. Refine and redo wired

### Phase 4 — Cat printer integration (2 hours)
1. Port the Cat-Printer JS to `lib/printer.ts`
2. Wire ✅ button to send the image bytes to printer
3. Test with actual hardware
4. Add reconnection logic, error states

### Phase 5 — Polish (1 hour)
1. Animations: Framer Motion on every transition
2. Sound effects: subtle clicks on tap, victory chime on print done (use Web Audio API, ~5 tiny WAV files)
3. PWA manifest, icons, install prompt
4. Confetti on print completion (`canvas-confetti` library)
5. Error handling: backend down, printer disconnected, mic permission denied — all in friendly Hebrew

### Phase 6 — Test with the actual 7-year-old (priceless)
- Watch silently for 5 minutes. Note every confusion. Fix the worst three.

---

## Testing checklist

- [ ] Hebrew transcription works for kid-pitched voice (Whisper handles this fine, but verify with real recordings)
- [ ] Refusal flow renders Hebrew message in friendly tone, not error-modal
- [ ] Web Bluetooth device picker actually shows the cat printer when nearby
- [ ] Printed sticker is recognizable as the prompted subject (line art quality)
- [ ] Cold start on Render doesn't crash the UX — show a "מתחממת..." (warming up) state for the first 30s after app open
- [ ] PWA installs to Android home screen with correct icon and Hebrew name
- [ ] Battery: full session (10 stickers) doesn't drain phone battery noticeably
- [ ] Offline: app shows clear Hebrew error if no internet, not a crash

---

## Resources to reference

- **Cat-Printer (protocol reference):** https://github.com/NaitLee/Cat-Printer
- **kitty-printer (JS port to fork):** https://github.com/NaitLee/kitty-printer
- **thermy (CLI for testing):** https://github.com/mazoqui/thermy
- **Web Bluetooth on Android:** https://developer.chrome.com/docs/capabilities/bluetooth
- **MediaRecorder browser support:** https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- **Replicate Flux Schnell:** https://replicate.com/black-forest-labs/flux-schnell
- **Anthropic Python SDK:** use `claude-haiku-4-5-20251001` for cost — good enough for prompt engineering, ~$0.001/call
- **OpenAI Whisper API:** `whisper-1`, $0.006/minute

## Cost model (per sticker)

- Whisper: ~$0.001 (3-second clip)
- Claude Haiku: ~$0.0005
- Flux Schnell: ~$0.003
- **Total: ~$0.005 per sticker = ~₪0.02**
- 50 stickers/day = ₪1/day. Negligible.

## Out of scope for v1

- Multi-user / accounts
- History persistence (everything is session-local)
- Server-side image cache
- Print queue (one at a time is fine)
- iOS support (Web Bluetooth doesn't work on iOS Safari — Android only for now)
- Voice feedback for refinement (just regenerates instead — keep UX simple for kids)


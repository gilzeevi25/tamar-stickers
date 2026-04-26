# tamar-stickers

A Hebrew voice → AI → cat-printer PWA. A 7-year-old taps a mic, says
something in Hebrew, sees an AI-generated coloring sticker, and prints it on
a Bluetooth thermal cat printer.

See [`PROMPT.md`](./PROMPT.md) for the full product spec.

## Repo layout

```
tamar-stickers/
├── api/   # FastAPI backend (deployed to Render)
└── web/   # Next.js 15 PWA (deployed to Vercel)
```

## Local development

### Backend

```bash
cd api
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in API keys
uvicorn main:app --reload --port 8000
```

Required env vars:

- `OPENAI_API_KEY` — Whisper STT
- `ANTHROPIC_API_KEY` — Claude Haiku for prompt engineering
- `REPLICATE_API_TOKEN` — Flux Schnell for image gen
- `FRONTEND_URL` — for CORS (e.g. `https://tamar-stickers.vercel.app`)

### Frontend

```bash
cd web
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local
npm run dev
```

Open <http://localhost:3000> on an Android phone over the local network
(or via `ngrok` for HTTPS, which Web Bluetooth requires).

## Deployment

- **Backend:** Render free tier via `api/render.yaml`. Cold starts take
  ~50s — the frontend pings `/api/warmup` on load to wake it up.
- **Frontend:** Vercel free tier. Set `NEXT_PUBLIC_API_URL` to the Render
  URL.

## Hardware

Any cat-printer-family BLE thermal printer: GB01 / GB02 / GB03 / GT01 /
YT01 / MX05 / MX06 / MX08 / MX10 / MXTP. All use the same BLE protocol.
384px hardware width, 200dpi.

Web Bluetooth requires HTTPS and Android (iOS Safari does not support it).

## Cost model

~$0.005 per sticker (Whisper $0.001 + Claude Haiku $0.0005 + Flux Schnell
$0.003). 50 stickers/day ≈ ₪1/day.

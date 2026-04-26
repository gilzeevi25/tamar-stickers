# tamar-stickers

A Hebrew voice → AI → cat-printer PWA. A 7-year-old taps a mic, says
something in Hebrew, sees an AI-generated coloring sticker, and prints it on
a Bluetooth thermal cat printer.

See [`PROMPT.md`](./PROMPT.md) for the full product spec.

## Repo layout

```
tamar-stickers/
├── api/   # FastAPI backend (deployed to Render)
└── web/   # Next.js 15 PWA, static-exported for GitHub Pages
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
- `FRONTEND_URL` — for CORS, e.g. `https://gilzeevi25.github.io`

### Frontend

```bash
cd web
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local
npm run dev
```

In dev mode `basePath` is empty, so the app runs at <http://localhost:3000>.
Open it on an Android phone over your LAN (or via `ngrok` for HTTPS, which
Web Bluetooth requires).

## Deployment

### Backend → Render (free tier)

`api/render.yaml` is the blueprint. Render's free tier cold-starts in ~50s,
so the frontend pings `/api/warmup` on load to wake the dyno before the
child finishes recording.

### Frontend → GitHub Pages

The PWA is a static export (`output: "export"` in `next.config.js`). A
GitHub Actions workflow at `.github/workflows/deploy-pages.yml` builds
`web/out/` and publishes it on every push to `main` that touches `web/`.

**One-time setup:**

1. **Repo → Settings → Pages → Source:** *GitHub Actions*.
2. **Repo → Settings → Secrets and variables → Actions → Variables:**
   - `NEXT_PUBLIC_API_URL` — your Render URL, e.g.
     `https://tamar-stickers-api.onrender.com`
   - (Optional) `NEXT_PUBLIC_BASE_PATH` — defaults to `/tamar-stickers`.
     Set to empty string `""` if you point a custom domain at Pages.
3. Push to `main`. The site goes live at
   `https://gilzeevi25.github.io/tamar-stickers/`.
4. Add that URL to the backend's `FRONTEND_URL` env var on Render so CORS
   lets it through.

Web Bluetooth requires HTTPS (Pages serves HTTPS automatically) and
Android Chrome (iOS Safari does not support Web Bluetooth).

## Hardware

Any cat-printer-family BLE thermal printer: GB01 / GB02 / GB03 / GT01 /
YT01 / MX05 / MX06 / MX08 / MX10 / MXTP. All use the same BLE protocol.
384px hardware width, 200dpi.

## Cost model

~$0.005 per sticker (Whisper $0.001 + Claude Haiku $0.0005 + Flux Schnell
$0.003). 50 stickers/day ≈ ₪1/day.

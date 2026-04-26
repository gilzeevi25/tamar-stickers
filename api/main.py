"""FastAPI app — Hebrew voice → AI → cat printer pipeline."""

from __future__ import annotations

import base64
import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pipeline.image import generate_lineart_png, prepare_for_thermal
from pipeline.prompt import hebrew_to_english_prompt, refine_prompt
from pipeline.stt import transcribe_hebrew

load_dotenv()

MIN_AUDIO_BYTES = 1_500    # ~300ms of opus
MAX_AUDIO_BYTES = 1_500_000  # ~15s of opus

app = FastAPI(title="tamar-stickers api", version="0.1.0")

frontend_url = os.environ.get("FRONTEND_URL", "").strip()
allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---------- schemas ----------


class TranscribeResponse(BaseModel):
    hebrew: str
    duration_ms: int


class GenerateRequest(BaseModel):
    hebrew: str = Field(min_length=1, max_length=400)


class RefineRequest(BaseModel):
    hebrew: str = Field(min_length=1, max_length=400)
    prev_english: str = Field(min_length=1, max_length=2000)
    attempt: int = Field(ge=2, le=5)


class GenerateResponse(BaseModel):
    english_prompt: str
    image_b64: str


class RefusalResponse(BaseModel):
    refusal_hebrew: str


# ---------- routes ----------


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/warmup")
async def warmup() -> dict[str, str]:
    """Hit on app load to wake the Render free-tier dyno before recording starts."""
    return {"status": "warm"}


@app.post("/api/transcribe", response_model=TranscribeResponse)
async def transcribe(audio: Annotated[UploadFile, File()]) -> TranscribeResponse:
    data = await audio.read()
    size = len(data)
    if size < MIN_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="audio_too_short")
    if size > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="audio_too_long")

    filename = audio.filename or "audio.webm"
    try:
        hebrew = await transcribe_hebrew(data, filename=filename)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"stt_failed: {exc}") from exc

    if not hebrew:
        raise HTTPException(status_code=422, detail="empty_transcript")

    # Whisper doesn't return duration; rough estimate based on opus bitrate (~32 kbps).
    approx_ms = max(300, int(size / 4))
    return TranscribeResponse(hebrew=hebrew, duration_ms=approx_ms)


async def _generate(english_prompt: str) -> GenerateResponse:
    try:
        raw_png = await generate_lineart_png(english_prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"image_gen_failed: {exc}") from exc
    thermal_png = prepare_for_thermal(raw_png)
    return GenerateResponse(
        english_prompt=english_prompt,
        image_b64=base64.b64encode(thermal_png).decode("ascii"),
    )


@app.post(
    "/api/generate",
    response_model=GenerateResponse,
    responses={422: {"model": RefusalResponse}},
)
async def generate(req: GenerateRequest) -> GenerateResponse:
    try:
        result = await hebrew_to_english_prompt(req.hebrew)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"prompt_failed: {exc}") from exc

    if result.is_refusal:
        raise HTTPException(
            status_code=422,
            detail={"refusal_hebrew": result.refusal_hebrew},
        )
    assert result.english is not None
    return await _generate(result.english)


@app.post(
    "/api/refine",
    response_model=GenerateResponse,
    responses={422: {"model": RefusalResponse}},
)
async def refine(req: RefineRequest) -> GenerateResponse:
    try:
        result = await refine_prompt(req.hebrew, req.prev_english, req.attempt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"refine_failed: {exc}") from exc

    if result.is_refusal:
        raise HTTPException(
            status_code=422,
            detail={"refusal_hebrew": result.refusal_hebrew},
        )
    assert result.english is not None
    return await _generate(result.english)

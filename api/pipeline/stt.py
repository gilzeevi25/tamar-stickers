"""Speech-to-text via OpenAI Whisper."""

from __future__ import annotations

import io
import os

from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


async def transcribe_hebrew(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe a short Hebrew audio clip with Whisper.

    The Hebrew language hint dramatically improves accuracy on a kid's voice.
    """
    buf = io.BytesIO(audio_bytes)
    buf.name = filename
    resp = await _get_client().audio.transcriptions.create(
        model="whisper-1",
        file=buf,
        language="he",
        response_format="text",
    )
    # When response_format="text", the SDK returns a plain string.
    text = resp if isinstance(resp, str) else getattr(resp, "text", "")
    return text.strip()

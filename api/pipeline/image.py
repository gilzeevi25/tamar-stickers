"""Image generation (Flux Schnell) and thermal-printer post-processing."""

from __future__ import annotations

import asyncio
import io
import os

import httpx
import replicate
from PIL import Image

PRINTER_WIDTH_PX = 384  # cat printer hardware width
FLUX_MODEL = "ideogram-ai/ideogram-v3-turbo""


def _get_replicate_client() -> replicate.Client:
    token = os.environ.get("REPLICATE_API_TOKEN")
    if not token:
        raise RuntimeError("REPLICATE_API_TOKEN is not set")
    return replicate.Client(api_token=token)


async def generate_lineart_png(english_prompt: str) -> bytes:
    """Run Flux Schnell and return the raw PNG bytes of the first output image."""
    client = _get_replicate_client()

    def _run() -> str | list[str]:
        return client.run(
            FLUX_MODEL,
            input={
                "prompt": english_prompt,
                "aspect_ratio": "1:1",
                "style_type": "Design",          # cleanest line-art-ish style
                "magic_prompt_option": "Off",    # Claude already crafted the prompt
                "resolution": "1024x1024",
            },
        )

    output = await asyncio.to_thread(_run)
    url = output[0] if isinstance(output, list) else output
    if hasattr(url, "url"):
        url = url.url
    if not isinstance(url, str):
        url = str(url)

    async with httpx.AsyncClient(timeout=60.0) as http:
        resp = await http.get(url)
        resp.raise_for_status()
        return resp.content


def prepare_for_thermal(png_bytes: bytes) -> bytes:
    """Resize, contrast-boost, dither down to a 1-bit PNG ready for the printer."""
    img = Image.open(io.BytesIO(png_bytes)).convert("L")
    w, h = img.size
    new_h = max(1, int(h * PRINTER_WIDTH_PX / w))
    img = img.resize((PRINTER_WIDTH_PX, new_h), Image.LANCZOS)
    # Contrast boost — line art prints crisper when we collapse mid-tones first.
    img = img.point(lambda p: 0 if p < 200 else 255)
    img = img.convert("1", dither=Image.FLOYDSTEINBERG)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()

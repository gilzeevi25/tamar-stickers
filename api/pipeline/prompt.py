"""Hebrew → English image-prompt translation via Claude Haiku."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from anthropic import AsyncAnthropic

MODEL = "claude-haiku-4-5-20251001"
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

_client: AsyncAnthropic | None = None
_initial_system: str | None = None
_refine_system: str | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        _client = AsyncAnthropic(api_key=api_key)
    return _client


def _load_initial_system() -> str:
    global _initial_system
    if _initial_system is None:
        _initial_system = (PROMPTS_DIR / "hebrew_to_lineart.md").read_text(
            encoding="utf-8"
        )
    return _initial_system


def _load_refine_system() -> str:
    global _refine_system
    if _refine_system is None:
        _refine_system = (PROMPTS_DIR / "refine.md").read_text(encoding="utf-8")
    return _refine_system


@dataclass
class PromptResult:
    """Outcome of translating a Hebrew description into an image prompt."""

    english: str | None
    refusal_hebrew: str | None

    @property
    def is_refusal(self) -> bool:
        return self.refusal_hebrew is not None


def _parse(text: str) -> PromptResult:
    text = text.strip()
    if text.startswith("REFUSE:"):
        return PromptResult(english=None, refusal_hebrew=text[len("REFUSE:") :].strip())
    return PromptResult(english=text, refusal_hebrew=None)


async def hebrew_to_english_prompt(hebrew: str) -> PromptResult:
    """Initial translation. Low temperature for consistent, on-spec output."""
    msg = await _get_client().messages.create(
        model=MODEL,
        max_tokens=300,
        temperature=0.4,
        system=_load_initial_system(),
        messages=[{"role": "user", "content": hebrew}],
    )
    text = "".join(
        block.text for block in msg.content if getattr(block, "type", None) == "text"
    )
    return _parse(text)


async def refine_prompt(
    hebrew: str, prev_english: str, attempt: int
) -> PromptResult:
    """Generate a deliberately different prompt after a failed attempt.

    Higher temperature so the model actually diverges from the previous take.
    """
    user_message = (
        f"ORIGINAL Hebrew: {hebrew}\n"
        f"PREVIOUS English prompt: {prev_english}\n"
        f"ATTEMPT: {attempt}\n\n"
        "Produce a new English prompt now."
    )
    msg = await _get_client().messages.create(
        model=MODEL,
        max_tokens=300,
        temperature=0.9,
        system=_load_refine_system(),
        messages=[{"role": "user", "content": user_message}],
    )
    text = "".join(
        block.text for block in msg.content if getattr(block, "type", None) == "text"
    )
    return _parse(text)

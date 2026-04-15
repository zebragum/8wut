"""Load optional local tone text (bounded) for vision prompts."""

from __future__ import annotations

import os
from pathlib import Path

_DEFAULT_NAME = "prompt_tone.txt"
_DEFAULT_CAP = 8000

_FALLBACK = """
Tone reference for short-form food comments (TikTok / Reels energy, not stand-up):
People react fast: hungry, jealous, playful roasts, "I'd destroy that," "that's criminal,"
mom-energy support, tagging friends, joking about diets. Warm community — they hype the cook,
tease a little, and talk like they know each other. Light emoji. No slurs; keep it fun and safe.
"""


def load_inspiration_text(
    *,
    max_chars: int = _DEFAULT_CAP,
    filename: str = _DEFAULT_NAME,
) -> str:
    """
    Read the start of ``eightwut_video_maker/data/<filename>`` if it exists.

    Override slice length with ``WUT8_INSPIRATION_MAX_CHARS`` (integer).
    """
    cap = max_chars
    env = os.environ.get("WUT8_INSPIRATION_MAX_CHARS", "").strip()
    if env.isdigit():
        cap = int(env)

    path = Path(__file__).resolve().parent / "data" / filename
    if not path.is_file():
        return _FALLBACK.strip()
    raw = path.read_text(encoding="utf-8", errors="replace").strip()
    return raw[:cap]

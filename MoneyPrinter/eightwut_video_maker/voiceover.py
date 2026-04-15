"""OpenAI text-to-speech for short promo voiceovers (MoneyPrinter exports)."""

from __future__ import annotations

import re
import tempfile
from pathlib import Path


# TTS must not speak the brand as "eight wut" / "8wut" — use "ate what" in the script only.
DEFAULT_PROMO_SCRIPT = (
    "Ate what? It's a new food photojournaling app. "
    "Just be taking pictures of everything you ate, all in a timeline."
)

# Spoken brand variants → "ate what" (what TTS should say).
_TTS_BRAND_SUBS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b8\s*[-]?\s*wut\b", re.I), "ate what"),
    (re.compile(r"\beight\s*[-]?\s*wut\b", re.I), "ate what"),
]


def tts_safe_script(text: str) -> str:
    """Strip speakable brand spellings so OpenAI TTS never says ``8wut`` / ``eight wut``."""
    s = (text or "").strip()
    for pat, repl in _TTS_BRAND_SUBS:
        s = pat.sub(repl, s)
    return s


def synthesize_promo_voiceover(
    text: str,
    *,
    api_key: str,
    out_path: Path | None = None,
    voice: str = "shimmer",
    model: str = "tts-1-hd",
    speed: float = 0.96,
) -> Path:
    """
    Generate speech with OpenAI TTS; return path to an audio file (MP3).

    Voices: ``shimmer`` and ``nova`` read as younger female; ``shimmer`` is a bit softer
    (closer to 'demure'); ``nova`` is brighter/more hype.
    """
    try:
        from openai import OpenAI
    except ImportError as e:
        raise RuntimeError("Install openai: pip install openai") from e

    client = OpenAI(api_key=api_key)
    if out_path is None:
        fd, tmp = tempfile.mkstemp(suffix=".mp3", prefix="wut8_vo_")
        import os

        os.close(fd)
        out_path = Path(tmp)
    else:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

    allowed = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
    v = (voice or "shimmer").strip().lower()
    if v not in allowed:
        v = "shimmer"

    safe_input = tts_safe_script(text)
    resp = client.audio.speech.create(
        model=model,
        voice=v,  # type: ignore[arg-type]
        input=safe_input,
        response_format="mp3",
        speed=max(0.25, min(4.0, float(speed))),
    )
    out_path.write_bytes(resp.content)
    return out_path

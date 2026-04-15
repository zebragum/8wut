"""OpenAI text-to-speech for short promo voiceovers (MoneyPrinter exports)."""

from __future__ import annotations

import tempfile
from pathlib import Path


# Energetic-but-soft, West-Coast-adjacent delivery works best with a warm female voice + this pacing.
DEFAULT_PROMO_SCRIPT = (
    "Ate what? It's called eight wut — a new food photojournaling app. "
    "Just be taking pictures of everything you ate, all in a timeline."
)


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

    resp = client.audio.speech.create(
        model=model,
        voice=v,  # type: ignore[arg-type]
        input=text.strip(),
        response_format="mp3",
        speed=max(0.25, min(4.0, float(speed))),
    )
    out_path.write_bytes(resp.content)
    return out_path

"""Load optional local comment samples for extra LLM tone (create data/comment_vibe.txt yourself)."""

from __future__ import annotations

from pathlib import Path


def default_vibe_path() -> Path:
    return Path(__file__).resolve().parent / "data" / "comment_vibe.txt"


def load_comment_vibe_snippet(*, max_chars: int = 6000) -> str:
    path = default_vibe_path()
    if not path.is_file():
        return ""
    raw = path.read_text(encoding="utf-8", errors="replace").strip()
    if not raw:
        return ""
    return raw[:max_chars]

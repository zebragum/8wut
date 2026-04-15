"""
Download a vertical-ish Minecraft parkour clip for use as ``minecraft_bg.mp4``.

Same idea as ethernet8023/tiktok-generator (YouTube search + yt-dlp):
https://github.com/ethernet8023/tiktok-generator/blob/main/src/parkour.ts

Requires ``yt-dlp`` (Python package) and ``ffmpeg`` on PATH for merges.
Respect YouTube's Terms of Service; use only where allowed.
"""

from __future__ import annotations

import random
from pathlib import Path


def fetch_parkour_background(
    out_path: Path,
    *,
    query: str = "minecraft parkour tiktok format",
    search_pool: int = 100,
    rng: random.Random | None = None,
) -> Path:
    """
    Search YouTube with ``query``, pick a random hit from up to ``search_pool`` results,
    download merged MP4 to ``out_path``.
    """
    try:
        from yt_dlp import YoutubeDL
    except ImportError as e:
        raise RuntimeError(
            "Install yt-dlp: pip install yt-dlp (and ensure ffmpeg is on PATH)."
        ) from e

    out_path = Path(out_path).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    stem = out_path.with_suffix("")
    outtmpl = f"{stem}.%(ext)s"

    rng = rng or random.Random()

    search_url = f"ytsearch{int(search_pool)}:{query}"
    list_opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "playlistend": int(search_pool),
        "skip_download": True,
    }
    with YoutubeDL(list_opts) as ydl:
        info = ydl.extract_info(search_url, download=False)

    entries = [e for e in (info.get("entries") or []) if e and e.get("id")]
    if not entries:
        raise RuntimeError(f"No YouTube results for search: {query!r}")

    pick = rng.choice(entries)
    vid = pick["id"]
    url = f"https://www.youtube.com/watch?v={vid}"

    dl_opts: dict = {
        "quiet": False,
        "no_warnings": False,
        "outtmpl": outtmpl,
        "merge_output_format": "mp4",
        "format": (
            "bestvideo[ext=mp4][height<=1920]+bestaudio[ext=m4a]/"
            "bestvideo[ext=mp4]+bestaudio/"
            "best[ext=mp4]/best"
        ),
        "noplaylist": True,
    }
    with YoutubeDL(dl_opts) as ydl:
        ydl.download([url])

    # yt-dlp may write minecraft_bg.mp4 or rare fallback ext
    if out_path.is_file():
        return out_path
    for ext in (".mp4", ".webm", ".mkv"):
        alt = stem.with_suffix(ext)
        if alt.is_file():
            if alt != out_path:
                alt.replace(out_path)
            return out_path
    raise RuntimeError(f"Download finished but {out_path} was not created (check ffmpeg / disk).")

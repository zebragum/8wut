"""
Download short vertical clips from xAI Grok Imagine (text-to-video) for MoneyPrinter backgrounds.

API: https://docs.x.ai/developers/model-capabilities/video/generation
Auth: GROK_KEY or XAI_API_KEY in the environment (.env).
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

_GROK_BG_DIR = Path(__file__).resolve().parent / "data" / "grok_bg_clips"
_GENERATIONS_URL = "https://api.x.ai/v1/videos/generations"
_STATUS_URL = "https://api.x.ai/v1/videos/{request_id}"

# Seven prompts -> grok_bg_01 … grok_bg_07. Export cycles them by default. Single file only:
# WUT8_GROK_SINGLE_BG=1. Refresh: --fetch-grok-bgs --grok-bgs-count 7 --grok-bgs-force
_SHARED_BEATS = (
    "Parked police CRUISER in background, readable; red and blue lights STROBE VERY FAST whole clip — "
    "hyperfast flashing and chasing, no slow pulse, washing pavement and faces. NO officers in frame. "
    "Blonde in dancefloor outfit holds mic; plainer friend beside her in cheaper party clothes. Blonde "
    "mildly DISINTERESTED, bored-cool, not hosting, caught off guard but going along; weak eye contact. "
    "MID-SHOT ~1s: she looks straight BEHIND at the cruiser, then back. BEAT 1: says something POSITIVE "
    "into mic (mouth moving, flat delivery). BEAT 2: says something NEGATIVE (mouth moving, same flat "
    "energy). END: both women embarrassed awkward laugh together."
)

# Stronger eyeline for selected clips: subjects address space behind camera, not the lens.
_LOOK_BEHIND_CAMERA = (
    " CRITICAL EYELINE: both women mostly look PAST the camera — toward the interviewer and the space "
    "BEHIND the camera operator — not into the lens; bored drifting gazes off that way. The brief mid-"
    "shot glance at the police car is the exception, then eyes return to looking behind/past camera."
)

_PROMPT_VARIANTS = [
    (
        "Vertical 9:16 smartphone street interview outside a club at night. "
        + _SHARED_BEATS
        + _LOOK_BEHIND_CAMERA
        + " Medium-wide two-shot, both visible; handheld micro-jitter, shallow depth of field."
    ),
    (
        "9:16 vertical, same club sidewalk night interview. "
        + _SHARED_BEATS
        + " Slightly WIDER two-shot: more street and cruiser visible, neon from venue doors. Handheld."
    ),
    (
        "Smartphone vertical night vox-pop, wet sidewalk reflections. "
        + _SHARED_BEATS
        + _LOOK_BEHIND_CAMERA
        + " Emphasize glossy pavement mirroring the fast red-blue flashes. Medium two-shot, documentary."
    ),
    (
        "Vertical 9:16, candid street grab after midnight. "
        + _SHARED_BEATS
        + _LOOK_BEHIND_CAMERA
        + " Friend turned a bit more three-quarter toward blonde; blonde shifts weight, fidgety. "
        "Slight film grain, shallow DOF."
    ),
    (
        "9:16 handheld chaos energy, club queue bokeh behind them. "
        + _SHARED_BEATS
        + " Mix of pink-purple club spill and police strobes; tiny dutch tilt on camera, micro-jitter."
    ),
    (
        "Vertical interview clip, quieter moment before the laugh. "
        + _SHARED_BEATS
        + " Hold the embarrassed laugh beat a little longer at the end; they cover mouths or look down "
        "sheepishly. Natural skin tones."
    ),
    (
        "9:16 street segment, tighter framing on the pair. "
        + _SHARED_BEATS
        + " Cruiser still clearly parked and strobing behind them; faces and mic read sharper in frame. "
        "Handheld, cinematic contrast."
    ),
]

_DEFAULT_DURATION = 8
_DEFAULT_RESOLUTION = "720p"
_POLL_INTERVAL_SEC = 5.0
_POLL_MAX_WAIT_SEC = 900.0


def grok_api_key() -> str | None:
    for name in ("GROK_KEY", "XAI_API_KEY"):
        v = (os.environ.get(name) or "").strip().lstrip("\ufeff")
        if v:
            return v
    return None


def grok_bg_dir() -> Path:
    return _GROK_BG_DIR


def _env_grok_single_bg() -> bool:
    v = (os.environ.get("WUT8_GROK_SINGLE_BG") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def grok_cycle_paths() -> tuple[Path, ...] | None:
    """
    Paths to use as Grok backgrounds for export.

    Default: cycle up to **seven** numbered clips ``grok_bg_01.mp4`` … ``grok_bg_07.mp4`` (fewer if
    some are missing). Set ``WUT8_GROK_SINGLE_BG=1`` to loop only the first file.
    """
    if not _GROK_BG_DIR.is_dir():
        return None
    paths = sorted(_GROK_BG_DIR.glob("grok_bg_*.mp4"))
    if not paths:
        return None
    if _env_grok_single_bg():
        return (paths[0],)
    return tuple(paths[:7])


def _ffmpeg_exe() -> str | None:
    import shutil

    if w := shutil.which("ffmpeg"):
        return w
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def strip_mp4_audio_only(path: Path) -> bool:
    """
    Remux ``path`` to video-only (no audio). Returns True if ffmpeg ran OK, False if skipped.
    """
    exe = _ffmpeg_exe()
    if not exe:
        print(
            "Warning: ffmpeg not found; cannot strip audio from Grok clips. "
            "Install ffmpeg or pip install imageio-ffmpeg.",
            file=sys.stderr,
        )
        return False
    # Simple .mp4 suffix; double extensions like .mp4.vidonly.part break muxer on Windows.
    tmp = path.parent / f"{path.stem}_vidonly_tmp.mp4"
    cmd = [
        exe,
        "-y",
        "-i",
        str(path),
        "-map",
        "0:v:0",
        "-c:v",
        "copy",
        "-an",
        str(tmp),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        if tmp.is_file():
            tmp.unlink(missing_ok=True)
        cmd2 = [
            exe,
            "-y",
            "-i",
            str(path),
            "-map",
            "0:v:0",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "20",
            "-an",
            str(tmp),
        ]
        r = subprocess.run(cmd2, capture_output=True, text=True)
        if r.returncode != 0:
            if tmp.is_file():
                tmp.unlink(missing_ok=True)
            print(
                f"Warning: could not strip audio from {path.name}: {r.stderr[:500]!r}",
                file=sys.stderr,
            )
            return False
    tmp.replace(path)
    return True


def strip_all_grok_clip_audio() -> int:
    """Strip audio from every ``grok_bg_*.mp4`` under data. Returns count of files processed."""
    if not _GROK_BG_DIR.is_dir():
        return 0
    n = 0
    for p in sorted(_GROK_BG_DIR.glob("grok_bg_*.mp4")):
        if strip_mp4_audio_only(p):
            n += 1
            print(f"  video-only: {p.name}")
    return n


def _post_generation(
    client: httpx.Client,
    api_key: str,
    prompt: str,
    *,
    duration: int,
    aspect_ratio: str,
    resolution: str,
) -> str:
    r = client.post(
        _GENERATIONS_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-imagine-video",
            "prompt": prompt,
            "duration": duration,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
        },
        timeout=120.0,
    )
    r.raise_for_status()
    data = r.json()
    rid = data.get("request_id")
    if not rid:
        raise RuntimeError(f"No request_id in response: {data}")
    return str(rid)


def _poll_until_url(
    client: httpx.Client,
    api_key: str,
    request_id: str,
) -> str:
    deadline = time.monotonic() + _POLL_MAX_WAIT_SEC
    url = _STATUS_URL.format(request_id=request_id)
    headers = {"Authorization": f"Bearer {api_key}"}
    while time.monotonic() < deadline:
        r = client.get(url, headers=headers, timeout=60.0)
        r.raise_for_status()
        data = r.json()
        st = data.get("status")
        if st == "done":
            video = data.get("video") or {}
            u = video.get("url")
            if not u:
                raise RuntimeError(f"done but no url: {data}")
            return str(u)
        if st in ("expired", "failed"):
            raise RuntimeError(f"Grok video job {request_id} {st}: {data}")
        time.sleep(_POLL_INTERVAL_SEC)
    raise TimeoutError(f"Grok video {request_id} not ready after {_POLL_MAX_WAIT_SEC}s")


def _download_mp4(client: httpx.Client, url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with client.stream("GET", url, timeout=300.0, follow_redirects=True) as r:
        r.raise_for_status()
        tmp = dest.with_suffix(dest.suffix + ".part")
        with open(tmp, "wb") as f:
            for chunk in r.iter_bytes(chunk_size=1024 * 256):
                f.write(chunk)
        tmp.replace(dest)


def generate_grok_backgrounds(
    *,
    count: int = 1,
    force: bool = False,
    only_indices: list[int] | None = None,
    duration: int = _DEFAULT_DURATION,
    aspect_ratio: str = "9:16",
    resolution: str = _DEFAULT_RESOLUTION,
    delay_between_jobs_sec: float = 2.0,
) -> list[Path]:
    """
    Create ``grok_bg_01.mp4`` … up to ``count`` in ``data/grok_bg_clips``.
    Default ``count`` is 1 so export loops one clip (same generated subject). Higher counts are
    separate API runs. Export cycles clips by default; ``WUT8_GROK_SINGLE_BG=1`` loops only the first.
    Skips existing files unless ``force`` is True.

    ``only_indices``: 1-based clip numbers (e.g. ``[1, 3, 4]``) to regenerate only those files;
    always overwrites when set (no need for ``force``).
    """
    key = grok_api_key()
    if not key:
        raise RuntimeError(
            "Set GROK_KEY or XAI_API_KEY in .env for Grok Imagine video generation."
        )

    max_n = len(_PROMPT_VARIANTS)
    if only_indices is not None:
        todo = sorted({int(x) for x in only_indices})
        for file_num in todo:
            if file_num < 1 or file_num > max_n:
                raise ValueError(
                    f"grok clip index {file_num} out of range 1..{max_n}"
                )
        use_force = True
    else:
        n = min(count, max_n)
        todo = list(range(1, n + 1))
        use_force = force

    out_paths: list[Path] = []
    _GROK_BG_DIR.mkdir(parents=True, exist_ok=True)
    total_jobs = len(todo)

    with httpx.Client() as client:
        for job_i, file_num in enumerate(todo):
            i = file_num - 1
            dest = _GROK_BG_DIR / f"grok_bg_{file_num:02d}.mp4"
            if dest.is_file() and not use_force:
                print(f"Skip existing {dest.name}")
                out_paths.append(dest)
                continue

            prompt = _PROMPT_VARIANTS[i]
            print(
                f"Grok Imagine [{job_i + 1}/{total_jobs}] grok_bg_{file_num:02d}.mp4 submitting ..."
            )
            rid = _post_generation(
                client,
                key,
                prompt,
                duration=duration,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
            )
            print(f"  request_id={rid} polling …")
            mp4_url = _poll_until_url(client, key, rid)
            print(f"  downloading -> {dest.name}")
            _download_mp4(client, mp4_url, dest)
            if strip_mp4_audio_only(dest):
                print(f"  stripped audio -> {dest.name}")
            out_paths.append(dest)
            if job_i < total_jobs - 1 and delay_between_jobs_sec > 0:
                time.sleep(delay_between_jobs_sec)

    return out_paths

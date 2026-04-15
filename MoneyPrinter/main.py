"""
8wut MoneyPrinter: pull a real post → vision-generated comment lines → styled 9:16 MP4 for TikTok/Reels.

Usage:
  python main.py --random -o out.mp4
  python main.py <POST_UUID> -o out.mp4
  Manual metadata (skip API fetch for the image):
    python main.py --post-url https://8wut.org --image-url https://... --title "dinner" --author chef_jay

  Auth / data (either works):
    • WUT8_JWT — normal app session token for the HTTP API, or
    • No JWT: MoneyPrinter reads the Postgres URL from api/test_recent_posts.js in this monorepo
      (or set WUT8_DATABASE_URL / DATABASE_URL) and pulls real public posts + comments from the DB.
  Optional: WUT8_API_URL (default http://localhost:3001), WUT8_APP_URL (default https://8wut.org),
    OPENAI_API_KEY (optional; without it, mock lines)

  Animated (default): looping background video or GIF. Priority: --bg-gif PATH, then Grok clips in
  data/grok_bg_clips/ when present (order shuffled each run), then WUT8_BG_VIDEO unless
  WUT8_BG_VIDEO_FIRST=1 puts env video ahead of Grok, then minecraft_bg.mp4 if real, stars_bg.png,
  else procedural starfield.
  Generate Grok clips (GROK_KEY or XAI_API_KEY): python main.py --fetch-grok-bgs
  Or pull a parkour clip (YouTube search + yt-dlp):
    python main.py --fetch-minecraft-bg
    python main.py --fetch-minecraft-bg --parkour-query "minecraft parkour tiktok format"
  --static = old single-frame export.

  Random discovery post (public feed with images):
    python main.py --random -o out.mp4
  Avoids repeats via eightwut_video_maker/data/used_discovery_posts.txt
"""

from __future__ import annotations

import argparse
import os
import random
import sys
from pathlib import Path

from dotenv import load_dotenv

from eightwut_video_maker.characters import generate_caricature_lines
from eightwut_video_maker.fetch_post import (
    discovery_handle_pool,
    fetch_post,
    manual_post,
    pick_random_discovery_post,
)
from eightwut_video_maker.render import (
    build_frame_png,
    write_animated_video,
    write_video_first_frame_png,
    write_video_from_png,
)
from eightwut_video_maker.scrape_comments import fetch_post_comments_for_id

_ROOT = Path(__file__).resolve().parent
_DEFAULT_GIF = _ROOT / "200_d.gif"
_DEFAULT_MINECRAFT_BG = _ROOT / "minecraft_bg.mp4"
_DEFAULT_STARS_BG = _ROOT / "stars_bg.png"
_MIN_MINECRAFT_BG_BYTES = 280_000
_USED_DISCOVERY = _ROOT / "eightwut_video_maker" / "data" / "used_discovery_posts.txt"


def _resolve_bg_media(
    explicit: Path | None, *, force_stars: bool
) -> tuple[Path | None, bool, tuple[Path, ...] | None]:
    if explicit is not None:
        return Path(explicit), False, None
    if force_stars:
        return None, True, None
    from eightwut_video_maker.grok_backgrounds import grok_cycle_paths

    gc = grok_cycle_paths()
    env_first = (os.environ.get("WUT8_BG_VIDEO_FIRST") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    env = (os.environ.get("WUT8_BG_VIDEO") or "").strip()
    env_path = Path(env) if env else None
    if env_first and env_path and env_path.is_file():
        return env_path, False, None
    if gc:
        return None, False, gc
    if env_path and env_path.is_file():
        return env_path, False, None
    if _DEFAULT_MINECRAFT_BG.is_file():
        if _DEFAULT_MINECRAFT_BG.stat().st_size >= _MIN_MINECRAFT_BG_BYTES:
            return _DEFAULT_MINECRAFT_BG, False, None
    if _DEFAULT_STARS_BG.is_file():
        return _DEFAULT_STARS_BG, False, None
    return None, True, None


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="8wut post image + social comment panel video")
    p.add_argument(
        "post",
        nargs="?",
        help="Post UUID from the 8wut API (or a URL whose path ends with the UUID)",
    )
    p.add_argument("-o", "--output", type=Path, default=Path("eightwut_clip.mp4"))
    p.add_argument("--duration", type=float, default=12.0, help="Video length in seconds")
    p.add_argument("--fps", type=int, default=30)
    p.add_argument(
        "--png",
        type=Path,
        help=(
            "Also save a composite PNG: for --static, the flat frame; for animated exports, "
            "frame 0 extracted from the encoded MP4 (includes Grok/video background)."
        ),
    )
    p.add_argument(
        "--model",
        default=os.environ.get("OPENAI_VISION_MODEL", "gpt-4o-mini"),
        help="OpenAI vision model (default gpt-4o-mini)",
    )
    p.add_argument(
        "--bg-gif",
        type=Path,
        default=None,
        metavar="PATH",
        help=(
            "Background: .mp4/.webm/.mov, .gif, or still .png/.jpg/.webp. "
            "Default: WUT8_BG_VIDEO, grok_bg_*.mp4, large minecraft_bg.mp4, stars_bg.png, stars"
        ),
    )
    p.add_argument(
        "--bg-stars",
        action="store_true",
        help="Force procedural twinkling starfield instead of any video/GIF file",
    )
    p.add_argument(
        "--static",
        action="store_true",
        help="Single static frame video instead of animated GIF background + pop-in comments",
    )
    p.add_argument(
        "--floater-keys-dir",
        type=Path,
        default=None,
        help="Folder of key GIFs used as drifting background sprites (default: WUT8_FLOATER_KEYS_DIR)",
    )
    p.add_argument(
        "--random",
        action="store_true",
        help=(
            "Pick a random public post with images (API + JWT, or Postgres via "
            "WUT8_DATABASE_URL / api/test_recent_posts.js). "
            "Avoids repeats via data/used_discovery_posts.txt."
        ),
    )
    p.add_argument(
        "--fetch-minecraft-bg",
        action="store_true",
        help=(
            "Download a random Minecraft parkour clip from YouTube (yt-dlp + ffmpeg) to "
            "minecraft_bg.mp4"
        ),
    )
    p.add_argument(
        "--parkour-query",
        default=os.environ.get("WUT8_PARKOUR_QUERY", "minecraft parkour tiktok format"),
        help="YouTube search string for --fetch-minecraft-bg",
    )
    p.add_argument(
        "--fetch-grok-bgs",
        action="store_true",
        help=(
            "Generate Grok Imagine video(s) (xAI) into data/grok_bg_clips/ "
            "(needs GROK_KEY or XAI_API_KEY; default 1 clip — same subject when looped)"
        ),
    )
    p.add_argument(
        "--grok-bgs-count",
        type=int,
        default=1,
        help="How many clips for --fetch-grok-bgs (default 1; each clip is a new generation)",
    )
    p.add_argument(
        "--grok-bgs-force",
        action="store_true",
        help="Regenerate all Grok clips even if files already exist",
    )
    p.add_argument(
        "--grok-bgs-only",
        type=str,
        default=None,
        metavar="1,3,4",
        help=(
            "With --fetch-grok-bgs: only regenerate these 1-based clip numbers (comma-separated, "
            "e.g. 1,3,4). Overwrites those files; ignores --grok-bgs-count."
        ),
    )
    p.add_argument(
        "--strip-grok-bg-audio",
        action="store_true",
        help="Remove audio tracks from all grok_bg_*.mp4 in data/grok_bg_clips (ffmpeg)",
    )

    g = p.add_argument_group("Manual post (optional; skips API image fetch)")
    g.add_argument("--post-url", help="Canonical link shown in the video (default https://8wut.org)")
    g.add_argument("--image-url", help="Direct image URL")
    g.add_argument("--title", help="Caption text")
    g.add_argument("--author", help="Uploader username")

    return p.parse_args(argv)


def _openai_api_key() -> str | None:
    raw = os.environ.get("OPENAI_API_KEY")
    if raw is None:
        return None
    key = raw.strip().lstrip("\ufeff")
    return key or None


def main(argv: list[str] | None = None) -> int:
    env_file = _ROOT / ".env"
    load_dotenv(env_file, override=True)
    args = _parse_args(argv or sys.argv[1:])
    manual = bool(args.image_url and args.author)

    if args.strip_grok_bg_audio:
        from eightwut_video_maker.grok_backgrounds import strip_all_grok_clip_audio

        n = strip_all_grok_clip_audio()
        print(f"Stripped audio from {n} file(s) under eightwut_video_maker/data/grok_bg_clips/")
        if (
            not args.post
            and not args.random
            and not manual
            and not args.fetch_grok_bgs
            and not args.fetch_minecraft_bg
        ):
            return 0

    if args.fetch_minecraft_bg:
        from eightwut_video_maker.minecraft_bg import fetch_parkour_background

        print(
            f"Fetching parkour background (YouTube search: {args.parkour_query!r}) -> "
            f"{_DEFAULT_MINECRAFT_BG.name} ..."
        )
        fetch_parkour_background(_DEFAULT_MINECRAFT_BG, query=args.parkour_query)
        print(f"Wrote {_DEFAULT_MINECRAFT_BG.resolve()}")
        if (
            not args.post
            and not args.random
            and not manual
            and not args.fetch_grok_bgs
        ):
            return 0

    if args.fetch_grok_bgs:
        from eightwut_video_maker.grok_backgrounds import generate_grok_backgrounds

        only: list[int] | None = None
        if args.grok_bgs_only:
            only = [
                int(x.strip())
                for x in args.grok_bgs_only.split(",")
                if x.strip()
            ]
            if not only:
                print("Error: --grok-bgs-only needs comma-separated numbers (e.g. 1,3,4)", file=sys.stderr)
                return 2
            print(
                f"Grok Imagine: regenerating clips {only} only "
                "(9:16, ~8s each via xAI API; this can take many minutes) ..."
            )
        else:
            print(
                f"Grok Imagine: generating {args.grok_bgs_count} clips "
                "(9:16, ~8s each via xAI API; this can take many minutes) ..."
            )
        out = generate_grok_backgrounds(
            count=args.grok_bgs_count,
            force=args.grok_bgs_force,
            only_indices=only,
        )
        print(f"Saved {len(out)} files under eightwut_video_maker/data/grok_bg_clips/")
        if not args.post and not args.random and not manual:
            return 0

    if args.random and args.post:
        print("Error: use either --random or a POST id/URL, not both.", file=sys.stderr)
        return 2
    if args.random and manual:
        print("Error: --random cannot be combined with manual --post-url/--image-url mode.", file=sys.stderr)
        return 2

    handle_pool: list[str] = []
    post_comments: list[str] | None = None

    if manual:
        meta = manual_post(
            post_url=args.post_url or "",
            image_url=args.image_url or "",
            title=(args.title if args.title is not None else ""),
            author_username=args.author or "",
        )
        try:
            handle_pool = discovery_handle_pool(offset=random.randint(0, 150))
        except Exception:
            handle_pool = []
    elif args.random:
        meta, handle_pool = pick_random_discovery_post(_USED_DISCOVERY)
        print(
            f"Discovery pick: {meta.source_post_id}\n"
            f"  caption: {meta.title!r}  @{meta.author_username}\n"
            f"  link in frame: {meta.post_url}"
        )
        if meta.source_post_id:
            post_comments = fetch_post_comments_for_id(meta.source_post_id)
            if post_comments:
                print(f"  On-post comments for prompt: {len(post_comments)}")
    else:
        if not args.post:
            print(
                "Error: provide POST UUID/URL, or --random, or manual --image-url --author (--post-url optional)",
                file=sys.stderr,
            )
            return 2
        meta = fetch_post(args.post)
        print(f"Post {meta.source_post_id}: @{meta.author_username} — {meta.post_url}")
        try:
            handle_pool = discovery_handle_pool(offset=random.randint(0, 150))
        except Exception:
            handle_pool = []
        if meta.source_post_id:
            post_comments = fetch_post_comments_for_id(meta.source_post_id)
            if post_comments:
                print(f"On-post comments for prompt: {len(post_comments)}")

    key = _openai_api_key()
    if not key:
        print(
            "Warning: OPENAI_API_KEY is missing or empty after loading "
            f"{env_file.resolve()}. Using mock comment lines.\n"
            "Put the key on one line: OPENAI_API_KEY=sk-... (no quotes needed).",
            file=sys.stderr,
        )
    lines = generate_caricature_lines(
        meta,
        api_key=key,
        model=args.model,
        real_post_comments=post_comments,
        handle_pool=handle_pool,
    )
    png = build_frame_png(meta, lines)
    png_written_early = False

    if args.static:
        if args.png:
            args.png.write_bytes(png)
            png_written_early = True
            print(f"Wrote frame {args.png}")
        write_video_from_png(png, args.output, duration_sec=args.duration, fps=args.fps)
    else:
        bg_path, use_starfield, grok_cycle = _resolve_bg_media(
            args.bg_gif, force_stars=args.bg_stars
        )
        if grok_cycle:
            grok_list = list(grok_cycle)
            random.shuffle(grok_list)
            grok_cycle = tuple(grok_list)
            print(
                "  Grok background order (shuffled this run): "
                + ", ".join(p.name for p in grok_cycle)
            )
            if len(grok_cycle) == 1:
                print(
                    "Background: looping 1 Grok clip (WUT8_GROK_SINGLE_BG). "
                    "Video-only; export has no background audio."
                )
            else:
                seg_h = os.environ.get("WUT8_GROK_BG_SEGMENT_SEC", "4.0").strip() or "4.0"
                print(
                    f"Background: cycling {len(grok_cycle)} Grok clips "
                    f"({seg_h}s each; WUT8_GROK_BG_SEGMENT_SEC). "
                    "Video-only sources; export has no background audio."
                )
            write_animated_video(
                meta,
                lines,
                bg_media=None,
                starfield=False,
                bg_video_cycle=list(grok_cycle),
                out_path=args.output,
                fps=args.fps,
                floater_keys_dir=args.floater_keys_dir,
            )
        elif use_starfield:
            print(
                "Background: animated starfield (tiny/missing minecraft_bg.mp4 uses this; "
                "pass --bg-gif PATH for a video/GIF loop)."
            )
            write_animated_video(
                meta,
                lines,
                bg_media=None,
                starfield=True,
                out_path=args.output,
                fps=args.fps,
                floater_keys_dir=args.floater_keys_dir,
            )
        elif bg_path is None or not bg_path.is_file():
            print(
                f"Background media not found: {bg_path.resolve() if bg_path else '(none)'}\n"
                "Run: python main.py --fetch-grok-bgs (needs GROK_KEY), or minecraft_bg / WUT8_BG_VIDEO, "
                "or pass --bg-gif PATH. Falling back to --static for this run.",
                file=sys.stderr,
            )
            write_video_from_png(png, args.output, duration_sec=args.duration, fps=args.fps)
        else:
            write_animated_video(
                meta,
                lines,
                bg_media=bg_path,
                starfield=False,
                out_path=args.output,
                fps=args.fps,
                floater_keys_dir=args.floater_keys_dir,
            )

    if args.png and not png_written_early:
        write_video_first_frame_png(args.output, args.png)
        print(f"Wrote frame {args.png} (snapshot from encoded video)")

    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

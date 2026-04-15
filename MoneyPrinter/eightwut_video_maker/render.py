from __future__ import annotations

import io
import os
import random
from dataclasses import dataclass
from pathlib import Path

import httpx
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from .models import CaricatureLine, PostMeta

# Terminal-green social frame (9:16)
BG = (18, 18, 18)
TEXT_MAIN = (200, 255, 185)  # green-white body
TEXT_DIM = (95, 185, 105)  # muted green metadata
ACCENT = (72, 255, 98)  # vivid lime / terminal green
BUBBLE_FILL = (20, 42, 28)
BUBBLE_OUTLINE = (40, 130, 72)
FRAME_W, FRAME_H = 1080, 1920
PAD = 36
IMAGE_MAX_W = FRAME_W - 2 * PAD
IMAGE_MAX_H = 820
# Animated exports: hero image top-aligned, full-width contain (see _layout_animated_top_image_and_scroll_bubbles).
IMAGE_MAX_W_ANIMATED = FRAME_W - 2 * PAD
IMAGE_MAX_H_ANIMATED = 1020

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}


def _display_handle(h: str) -> str:
    s = (h or "").strip()
    if not s:
        return "@someone"
    return s if s.startswith("@") else f"@{s}"


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:\\Windows\\Fonts\\JetBrainsMono-Regular.ttf",
        "C:\\Windows\\Fonts\\Consola.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/System/Library/Fonts/Menlo.ttc",
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


def _fit_image(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    w, h = img.size
    scale = min(max_w / w, max_h / h, 1.0)
    nw, nh = int(w * scale), int(h * scale)
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def _fit_image_full_width(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    """Scale to exactly ``max_w`` (may upscale); if taller than ``max_h``, center-crop vertically."""
    w, h = img.size
    if w <= 0 or h <= 0:
        return Image.new("RGB", (max_w, min(max_h, 1)), (0, 0, 0))
    scaled = img.resize((max_w, max(1, int(h * max_w / w))), Image.Resampling.LANCZOS)
    if scaled.height <= max_h:
        return scaled
    top = (scaled.height - max_h) // 2
    return scaled.crop((0, top, max_w, top + max_h))


def _fit_image_contain(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    """Uniform scale so the **entire** image fits in ``max_w``×``max_h`` (may upscale). No cropping."""
    w, h = img.size
    if w <= 0 or h <= 0:
        return Image.new("RGB", (max(1, max_w), min(max_h, 1)), (0, 0, 0))
    scale = min(max_w / w, max_h / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def _break_long_word(word: str, font: ImageFont.ImageFont, max_px: int) -> list[str]:
    """Split a token (e.g. URL) that exceeds max width."""
    out: list[str] = []
    cur = ""
    for ch in word:
        trial = cur + ch
        if font.getbbox(trial)[2] - font.getbbox(trial)[0] <= max_px:
            cur = trial
        else:
            if cur:
                out.append(cur)
            cur = ch
    if cur:
        out.append(cur)
    return out or [word]


def _wrap_lines(text: str, font: ImageFont.ImageFont, max_px: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    expanded: list[str] = []
    for w in words:
        if not w:
            continue
        if font.getbbox(w)[2] - font.getbbox(w)[0] <= max_px:
            expanded.append(w)
        else:
            expanded.extend(_break_long_word(w, font, max_px))
    if not expanded:
        return [""]
    lines: list[str] = []
    cur = expanded[0]
    for word in expanded[1:]:
        trial = f"{cur} {word}"
        if font.getbbox(trial)[2] - font.getbbox(trial)[0] <= max_px:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    lines.append(cur)
    return lines


@dataclass(frozen=True)
class HeaderLayout:
    """Top bar: brand + title, contribution caption, prominent @author, large link (wrapped)."""

    font_brand: ImageFont.ImageFont
    font_title: ImageFont.ImageFont
    font_caption: ImageFont.ImageFont
    font_author: ImageFont.ImageFont
    font_link: ImageFont.ImageFont
    title: str
    author_label: str
    link_lines: list[str]
    y_brand: int
    y_title: int
    x_title: int
    y_caption: int
    caption_text: str
    y_author: int
    author_text_x: int
    author_text_y: int
    author_pill: tuple[int, int, int, int] | None
    y_link_start: int
    image_top_y: int


def _build_header_layout(meta: PostMeta) -> HeaderLayout:
    font_brand = _load_font(26)
    font_title = _load_font(18)
    font_caption = _load_font(16)
    font_author = _load_font(36)
    font_link = _load_font(28)
    title = meta.title if len(meta.title) < 68 else meta.title[:65] + "..."
    author_label = f"@{meta.author_username}"
    link = meta.post_url
    link_lines = _wrap_lines(link, font_link, FRAME_W - 2 * PAD)
    if not link_lines:
        link_lines = [link]

    y = PAD
    brand_text = "8wut"
    bb = font_brand.getbbox(brand_text)
    tb = font_title.getbbox(title)
    row1_h = max(bb[3] - bb[1], tb[3] - tb[1])
    y_brand = y
    y_title = y
    x_title = PAD + (bb[2] - bb[0]) + 20
    caption_text = "Feed snapshot"
    cb = font_caption.getbbox(caption_text)
    y_caption = y + row1_h + 8
    cap_h = cb[3] - cb[1]
    y_author = y_caption + cap_h + 8
    ab = font_author.getbbox(author_label)
    author_h = ab[3] - ab[1]
    author_w = ab[2] - ab[0]
    pad_pill_x, pad_pill_y = 14, 10
    author_text_x = PAD + pad_pill_x
    author_text_y = y_author
    pill = (
        PAD - 6,
        y_author - pad_pill_y,
        PAD + author_w + pad_pill_x * 2 + 8,
        y_author + author_h + pad_pill_y,
    )
    y_link_start = pill[3] + 14
    link_h = 0
    for ln in link_lines:
        lb = font_link.getbbox(ln)
        link_h += lb[3] - lb[1] + 10
    image_top_y = y_link_start + link_h + 18
    return HeaderLayout(
        font_brand=font_brand,
        font_title=font_title,
        font_caption=font_caption,
        font_author=font_author,
        font_link=font_link,
        title=title,
        author_label=author_label,
        link_lines=link_lines,
        y_brand=y_brand,
        y_title=y_title,
        x_title=x_title,
        y_caption=y_caption,
        caption_text=caption_text,
        y_author=y_author,
        author_text_x=author_text_x,
        author_text_y=author_text_y,
        author_pill=pill,
        y_link_start=y_link_start,
        image_top_y=image_top_y,
    )


def _draw_header_rgb(draw: ImageDraw.ImageDraw, layout: HeaderLayout) -> None:
    draw.text((PAD, layout.y_brand), "8wut", fill=ACCENT, font=layout.font_brand)
    draw.text((layout.x_title, layout.y_title), layout.title, fill=TEXT_MAIN, font=layout.font_title)
    draw.text((PAD, layout.y_caption), layout.caption_text, fill=TEXT_DIM, font=layout.font_caption)
    if layout.author_pill:
        x0, y0, x1, y1 = layout.author_pill
        draw.rounded_rectangle(
            (x0, y0, x1, y1),
            radius=14,
            fill=(26, 58, 38),
            outline=BUBBLE_OUTLINE,
            width=2,
        )
    draw.text(
        (layout.author_text_x, layout.author_text_y),
        layout.author_label,
        fill=ACCENT,
        font=layout.font_author,
    )
    ty = layout.y_link_start
    for ln in layout.link_lines:
        draw.text((PAD, ty), ln, fill=ACCENT, font=layout.font_link)
        lb = layout.font_link.getbbox(ln)
        ty += lb[3] - lb[1] + 10


def _draw_header_rgba(draw: ImageDraw.ImageDraw, layout: HeaderLayout) -> None:
    draw.text((PAD, layout.y_brand), "8wut", fill=ACCENT + (255,), font=layout.font_brand)
    draw.text((layout.x_title, layout.y_title), layout.title, fill=TEXT_MAIN + (255,), font=layout.font_title)
    draw.text((PAD, layout.y_caption), layout.caption_text, fill=TEXT_DIM + (255,), font=layout.font_caption)
    if layout.author_pill:
        x0, y0, x1, y1 = layout.author_pill
        draw.rounded_rectangle(
            (x0, y0, x1, y1),
            radius=14,
            fill=(26, 58, 38, 240),
            outline=BUBBLE_OUTLINE + (255,),
            width=2,
        )
    draw.text(
        (layout.author_text_x, layout.author_text_y),
        layout.author_label,
        fill=ACCENT + (255,),
        font=layout.font_author,
    )
    ty = layout.y_link_start
    for ln in layout.link_lines:
        draw.text((PAD, ty), ln, fill=ACCENT + (255,), font=layout.font_link)
        lb = layout.font_link.getbbox(ln)
        ty += lb[3] - lb[1] + 10


def build_frame_png(
    meta: PostMeta,
    lines: list[CaricatureLine],
    *,
    image_bytes: bytes | None = None,
) -> bytes:
    if image_bytes is None:
        with httpx.Client(headers=_BROWSER_HEADERS, follow_redirects=True, timeout=60.0) as client:
            r = client.get(meta.image_url)
            r.raise_for_status()
            image_bytes = r.content

    layout = _build_header_layout(meta)
    img, ix, iy, bubbles_geom, chat_y0, _chat_h = _layout_animated_top_image_and_scroll_bubbles(
        lines,
        image_bytes,
        layout.image_top_y,
        max_image_w=IMAGE_MAX_W_ANIMATED,
        max_image_h_cap=IMAGE_MAX_H_ANIMATED,
    )

    canvas = Image.new("RGB", (FRAME_W, FRAME_H), BG)
    draw = ImageDraw.Draw(canvas)
    _draw_header_rgb(draw, layout)

    canvas.paste(img, (ix, iy))

    font_handle = _load_font(22)
    font_body = _load_font(20)

    bubble_w = FRAME_W - 2 * PAD
    line_x0 = PAD

    for bg in bubbles_geom:
        y = chat_y0 + bg.y0
        if y + bg.h > FRAME_H - PAD:
            break
        draw.rounded_rectangle(
            (line_x0, y, line_x0 + bubble_w, y + bg.h),
            radius=12,
            fill=BUBBLE_FILL,
            outline=BUBBLE_OUTLINE,
            width=2,
        )
        handle_h = font_handle.getbbox(bg.handle)[3] - font_handle.getbbox(bg.handle)[1]
        draw.text((line_x0 + 14, y + 10), bg.handle, fill=ACCENT, font=font_handle)
        ty = y + 10 + handle_h + 8
        for bl in bg.body_lines:
            draw.text((line_x0 + 14, ty), bl, fill=TEXT_MAIN, font=font_body)
            ty += font_body.getbbox(bl)[3] - font_body.getbbox(bl)[1] + 6

    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def write_video_from_png(
    png_bytes: bytes,
    out_path: Path,
    *,
    duration_sec: float = 12.0,
    fps: int = 30,
    audio_path: Path | None = None,
    voiceover_tail_sec: float = 0.35,
) -> None:
    from moviepy import AudioFileClip, ImageClip

    pil = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    arr = np.asarray(pil)
    dur = float(duration_sec)
    audio_clip = None
    if audio_path is not None and Path(audio_path).is_file():
        _aud = AudioFileClip(str(audio_path))
        ad = float(_aud.duration or 0.0)
        if ad > 1e-3:
            audio_clip = _aud
            dur = max(dur, ad + float(voiceover_tail_sec))
    clip = ImageClip(arr).with_duration(dur).with_fps(fps)
    if audio_clip is not None:
        if audio_clip.duration > dur + 0.05:
            dur = float(audio_clip.duration) + float(voiceover_tail_sec)
            clip = ImageClip(arr).with_duration(dur).with_fps(fps)
        clip = clip.with_audio(audio_clip)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        clip.write_videofile(
            str(out_path),
            codec="libx264",
            audio=audio_clip is not None,
            fps=fps,
            preset="medium",
            logger=None,
        )
    finally:
        clip.close()
        if audio_clip is not None:
            try:
                audio_clip.close()
            except Exception:
                pass


def write_video_first_frame_png(video_path: Path, png_path: Path) -> None:
    """Save the first frame of an encoded video as PNG (matches t=0 of the MP4)."""
    from moviepy import VideoFileClip

    video_path = Path(video_path)
    png_path = Path(png_path)
    if not video_path.is_file():
        raise FileNotFoundError(str(video_path))
    clip = VideoFileClip(str(video_path), audio=False)
    try:
        frame = clip.get_frame(0)
    finally:
        clip.close()
    im = Image.fromarray(np.asarray(frame, dtype=np.uint8)).convert("RGB")
    png_path.parent.mkdir(parents=True, exist_ok=True)
    im.save(png_path, format="PNG", optimize=True)


# --- Animated: GIF background + staggered comment pop-in ---


@dataclass(frozen=True)
class _BubbleGeom:
    x0: int
    y0: int
    w: int
    h: int
    handle: str
    body_lines: list[str]


def _measure_bubbles(
    lines: list[CaricatureLine],
    *,
    bubble_w: int,
    font_handle: ImageFont.ImageFont,
    font_body: ImageFont.ImageFont,
) -> list[tuple[int, CaricatureLine, list[str]]]:
    """Return list of (block_h, line, body_lines)."""
    out: list[tuple[int, CaricatureLine, list[str]]] = []
    for cl in lines:
        dh = _display_handle(cl.handle)
        handle_h = font_handle.getbbox(dh)[3] - font_handle.getbbox(dh)[1]
        body_lines = _wrap_lines(cl.text, font_body, bubble_w - 24)
        body_h = sum(
            font_body.getbbox(bl)[3] - font_body.getbbox(bl)[1] + 6 for bl in body_lines
        )
        block_h = 12 + handle_h + 8 + body_h + 12
        out.append((block_h, cl, body_lines))
    return out


def _layout_centered_image_and_bubbles(
    meta: PostMeta,
    lines: list[CaricatureLine],
    image_bytes: bytes,
    header_top_y: int,
    *,
    max_image_w: int | None = None,
    max_image_h: int | None = None,
    image_vertical: str = "center",
    image_full_width: bool = False,
) -> tuple[Image.Image, list[_BubbleGeom], int, int]:
    """Place image above comment bubbles. image_vertical: \"center\" (under header) or \"third\" (upper third)."""
    font_handle = _load_font(22)
    font_body = _load_font(20)

    bubble_w = FRAME_W - 2 * PAD
    GAP = 22

    mw = IMAGE_MAX_W if max_image_w is None else max_image_w
    mh = IMAGE_MAX_H if max_image_h is None else max_image_h

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    measured = _measure_bubbles(lines, bubble_w=bubble_w, font_handle=font_handle, font_body=font_body)
    total_comments_h = sum(bh + 14 for bh, _, __ in measured) - (14 if measured else 0)

    max_img_h = mh
    fit: Image.Image | None = None
    _fit = _fit_image_full_width if image_full_width else _fit_image
    for _ in range(24):
        candidate = _fit(img, mw, max_img_h)
        comments_h = total_comments_h
        if image_vertical == "third":
            img_y_try = max(header_top_y, FRAME_H // 3 - candidate.height // 2)
            slack = FRAME_H - img_y_try - candidate.height - GAP - comments_h - PAD
        else:
            slack = FRAME_H - header_top_y - candidate.height - GAP - comments_h - PAD
        if slack >= 0:
            fit = candidate
            break
        max_img_h = int(max_img_h * 0.92)
        if max_img_h < 180:
            fit = candidate
            break
    if fit is None:
        fit = _fit(img, mw, 180)
    img = fit

    img_w, img_h = img.size
    if image_vertical == "third":
        img_y = max(header_top_y, FRAME_H // 3 - img_h // 2)
    else:
        slack = FRAME_H - header_top_y - img_h - GAP - total_comments_h - PAD
        img_y = header_top_y + max(0, slack // 2)
    img_x = (FRAME_W - img_w) // 2

    y = img_y + img_h + GAP
    bubbles: list[_BubbleGeom] = []
    line_x0 = PAD
    for block_h, cl, body_lines in measured:
        if y + block_h > FRAME_H - PAD:
            break
        bubbles.append(
            _BubbleGeom(line_x0, y, bubble_w, block_h, _display_handle(cl.handle), body_lines)
        )
        y += block_h + 14

    return img, bubbles, img_x, img_y


# Minimum height reserved under the hero image for the scrolling chat column (animated export).
_MIN_CHAT_VIEWPORT_H = 260


def _layout_animated_top_image_and_scroll_bubbles(
    lines: list[CaricatureLine],
    image_bytes: bytes,
    header_top_y: int,
    *,
    max_image_w: int,
    max_image_h_cap: int,
) -> tuple[Image.Image, int, int, list[_BubbleGeom], int, int]:
    """
    Hero image: top-aligned under header, full width (contain — never cropped).
    Bubbles: ``y0`` is vertical offset inside a tall **content** strip (for scrolling).
    Returns (img, ix, iy, bubbles, chat_viewport_y0, chat_viewport_h).
    """
    font_handle = _load_font(22)
    font_body = _load_font(20)
    bubble_w = FRAME_W - 2 * PAD
    GAP = 22

    pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    measured = _measure_bubbles(
        lines, bubble_w=bubble_w, font_handle=font_handle, font_body=font_body
    )
    ycur = 0
    bubbles: list[_BubbleGeom] = []
    for block_h, cl, body_lines in measured:
        bubbles.append(
            _BubbleGeom(PAD, ycur, bubble_w, block_h, _display_handle(cl.handle), body_lines)
        )
        ycur += block_h + 14

    max_img_h = min(
        max_image_h_cap,
        FRAME_H - header_top_y - GAP - _MIN_CHAT_VIEWPORT_H,
    )
    max_img_h = max(max_img_h, 140)
    img_final: Image.Image | None = None
    for _ in range(28):
        candidate = _fit_image_contain(pil, max_image_w, max_img_h)
        chat_y0 = header_top_y + candidate.height + GAP
        chat_h = FRAME_H - PAD - chat_y0
        if chat_h >= _MIN_CHAT_VIEWPORT_H or max_img_h <= 140:
            img_final = candidate
            break
        max_img_h = int(max_img_h * 0.9)
    if img_final is None:
        img_final = _fit_image_contain(pil, max_image_w, 140)

    img = img_final
    iy = header_top_y
    ix = (FRAME_W - img.size[0]) // 2
    chat_y0 = iy + img.size[1] + GAP
    chat_h = FRAME_H - PAD - chat_y0
    chat_h = max(chat_h, 80)
    return img, ix, iy, bubbles, chat_y0, chat_h


def _load_gif_rgb_frames(path: Path) -> tuple[list[np.ndarray], list[float]]:
    """RGB uint8 arrays (H,W,3) and per-frame duration in seconds."""
    im = Image.open(path)
    frames: list[np.ndarray] = []
    durs: list[float] = []
    try:
        while True:
            frames.append(np.array(im.convert("RGB")))
            d = float(im.info.get("duration", 100))
            durs.append(max(d, 20.0) / 1000.0)
            im.seek(im.tell() + 1)
    except EOFError:
        pass
    if not frames:
        raise ValueError(f"No frames in GIF: {path}")
    return frames, durs


def _match_frame_shape(arr: np.ndarray, ref_shape: tuple[int, int, int]) -> np.ndarray:
    """ref_shape is (H, W, C)."""
    if arr.shape == ref_shape:
        return arr
    pil = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).resize(
        (ref_shape[1], ref_shape[0]), Image.Resampling.LANCZOS
    )
    return np.array(pil)


def _gif_frame_index(durs: list[float], t: float, n_frames: int) -> int:
    """Which GIF frame is active at time t (looped), no interpolation."""
    if n_frames <= 1:
        return 0
    total = sum(durs)
    if total <= 1e-9:
        return 0
    t = t % total
    acc = 0.0
    for i, d in enumerate(durs):
        d = max(d, 1e-6)
        if t < acc + d:
            return i
        acc += d
    return n_frames - 1


def _gif_frame_blend(
    frames: list[np.ndarray],
    durs: list[float],
    t: float,
) -> np.ndarray:
    """
    Smooth GIF playback: linear crossfade from frame i → i+1 over each frame's duration
    (avoids hard cuts / strobing on high-contrast GIFs).
    """
    n = len(frames)
    if n == 0:
        raise ValueError("GIF has no frames")
    if n == 1:
        return np.array(frames[0])
    total = sum(durs)
    if total <= 1e-9:
        return np.array(frames[0])
    t = t % total
    acc = 0.0
    ref_shape = frames[0].shape
    for i, d in enumerate(durs):
        d = max(d, 1e-6)
        if t < acc + d:
            local = (t - acc) / d
            local = min(1.0, max(0.0, local))
            ni = (i + 1) % n
            a = _match_frame_shape(np.array(frames[i]), ref_shape).astype(np.float32)
            b = _match_frame_shape(np.array(frames[ni]), ref_shape).astype(np.float32)
            out = (1.0 - local) * a + local * b
            return np.clip(out, 0, 255).astype(np.uint8)
        acc += d
    return np.array(_match_frame_shape(np.array(frames[-1]), ref_shape))


# Light blur on the scaled background to kill residual high-frequency flicker / scanline moiré.
_BG_GIF_SOFTEN = 1.85
# Video (e.g. Minecraft gameplay): lighter blur, keep color; dampens macroblock shimmer behind keys.
_BG_VIDEO_SOFTEN = 0.55
# Cycling Grok B-roll: light blur; subject should stay readable (lights are incidental in prompts).
_BG_VIDEO_CYCLE_SOFTEN = 0.62

# GIF crossfade blends palette frames in RGB → bogus chroma between frames (green/cyan “film”).
# Keep only luminance so motion stays, color flicker goes away. Not applied to MP4/WebM backgrounds.
_BG_GIF_LUMA_ONLY = True

_VIDEO_BG_EXTENSIONS = frozenset({".mp4", ".webm", ".mov", ".mkv", ".m4v"})
_IMAGE_BG_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".webp", ".bmp"})
# Still image (e.g. starfield PNG): same treatment as video — keep color, light blur.
_BG_STATIC_IMAGE_SOFTEN = 0.48

# Procedural night sky (twinkling stars) when no real background video is used.
_STARFIELD_COUNT = 2600
_STARFIELD_SOFTEN = 0.38

# Drifting key sprites from GRAVITYZONE — full GIF animation per floater (looped, crossfaded).
DEFAULT_FLOATER_KEYS_DIR = Path(
    os.environ.get("WUT8_FLOATER_KEYS_DIR", r"C:\Z\LIVE\GRAVITYZONE\keys")
)
_KEY_FLOATER_COUNT = 20
_KEY_FLOATER_MAX_PX = 96
_KEY_FLOATER_ALPHA = 0.72  # soften vs background
_KEY_GIF_MAX_FRAMES = 200  # safety cap per key file


def _ease_out_quad(u: float) -> float:
    return 1.0 - (1.0 - u) * (1.0 - u)


def _wrap_coord(v: float, span: float) -> float:
    v = v % span
    if v < 0:
        v += span
    return v


@dataclass
class _KeyFloater:
    """One key GIF (all frames), scaled; drifts, spins, and animates in a loop."""

    frames: list[Image.Image]
    durs: list[float]
    phase: float  # seconds offset into the GIF timeline (desync instances)
    x0: float
    y0: float
    vx: float
    vy: float
    angle0: float
    spin_deg_per_sec: float


def _list_key_gif_paths(keys_dir: Path) -> list[Path]:
    if not keys_dir.is_dir():
        return []
    return sorted(p.resolve() for p in keys_dir.glob("*.gif") if p.is_file())


def _apply_key_alpha(im: Image.Image, alpha_scale: float) -> Image.Image:
    im = im.convert("RGBA")
    r, g, b, a = im.split()
    a = a.point(lambda p, s=alpha_scale: min(255, int(p * s)))
    return Image.merge("RGBA", (r, g, b, a))


def _load_key_gif_animation(
    path: Path, max_px: int, alpha_scale: float
) -> tuple[list[Image.Image], list[float]] | None:
    """Load all frames of a key GIF, resize to max_px, same canvas size, crossfade-ready."""
    try:
        im = Image.open(path)
    except OSError:
        return None
    raw_frames: list[Image.Image] = []
    durs: list[float] = []
    try:
        while True:
            if len(raw_frames) >= _KEY_GIF_MAX_FRAMES:
                break
            rgba = im.convert("RGBA")
            w, h = rgba.size
            if w > 0 and h > 0:
                scale = min(float(max_px) / float(max(w, h)), 1.0)
                if scale < 1.0:
                    nw = max(1, int(w * scale))
                    nh = max(1, int(h * scale))
                    rgba = rgba.resize((nw, nh), Image.Resampling.LANCZOS)
                raw_frames.append(_apply_key_alpha(rgba, alpha_scale))
            d = float(im.info.get("duration", 100))
            durs.append(max(d, 20.0) / 1000.0)
            im.seek(im.tell() + 1)
    except EOFError:
        pass
    if not raw_frames:
        return None
    rw, rh = raw_frames[0].size
    frames: list[Image.Image] = []
    for fr in raw_frames:
        if fr.size != (rw, rh):
            fr = fr.resize((rw, rh), Image.Resampling.LANCZOS)
        frames.append(fr)
    durs = durs[: len(frames)]
    while len(durs) < len(frames):
        durs.append(durs[-1] if durs else 0.1)
    return frames, durs


def _pil_key_gif_frame(frames: list[Image.Image], durs: list[float], t: float) -> Image.Image:
    """One palette frame only — cross-blending key GIFs causes visible flicker on the semi-transparent sprites."""
    if len(frames) == 1:
        return frames[0].copy()
    idx = _gif_frame_index(durs, t, len(frames))
    return frames[idx].copy()


def _cover_crop_center(pil: Image.Image, tw: int, th: int) -> Image.Image:
    """Scale up to cover (tw, th), then center-crop."""
    w, h = pil.size
    if w <= 0 or h <= 0:
        return Image.new("RGB", (tw, th), (0, 0, 0))
    scale = max(tw / w, th / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    pil = pil.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return pil.crop((left, top, left + tw, top + th))


def _make_key_floaters(
    seed: int,
    keys_dir: Path | None,
    *,
    count: int = _KEY_FLOATER_COUNT,
) -> list[_KeyFloater]:
    if keys_dir is None:
        keys_dir = DEFAULT_FLOATER_KEYS_DIR
    paths = _list_key_gif_paths(keys_dir)
    if not paths:
        return []

    rng = random.Random(seed)
    if len(paths) >= count:
        picks = rng.sample(paths, k=count)
    else:
        picks = rng.choices(paths, k=count)

    out: list[_KeyFloater] = []
    for path in picks:
        loaded = _load_key_gif_animation(path, _KEY_FLOATER_MAX_PX, _KEY_FLOATER_ALPHA)
        if not loaded:
            continue
        frames, durs = loaded
        total = sum(durs)
        phase = rng.uniform(0.0, total) if total > 1e-9 else 0.0
        out.append(
            _KeyFloater(
                frames=frames,
                durs=durs,
                phase=phase,
                x0=rng.uniform(0, FRAME_W),
                y0=rng.uniform(0, FRAME_H),
                vx=rng.uniform(-22, 22),
                vy=rng.uniform(-18, 18),
                angle0=rng.uniform(0, 360),
                spin_deg_per_sec=rng.uniform(-35, 35),
            )
        )
    return out


def _bg_gif_to_neutral_rgb(pil_bg: Image.Image) -> Image.Image:
    """Drop chroma from the tiled GIF layer (grayscale luma replicated to RGB)."""
    if not _BG_GIF_LUMA_ONLY:
        return pil_bg
    luma = ImageOps.grayscale(pil_bg)
    return Image.merge("RGB", (luma, luma, luma))


def _render_starfield_pil(t: float, seed: int) -> Image.Image:
    """Night gradient + many twinkling stars (full color, no video file)."""
    rng = np.random.default_rng(seed & 0xFFFFFFFF)
    n = _STARFIELD_COUNT
    xs = rng.integers(0, FRAME_W, size=n, dtype=np.int32)
    ys = rng.integers(0, FRAME_H, size=n, dtype=np.int32)
    br = rng.uniform(0.22, 1.0, size=n)
    phase = rng.uniform(0.0, 2.0 * np.pi, size=n)
    freq = rng.uniform(0.75, 2.85, size=n)
    tw = 0.18 + 0.82 * (0.5 + 0.5 * np.sin(t * freq * 2.35 + phase))
    v = np.clip((255.0 * br * tw), 0, 255).astype(np.uint8)

    yy = np.linspace(0.0, 1.0, FRAME_H, dtype=np.float32)
    gv = (4.0 + yy * 11.0).astype(np.uint8)
    gvi = gv.astype(np.int32)
    base = np.zeros((FRAME_H, FRAME_W, 3), dtype=np.uint8)
    base[:, :, 0] = gv[:, np.newaxis]
    base[:, :, 1] = np.clip(gvi[:, np.newaxis] + 2, 0, 255).astype(np.uint8)
    base[:, :, 2] = np.clip(gvi[:, np.newaxis] + 16, 0, 255).astype(np.uint8)
    base[ys, xs, 0] = v
    base[ys, xs, 1] = np.minimum(255, v.astype(np.int32) + 20).astype(np.uint8)
    base[ys, xs, 2] = np.minimum(255, v.astype(np.int32) + 38).astype(np.uint8)
    return Image.fromarray(base, mode="RGB")


def _load_static_bg_image(path: Path) -> Image.Image:
    """Single image, cover-cropped to frame (RGB)."""
    im = Image.open(path).convert("RGB")
    return _cover_crop_center(im, FRAME_W, FRAME_H)


def _video_frame_to_bg_pil(bg_clip, t: float) -> Image.Image:
    """Sample looping video at t, return RGB PIL sized to frame (cover crop)."""
    dur = float(bg_clip.duration or 0.0)
    tt = (t % dur) if dur > 1e-6 else 0.0
    frame = bg_clip.get_frame(tt)
    arr = np.asarray(frame)
    if arr.ndim == 2:
        pil = Image.fromarray(arr).convert("RGB")
    elif arr.shape[2] == 4:
        pil = Image.fromarray(arr, mode="RGBA").convert("RGB")
    else:
        pil = Image.fromarray(arr[:, :, :3], mode="RGB")
    return _cover_crop_center(pil, FRAME_W, FRAME_H)


def _paste_key_floaters(canvas: Image.Image, t: float, floaters: list[_KeyFloater]) -> None:
    for f in floaters:
        cx = _wrap_coord(f.x0 + f.vx * t, FRAME_W)
        cy = _wrap_coord(f.y0 + f.vy * t, FRAME_H)
        ang = f.angle0 + f.spin_deg_per_sec * t
        local_t = t + f.phase
        spr = _pil_key_gif_frame(f.frames, f.durs, local_t)
        rot = spr.rotate(ang, expand=True, resample=Image.Resampling.BICUBIC)
        rw, rh = rot.size
        px = int(cx - rw / 2)
        py = int(cy - rh / 2)
        canvas.paste(rot, (px, py), rot)


def write_animated_video(
    meta: PostMeta,
    lines: list[CaricatureLine],
    *,
    bg_media: Path | None,
    out_path: Path,
    starfield: bool = False,
    bg_video_cycle: list[Path] | None = None,
    bg_cycle_segment_sec: float | None = None,
    image_bytes: bytes | None = None,
    fps: int = 30,
    stagger_sec: float = 0.38,
    pop_sec: float = 0.18,
    hold_tail_sec: float = 2.0,
    floater_keys_dir: Path | None = None,
    audio_path: Path | None = None,
    voiceover_tail_sec: float = 0.35,
) -> None:
    """
    Background: one video/GIF/image, cycling MP4s (e.g. Grok clips), or procedural starfield;
    post image top-aligned (full width, never cropped); first comment visible at t=0; others pop in
    on a stagger while the chat column scrolls up so new messages stay in view.
    """
    from moviepy import VideoClip, VideoFileClip

    if bg_video_cycle and starfield:
        raise ValueError("bg_video_cycle and starfield cannot both be set")
    if bg_video_cycle and bg_media is not None:
        raise ValueError("bg_video_cycle and bg_media cannot both be set")

    cycle_seg = (
        bg_cycle_segment_sec
        if bg_cycle_segment_sec is not None
        else float(os.environ.get("WUT8_GROK_BG_SEGMENT_SEC", "4.0"))
    )

    if image_bytes is None:
        with httpx.Client(headers=_BROWSER_HEADERS, follow_redirects=True, timeout=60.0) as client:
            r = client.get(meta.image_url)
            r.raise_for_status()
            image_bytes = r.content

    bg_static_pil: Image.Image | None = None
    bg_clip = None
    bg_clips_list: list = []
    use_video = False
    use_video_cycle = False
    use_static_image = False
    frames_gif: list[np.ndarray] | None = None
    durs: list[float] | None = None
    star_seed = 0

    if bg_video_cycle:
        paths = [Path(p) for p in bg_video_cycle if Path(p).is_file()]
        if not paths:
            raise FileNotFoundError("bg_video_cycle: no existing video files")
        for p in paths:
            bg_clips_list.append(VideoFileClip(str(p), audio=False))
        use_video_cycle = True
    elif starfield:
        use_video = False
        use_static_image = False
        frames_gif = None
        durs = None
        star_seed = hash(meta.post_url) & 0xFFFFFFFF
    else:
        if bg_media is None or not Path(bg_media).is_file():
            raise FileNotFoundError(f"Background media not found: {bg_media}")
        bg_media = Path(bg_media)
        ext = bg_media.suffix.lower()
        use_video = ext in _VIDEO_BG_EXTENSIONS
        use_static_image = ext in _IMAGE_BG_EXTENSIONS
        frames_gif = None
        durs = None

        if use_video:
            bg_clip = VideoFileClip(str(bg_media), audio=False)
        elif use_static_image:
            bg_static_pil = _load_static_bg_image(bg_media)
        else:
            frames_gif, durs = _load_gif_rgb_frames(bg_media)

    layout = _build_header_layout(meta)
    img_rgb, ix, iy, bubbles, chat_y0, chat_h = _layout_animated_top_image_and_scroll_bubbles(
        lines,
        image_bytes,
        layout.image_top_y,
        max_image_w=IMAGE_MAX_W_ANIMATED,
        max_image_h_cap=IMAGE_MAX_H_ANIMATED,
    )

    font_handle = _load_font(22)
    font_body = _load_font(20)

    n = len(bubbles)
    st = max(float(stagger_sec), 1e-6)
    if n <= 1:
        animation_duration_sec = float(hold_tail_sec) + (pop_sec if n == 0 else 0.0)
    else:
        animation_duration_sec = (n - 1) * st + float(pop_sec) + float(hold_tail_sec)
    animation_duration_sec = max(animation_duration_sec, float(hold_tail_sec))

    duration_sec = float(animation_duration_sec)
    audio_clip = None
    if audio_path is not None and Path(audio_path).is_file():
        from moviepy import AudioFileClip

        _aud = AudioFileClip(str(audio_path))
        ad = float(_aud.duration or 0.0)
        if ad > 1e-3:
            audio_clip = _aud
            duration_sec = max(duration_sec, ad + float(voiceover_tail_sec))
        else:
            _aud.close()

    anim_cap = max(animation_duration_sec - 1e-6, 0.0)

    key_floaters = _make_key_floaters(
        hash(meta.post_url) & 0xFFFFFFFF,
        floater_keys_dir,
    )

    try:

        def make_frame(t: float) -> np.ndarray:
            t_vis = min(float(t), anim_cap)
            if starfield:
                pil_bg = _render_starfield_pil(t_vis, star_seed)
                soften = _STARFIELD_SOFTEN
            elif use_video_cycle:
                assert bg_clips_list
                if len(bg_clips_list) == 1:
                    pil_bg = _video_frame_to_bg_pil(bg_clips_list[0], t_vis)
                else:
                    seg = max(cycle_seg, 0.25)
                    idx = int(t_vis / seg) % len(bg_clips_list)
                    c = bg_clips_list[idx]
                    inner = t_vis % seg
                    pil_bg = _video_frame_to_bg_pil(c, inner)
                soften = _BG_VIDEO_CYCLE_SOFTEN
            elif use_video:
                assert bg_clip is not None
                pil_bg = _video_frame_to_bg_pil(bg_clip, t_vis)
                soften = _BG_VIDEO_SOFTEN
            elif use_static_image:
                assert bg_static_pil is not None
                pil_bg = bg_static_pil
                soften = _BG_STATIC_IMAGE_SOFTEN
            else:
                assert frames_gif is not None and durs is not None
                bg = _gif_frame_blend(frames_gif, durs, t_vis)
                pil_bg = Image.fromarray(bg).resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS)
                soften = _BG_GIF_SOFTEN
            if soften > 0:
                pil_bg = pil_bg.filter(ImageFilter.GaussianBlur(radius=soften))
            if not use_video and not starfield and not use_static_image and not use_video_cycle:
                pil_bg = _bg_gif_to_neutral_rgb(pil_bg)
            canvas = pil_bg.convert("RGBA")

            overlay = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
            od = ImageDraw.Draw(overlay)
            od.rectangle((0, 0, FRAME_W, FRAME_H), fill=(0, 0, 0, 88))
            canvas = Image.alpha_composite(canvas, overlay)

            _paste_key_floaters(canvas, t_vis, key_floaters)
            draw = ImageDraw.Draw(canvas)
            _draw_header_rgba(draw, layout)

            canvas.paste(img_rgb.convert("RGBA"), (ix, iy))

            chat_layer = Image.new("RGBA", (FRAME_W, chat_h), (0, 0, 0, 0))
            k = min(max(0, n - 1), int(t_vis / st)) if n > 0 else -1
            scroll = 0.0
            if k >= 0:
                bk = bubbles[k]
                scroll = float(max(0, bk.y0 + bk.h - chat_h))

            chat_draw = ImageDraw.Draw(chat_layer)
            psec = max(float(pop_sec), 1e-6)
            for i, b in enumerate(bubbles):
                t0 = i * st
                if t_vis + 1e-9 < t0:
                    continue
                if i == 0:
                    a = 1.0
                else:
                    a = _ease_out_quad(min(1.0, (t_vis - t0) / psec))
                if a <= 0.001:
                    continue
                ly = int(round(b.y0 - scroll))
                if ly + b.h < -4 or ly > chat_h + 4:
                    continue
                fill = (
                    BUBBLE_FILL[0],
                    BUBBLE_FILL[1],
                    BUBBLE_FILL[2],
                    int(235 * a),
                )
                outline_a = int(200 * a)
                chat_draw.rounded_rectangle(
                    (b.x0, ly, b.x0 + b.w, ly + b.h),
                    radius=12,
                    fill=fill,
                    outline=(
                        BUBBLE_OUTLINE[0],
                        BUBBLE_OUTLINE[1],
                        BUBBLE_OUTLINE[2],
                        outline_a,
                    ),
                    width=2,
                )
                ha = int(255 * a)
                chat_draw.text(
                    (b.x0 + 14, ly + 10),
                    b.handle,
                    fill=ACCENT + (ha,),
                    font=font_handle,
                )
                ty = ly + 10 + (
                    font_handle.getbbox(b.handle)[3] - font_handle.getbbox(b.handle)[1]
                ) + 8
                for bl in b.body_lines:
                    chat_draw.text(
                        (b.x0 + 14, ty), bl, fill=TEXT_MAIN + (ha,), font=font_body
                    )
                    ty += font_body.getbbox(bl)[3] - font_body.getbbox(bl)[1] + 6

            canvas.paste(chat_layer, (0, chat_y0), chat_layer)

            return np.asarray(canvas.convert("RGB"))

        clip = VideoClip(make_frame, duration=duration_sec).with_fps(fps)
        if audio_clip is not None:
            try:
                if audio_clip.duration > duration_sec + 0.05:
                    duration_sec = float(audio_clip.duration) + float(voiceover_tail_sec)
                    clip = VideoClip(make_frame, duration=duration_sec).with_fps(fps)
                clip = clip.with_audio(audio_clip)
            except Exception:
                audio_clip.close()
                raise
        out_path.parent.mkdir(parents=True, exist_ok=True)
        clip.write_videofile(
            str(out_path),
            codec="libx264",
            audio=audio_clip is not None,
            fps=fps,
            preset="medium",
            logger=None,
        )
        clip.close()
    finally:
        if audio_clip is not None:
            try:
                audio_clip.close()
            except Exception:
                pass
        if bg_clip is not None:
            bg_clip.close()
        for c in bg_clips_list:
            c.close()

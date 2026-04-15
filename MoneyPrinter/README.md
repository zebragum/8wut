# 8wut MoneyPrinter

Short **9:16 (1080×1920)** clips for **TikTok / Instagram Reels**: pull a **real public post** from the 8wut API (or pick **`--random`** from discovery), run a **vision model** to synthesize a scrolling **comment thread** that hypes or gently roasts the **food** and plugs **8wut** / **8wut.org**, then composite over a **looping background** (Grok clips, video, GIF, or starfield) → **H.264 MP4** (optional PNG frame grab).

## Setup

```bash
cd MoneyPrinter
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Fill **`.env`**:

- **`OPENAI_API_KEY`** — For GPT-4o-class vision JSON output; if omitted, the tool uses **mock** lines (still renders).
- **`WUT8_API_URL`** — API base. Defaults to **`https://eightwut-api.onrender.com`** for unauthenticated **MoneyPrinter** reads (`GET /mp/sample`, etc.). Use `http://localhost:3001` when running the API locally.
- **`WUT8_APP_URL`** — Link printed large in the header (default `https://8wut.org`).
- **`WUT8_JWT`** *(optional)* — If set, MoneyPrinter uses authenticated `GET /posts/discovery` instead of the public **`/mp/*`** routes.

**No JWT needed:** after the API is deployed, **`GET /mp/sample`** returns a random public post with images plus a username pool. Disable with env **`DISABLE_PUBLIC_POST_SAMPLE=1`** on the server if you ever want to turn that off.

**Postgres (optional):** `WUT8_DATABASE_URL` or the URL in `api/test_recent_posts.js` can be used as a last resort; many hosts block direct DB access from home networks.

## Usage

**Random discovery post with images** (recommended for batch content):

```bash
python main.py --random -o out.mp4
```

**Specific post** (UUID from the API):

```bash
python main.py f47ac10b-58cc-4372-a567-0e02b2c3d479 -o out.mp4
```

**Manual** (no post fetch — supply image URL and caption):

```bash
python main.py --post-url https://8wut.org --image-url https://example.com/plate.jpg --title "midnight ramen" --author noodle_nom -o out.mp4
```

**Static** (single frame, no animated background):

```bash
python main.py --random --static -o still.mp4
```

**Backgrounds**

- **`--bg-gif path`** — MP4 / GIF / still image.
- **Grok** — `python main.py --fetch-grok-bgs` (needs `GROK_KEY` or `XAI_API_KEY`); clips live in `eightwut_video_maker/data/grok_bg_clips/`.
- **Minecraft-style loop** — `python main.py --fetch-minecraft-bg` (needs `yt-dlp` + `ffmpeg`).

## How comments are generated

- The model sees the **post photo**, **caption**, and **poster username** (the poster is **not** reused as a fake commenter handle).
- **`--random`** passes a pool of **real usernames** from the same discovery page so handles look like the real community.
- Optional **real comments** on that post are loaded from `GET /posts/:id/comments` when `WUT8_JWT` is set (tone/topics only — not copied verbatim).
- Every synthesized line is instructed to stay **food-direct** (praise or friendly ribbing) and to mention **8wut** naturally, with **@mentions** in the text where it fits.

## Layout (unchanged structure)

Green-on-dark header: **8wut** wordmark, caption, **Feed snapshot**, **`@author`**, prominent **link** (`WUT8_APP_URL`), hero image, chat bubbles. Same animated scroll / pop-in behavior as before.

## Package layout

| Path | Role |
|------|------|
| `main.py` | CLI entrypoint |
| `eightwut_video_maker/fetch_post.py` | API: discovery, post by id, `PostMeta` |
| `eightwut_video_maker/characters.py` | OpenAI vision → `CaricatureLine` list |
| `eightwut_video_maker/render.py` | PIL + MoviePy export |
| `eightwut_video_maker/scrape_comments.py` | `GET /posts/:id/comments` helper |
| `eightwut_video_maker/data/` | `used_discovery_posts.txt`, Grok clips, optional `prompt_tone.txt` / `comment_vibe.txt` |

## Env vars (backgrounds & Grok)

| Variable | Purpose |
|----------|---------|
| `WUT8_GROK_SINGLE_BG` | If truthy, loop only the first `grok_bg_*.mp4`. |
| `WUT8_GROK_BG_SEGMENT_SEC` | Seconds per clip when cycling multiple Grok files (default `4`). |
| `WUT8_BG_VIDEO` | Optional single background video path. |
| `WUT8_BG_VIDEO_FIRST` | If truthy, prefer `WUT8_BG_VIDEO` over Grok when both exist. |
| `WUT8_PARKOUR_QUERY` | YouTube search for `--fetch-minecraft-bg`. |
| `WUT8_INSPIRATION_MAX_CHARS` | Cap for optional `data/prompt_tone.txt`. |
| `WUT8_FLOATER_KEYS_DIR` | Directory of GIFs for floating key sprites. |

## Policies

Use generated clips and API data responsibly and in line with 8wut’s terms, your creators’ consent, and each platform’s rules. This README documents the tooling only.

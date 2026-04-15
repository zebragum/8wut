from __future__ import annotations

import base64
import json
import random
import re
import sys
import time
import uuid
from typing import Any

import httpx

from .inspiration import load_inspiration_text
from .models import CaricatureLine, PostMeta
from .vibe import load_comment_vibe_snippet

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}


def _system_prompt(
    inspiration_excerpt: str,
    vibe_excerpt: str,
) -> str:
    vibe_block = ""
    if vibe_excerpt.strip():
        vibe_block = (
            "\n\nOPTIONAL_EXTRA_TONE_SAMPLES (do not copy verbatim; cadence only):\n---\n"
            + vibe_excerpt.strip()
            + "\n"
        )
    return (
        """You write fake on-screen comments for a TikTok/Instagram-style vertical video. The hero """
        """image is a real food post from the app **8wut** (food social; link in bio is 8wut.org).

Each comment must do ALL of the following:
1) Say something **direct** about the **food or drink** in the photo — sincere praise, craving, """
        """or a **gentle rib / roast** (playful, not cruel). No vague "nice pic" — name what you see.
2) Naturally mention **8wut** the app or community at least once in **every** comment (spell it """
        """"8wut"). Examples of vibe: "this is why I open 8wut first thing," "never 8 that before lol," """
        """"glad I found 8wut," "tagging you @friend we need this," "8wut did not disappoint today." """
        """Vary wording; do not repeat one template.
3) Feel like **real community**: short, messy, human. Often **@mention** a friend with a plausible """
        """handle from the provided pool (see user message). Use 1–3 @mentions per comment when it fits.

Handles:
- The JSON field "handle" must be the plain username **without** a leading @ (the renderer adds styling).
- You **must** only use handles from the **POOL_OF_REAL_8WUT_USERNAMES** list in the user message. """
        """Prefer each handle at most once across all lines; if the pool is too small, repeat sparingly.
- **Never** use the poster's own username (given in user message) as a comment handle.

Emoji: include Unicode emoji on roughly half the lines (hearts, drool, fire, laugh, etc.).

Hard bans:
- No slurs, hate, harassment, or graphic insults. Roasts stay food-safe and friendly.
- Do not claim to be official 8wut staff or ads.
- Do not mention other social platforms by name (no TikTok, Instagram, Reddit, etc.).
- No hashtags.

INSPIRATION (rhythm only — not a script):
---
"""
        + inspiration_excerpt
        + vibe_block
        + """

---

Output ONLY valid JSON, no markdown. The object must have key "lines": an array of 10 to 14 objects. """
        """Each object has "handle" and "text" (both non-empty strings)."""
    )


def _build_system_message() -> str:
    return _system_prompt(load_inspiration_text(), load_comment_vibe_snippet())


def _extract_json_object(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", raw, re.MULTILINE)
    if m:
        raw = m.group(1).strip()

    decoder = json.JSONDecoder()
    idx = 0
    while True:
        start = raw.find("{", idx)
        if start < 0:
            break
        try:
            obj, _ = decoder.raw_decode(raw, start)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            idx = start + 1
            continue
    raise ValueError("Model did not return a parseable JSON object")


def _coerce_lines_array(data: dict[str, Any]) -> list[Any] | None:
    by_lower: dict[str, Any] = {str(k).lower(): v for k, v in data.items()}
    for key in ("lines", "comments", "panel", "voices", "reactions"):
        v = data.get(key)
        if v is None:
            v = by_lower.get(key)
        if isinstance(v, list) and v:
            return v
    for v in data.values():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            k0 = v[0].keys()
            if {"handle", "text"} <= set(k0) or any(
                x in k0 for x in ("username", "screenname", "body", "line")
            ):
                return v
    return None


def _item_handle_text(item: dict[str, Any]) -> tuple[str, str] | None:
    h = str(
        item.get("handle")
        or item.get("username")
        or item.get("screenname")
        or ""
    ).strip()
    t = str(item.get("text") or item.get("body") or item.get("line") or "").strip()
    if h and t:
        return h, t
    return None


def _download_image_b64(url: str) -> tuple[str, str]:
    with httpx.Client(headers=_BROWSER_HEADERS, follow_redirects=True, timeout=60.0) as client:
        r = client.get(url)
        r.raise_for_status()
        ctype = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        if not ctype.startswith("image/"):
            ctype = "image/jpeg"
        b64 = base64.standard_b64encode(r.content).decode("ascii")
        return ctype, b64


def generate_caricature_lines(
    meta: PostMeta,
    *,
    api_key: str | None,
    model: str = "gpt-4o-mini",
    real_post_comments: list[str] | None = None,
    handle_pool: list[str] | None = None,
) -> list[CaricatureLine]:
    pool = [h.strip() for h in (handle_pool or []) if h and str(h).strip()]
    pool = list(dict.fromkeys(pool))
    if meta.author_username:
        al = meta.author_username.strip().lower()
        pool = [h for h in pool if h.lower() != al]

    if not api_key:
        return _mock_lines(meta, pool)

    try:
        from openai import OpenAI
    except ImportError as e:
        raise RuntimeError("Install openai: pip install openai") from e

    mime, b64 = _download_image_b64(meta.image_url)
    client = OpenAI(api_key=api_key)
    sys_msg = _build_system_message()

    pool_block = ""
    if pool:
        pool_block = (
            "\nPOOL_OF_REAL_8WUT_USERNAMES (use only these as \"handle\" values; plain username, no @):\n"
            + "\n".join(f"- {h}" for h in pool[:80])
            + "\n"
        )
    else:
        pool_block = (
            "\nNo username pool was supplied — invent plausible short food-app-style usernames "
            "(lowercase, numbers, underscores okay), but still follow all rules.\n"
        )

    def _build_user_text(retry_hint: str) -> str:
        user_text = (
            f"Generation id (unique this run): {uuid.uuid4().hex}\n"
            f"Post caption: {meta.title}\n"
            f"Poster username (do NOT use as a comment handle; already on screen): "
            f"{meta.author_username}\n"
            f"App / link-in-bio URL for viewers: {meta.post_url}\n"
            "Write wholly NEW comments (fresh wording). Describe this specific photo's food.\n"
            f"{pool_block}"
        )
        if real_post_comments:
            trimmed = [c.replace("\r", " ").replace("\n", " ").strip() for c in real_post_comments]
            trimmed = [c for c in trimmed if c][:24]
            if trimmed:
                user_text += (
                    "\nREAL_COMMENTS_ON_THIS_POST (topics/mood only; do NOT copy verbatim; "
                    "do NOT reuse real handles):\n---\n"
                    + "\n".join(f"- {c[:400]}" for c in trimmed)
                    + "\n---\n"
                )
        if retry_hint:
            user_text += retry_hint
        user_text += (
            '\nOutput ONE JSON object only. Key "lines" MUST be an array of at least 10 objects '
            '(aim for 10–14); each object MUST have non-empty strings "handle" and "text".\n'
            "Every comment's text must mention 8wut naturally and say something direct about the food.\n"
            "Write the JSON now."
        )
        return user_text

    last_problem = "no attempt"
    for attempt in range(3):
        hint = ""
        if attempt:
            hint = (
                f"\n\nYour previous answer was rejected: {last_problem}. "
                'Try again: valid JSON only, key "lines" with at least 10 {handle,text} items.\n'
            )
        user_text = _build_user_text(hint)
        try:
            resp = client.chat.completions.create(
                model=model,
                temperature=1.0,
                max_tokens=2600,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": sys_msg},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_text},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime};base64,{b64}",
                                },
                            },
                        ],
                    },
                ],
            )
            raw = resp.choices[0].message.content or ""
        except Exception as e:
            last_problem = f"API error: {e}"
            continue
        try:
            data = _extract_json_object(raw)
        except ValueError as e:
            last_problem = str(e)
            continue
        lines_raw = _coerce_lines_array(data)
        if not isinstance(lines_raw, list):
            last_problem = (
                "JSON must contain a lines-like array; got top-level keys: "
                + ", ".join(sorted(data.keys()))
            )
            continue

        out: list[CaricatureLine] = []
        for item in lines_raw:
            if not isinstance(item, dict):
                continue
            pair = _item_handle_text(item)
            if pair:
                h, t = pair
                out.append(CaricatureLine(handle=h, text=t))
        if len(out) >= 8:
            return out
        last_problem = f"only {len(out)} valid lines (need at least 8)"

    print(
        "Warning: vision model did not return enough valid lines after 3 tries; "
        f"last issue: {last_problem}. Using mock panel lines so the video can still render.",
        file=sys.stderr,
    )
    return _mock_lines(meta, pool)


def _mock_lines(meta: PostMeta, pool: list[str]) -> list[CaricatureLine]:
    salt = time.time_ns() & 0xFFFFFFFFFFFFFFFF
    rng = random.Random((hash(meta.post_url) ^ salt) & 0xFFFFFFFFFFFFFFFF)
    base_pool = [h for h in pool if h.lower() != meta.author_username.lower()]
    if len(base_pool) < 8:
        base_pool.extend(
            [
                "snack_radar",
                "fridge_poet",
                "soup_hours",
                "pickle_mom",
                "carb_accountant",
                "midnight_8",
                "sauce_detective",
                "leftovers_king",
            ]
        )
    rng.shuffle(base_pool)
    bodies = [
        "😍 that glaze is illegal @{} — 8wut stays undefeated",
        "{} this is the energy I open 8wut for",
        "never 8 that combo before lol 8wut wild today",
        "I'm screenshotting this for {} — get 8wut already",
        "honest roast: needs more crunch but still clearing my 8wut feed",
        "{} tag ur chef twin this belongs on 8wut front page",
        "8wut made me brave enough to try that at home 💀",
        "sweet heat looks perfect {} 8wut dinner club assemble",
        "I'd fight a bear for a bite (jk) (unless?) 8wut gang",
        "{} this plate is bullying me in a good way 8wut",
        "tell me this isn't the best thing on 8wut this week",
        "{} 8wut really said comfort food today",
        "slightly unhinged portion respect 8wut understands me",
        "{} if we don't cook this I'm uninstalling life not 8wut tho",
    ]
    rng.shuffle(bodies)
    out: list[CaricatureLine] = []
    for i, tmpl in enumerate(bodies[:12]):
        mention = base_pool[i % len(base_pool)]
        if "{}" in tmpl:
            text = tmpl.format(mention)
        else:
            text = tmpl
        handle = mention
        out.append(CaricatureLine(handle=handle, text=text))
    return out

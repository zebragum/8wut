from __future__ import annotations

import os
import random
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs

import httpx

from .models import PostMeta


def _api_base() -> str:
    return (os.environ.get("WUT8_API_URL") or "http://localhost:3001").rstrip("/")


def public_api_base() -> str:
    """
    Base URL for unauthenticated read-only routes (``/posts/public-sample``, etc.).
    Defaults to production so MoneyPrinter works with zero env after API deploy.
    """
    return (os.environ.get("WUT8_API_URL") or "https://eightwut-api.onrender.com").rstrip("/")


def _app_url() -> str:
    return (os.environ.get("WUT8_APP_URL") or "https://8wut.org").rstrip("/")


def _repo_root() -> Path:
    """8wut monorepo root (parent of MoneyPrinter)."""
    return Path(__file__).resolve().parents[2]


def _fallback_database_url_from_repo() -> str | None:
    """
    Same connection string as ``api/test_recent_posts.js`` (already in this repo).
    Lets MoneyPrinter pull real posts with zero manual env for users who have the clone.
    """
    js = _repo_root() / "api" / "test_recent_posts.js"
    if not js.is_file():
        return None
    text = js.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"connectionString:\s*'([^']+)'", text)
    if not m:
        return None
    return m.group(1).strip()


def resolve_database_url() -> str | None:
    for key in ("WUT8_DATABASE_URL", "DATABASE_URL"):
        v = (os.environ.get(key) or "").strip()
        if v:
            return v
    return _fallback_database_url_from_repo()


def _jwt_optional() -> str | None:
    return (os.environ.get("WUT8_JWT") or os.environ.get("JWT") or "").strip() or None


def _require_jwt() -> str:
    token = _jwt_optional()
    if not token:
        raise ValueError(
            "Set WUT8_JWT for authenticated API routes, or rely on GET /mp/sample "
            "on the deployed API, or set WUT8_DATABASE_URL / api/test_recent_posts.js."
        )
    return token


def _api_headers() -> dict[str, str]:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
        "Authorization": f"Bearer {_require_jwt()}",
    }


_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)


def normalize_post_id(post_or_url: str) -> str:
    s = post_or_url.strip()
    if _UUID_RE.fullmatch(s):
        return s
    if s.startswith("http"):
        parsed = urlparse(s)
        parts = [p for p in parsed.path.split("/") if p]
        if parts and _UUID_RE.fullmatch(parts[-1] or ""):
            return parts[-1]
        qs = parse_qs(parsed.query)
        for key in ("post", "postId", "id"):
            vals = qs.get(key)
            if vals and _UUID_RE.fullmatch((vals[0] or "").strip()):
                return vals[0].strip()
        raise ValueError(
            "Could not parse an 8wut post UUID from that URL. "
            "Pass the raw post id from the API, or a URL whose path ends with the UUID."
        )
    raise ValueError("Expected an 8wut post id (UUID) from the API.")


def fetch_post_json(post_id: str) -> dict:
    url = f"{_api_base()}/posts/{post_id}"
    with httpx.Client(headers=_api_headers(), follow_redirects=True, timeout=60.0) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.json()


def post_meta_from_public_sample_dict(p: dict) -> PostMeta:
    """Shape from ``GET /posts/public-sample`` or ``.../public-sample/post/:id``."""
    images = p.get("images") or []
    if not isinstance(images, list) or not images:
        raise ValueError("public-sample post has no images")
    image_url = str(images[0]).strip() if isinstance(images[0], str) else str(images[0]).strip()
    if not image_url:
        raise ValueError("empty image url")
    author = p.get("author") or {}
    username = str(author.get("username") or "").strip() or "someone"
    caption = str(p.get("caption") or "").strip()
    title = caption or "wut u 8"
    pid = str(p.get("id") or "").strip()
    return PostMeta(
        post_url=_app_url(),
        image_url=image_url,
        title=title,
        author_username=username,
        source_post_id=pid or None,
    )


def post_meta_from_api_dict(p: dict) -> PostMeta:
    images = p.get("images") or []
    if not isinstance(images, list) or not images:
        raise ValueError(
            f"Post {p.get('id')} has no images — MoneyPrinter needs a food photo (image post)."
        )
    image_url = str(images[0]).strip()
    if not image_url:
        raise ValueError("Post has empty image URL")
    author = p.get("author") or {}
    username = str(author.get("username") or "").strip() or "someone"
    caption = str(p.get("caption") or "").strip()
    title = caption or "wut u 8"
    pid = str(p.get("id") or "").strip()
    return PostMeta(
        post_url=_app_url(),
        image_url=image_url,
        title=title,
        author_username=username,
        source_post_id=pid or None,
    )


def _pg_connect(dsn: str):
    import psycopg2

    # Render / managed Postgres typically requires TLS.
    try:
        return psycopg2.connect(dsn, connect_timeout=30, sslmode="require")
    except Exception:
        return psycopg2.connect(dsn, connect_timeout=30)


def fetch_comment_texts_from_db(post_id: str, dsn: str) -> list[str]:
    q = """
    SELECT c.text FROM comments c
    WHERE c.post_id = %s::uuid
    ORDER BY c.created_at ASC
    """
    with _pg_connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(q, (post_id,))
            rows = cur.fetchall()
    out: list[str] = []
    for r in rows:
        if r and r[0]:
            t = str(r[0]).strip()
            if t:
                out.append(t)
    return out


def fetch_post_row_from_db(post_id: str, dsn: str) -> PostMeta | None:
    import psycopg2.extras

    q = """
    SELECT p.id, p.caption, u.username AS author_username,
      (SELECT pi.url FROM post_images pi WHERE pi.post_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS image_url
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE p.id = %s::uuid
    """
    with _pg_connect(dsn) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(q, (post_id,))
            row = cur.fetchone()
    if not row or not (row.get("image_url") or "").strip():
        return None
    cap = (row.get("caption") or "").strip()
    return PostMeta(
        post_url=_app_url(),
        image_url=str(row["image_url"]).strip(),
        title=cap or "wut u 8",
        author_username=str(row.get("author_username") or "someone").strip(),
        source_post_id=str(row["id"]),
    )


def _fetch_public_post_payload(post_id: str | None) -> dict:
    base = public_api_base()
    path = "/mp/sample" if post_id is None else f"/mp/sample/post/{post_id}"
    with httpx.Client(
        headers={"Accept": "application/json", "User-Agent": "8wut-MoneyPrinter/1.0"},
        follow_redirects=True,
        timeout=60.0,
    ) as client:
        r = client.get(f"{base}{path}")
        r.raise_for_status()
        return r.json()


def fetch_post(post_or_id: str) -> PostMeta:
    pid = normalize_post_id(post_or_id)
    if _jwt_optional():
        data = fetch_post_json(pid)
        return post_meta_from_api_dict(data)
    try:
        data = _fetch_public_post_payload(pid)
        return post_meta_from_public_sample_dict(data)
    except Exception:
        pass
    dsn = resolve_database_url()
    if dsn:
        meta = fetch_post_row_from_db(pid, dsn)
        if meta:
            return meta
        raise ValueError(f"Post {pid} not found or has no images.")
    raise ValueError(
        "Could not load post: set WUT8_JWT, or deploy API with GET /mp/sample, "
        "or set WUT8_DATABASE_URL."
    )


def fetch_discovery_posts(*, limit: int = 50, offset: int = 0) -> list[dict]:
    lim = max(1, min(50, limit))
    off = max(0, offset)
    url = f"{_api_base()}/posts/discovery"
    with httpx.Client(headers=_api_headers(), follow_redirects=True, timeout=60.0) as client:
        r = client.get(url, params={"limit": lim, "offset": off})
        r.raise_for_status()
        data = r.json()
    if not isinstance(data, list):
        raise ValueError("discovery response must be a JSON array")
    return data


def usernames_from_posts(posts: list[dict]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for p in posts:
        u = (p.get("author") or {}).get("username")
        if u and isinstance(u, str):
            s = u.strip()
            if s and s not in seen:
                seen.add(s)
                out.append(s)
    return out


def _usernames_random_from_db(dsn: str, limit: int = 60) -> list[str]:
    import psycopg2.extras

    q = """
    SELECT username FROM users
    WHERE username IS NOT NULL AND trim(username) <> ''
    ORDER BY random()
    LIMIT %s
    """
    with _pg_connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(q, (limit,))
            rows = cur.fetchall()
    return [str(r[0]).strip() for r in rows if r and r[0]]


def discovery_handle_pool(*, offset: int = 0) -> list[str]:
    if _jwt_optional():
        raw = fetch_discovery_posts(limit=50, offset=offset)
        return usernames_from_posts(raw)
    base = public_api_base()
    try:
        with httpx.Client(
            headers={"Accept": "application/json", "User-Agent": "8wut-MoneyPrinter/1.0"},
            timeout=45.0,
        ) as client:
            r = client.get(f"{base}/mp/usernames")
            r.raise_for_status()
            arr = r.json()
        if isinstance(arr, list):
            return [str(x).strip() for x in arr if x and str(x).strip()]
    except Exception:
        pass
    dsn = resolve_database_url()
    if dsn:
        try:
            return _usernames_random_from_db(dsn, 60)
        except Exception:
            pass
    return []


def _posts_with_images(posts: list[dict]) -> list[dict]:
    out: list[dict] = []
    for p in posts:
        imgs = p.get("images") or []
        if isinstance(imgs, list) and imgs and str(imgs[0]).strip():
            out.append(p)
    return out


def _read_used_ids(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    out: set[str] = set()
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if _UUID_RE.fullmatch(s):
            out.add(s.lower())
    return out


def _append_used_id(path: Path, post_id: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(f"{post_id}\n")


def _pick_random_via_api(
    used_ids_file: Path,
    *,
    rng: random.Random,
) -> tuple[PostMeta, list[str]] | None:
    used = _read_used_ids(used_ids_file)
    page_starts = list(range(0, 300, 50))
    rng.shuffle(page_starts)

    last_err: str | None = None
    for offset in page_starts:
        try:
            raw = fetch_discovery_posts(limit=50, offset=offset)
        except Exception as e:
            last_err = str(e)
            continue
        candidates = _posts_with_images(raw)
        candidates = [
            p
            for p in candidates
            if str(p.get("id") or "").strip().lower() not in used
        ]
        if not candidates:
            continue
        choice = rng.choice(candidates)
        pid = str(choice["id"])
        handles = usernames_from_posts(raw)
        _append_used_id(used_ids_file, pid)
        return post_meta_from_api_dict(choice), handles

    if used_ids_file.is_file():
        used_ids_file.write_text("", encoding="utf-8")

    for offset in (0, 50, 100):
        try:
            raw = fetch_discovery_posts(limit=50, offset=offset)
        except Exception as e:
            last_err = str(e)
            continue
        candidates = _posts_with_images(raw)
        if candidates:
            choice = rng.choice(candidates)
            pid = str(choice["id"])
            _append_used_id(used_ids_file, pid)
            return post_meta_from_api_dict(choice), usernames_from_posts(raw)

    if last_err:
        raise RuntimeError(f"Discovery API failed: {last_err}")
    return None


def _pick_random_via_db(
    used_ids_file: Path,
    dsn: str,
    *,
    rng: random.Random,
) -> tuple[PostMeta, list[str]]:
    import psycopg2.extras

    used = _read_used_ids(used_ids_file)
    q_pick = """
    SELECT p.id, p.caption, u.username AS author_username,
      (SELECT pi.url FROM post_images pi WHERE pi.post_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS image_url
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE p.scope = 'everyone'
      AND (p.is_reported IS NOT TRUE)
      AND EXISTS (SELECT 1 FROM post_images pi2 WHERE pi2.post_id = p.id)
    ORDER BY random()
    LIMIT 1
    """

    with _pg_connect(dsn) as conn:
        for _ in range(80):
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(q_pick)
                row = cur.fetchone()
            if not row:
                break
            pid = str(row["id"])
            if pid.lower() in used:
                continue
            img = (row.get("image_url") or "").strip()
            if not img:
                continue
            cap = (row.get("caption") or "").strip()
            meta = PostMeta(
                post_url=_app_url(),
                image_url=img,
                title=cap or "wut u 8",
                author_username=str(row.get("author_username") or "someone").strip(),
                source_post_id=pid,
            )
            handles = _usernames_random_from_db(dsn, 60)
            _append_used_id(used_ids_file, pid)
            return meta, handles

    if used_ids_file.is_file():
        used_ids_file.write_text("", encoding="utf-8")
        with _pg_connect(dsn) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(q_pick)
                row = cur.fetchone()
        if row and (row.get("image_url") or "").strip():
            pid = str(row["id"])
            cap = (row.get("caption") or "").strip()
            meta = PostMeta(
                post_url=_app_url(),
                image_url=str(row["image_url"]).strip(),
                title=cap or "wut u 8",
                author_username=str(row.get("author_username") or "someone").strip(),
                source_post_id=pid,
            )
            handles = _usernames_random_from_db(dsn, 60)
            _append_used_id(used_ids_file, pid)
            return meta, handles

    raise RuntimeError("No public image posts found in database (or connection failed).")


def pick_random_discovery_post(
    used_ids_file: Path,
    *,
    rng: random.Random | None = None,
) -> tuple[PostMeta, list[str]]:
    """
    Pick a random public post with at least one image.

    Prefers the HTTP API when ``WUT8_JWT`` is set; otherwise uses Postgres if
    ``WUT8_DATABASE_URL`` / ``DATABASE_URL`` is set, or the URL embedded in
    ``api/test_recent_posts.js`` in this monorepo.
    """
    rng = rng or random.Random()
    if _jwt_optional():
        out = _pick_random_via_api(used_ids_file, rng=rng)
        if out:
            return out
        raise RuntimeError("Could not pick a post via discovery API.")

    out = _pick_random_via_public_http(used_ids_file, rng=rng)
    if out:
        return out

    dsn = resolve_database_url()
    if dsn:
        return _pick_random_via_db(used_ids_file, dsn, rng=rng)

    raise RuntimeError(
        "Could not pick a post: deploy GET /mp/sample, or set WUT8_JWT, "
        "or provide Postgres (WUT8_DATABASE_URL / api/test_recent_posts.js)."
    )


def manual_post(
    *,
    post_url: str,
    image_url: str,
    title: str,
    author_username: str,
) -> PostMeta:
    return PostMeta(
        post_url=(post_url.strip() or _app_url()),
        image_url=image_url.strip(),
        title=title.strip() or "wut u 8",
        author_username=author_username.strip() or "someone",
        source_post_id=None,
    )

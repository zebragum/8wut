"""Load real on-post comments from the 8wut API or Postgres (optional context for the vision prompt)."""

from __future__ import annotations

import os
import time

import httpx


def _api_base() -> str:
    return (os.environ.get("WUT8_API_URL") or "http://localhost:3001").rstrip("/")


def _jwt() -> str | None:
    v = (os.environ.get("WUT8_JWT") or os.environ.get("JWT") or "").strip()
    return v or None


def fetch_post_comments_for_id(post_id: str, *, delay_sec: float = 0.0) -> list[str]:
    """Return comment bodies for ``post_id`` (UUID)."""
    if delay_sec:
        time.sleep(delay_sec)

    token = _jwt()
    if token:
        url = f"{_api_base()}/posts/{post_id}/comments"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
        }
        with httpx.Client(headers=headers, follow_redirects=True, timeout=45.0) as client:
            r = client.get(url)
            if r.status_code == 404:
                return []
            r.raise_for_status()
            rows = r.json()
        if not isinstance(rows, list):
            return []
        texts: list[str] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            t = (row.get("text") or "").strip()
            if t:
                texts.append(t)
        return texts

    from .fetch_post import (
        fetch_comment_texts_from_db,
        public_api_base,
        resolve_database_url,
    )

    base = public_api_base()
    try:
        with httpx.Client(
            headers={"Accept": "application/json", "User-Agent": "8wut-MoneyPrinter/1.0"},
            timeout=45.0,
        ) as client:
            r = client.get(f"{base}/mp/sample/{post_id}/comments")
            r.raise_for_status()
            arr = r.json()
        if isinstance(arr, list):
            return [str(x).strip() for x in arr if x and str(x).strip()]
    except Exception:
        pass

    dsn = resolve_database_url()
    if dsn:
        return fetch_comment_texts_from_db(post_id, dsn)
    return []

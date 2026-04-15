from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PostMeta:
    post_url: str
    """Shown in the header (default https://8wut.org — link-in-bio destination)."""

    image_url: str
    """First image URL from the post."""

    title: str
    """Caption / post text."""

    author_username: str
    """8wut username of the poster."""

    source_post_id: str | None = None
    """API id when this frame was built from a real post (for loading comments)."""


@dataclass(frozen=True)
class CaricatureLine:
    handle: str
    text: str

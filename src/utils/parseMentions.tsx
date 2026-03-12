import React from 'react';

/**
 * Parses text for @username patterns and returns mixed text/JSX.
 * @mentions are rendered as bold, clickable spans that navigate to that user's profile.
 * Username resolution is done by the caller — we just emit the username as the navigation target.
 */
export function parseMentions(text: string): React.ReactNode[] {
  if (!text) return [text];

  // Match @username (alpha, digits, underscores, hyphens — no spaces)
  const parts = text.split(/(@[A-Za-z0-9_-]+)/g);

  return parts.map((part, i) => {
    if (/^@[A-Za-z0-9_-]+$/.test(part)) {
      const username = part.slice(1); // strip leading @
      return (
        <span
          key={i}
          role="button"
          style={{ fontWeight: 'bold', cursor: 'pointer', color: 'var(--color-skyblue)', userSelect: 'none' }}
          onClick={e => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'profile', username } }));
          }}
        >
          {username}
        </span>
      );
    }
    return part;
  });
}

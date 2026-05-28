import React from 'react';

/**
 * renderLinkedContent(text)
 * ─────────────────────────
 * Parses post text and returns React elements with:
 *  1. Markdown-style links: [label](url) → clickable <a>
 *  2. Bare URLs: https://… http://… www.… → clickable <a>
 *  All other text is preserved as-is (including newlines).
 */

// Markdown link: [text](url)
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

// Bare URL: http(s)://… or www.…
const BARE_URL = /(https?:\/\/[^\s<>[\]()]+|www\.[^\s<>[\]()]+)/g;

// Combined regex: markdown links first (higher priority), then bare URLs
const COMBINED = new RegExp(
  `(\\[[^\\]]+\\]\\(https?:\\/\\/[^\\s)]+\\))|(https?:\\/\\/[^\\s<>\\[\\]()]+|www\\.[^\\s<>\\[\\]()]+)`,
  'g'
);

export function renderLinkedContent(text) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  // Reset regex
  COMBINED.lastIndex = 0;

  while ((match = COMBINED.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Markdown link: [label](url)
      const mdMatch = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/.exec(match[1]);
      if (mdMatch) {
        parts.push(
          <a
            key={`link-${key++}`}
            href={mdMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="post-link"
          >
            {mdMatch[1]}
          </a>
        );
      }
    } else if (match[2]) {
      // Bare URL
      const url = match[2];
      const href = url.startsWith('www.') ? `https://${url}` : url;
      parts.push(
        <a
          key={`link-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="post-link"
        >
          {url}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no links were found, return original text
  if (parts.length === 0) return text;

  return parts;
}

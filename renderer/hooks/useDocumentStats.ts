/**
 * useDocumentStats (renderer/hooks/useDocumentStats.ts)
 *
 * Custom React hook that computes live document statistics for any text-based
 * file open in the editor. Provides word count, character count (no spaces),
 * sentence count, and estimated reading time.
 *
 * No external libraries are used — all counts are computed inline:
 *  - Words:        String.split(/\s+/)
 *  - Characters:   String.replace(/\s/g, "") length
 *  - Sentences:    regex match on /[^.!?]*[.!?]+/g
 *  - Reading time: Math.ceil(words / 200) (200 wpm average)
 *
 * HTML content (Tiptap .txt files) is first stripped to plain text via a
 * temporary DOM element (document.createElement). Debounce is implemented
 * with a plain setTimeout/clearTimeout ref — no external debounce utility.
 *
 * Dependencies (all from React core, no additional packages):
 *  - react: useEffect, useRef, useState
 *
 * Revision History:
 *  • Wesley McDougal - 19APR2026 - Initial implementation
 */
import { useEffect, useRef, useState } from "react";

export interface DocumentStats {
  words: number;
  characters: number;
  sentences: number;
  readingTimeText: string; // e.g. "2 min read"
}

const EMPTY: DocumentStats = {
  words: 0,
  characters: 0,
  sentences: 0,
  readingTimeText: "0 min read",
};

/** Average reading speed in words per minute. */
const WORDS_PER_MINUTE = 200;

/** Count words and compute reading-time text without an external library. */
function computeStats(text: string): { words: number; characters: number; sentences: number; readingTimeText: string } {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, characters: 0, sentences: 0, readingTimeText: "0 min read" };

  const words = trimmed.split(/\s+/).length;
  const characters = text.replace(/\s/g, "").length;
  const sentences = (text.match(/[^.!?]*[.!?]+/g) ?? []).length || 1;
  const minutes = Math.ceil(words / WORDS_PER_MINUTE);
  const readingTimeText = minutes === 1 ? "1 min read" : `${minutes} min read`;

  return { words, characters, sentences, readingTimeText };
}

/** Extract plain text from an HTML string using the DOM parser. */
function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") return html;
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent ?? el.innerText ?? "";
}

/**
 * Computes word / character / sentence counts and estimated reading time for
 * the given content (plain text or HTML). Updates debounced at `delayMs`
 * (default 300 ms) so rapid typing does not cause performance hits.
 */
export function useDocumentStats(
  content: string,
  isHtml = false,
  delayMs = 300
): DocumentStats {
  const [stats, setStats] = useState<DocumentStats>(EMPTY);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const text = isHtml ? htmlToPlainText(content) : content;

      if (!text.trim()) {
        setStats(EMPTY);
        return;
      }

      const { words, characters, sentences, readingTimeText } = computeStats(text);
      setStats({ words, characters, sentences, readingTimeText });
    }, delayMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, isHtml, delayMs]);

  return stats;
}

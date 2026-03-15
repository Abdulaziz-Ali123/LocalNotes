import type { CanvasDocV1 } from "./canvasTypes";

/**
 * File: pageMath.ts
 * Project: LocalNotes
 * Course: EECS 582 Software Engineering Capstone
 *
 * Authors / Contributors:
 * - Malek Kchaou
 *
 * Date Created: 03/14/2026
 * Last Updated: 03/15/2026
 * 
 * Purpose:
 * Contains the layout and coordinate math for the multi-page notebook model.
 *
 * Why this file was introduced:
 * In the old single-page canvas, pointer positions mapped directly into one canvas.
 * In the new multi-page notebook, the app must constantly translate between:
 * - global notebook coordinates (relative to the scrollable document)
 * - local page coordinates (relative to one page)
 *
 * Main responsibilities:
 * - compute page span
 * - determine which page a global Y position belongs to
 * - convert notebook Y into page-local Y
 * - ensure required pages exist as the user draws downward
 * - compute the visible page range for rendering/virtualization
 */

/**
 * Returns the total vertical span occupied by one page plus the inter-page gap.
 *
 * Example:
 * If height = 1600 and gap = 24, then each page occupies 1624 units in notebook space.
 */
export function getPageSpan(doc: CanvasDocV1): number {
  return doc.page.height + doc.page.gap;
}

/**
 * Maps a global notebook Y coordinate to a page index.
 *
 * Example:
 * With page span 1624:
 * - y = 100   -> page 0
 * - y = 1700  -> page 1
 * - y = 3400  -> page 2
 */
export function getPageIndexForGlobalY(doc: CanvasDocV1, y: number): number {
  return Math.max(0, Math.floor(y / getPageSpan(doc)));
}

/**
 * Converts a global notebook Y coordinate into a page-local Y coordinate.
 *
 * Example:
 * If page 1 starts at notebook y = 1624 and the global y is 1700,
 * then the local y on page 1 is 76.
 */
export function getLocalYForGlobalY(doc: CanvasDocV1, y: number, pageIndex: number): number {
  return y - pageIndex * getPageSpan(doc);
}

/**
 * Ensures that the document contains at least the given page index.
 *
 * This supports "unlimited pages" by growing the page list on demand.
 * If the user reaches a page that does not yet exist, we append empty pages
 * until the requested index is valid.
 */
export function ensurePageExists(doc: CanvasDocV1, index: number): CanvasDocV1 {
  const pages = [...doc.pages];

  while (pages.length <= index) {
    pages.push({
      id: `page_${pages.length}`,
      index: pages.length,
      strokes: [],
    });
  }

  return {
    ...doc,
    pages,
  };
}

/**
 * Ensures pages exist through the page implied by a given global Y position.
 *
 * The +1 behavior intentionally preallocates one extra page ahead so the user
 * can continue drawing downward naturally without hitting a hard stop at the bottom.
 */
export function ensurePagesThroughY(doc: CanvasDocV1, y: number): CanvasDocV1 {
  const requiredPage = getPageIndexForGlobalY(doc, y) + 1;
  return ensurePageExists(doc, requiredPage);
}

/**
 * Computes which pages are near the current viewport.
 *
 * This can be used for virtualization or lightweight "nearby page only" rendering.
 * overscanPages keeps a small buffer above and below the visible region so scrolling
 * remains smooth.
 */
export function getVisiblePageRange(
  doc: CanvasDocV1,
  scrollTop: number,
  viewportHeight: number,
  overscanPages = 1
) {
  const pageSpan = getPageSpan(doc);

  const start = Math.max(0, Math.floor(scrollTop / pageSpan) - overscanPages);
  const end = Math.floor((scrollTop + viewportHeight) / pageSpan) + overscanPages;

  return { start, end };
}
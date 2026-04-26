/**
 * Name of code artifact: renderer/components/canvas/strokeSplit.ts
 * Brief description: Supports the multi-page canvas editor data model, page math, rendering, or stroke processing.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Malek Kchaou
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import type {
  CanvasDocV1,
  CanvasPoint,
  GlobalCanvasPoint,
  PageStroke,
} from "./canvasTypes";
import { getLocalYForGlobalY, getPageIndexForGlobalY } from "./pageMath";

/**
 * File: strokeSplit.ts
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
 * Converts one continuous in-progress stroke captured in notebook/global coordinates
 * into one or more page-local stroke fragments.
 *
 * Why this file was introduced:
 * The user should be able to draw naturally across page boundaries as if working
 * in one long notebook. However, the persisted document structure stores strokes
 * per page. This file bridges those two requirements.
 *
 * Main responsibility:
 * Take a temporary global stroke and split it into page-specific strokes so the
 * document can remain structured and reloadable by page.
 */

/**
 * Splits a continuous notebook/global stroke into page-local stroke fragments.
 *
 * Workflow:
 * 1. Each incoming point is classified by which page it belongs to.
 * 2. The global y value is converted into a page-local y value.
 * 3. Consecutive points that belong to the same page are grouped together.
 * 4. Whenever the page changes, the previous page fragment is finalized and stored.
 *
 * Result:
 * The caller receives an array like:
 * - one fragment for page 0
 * - one fragment for page 1
 * - one fragment for page 2
 * depending on how far the stroke traveled.
 *
 * This is the core logic that allows the notebook to feel continuous while still
 * storing pages as separate structured units.
 */
/**
 * Functionality: splitStrokeAcrossPages performs the split stroke across pages workflow used by renderer/components/canvas/strokeSplit.ts.
 * Parameters: doc (CanvasDocV1); points (GlobalCanvasPoint[]); color (string); size (number).
 * Returns: Returns Array<{ pageIndex: number; stroke: PageStroke }>.
 * Usage: Call splitStrokeAcrossPages from the owning module or component when this behavior is required.
 */
export function splitStrokeAcrossPages(
  doc: CanvasDocV1,
  points: GlobalCanvasPoint[],
  color: string,
  size: number
): Array<{ pageIndex: number; stroke: PageStroke }> {
  if (!points.length) return [];

  const result: Array<{ pageIndex: number; stroke: PageStroke }> = [];

  let currentPageIndex: number | null = null;
  let currentPoints: CanvasPoint[] = [];

  for (const p of points) {
    const pageIndex = getPageIndexForGlobalY(doc, p.y);
    const localY = getLocalYForGlobalY(doc, p.y, pageIndex);

    // Ignore points that fall outside the actual page bounds.
    // This is especially useful around page-gap regions.
    if (localY < 0 || localY >= doc.page.height) {
      continue;
    }

    const localPoint: CanvasPoint = {
      x: p.x,
      y: localY,
      t: p.t,
    };

    // Initialize the first fragment.
    if (currentPageIndex === null) {
      currentPageIndex = pageIndex;
      currentPoints = [localPoint];
      continue;
    }

    // If the point belongs to a new page, finalize the old fragment and start a new one.
    if (pageIndex !== currentPageIndex) {
      result.push({
        pageIndex: currentPageIndex,
        stroke: {
          id: crypto.randomUUID(),
          color,
          size,
          points: currentPoints,
        },
      });

      currentPageIndex = pageIndex;
      currentPoints = [localPoint];
    } else {
      currentPoints.push(localPoint);
    }
  }

  // Finalize the last fragment after the loop ends.
  if (currentPageIndex !== null && currentPoints.length > 0) {
    result.push({
      pageIndex: currentPageIndex,
      stroke: {
        id: crypto.randomUUID(),
        color,
        size,
        points: currentPoints,
      },
    });
  }

  return result;
}
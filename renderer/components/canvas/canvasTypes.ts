/**
 * File: canvasTypes.ts
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
 * Defines the core TypeScript data structures used by the multi-page canvas system.
 *
 * Why this file was introduced:
 * The old single-page canvas stored one flat stroke list in a single document shape.
 * The new architecture needs a structured document that can represent multiple pages,
 * page-local strokes, legacy single-page files, and temporary global pointer positions
 * captured while the user is drawing across page boundaries.
 *
 * Main responsibility:
 * Provide a shared vocabulary for the rest of the canvas subsystem:
 * - what a point is
 * - what a stroke is
 * - what a page is
 * - what the persisted multi-page document looks like
 * - what the legacy single-page document looked like
 * - what a temporary global drawing point looks like during active drawing
 * Git-history contributors: Malek Kchaou
 */

/**
 * A point stored inside a page-local stroke.
 * x and y are relative to the page itself, not the whole scrollable notebook.
 * t is optional and can be used later for timing-based features or smoothing.
 */
export interface CanvasPoint {
  x: number;
  y: number;
  t?: number;
}

/**
 * A single persisted stroke that belongs to one page.
 * In the new architecture, strokes are stored per page rather than in one global list.
 */
export interface PageStroke {
  id: string;
  color: string;
  size: number;
  points: CanvasPoint[];
}

/**
 * A single page in the structured multi-page canvas document.
 * Each page owns its own ordered list of strokes.
 */
export interface CanvasPage {
  id: string;
  index: number;
  strokes: PageStroke[];
}

/**
 * Version 1 of the new persisted multi-page canvas document format.
 *
 * page:
 * Stores shared page layout settings so all pages in the notebook use the same
 * dimensions, gap spacing, and background color.
 *
 * pages:
 * Ordered list of pages that make up the scrollable notebook.
 */
export interface CanvasDocV1 {
  type: "localnotes/canvas-document";
  version: 1;
  page: {
    width: number;
    height: number;
    gap: number;
    background: string;
  };
  pages: CanvasPage[];
}

/**
 * Legacy single-page stroke format used before the multi-page rewrite.
 * This is kept so old .canvas files can still be opened and migrated forward.
 */
export interface LegacyStroke {
  color: string;
  size: number;
  points: CanvasPoint[];
}

/**
 * Legacy single-page document format.
 * This represents the old "one canvas, one stroke list" model.
 */
export interface LegacyCanvasDoc {
  version?: number;
  width?: number;
  height?: number;
  background?: string;
  strokes?: LegacyStroke[];
}

/**
 * Temporary point captured during active drawing in notebook/global coordinates.
 *
 * Important distinction:
 * - CanvasPoint is page-local and persisted
 * - GlobalCanvasPoint is notebook-relative and temporary during pointer tracking
 *
 * These points are later split into page-local fragments before saving.
 */
export interface GlobalCanvasPoint {
  x: number;
  y: number;
  t: number;
}
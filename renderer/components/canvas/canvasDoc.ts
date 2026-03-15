import type {
  CanvasDocV1,
  LegacyCanvasDoc,
  PageStroke,
} from "./canvasTypes";

/**
 * File: canvasDoc.ts
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
 * Centralizes creation, parsing, migration, validation, and serialization
 * of the multi-page canvas document format.
 *
 * Why this file was introduced:
 * The editor component should not be responsible for understanding every possible
 * input format. This file isolates document-format concerns so the UI can simply
 * ask for a valid canvas document object.
 *
 * Main responsibilities:
 * - create a new empty multi-page document
 * - detect whether a parsed file is already in the new format
 * - migrate old single-page .canvas files into the new multi-page structure
 * - parse raw JSON safely
 * - serialize the in-memory document back into JSON for persistence
 */

/**
 * Creates a brand-new empty multi-page canvas document.
 *
 * This gives the editor a clean starting state with:
 * - one default page
 * - default dimensions
 * - default spacing between pages
 * - white background
 */
export function createEmptyCanvasDoc(): CanvasDocV1 {
  return {
    type: "localnotes/canvas-document",
    version: 1,
    page: {
      width: 1200,
      height: 1600,
      gap: 24,
      background: "#ffffff",
    },
    pages: [
      {
        id: "page_0",
        index: 0,
        strokes: [],
      },
    ],
  };
}

/**
 * Type guard for the new multi-page canvas document format.
 *
 * This helps us verify that a parsed JSON value already conforms to the new
 * persisted schema before using it directly in the editor.
 */
export function isCanvasDocV1(value: unknown): value is CanvasDocV1 {
  return !!value
    && typeof value === "object"
    && (value as any).type === "localnotes/canvas-document"
    && (value as any).version === 1
    && Array.isArray((value as any).pages);
}

/**
 * Converts a legacy single-page canvas document into the new multi-page format.
 *
 * Migration strategy:
 * - preserve width, height, and background if available
 * - place all old strokes onto page_0
 * - assign generated stroke ids for the new page-based model
 *
 * This allows existing .canvas files created before the notebook rewrite
 * to continue working without data loss.
 */
export function migrateLegacyCanvasDoc(parsed: LegacyCanvasDoc): CanvasDocV1 {
  const pageWidth = parsed.width || 1200;
  const pageHeight = parsed.height || 1600;
  const background = parsed.background || "#ffffff";

  const legacyStrokes: PageStroke[] = (parsed.strokes || []).map((s, i) => ({
    id: `legacy_stroke_${i}`,
    color: s.color,
    size: s.size,
    points: s.points || [],
  }));

  return {
    type: "localnotes/canvas-document",
    version: 1,
    page: {
      width: pageWidth,
      height: pageHeight,
      gap: 24,
      background,
    },
    pages: [
      {
        id: "page_0",
        index: 0,
        strokes: legacyStrokes,
      },
    ],
  };
}

/**
 * Parses raw file content into a valid in-memory canvas document.
 *
 * Supported cases:
 * 1. empty or missing file -> return a fresh blank document
 * 2. valid new multi-page document -> return it directly
 * 3. valid old single-page document -> migrate it to page-based format
 * 4. malformed or unsupported content -> fall back to a blank document
 *
 * This makes canvas loading robust and backward-compatible.
 */
export function parseCanvasDoc(raw: string | undefined | null): CanvasDocV1 {
  if (!raw) return createEmptyCanvasDoc();

  try {
    const parsed = JSON.parse(raw);

    if (isCanvasDocV1(parsed)) {
      // Safety check: even a valid V1 document should always have at least one page.
      if (!parsed.pages.length) {
        return createEmptyCanvasDoc();
      }
      return parsed;
    }

    // Detect the old single-page format by the presence of a top-level strokes array.
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).strokes)) {
      return migrateLegacyCanvasDoc(parsed as LegacyCanvasDoc);
    }

    return createEmptyCanvasDoc();
  } catch {
    return createEmptyCanvasDoc();
  }
}

/**
 * Serializes the current in-memory canvas document to JSON for persistence.
 *
 * This is used by the editor when saving or autosaving .canvas files.
 */
export function serializeCanvasDoc(doc: CanvasDocV1): string {
  return JSON.stringify(doc);
}
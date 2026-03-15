/**
 * File: CanvasEditor.tsx
 * Project: LocalNotes
 * Course: EECS 582 Software Engineering Capstone
 *
 * Authors / Contributors:
 * - Malek Kchaou
 * - If you worked on this file besides me, add your name here when you see this.
 *
 * Date Created: 03/2026
 * Last Updated: 03/2026
 *
 * Change Summary:
 * Refactored the old single-page canvas editor into a vertically scrollable,
 * structured multi-page notebook editor. This version supports page-based storage,
 * automatic page growth while drawing, page-aware undo/clear behavior, and
 * renderer-side orchestration of the multi-page canvas workflow.
 */

/**
 * Purpose:
 * This component is the main controller for the multi-page canvas experience.
 * It owns the current canvas document state, captures pointer input, converts
 * raw pointer motion into structured page-local strokes, and persists updates
 * back to the parent editor through onChange.
 *
 * Why this file exists:
 * The supporting files in the canvas folder each solve one focused problem:
 * - canvasTypes.ts defines the data model
 * - canvasDoc.ts handles parsing/serialization/migration
 * - pageMath.ts handles notebook/page coordinate math
 * - strokeSplit.ts splits continuous strokes across page boundaries
 * - PageCanvas.tsx renders one page
 *
 * This file ties all of those pieces together into the user-facing editor.
 *
 * Role in the multi-page canvas workflow:
 * 1. Load the persisted .canvas file into a structured multi-page document.
 * 2. Track a temporary in-progress stroke in notebook/global coordinates.
 * 3. Auto-scroll and grow pages as the user draws downward.
 * 4. Split the completed stroke into page-specific fragments.
 * 5. Commit those fragments into the page array and serialize the document.
 * 6. Render the scrollable notebook as a stack of page canvases.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

import PageCanvas from "./canvas/PageCanvas";
import {
  type CanvasDocV1,
  type GlobalCanvasPoint,
} from "./canvas/canvasTypes";
import {
  createEmptyCanvasDoc,
  parseCanvasDoc,
  serializeCanvasDoc,
} from "./canvas/canvasDoc";
import {
  ensurePageExists,
  ensurePagesThroughY,
  getVisiblePageRange,
} from "./canvas/pageMath";
import { splitStrokeAcrossPages } from "./canvas/strokeSplit";

/**
 * Props accepted by the canvas editor.
 *
 * value:
 * Raw persisted file content coming from the editor system.
 *
 * onChange:
 * Callback used to push serialized canvas document updates back to the parent.
 *
 * onSave / isSaving:
 * Optional save integration so the canvas editor can reuse the same save controls
 * as the rest of the file editing experience.
 */
interface CanvasEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

/**
 * Auto-scroll configuration.
 *
 * AUTO_SCROLL_EDGE_THRESHOLD:
 * When the pointer gets this close to the top or bottom edge of the viewport
 * during drawing, the notebook begins to scroll.
 *
 * AUTO_SCROLL_STEP:
 * The number of pixels to pan the notebook per pointer-move step while drawing.
 */
const AUTO_SCROLL_EDGE_THRESHOLD = 80;
const AUTO_SCROLL_STEP = 24;

const CanvasEditor: React.FC<CanvasEditorProps> = ({
  value,
  onChange,
  onSave,
  isSaving,
}) => {
  /**
   * Ref to the scrollable notebook container.
   *
   * This is the key DOM element for:
   * - measuring viewport size
   * - reading/writing scrollTop
   * - converting client coordinates into notebook coordinates
   */
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * doc:
   * The current structured multi-page canvas document in memory.
   *
   * activeStroke:
   * Temporary in-progress stroke stored in notebook/global coordinates while
   * the user is actively drawing.
   *
   * isDrawing:
   * Tracks whether a pointer stroke is currently active.
   *
   * visibleRange:
   * Stores the currently relevant page range for nearby-page rendering logic
   * and debug visibility tracking.
   */
  const [doc, setDoc] = useState<CanvasDocV1>(createEmptyCanvasDoc());
  const [activeStroke, setActiveStroke] = useState<GlobalCanvasPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 2 });

  /**
   * Basic drawing tool configuration.
   * These settings are applied when a completed stroke is committed.
   */
  const [currentColor, setCurrentColor] = useState<string>("#111827");
  const [currentSize, setCurrentSize] = useState<number>(4);

  /**
   * Load or reload the canvas document whenever the incoming file content changes.
   *
   * parseCanvasDoc handles:
   * - empty content
   * - valid V1 multi-page content
   * - migration from old single-page canvas JSON
   */
  useEffect(() => {
    setDoc(parseCanvasDoc(value));
  }, [value]);

  /**
   * Temporary debug hook exposed on window for manual DevTools inspection.
   *
   * This was useful during development to verify:
   * - page counts
   * - active stroke points
   * - visible page ranges
   * - scroll container dimensions
   *
   * This can be removed later if no longer needed.
   */
  useEffect(() => {
    (window as any).__canvasDebug = {
      getDoc: () => doc,
      getActiveStroke: () => activeStroke,
      getVisibleRange: () => visibleRange,
      getScrollInfo: () => {
        const el = containerRef.current;
        if (!el) return null;
        return {
          scrollTop: el.scrollTop,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
        };
      },
    };
  }, [doc, activeStroke, visibleRange]);

  /**
   * Commits a fully updated canvas document into local state and immediately
   * serializes it back to the parent editor.
   *
   * This centralizes document persistence behavior so save-worthy updates do not
   * have to manually repeat setDoc + JSON serialization logic everywhere.
   */
  const commitDoc = useCallback(
    (nextDoc: CanvasDocV1) => {
      setDoc(nextDoc);
      onChange(serializeCanvasDoc(nextDoc));
    },
    [onChange]
  );

  /**
   * Converts browser client coordinates into notebook/global coordinates.
   *
   * Why this matters:
   * In the old single-page editor, pointer coordinates could be stored directly
   * relative to one canvas. In the new notebook model, drawing happens inside
   * a scrollable document, so the current scrollTop must be included.
   */
  const getNotebookPos = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();

    return {
      x: clientX - rect.left,
      y: clientY - rect.top + container.scrollTop,
      t: performance.now(),
    };
  }, []);

  /**
   * Recomputes which pages are near the current viewport.
   *
   * This supports nearby-page awareness and can also help with future rendering
   * optimizations or virtualization if desired.
   */
  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    setVisibleRange(
      getVisiblePageRange(doc, container.scrollTop, container.clientHeight, 1)
    );
  }, [doc]);

  /**
   * Refresh the visible range whenever the document changes.
   * This keeps page visibility metadata aligned with content growth and reloads.
   */
  useEffect(() => {
    updateVisibleRange();
  }, [doc, updateVisibleRange]);

  /**
   * Begins a new drawing stroke.
   *
   * Workflow:
   * - capture the pointer
   * - convert the first point into notebook/global coordinates
   * - initialize activeStroke with that first point
   */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const pos = getNotebookPos(e.clientX, e.clientY);
      if (!pos) return;

      setIsDrawing(true);
      setActiveStroke([pos]);
    },
    [getNotebookPos]
  );

  /**
   * Continues an in-progress stroke while the pointer moves.
   *
   * Responsibilities:
   * - auto-scroll the notebook if the pointer nears the top/bottom edge
   * - convert the live pointer position into notebook/global coordinates
   * - append the point to the active stroke
   * - ensure enough pages exist for the current drawing position
   * - refresh visibility information as scrolling changes
   *
   * This is the key handler that gives the notebook its "keep drawing downward"
   * behavior rather than forcing the user to stop at page boundaries.
   */
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDrawing) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      // Auto-pan downward or upward while the pointer stays near the viewport edge.
      if (e.clientY > rect.bottom - AUTO_SCROLL_EDGE_THRESHOLD) {
        container.scrollTop += AUTO_SCROLL_STEP;
      } else if (e.clientY < rect.top + AUTO_SCROLL_EDGE_THRESHOLD) {
        container.scrollTop -= AUTO_SCROLL_STEP;
      }

      const pos = getNotebookPos(e.clientX, e.clientY);
      if (!pos) return;

      setActiveStroke((prev) => [...prev, pos]);

      // Grow the page list on demand so the notebook can extend downward naturally.
      setDoc((prevDoc) => ensurePagesThroughY(prevDoc, pos.y));

      setVisibleRange(
        getVisiblePageRange(doc, container.scrollTop, container.clientHeight, 1)
      );
    },
    [doc, getNotebookPos, isDrawing]
  );

  /**
   * Finalizes the current active stroke.
   *
   * Workflow:
   * 1. If no valid stroke exists, just reset drawing state.
   * 2. Split the temporary notebook/global stroke into page-local fragments.
   * 3. Append each fragment to the correct page.
   * 4. Commit the updated multi-page document.
   *
   * This function is the main bridge from "live pointer input" to
   * "structured persisted page-based strokes."
   */
  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !activeStroke.length) {
      setIsDrawing(false);
      setActiveStroke([]);
      return;
    }

    let nextDoc = doc;

    const fragments = splitStrokeAcrossPages(
      nextDoc,
      activeStroke,
      currentColor,
      currentSize
    );

    for (const fragment of fragments) {
      nextDoc = ensurePageExists(nextDoc, fragment.pageIndex);
      const pages = [...nextDoc.pages];
      const page = pages[fragment.pageIndex];

      pages[fragment.pageIndex] = {
        ...page,
        strokes: [...page.strokes, fragment.stroke],
      };

      nextDoc = {
        ...nextDoc,
        pages,
      };
    }

    commitDoc(nextDoc);
    setIsDrawing(false);
    setActiveStroke([]);
  }, [isDrawing, activeStroke, doc, currentColor, currentSize, commitDoc]);

  /**
   * Removes the most recently committed stroke from the last page that still
   * contains strokes.
   *
   * This is the multi-page equivalent of undoing the last action in the old
   * flat stroke list model.
   */
  const handleUndo = useCallback(() => {
    let lastPageIndex = -1;

    for (let i = doc.pages.length - 1; i >= 0; i--) {
      if (doc.pages[i].strokes.length > 0) {
        lastPageIndex = i;
        break;
      }
    }

    if (lastPageIndex === -1) return;

    const pages = [...doc.pages];
    const page = pages[lastPageIndex];

    pages[lastPageIndex] = {
      ...page,
      strokes: page.strokes.slice(0, -1),
    };

    commitDoc({
      ...doc,
      pages,
    });
  }, [doc, commitDoc]);

  /**
   * Resets the canvas editor to a fresh blank document.
   *
   * In the current implementation, clear returns the notebook to a new
   * single empty page with default layout settings.
   */
  const handleClear = useCallback(() => {
    commitDoc(createEmptyCanvasDoc());
  }, [commitDoc]);

  return (
    /**
     * Root canvas editor layout.
     *
     * Important layout detail:
     * min-h-0 and overflow-hidden are necessary so the notebook container below
     * becomes a real bounded scroll viewport instead of expanding to full content height.
     */
    <div className="flex flex-col h-full min-h-0 w-full bg-background rounded-lg border border-border overflow-hidden">
      {/* Toolbar / controls section */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted">
        <label className="text-xs text-muted-foreground">Color</label>
        <input
          type="color"
          value={currentColor}
          onChange={(e) => setCurrentColor(e.target.value)}
          className="h-6 w-6 p-0 border border-border rounded"
        />

        <label className="text-xs text-muted-foreground ml-2">Size</label>
        <input
          type="range"
          min={1}
          max={24}
          value={currentSize}
          onChange={(e) => setCurrentSize(Number(e.target.value))}
          className="w-24"
        />

        <button
          className="px-2 py-1 text-sm rounded-md bg-background border border-border hover:bg-accent"
          onClick={handleUndo}
          title="Undo last stroke"
        >
          Undo
        </button>

        <button
          className="px-2 py-1 text-sm rounded-md bg-background border border-border hover:bg-accent"
          onClick={handleClear}
          title="Clear canvas"
        >
          Clear
        </button>

        {onSave && (
          <button
            className="px-2 py-1 text-sm rounded-md bg-background border border-border hover:bg-accent ml-auto"
            onClick={onSave}
            disabled={isSaving}
            title="Save canvas"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {/* Scrollable notebook viewport */}
      <div
        ref={containerRef}
        data-canvas-scroll="true"
        className="flex-1 min-h-0 h-0 overflow-y-auto bg-zinc-200"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onScroll={updateVisibleRange}
      >
        {/* Stacked page shells */}
        <div className="py-6">
          {doc.pages.map((page, index) => (
            <div
              key={page.id}
              data-canvas-page={index}
              className="mx-auto mb-6 bg-white shadow border border-zinc-400 relative"
              style={{
                width: doc.page.width,
                height: doc.page.height,
              }}
            >
              {/* Temporary page label added during development/debugging */}
              <div className="absolute top-2 left-2 z-10 text-xs px-2 py-1 rounded bg-black/70 text-white">
                Page {index}
              </div>

              {/* Render a single page using the dedicated per-page canvas component */}
              <PageCanvas
                page={page}
                width={doc.page.width}
                height={doc.page.height}
                background={doc.page.background}
                onPointerDown={handlePointerDown}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CanvasEditor;
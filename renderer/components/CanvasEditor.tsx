/**
 * File: CanvasEditor.tsx
 * Project: LocalNotes
 * Course: EECS 582 Software Engineering Capstone
 *
 * Authors / Contributors:
 * - Malek Kchaou
 * - Wesley McDougal
 * - If you worked on this file besides me, add your name here when you see this.
 *
 * Date Created: 03/2026
 * Last Updated: 03/2026
 *
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Abdulaziz-Ali123
 * Revision History:
 *  • Wesley McDougal - 05APR2026 - Added low-latency overlay stroke rendering and RAF-batched drawing updates
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

interface CanvasEditorProps {
    value: string;
    onChange: (value: string) => void;
    onSave?: () => void;
    isSaving?: boolean;
}

const AUTO_SCROLL_EDGE_THRESHOLD = 80;
const AUTO_SCROLL_STEP = 24;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP_IN = 1.1;
const ZOOM_STEP_OUT = 1 / ZOOM_STEP_IN;

const VIEWPORT_PADDING = 24;

interface MousePanState {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
}

type TouchGestureState =
    | {
        mode: "pan";
        startTouchX: number;
        startTouchY: number;
        startScrollLeft: number;
        startScrollTop: number;
    }
    | {
        mode: "pinch";
        startDistance: number;
        startMidX: number;
        startMidY: number;
        startZoom: number;
        anchorNotebookX: number;
        anchorNotebookY: number;
        startScrollLeft: number;
        startScrollTop: number;
    };

/**
 * Functionality: CanvasEditor performs the canvas editor workflow used by renderer/components/CanvasEditor.tsx.
 * Parameters: { value, onChange, onSave, isSaving, } (inferred).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call CanvasEditor from the owning module or component when this behavior is required.
 */
const CanvasEditor: React.FC<CanvasEditorProps> = ({
    value,
    onChange,
    onSave,
    isSaving,
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const scaledNotebookRef = useRef<HTMLDivElement | null>(null);
    const mousePanRef = useRef<MousePanState | null>(null);
    const touchGestureRef = useRef<TouchGestureState | null>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const activeStrokeRef = useRef<GlobalCanvasPoint[]>([]);
    const pendingRAFRef = useRef<number | null>(null);

    const [doc, setDoc] = useState<CanvasDocV1>(createEmptyCanvasDoc());
    const [activeStroke, setActiveStroke] = useState<GlobalCanvasPoint[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 2 });
    const [zoom, setZoom] = useState<number>(1);

    const [currentColor, setCurrentColor] = useState<string>("#111827");
    const [currentSize, setCurrentSize] = useState<number>(4);

    const notebookHeight = useMemo(() => {
        const pageCount = doc.pages.length;
        if (pageCount === 0) return doc.page.height;

        return (
            pageCount * doc.page.height +
            Math.max(0, pageCount - 1) * doc.page.gap
        );
    }, [doc]);

    const clampZoom = useCallback((value: number) => {
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    }, []);

    useEffect(() => {
        setDoc(parseCanvasDoc(value));
    }, [value]);

    useEffect(() => {
        (window as any).__canvasDebug = {
            getDoc: () => doc,
            getActiveStroke: () => activeStroke,
            getVisibleRange: () => visibleRange,
            getZoom: () => zoom,
            getScrollInfo: () => {
                const el = containerRef.current;
                if (!el) return null;
                return {
                    scrollLeft: el.scrollLeft,
                    scrollTop: el.scrollTop,
                    clientWidth: el.clientWidth,
                    clientHeight: el.clientHeight,
                    scrollWidth: el.scrollWidth,
                    scrollHeight: el.scrollHeight,
                };
            },
        };
    }, [doc, activeStroke, visibleRange, zoom]);

    const commitDoc = useCallback(
        (nextDoc: CanvasDocV1) => {
            setDoc(nextDoc);
            onChange(serializeCanvasDoc(nextDoc));
        },
        [onChange]
    );

    const getNotebookPos = useCallback(
        (clientX: number, clientY: number) => {
            const scaledNotebook = scaledNotebookRef.current;
            if (!scaledNotebook) return null;

            const rect = scaledNotebook.getBoundingClientRect();

            return {
                x: (clientX - rect.left) / zoom,
                y: (clientY - rect.top) / zoom,
                t: performance.now(),
            };
        },
        [zoom]
    );

    const renderOverlayStroke = useCallback(
        (points: GlobalCanvasPoint[], color: string, size: number) => {
            const overlay = overlayCanvasRef.current;
            const scaledNotebook = scaledNotebookRef.current;
            if (!overlay || !scaledNotebook || points.length === 0) return;

            const dpr = window.devicePixelRatio || 1;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (
                overlay.width !== Math.floor(viewportWidth * dpr) ||
                overlay.height !== Math.floor(viewportHeight * dpr)
            ) {
                overlay.width = Math.floor(viewportWidth * dpr);
                overlay.height = Math.floor(viewportHeight * dpr);
                overlay.style.width = `${viewportWidth}px`;
                overlay.style.height = `${viewportHeight}px`;
            }

            const ctx = overlay.getContext("2d");
            if (!ctx) return;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, viewportWidth, viewportHeight);

            const notebookRect = scaledNotebook.getBoundingClientRect();

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = size * zoom;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            const first = points[0];
            ctx.moveTo(
                notebookRect.left + first.x * zoom,
                notebookRect.top + first.y * zoom
            );

            for (let i = 1; i < points.length; i++) {
                const p = points[i];
                ctx.lineTo(
                    notebookRect.left + p.x * zoom,
                    notebookRect.top + p.y * zoom
                );
            }

            ctx.stroke();
        },
        [zoom]
    );

    const updateVisibleRange = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        setVisibleRange(
            getVisiblePageRange(
                doc,
                container.scrollTop / zoom,
                container.clientHeight / zoom,
                2
            )
        );
    }, [doc, zoom]);

    useEffect(() => {
        updateVisibleRange();
    }, [doc, zoom, updateVisibleRange]);

    const applyZoomAtClientPoint = useCallback(
        (nextZoom: number, clientX: number, clientY: number) => {
            const container = containerRef.current;
            const scaledNotebook = scaledNotebookRef.current;
            if (!container || !scaledNotebook) return;

            const clampedZoom = clampZoom(nextZoom);
            const previousZoom = zoom;

            if (Math.abs(clampedZoom - previousZoom) < 0.0001) {
                return;
            }

            const rect = scaledNotebook.getBoundingClientRect();
            const offsetXBefore = clientX - rect.left;
            const offsetYBefore = clientY - rect.top;

            const anchorNotebookX = offsetXBefore / previousZoom;
            const anchorNotebookY = offsetYBefore / previousZoom;

            setZoom(clampedZoom);

            requestAnimationFrame(() => {
                const currentContainer = containerRef.current;
                if (!currentContainer) return;

                currentContainer.scrollLeft +=
                    anchorNotebookX * (clampedZoom - previousZoom);
                currentContainer.scrollTop +=
                    anchorNotebookY * (clampedZoom - previousZoom);

                updateVisibleRange();
            });
        },
        [clampZoom, zoom, updateVisibleRange]
    );

    const zoomAroundViewportCenter = useCallback(
        (nextZoom: number) => {
            const container = containerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            applyZoomAtClientPoint(nextZoom, centerX, centerY);
        },
        [applyZoomAtClientPoint]
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const container = containerRef.current;
            if (!container) return;

            if (e.pointerType === "touch") {
                return;
            }

            const isMiddleMousePan = e.pointerType === "mouse" && e.button === 1;
            const isAltLeftMousePan =
                e.pointerType === "mouse" && e.button === 0 && e.altKey;

            if (isMiddleMousePan || isAltLeftMousePan) {
                e.preventDefault();

                e.currentTarget.setPointerCapture(e.pointerId);

                mousePanRef.current = {
                    pointerId: e.pointerId,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startScrollLeft: container.scrollLeft,
                    startScrollTop: container.scrollTop,
                };

                setIsDrawing(false);
                setActiveStroke([]);
                return;
            }

            const pos = getNotebookPos(e.clientX, e.clientY);
            if (!pos) return;

            e.currentTarget.setPointerCapture(e.pointerId);

            activeStrokeRef.current = [pos];
            setIsDrawing(true);
            setActiveStroke([pos]);

            // Set up overlay canvas
            const overlay = overlayCanvasRef.current;
            if (overlay) {
                const dpr = window.devicePixelRatio || 1;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                overlay.width = Math.floor(viewportWidth * dpr);
                overlay.height = Math.floor(viewportHeight * dpr);
                overlay.style.width = `${viewportWidth}px`;
                overlay.style.height = `${viewportHeight}px`;
                const ctx = overlay.getContext("2d");
                if (ctx) {
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
                }
            }
        },
        [getNotebookPos]
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const container = containerRef.current;
            if (!container) return;

            const panState = mousePanRef.current;
            if (panState && panState.pointerId === e.pointerId) {
                const dx = e.clientX - panState.startClientX;
                const dy = e.clientY - panState.startClientY;

                container.scrollLeft = panState.startScrollLeft - dx;
                container.scrollTop = panState.startScrollTop - dy;

                updateVisibleRange();
                return;
            }

            if (!isDrawing) return;

            const rect = container.getBoundingClientRect();

            if (e.clientY > rect.bottom - AUTO_SCROLL_EDGE_THRESHOLD) {
                container.scrollTop += AUTO_SCROLL_STEP;
            } else if (e.clientY < rect.top + AUTO_SCROLL_EDGE_THRESHOLD) {
                container.scrollTop -= AUTO_SCROLL_STEP;
            }

            const pos = getNotebookPos(e.clientX, e.clientY);
            if (!pos) return;

            // Update ref immediately for next RAF
            activeStrokeRef.current = [...activeStrokeRef.current, pos];

            // Ensure pages exist
            setDoc((prevDoc) => ensurePagesThroughY(prevDoc, pos.y));

            // Cancel pending RAF and queue a new one
            if (pendingRAFRef.current !== null) {
                cancelAnimationFrame(pendingRAFRef.current);
            }

            pendingRAFRef.current = requestAnimationFrame(() => {
                pendingRAFRef.current = null;
                setActiveStroke([...activeStrokeRef.current]);
                renderOverlayStroke(activeStrokeRef.current, currentColor, currentSize);
                updateVisibleRange();
            });
        },
        [getNotebookPos, isDrawing, updateVisibleRange, currentColor, currentSize, renderOverlayStroke]
    );

    const handlePointerUp = useCallback(() => {
        if (mousePanRef.current) {
            mousePanRef.current = null;
            return;
        }

        // Cancel any pending RAF
        if (pendingRAFRef.current !== null) {
            cancelAnimationFrame(pendingRAFRef.current);
            pendingRAFRef.current = null;
        }

        // Clear overlay
        const overlay = overlayCanvasRef.current;
        if (overlay) {
            const ctx = overlay.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
        }

        if (!isDrawing || !activeStrokeRef.current.length) {
            setIsDrawing(false);
            setActiveStroke([]);
            activeStrokeRef.current = [];
            return;
        }

        let nextDoc = doc;

        const fragments = splitStrokeAcrossPages(
            nextDoc,
            activeStrokeRef.current,
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
        activeStrokeRef.current = [];
    }, [isDrawing, doc, currentColor, currentSize, commitDoc]);

    const handleWheel = useCallback(
        (e: React.WheelEvent<HTMLDivElement>) => {
            if (!(e.ctrlKey || e.metaKey)) {
                return;
            }

            e.preventDefault();

            const nextZoom =
                e.deltaY < 0 ? zoom * ZOOM_STEP_IN : zoom * ZOOM_STEP_OUT;

            applyZoomAtClientPoint(nextZoom, e.clientX, e.clientY);
        },
        [zoom, applyZoomAtClientPoint]
    );

    const handleTouchStart = useCallback(
        (e: React.TouchEvent<HTMLDivElement>) => {
            const container = containerRef.current;
            if (!container) return;

            if (e.touches.length === 1) {
                const touch = e.touches[0];

                touchGestureRef.current = {
                    mode: "pan",
                    startTouchX: touch.clientX,
                    startTouchY: touch.clientY,
                    startScrollLeft: container.scrollLeft,
                    startScrollTop: container.scrollTop,
                };

                return;
            }

            if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];

                const dx = t2.clientX - t1.clientX;
                const dy = t2.clientY - t1.clientY;
                const distance = Math.hypot(dx, dy);

                const midX = (t1.clientX + t2.clientX) / 2;
                const midY = (t1.clientY + t2.clientY) / 2;

                const anchor = getNotebookPos(midX, midY);
                if (!anchor) return;

                touchGestureRef.current = {
                    mode: "pinch",
                    startDistance: distance,
                    startMidX: midX,
                    startMidY: midY,
                    startZoom: zoom,
                    anchorNotebookX: anchor.x,
                    anchorNotebookY: anchor.y,
                    startScrollLeft: container.scrollLeft,
                    startScrollTop: container.scrollTop,
                };
            }
        },
        [getNotebookPos, zoom]
    );

    const handleTouchMove = useCallback(
        (e: React.TouchEvent<HTMLDivElement>) => {
            const container = containerRef.current;
            const gesture = touchGestureRef.current;
            if (!container || !gesture) return;

            if (gesture.mode === "pan" && e.touches.length === 1) {
                e.preventDefault();

                const touch = e.touches[0];
                const dx = touch.clientX - gesture.startTouchX;
                const dy = touch.clientY - gesture.startTouchY;

                container.scrollLeft = gesture.startScrollLeft - dx;
                container.scrollTop = gesture.startScrollTop - dy;

                updateVisibleRange();
                return;
            }

            if (gesture.mode === "pinch" && e.touches.length === 2) {
                e.preventDefault();

                const t1 = e.touches[0];
                const t2 = e.touches[1];

                const dx = t2.clientX - t1.clientX;
                const dy = t2.clientY - t1.clientY;
                const distance = Math.hypot(dx, dy);

                const midX = (t1.clientX + t2.clientX) / 2;
                const midY = (t1.clientY + t2.clientY) / 2;

                const nextZoom = clampZoom(
                    gesture.startZoom * (distance / gesture.startDistance)
                );

                const midShiftX = midX - gesture.startMidX;
                const midShiftY = midY - gesture.startMidY;

                setZoom(nextZoom);

                requestAnimationFrame(() => {
                    const currentContainer = containerRef.current;
                    if (!currentContainer) return;

                    currentContainer.scrollLeft =
                        gesture.startScrollLeft +
                        gesture.anchorNotebookX * (nextZoom - gesture.startZoom) -
                        midShiftX;

                    currentContainer.scrollTop =
                        gesture.startScrollTop +
                        gesture.anchorNotebookY * (nextZoom - gesture.startZoom) -
                        midShiftY;

                    updateVisibleRange();
                });
            }
        },
        [clampZoom, updateVisibleRange]
    );

    const handleTouchEnd = useCallback(() => {
        touchGestureRef.current = null;
        updateVisibleRange();
    }, [updateVisibleRange]);

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

    const handleClear = useCallback(() => {
        commitDoc(createEmptyCanvasDoc());
    }, [commitDoc]);

    const isPageInVisibleRange = useCallback(
        (index: number) => index >= visibleRange.start && index <= visibleRange.end,
        [visibleRange]
    );

    return (
        <div className="flex flex-col h-full min-h-0 w-full bg-background rounded-lg border border-border overflow-hidden">
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

                <div className="ml-2 flex items-center gap-1">
                    <button
                        className="px-2 py-1 text-sm rounded-md bg-background border border-border hover:bg-accent"
                        onClick={() => zoomAroundViewportCenter(zoom * ZOOM_STEP_OUT)}
                        title="Zoom out"
                    >
                        -
                    </button>

                    <button
                        className="px-2 py-1 text-sm rounded-md bg-background border border-border hover:bg-accent min-w-[72px]"
                        onClick={() => setZoom(1)}
                        title="Reset zoom"
                    >
                        {Math.round(zoom * 100)}%
                    </button>

                    <button
                        className="px-2 py-1 text-sm rounded-md bg-background border border-border hover:bg-accent"
                        onClick={() => zoomAroundViewportCenter(zoom * ZOOM_STEP_IN)}
                        title="Zoom in"
                    >
                        +
                    </button>
                </div>

                <div className="ml-2 text-[11px] text-muted-foreground">
                    Ctrl/Cmd + wheel: zoom | Middle mouse or Alt+drag: pan | Touch: pan/pinch
                </div>

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

            <div
                ref={containerRef}
                data-canvas-scroll="true"
                className="flex-1 min-h-0 h-0 overflow-auto bg-zinc-200"
                style={{
                    touchAction: "none",
                    cursor: mousePanRef.current ? "grabbing" : isDrawing ? "crosshair" : "default",
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onScroll={updateVisibleRange}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
            >
                <canvas
                    ref={overlayCanvasRef}
                    className="fixed pointer-events-none z-50"
                    style={{
                        left: 0,
                        top: 0,
                        display: isDrawing ? "block" : "none",
                    }}
                />
                <div
                    className="relative"
                    style={{
                        width: doc.page.width * zoom + VIEWPORT_PADDING * 2,
                        height: notebookHeight * zoom + VIEWPORT_PADDING * 2,
                        padding: VIEWPORT_PADDING,
                    }}
                >
                    <div
                        ref={scaledNotebookRef}
                        style={{
                            width: doc.page.width * zoom,
                            height: notebookHeight * zoom,
                        }}
                    >
                        <div
                            style={{
                                width: doc.page.width,
                                height: notebookHeight,
                                transform: `scale(${zoom})`,
                                transformOrigin: "top left",
                            }}
                        >
                            <div>
                                {doc.pages.map((page, index) => {
                                    const showRealCanvas = isPageInVisibleRange(index);

                                    return (
                                        <div
                                            key={page.id}
                                            data-canvas-page={index}
                                            className="bg-white shadow border border-zinc-400 relative"
                                            style={{
                                                width: doc.page.width,
                                                height: doc.page.height,
                                                marginBottom:
                                                    index === doc.pages.length - 1 ? 0 : doc.page.gap,
                                            }}
                                        >
                                            <div className="absolute top-2 left-2 z-10 text-xs px-2 py-1 rounded bg-black/70 text-white">
                                                Page {index}
                                            </div>

                                            {showRealCanvas ? (
                                                <PageCanvas
                                                    page={page}
                                                    width={doc.page.width}
                                                    height={doc.page.height}
                                                    background={doc.page.background}
                                                    onPointerDown={handlePointerDown}
                                                />
                                            ) : (
                                                <div
                                                    className="w-full h-full"
                                                    style={{ background: doc.page.background }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CanvasEditor;
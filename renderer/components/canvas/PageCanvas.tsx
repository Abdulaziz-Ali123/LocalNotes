/**
 * File: PageCanvas.tsx
 * Project: LocalNotes
 * Course: EECS 582 Software Engineering Capstone
 *
 * Authors / Contributors:
 * - Malek Kchaou
 *
 * Date Created: 03/14/2026
 * Last Updated: 03/29/2026
 *
 * Purpose:
 * Renders one notebook page onto its own HTML canvas element.
 *
 * Why this file was introduced:
 * The old implementation drew everything onto a single canvas surface.
 * In the new multi-page architecture, each page is an independent drawing surface.
 * This component isolates the rendering of one page so the main editor component
 * can focus on document state, scrolling, and pointer handling.
 *
 * Main responsibilities:
 * - size the page canvas correctly
 * - apply device pixel ratio scaling for crisp rendering
 * - paint the page background
 * - redraw all persisted strokes for that page
 * - forward pointer-down events back to the editor for drawing orchestration
 * Git-history contributors: Malek Kchaou
 */

import React, { useEffect, useRef } from "react";
import type { CanvasPage } from "./canvasTypes";

/**
 * Props for one page canvas.
 *
 * onPointerDown is forwarded back to the parent editor so the parent can decide
 * whether the interaction should begin drawing or panning.
 */
interface PageCanvasProps {
    page: CanvasPage;
    width: number;
    height: number;
    background: string;
    onPointerDown?: (
        e: React.PointerEvent<HTMLCanvasElement>,
        pageIndex: number
    ) => void;
}

/**
 * PageCanvas is a pure page renderer.
 * It does not know about the whole notebook or persistence.
 * It simply redraws the page whenever its page-level drawing inputs change.
 */
/**
 * Functionality: PageCanvasComponent performs the page canvas component workflow used by renderer/components/canvas/PageCanvas.tsx.
 * Parameters: { page, width, height, background, onPointerDown, } (PageCanvasProps).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call PageCanvasComponent from the owning module or component when this behavior is required.
 */
function PageCanvasComponent({
    page,
    width,
    height,
    background,
    onPointerDown,
}: PageCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    /**
     * Redraw the full page whenever page content or layout inputs change.
     *
     * Key rendering steps:
     * 1. Resize internal canvas using device pixel ratio
     * 2. Reset transform and clear old pixels
     * 3. Paint the page background
     * 4. Replay each saved stroke in order
     */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Reset to device-pixel-aware coordinates.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        // Paint the configured page background first.
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);

        // Replay every stored stroke in draw order.
        for (const stroke of page.strokes) {
            if (!stroke.points.length) continue;

            ctx.beginPath();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

            for (let i = 1; i < stroke.points.length; i++) {
                const p = stroke.points[i];
                ctx.lineTo(p.x, p.y);
            }

            ctx.stroke();
        }
    }, [page, width, height, background]);

    return (
        <canvas
            ref={canvasRef}
            className="block"
            style={{
                /**
                 * touchAction none prevents the browser from hijacking touch gestures
                 * before the editor can interpret them as pan or pinch.
                 */
                touchAction: "none",
            }}
            onPointerDown={(e) => onPointerDown?.(e, page.index)}
        />
    );
}

/**
 * React.memo prevents unchanged pages from rerendering when viewport-only state
 * changes elsewhere in the notebook.
 *
 * This is especially helpful once notebooks grow to many pages.
 */
const PageCanvas = React.memo(PageCanvasComponent);

PageCanvas.displayName = "PageCanvas";

export default PageCanvas;
/**
 * Name of code artifact: renderer/components/ui/skeleton.tsx
 * Brief description: Defines reusable renderer UI primitives used throughout the LocalNotes interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

"use client";

import * as React from "react";
import { cn } from "../../lib/util";

/**
 * Functionality: Skeleton performs the skeleton workflow used by renderer/components/ui/skeleton.tsx.
 * Parameters: { className, ...props } (React.ComponentProps<"div">).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call Skeleton from the owning module or component when this behavior is required.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} className={cn("animate-pulse bg-muted rounded", className)} />;
}

export default Skeleton;

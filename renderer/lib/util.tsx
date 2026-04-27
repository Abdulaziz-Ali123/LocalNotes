/**
 * Name of code artifact: renderer/lib/util.tsx
 * Brief description: Provides renderer utility logic shared by LocalNotes components.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Functionality: cn performs the cn workflow used by renderer/lib/util.tsx.
 * Parameters: inputs (ClassValue[]).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call cn from the owning module or component when this behavior is required.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

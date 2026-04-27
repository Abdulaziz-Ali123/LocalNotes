/**
 * Name of code artifact: renderer/components/hooks/use-mobile.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { useEffect, useState } from "react";

/**
 * Functionality: useIsMobile performs the use is mobile workflow used by renderer/components/hooks/use-mobile.tsx.
 * Parameters: breakpoint (inferred).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call useIsMobile from the owning module or component when this behavior is required.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
        /**
     * Functionality: onResize performs the on resize workflow used by renderer/components/hooks/use-mobile.tsx.
     * Parameters: None.
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call onResize from the owning module or component when this behavior is required.
     */
const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;

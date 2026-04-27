/**
 * useKeybindings hook
 *
 * Registers keyboard event listeners based on the current keybinding settings
 * from the Zustand store. Action IDs (e.g. "file.save") are mapped to handler
 * callbacks provided by consuming components.
 *
 * This replaces the old hardcoded useKeyboardShortcuts hook with a
 * settings-driven version.
 * Git-history contributors: Shaun
 */

import { useEffect, useMemo } from "react";
import { useBoundStore } from "@/renderer/store/useBoundStore";

/** Map of action IDs to callback functions. */
export type KeybindingHandlers = Partial<Record<string, () => void>>;

interface UseKeybindingsOptions {
  handlers: KeybindingHandlers;
  enabled?: boolean;
}

/**
 * Parse an Electron accelerator string into a matchable shape.
 *
 * We need to normalise things like "CommandOrControl" to the platform's
 * actual modifier key for matching against KeyboardEvent.
 */
interface ParsedAccelerator {
  ctrl: boolean; // Ctrl (Windows/Linux) or Cmd (Mac)
  shift: boolean;
  alt: boolean;
  key: string; // the non-modifier key, lowercased
}

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");

/**
 * Functionality: parseAccelerator performs the parse accelerator workflow used by renderer/hooks/useKeybindings.ts.
 * Parameters: accel (string).
 * Returns: Returns ParsedAccelerator | null.
 * Usage: Call parseAccelerator from the owning module or component when this behavior is required.
 */
function parseAccelerator(accel: string): ParsedAccelerator | null {
  if (!accel || typeof accel !== "string") return null;

  const parts = accel.split("+");
  let ctrl = false;
  let shift = false;
  let alt = false;
  let key = "";

  for (const part of parts) {
    const p = part.trim();
    if (
      p === "CommandOrControl" ||
      p === "CmdOrCtrl" ||
      p === "Command" ||
      p === "Control" ||
      p === "Ctrl" ||
      p === "Cmd"
    ) {
      ctrl = true;
    } else if (p === "Shift") {
      shift = true;
    } else if (p === "Alt" || p === "Option") {
      alt = true;
    } else {
      key = p.toLowerCase();
    }
  }

  if (!key) return null;
  return { ctrl, shift, alt, key };
}

/**
 * Functionality: matchesEvent performs the matches event workflow used by renderer/hooks/useKeybindings.ts.
 * Parameters: parsed (ParsedAccelerator); e (KeyboardEvent).
 * Returns: Returns boolean.
 * Usage: Call matchesEvent from the owning module or component when this behavior is required.
 */
function matchesEvent(parsed: ParsedAccelerator, e: KeyboardEvent): boolean {
  const modKey = isMac ? e.metaKey : e.ctrlKey;
  if (parsed.ctrl !== modKey) return false;
  if (parsed.shift !== e.shiftKey) return false;
  if (parsed.alt !== e.altKey) return false;

  // Normalise event key for comparison
  let eventKey = e.key.toLowerCase();
  if (eventKey === " ") eventKey = "space";
  else if (eventKey === "arrowup") eventKey = "up";
  else if (eventKey === "arrowdown") eventKey = "down";
  else if (eventKey === "arrowleft") eventKey = "left";
  else if (eventKey === "arrowright") eventKey = "right";

  return eventKey === parsed.key;
}

/**
 * Functionality: useKeybindings performs the use keybindings workflow used by renderer/hooks/useKeybindings.ts.
 * Parameters: { handlers, enabled = true } (UseKeybindingsOptions).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call useKeybindings from the owning module or component when this behavior is required.
 */
export function useKeybindings({ handlers, enabled = true }: UseKeybindingsOptions) {
  const keybindings = useBoundStore((s) => s.settings.global.keybindings);

  // Build a lookup: parsed accelerator -> action ID
  const parsedBindings = useMemo(() => {
    const bindings: { parsed: ParsedAccelerator; actionId: string }[] = [];
    if (keybindings && typeof keybindings === "object") {
      for (const [actionId, accel] of Object.entries(keybindings)) {
        if (typeof accel === "string") {
          const parsed = parseAccelerator(accel);
          if (parsed) {
            bindings.push({ parsed, actionId });
          }
        }
      }
    }
    return bindings;
  }, [keybindings]);

  useEffect(() => {
    if (!enabled) return;

        /**
     * Functionality: handleKeyDown performs the handle key down workflow used by renderer/hooks/useKeybindings.ts.
     * Parameters: e (KeyboardEvent).
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call handleKeyDown from the owning module or component when this behavior is required.
     */
const handleKeyDown = (e: KeyboardEvent) => {
      for (const { parsed, actionId } of parsedBindings) {
        if (matchesEvent(parsed, e)) {
          const handler = handlers[actionId];
          if (handler) {
            e.preventDefault();
            handler();
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [parsedBindings, handlers, enabled]);
}

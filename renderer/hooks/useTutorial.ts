/**
 * useTutorial (renderer/hooks/useTutorial.ts)
 *
 * React hook that manages the first-time user tutorial powered by Driver.js.
 * Auto-starts on first visit by checking localStorage, and exposes a
 * startTutorial() function for replay. Accepts an optional onReset callback
 * to restore the UI to a known state before the tour begins.
 *
 * Revision History:
 *  • Wesley McDougal - 23APR2026 - Initial implementation
 */

import { useEffect, useRef, useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { editorTutorialSteps } from "@/renderer/lib/tutorial-steps";

const TUTORIAL_DONE_KEY = "localnotes-tutorial-done";

interface UseTutorialOptions {
  /**
   * Called synchronously before the tour starts. Use this to reset the UI
   * to a known state (e.g. open the files panel) by setting React state
   * directly, rather than relying on DOM clicks that may toggle panels closed.
   */
  onReset?: () => void;
}

export function useTutorial({ onReset }: UseTutorialOptions = {}) {
  // Keep a stable ref to the driver instance so we can destroy it on unmount
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  // Keep a stable ref to onReset so startTutorial's useCallback doesn't
  // need it as a dependency (avoids re-creating the function on every render).
  const onResetRef = useRef(onReset);
  useEffect(() => { onResetRef.current = onReset; }, [onReset]);

  const startTutorial = useCallback(() => {
    // Destroy any previous instance before starting a fresh one
    driverRef.current?.destroy();

    // Reset the UI to the files panel before starting so the tour always
    // begins from a known state regardless of what the user had open.
    onResetRef.current?.();

    driverRef.current = driver({
      showProgress: true,
      animate: true,
      showButtons: ["next", "close"],
      steps: editorTutorialSteps,
      onDestroyed: () => {
        // Mark as seen so it does not auto-start next time
        localStorage.setItem(TUTORIAL_DONE_KEY, "true");
      },
    });

    driverRef.current.drive();
  }, []);

  useEffect(() => {
    // Only auto-start if the user has never seen the tutorial
    const alreadySeen = localStorage.getItem(TUTORIAL_DONE_KEY);
    if (alreadySeen) return;

    // Small delay so all DOM elements with data-tutorial IDs are mounted
    const timer = setTimeout(() => {
      startTutorial();
    }, 800);

    return () => {
      clearTimeout(timer);
      // Clean up driver instance if the component unmounts mid-tour
      driverRef.current?.destroy();
    };
  }, [startTutorial]);

  return { startTutorial };
}

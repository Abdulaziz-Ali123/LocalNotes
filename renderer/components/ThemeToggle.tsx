/**
 * Name of code artifact: renderer/components/ThemeToggle.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: m518n748
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { useEffect, useState } from "react";
import { getStoredTheme, storeTheme, applyTheme, ThemeType } from "@/renderer/lib/theme";

/**
 * Functionality: ThemeToggle performs the theme toggle workflow used by renderer/components/ThemeToggle.tsx.
 * Parameters: None.
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call ThemeToggle from the owning module or component when this behavior is required.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeType>(getStoredTheme() || "nord");

    /**
   * Functionality: toggleTheme performs the toggle theme workflow used by renderer/components/ThemeToggle.tsx.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call toggleTheme from the owning module or component when this behavior is required.
   */
function toggleTheme() {
    let next: ThemeType = "nord";
    if (theme === "nord") next = "light";
    else if (theme === "light") next = "dark";
    else next = "nord";

    setTheme(next);
    applyTheme(next);
    storeTheme(next);
  }

  // Ensure DOM is updated if stored theme changes
  useEffect(() => {
    applyTheme(theme);
  }, []);

  return (
    <button
      onClick={toggleTheme}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        cursor: "pointer",
        border: "1px solid var(--border-color)",
        background: "var(--btn-bg)",
        color: "var(--text-color)",
      }}
    >
      {theme === "light" ? "🌙 Dark Mode" : theme === "dark" ? "☀️ Light Mode" : "❄️ Nord Mode"}
    </button>
  );
}

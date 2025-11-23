import { useEffect, useState } from "react";
import { getStoredTheme, storeTheme, applyTheme } from "@/renderer/lib/theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(getStoredTheme());

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
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
      {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
    </button>
  );
}

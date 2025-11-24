import { useEffect, useState } from "react";
import { getStoredTheme, storeTheme, applyTheme, ThemeType } from "@/renderer/lib/theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeType>(getStoredTheme() || "nord");

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

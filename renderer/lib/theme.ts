import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeType = "light" | "dark" | "nord" | "cozy" | "darker";

export const DEFAULT_THEME = "nord";

const THEME_KEY = "app-theme";

const ThemeContext = createContext<{
  theme: ThemeType;
  setTheme: (t: ThemeType) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    try {
      const stored = loadStoredTheme();
      return stored ?? DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);

  const setTheme = (t: ThemeType) => setThemeState(t);

  return React.createElement(ThemeContext.Provider, { value: { theme, setTheme } }, children);
}

// Load stored theme
export function loadStoredTheme(): ThemeType | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(THEME_KEY) as ThemeType) || null;
}

// Save theme
export function storeTheme(theme: ThemeType) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
}

// Apply theme by toggling class on <html>
export function applyTheme(theme: ThemeType) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("overflow-hidden", "max-h-screen");

  // Remove any theme classes first
  root.classList.remove("theme-nord");
  root.classList.remove("theme-light");
  root.classList.remove("theme-dark");
  root.classList.remove("theme-cozy");
  root.classList.remove("theme-darker");

  // Add the appropriate classes for the selected theme
  if (theme === "dark") {
    root.classList.add("theme-dark");
  } else if (theme === "nord") {
    root.classList.add("theme-nord");
  } else if (theme === "cozy") {
    root.classList.add("theme-cozy");
  } else if (theme === "darker") {
    root.classList.add("theme-darker");
  } else {
    root.classList.add("theme-light");
  }
}

export function getStoredTheme(): ThemeType | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(THEME_KEY) as ThemeType) || null;
}


export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
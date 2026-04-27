/**
 * Theme Engine - Manages built-in and custom theme support with live preview and WCAG contrast validation.
 *
 * Key Responsibilities:
 * 1. ThemeProvider context component - initializes theme state from settings on mount, syncs with Zustand store
 * 2. applyTheme(theme, customThemes) - applies theme class to document root and dispatches token overrides
 * 3. applyThemeTokenOverrides(tokens) - sets CSS custom properties on root element for custom theme colors
 * 4. clearThemeTokenOverrides() - removes all CSS property overrides (used when switching away from custom theme)
 * 5. contrastRatio(foreground, background) - calculates WCAG relative luminance for contrast validation
 * 6. relativeLuminance(hexColor) - converts sRGB hex to linear luminance per WCAG 2.1 spec
 * 7. createCustomThemeId(name) - generates unique theme ID from name + random suffix
 * 8. isBuiltInTheme(theme) - type guard to distinguish built-in themes from custom theme IDs
 * 9. Constants: BUILT_IN_THEMES array, DEFAULT_CUSTOM_THEME_TOKENS, TOKEN_TO_CSS_VAR mapping
 * 10. Type definitions: BuiltInThemeType, CustomThemeTokens (20 color tokens), CustomThemeDefinition
 *
 * Git-history contributors: Wesley McDougal; Shaun; Abdulaziz-Ali123; m518n748
 * Revision History:
 * - 29 MAR 2026: Wesley McDougal - Theme engine overhaul with custom token support, contrast ratio calculation, CSS variable application, and synchronization with settings store.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { useBoundStore } from "@/renderer/store/useBoundStore";

export type BuiltInThemeType = "light" | "dark" | "nord" | "cozy" | "darker";
export type ThemeType = string;

export interface CustomThemeTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
}

export interface CustomThemeDefinition {
  id: string;
  name: string;
  tokens: CustomThemeTokens;
}

export const BUILT_IN_THEMES: BuiltInThemeType[] = [
  "nord",
  "light",
  "dark",
  "cozy",
  "darker",
];

export const DEFAULT_CUSTOM_THEME_TOKENS: CustomThemeTokens = {
  background: "#21252e",
  foreground: "#eceff4",
  card: "#2e3440",
  cardForeground: "#eceff4",
  primary: "#88c0d0",
  primaryForeground: "#2e3440",
  secondary: "#3b4252",
  secondaryForeground: "#eceff4",
  muted: "#3b4252",
  mutedForeground: "#d8dee9",
  accent: "#81a1c1",
  accentForeground: "#eceff4",
  border: "#4c566a",
  input: "#4c566a",
  ring: "#81a1c1",
  sidebar: "#3b4252",
  sidebarForeground: "#eceff4",
  sidebarAccent: "#81a1c1",
  sidebarAccentForeground: "#eceff4",
  sidebarBorder: "#4c566a",
};

export const DEFAULT_THEME = "nord";

const THEME_KEY = "app-theme";

const ThemeContext = createContext<{
  theme: ThemeType;
  customThemes: Record<string, CustomThemeDefinition>;
  setTheme: (t: ThemeType) => void;
} | null>(null);

/**
 * React context provider that manages theme state and persistence.
 * Initializes theme from localStorage (fast first-paint), then syncs with Zustand settings store.
 * Re-applies theme whenever active theme or customThemes object changes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settingsLoaded = useBoundStore((s) => s.settings.loaded);
  const settingsTheme = useBoundStore(
    (s) => s.settings.global.appearance.theme
  ) as ThemeType;
  const customThemes = useBoundStore(
    (s) => s.settings.global.appearance.customThemes
  ) as Record<string, CustomThemeDefinition>;
  const setGlobal = useBoundStore((s) => s.settings.setGlobal);

  const [theme, setThemeState] = useState<ThemeType>(() => {
    try {
      // On first render (before settings load), fall back to localStorage for
      // backward compatibility so the user doesn't see a flash of wrong theme.
      const stored = loadStoredTheme();
      return stored ?? DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  });

  // Once settings are loaded from the main process, sync theme.
  useEffect(() => {
    if (settingsLoaded && settingsTheme) {
      setThemeState(settingsTheme);
    }
  }, [settingsLoaded, settingsTheme]);

  useEffect(() => {
    applyTheme(theme, customThemes ?? {});
    // Keep localStorage in sync for backward-compat / quick first-paint
    storeTheme(theme);
  }, [theme, customThemes]);

    /**
   * Functionality: setTheme performs the set theme workflow used by renderer/lib/theme.ts.
   * Parameters: t (ThemeType).
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call setTheme from the owning module or component when this behavior is required.
   */
const setTheme = (t: ThemeType) => {
    setThemeState(t);
    // Persist to the settings system (writes to JSON on disk via main process)
    setGlobal("appearance.theme", t);
  };

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, customThemes: customThemes ?? {}, setTheme } },
    children
  );
}

/**
 * Retrieves theme from localStorage fallback (used for fast first-paint before settings load).
 * Returns null if no stored theme found or window is undefined (SSR).
 */
export function loadStoredTheme(): ThemeType | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(THEME_KEY) as ThemeType) || null;
}

/**
 * Persists theme to localStorage for backward-compatibility and quick first-render display.
 * Does not update persistent settings storage (that happens via setGlobal in ThemeProvider).
 */
/**
 * Functionality: storeTheme performs the store theme workflow used by renderer/lib/theme.ts.
 * Parameters: theme (ThemeType).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call storeTheme from the owning module or component when this behavior is required.
 */
export function storeTheme(theme: ThemeType) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * Applies theme class to document root (<html> element) and dispatches token overrides for custom themes.
 * Removes old theme classes first, then adds appropriate class (e.g., theme-nord, theme-dark).
 * For custom themes, also calls applyThemeTokenOverrides to set CSS variables.
 */
/**
 * Functionality: applyTheme performs the apply theme workflow used by renderer/lib/theme.ts.
 * Parameters: theme (ThemeType); customThemes (Record<string, CustomThemeDefinition>).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call applyTheme from the owning module or component when this behavior is required.
 */
export function applyTheme(
  theme: ThemeType,
  customThemes: Record<string, CustomThemeDefinition> = {}
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("overflow-hidden", "max-h-screen");

  // Remove any theme classes first
  root.classList.remove("theme-nord");
  root.classList.remove("theme-light");
  root.classList.remove("theme-dark");
  root.classList.remove("theme-cozy");
  root.classList.remove("theme-darker");

  const maybeCustom = customThemes[theme];
  if (maybeCustom) {
    root.classList.add("theme-nord");
    applyThemeTokenOverrides(maybeCustom.tokens);
    return;
  }

  clearThemeTokenOverrides();

  // Add the appropriate classes for the selected built-in theme
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

/**
 * Alias for loadStoredTheme() - retrieves theme from localStorage.
 */
/**
 * Functionality: getStoredTheme performs the get stored theme workflow used by renderer/lib/theme.ts.
 * Parameters: None.
 * Returns: Returns ThemeType | null.
 * Usage: Call getStoredTheme from the owning module or component when this behavior is required.
 */
export function getStoredTheme(): ThemeType | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(THEME_KEY) as ThemeType) || null;
}

const TOKEN_TO_CSS_VAR: Record<keyof CustomThemeTokens, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
  sidebarAccent: "--sidebar-accent",
  sidebarAccentForeground: "--sidebar-accent-foreground",
  sidebarBorder: "--sidebar-border",
};

/**
 * Sets CSS custom properties on document root for all 20 theme color tokens.
 * Maps token keys to CSS variable names (e.g., background → --background).
 * Used when applying custom themes to override default built-in colors.
 */
export function applyThemeTokenOverrides(tokens: CustomThemeTokens): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  for (const key of Object.keys(TOKEN_TO_CSS_VAR) as Array<keyof CustomThemeTokens>) {
    const cssVar = TOKEN_TO_CSS_VAR[key];
    root.style.setProperty(cssVar, tokens[key]);
  }
}

/**
 * Removes all CSS custom property overrides from document root.
 * Called when switching from custom theme to built-in theme.
 */
/**
 * Functionality: clearThemeTokenOverrides performs the clear theme token overrides workflow used by renderer/lib/theme.ts.
 * Parameters: None.
 * Returns: Returns void.
 * Usage: Call clearThemeTokenOverrides from the owning module or component when this behavior is required.
 */
export function clearThemeTokenOverrides(): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  for (const cssVar of Object.values(TOKEN_TO_CSS_VAR)) {
    root.style.removeProperty(cssVar);
  }
}

/**
 * Type guard that returns true if themeId is one of the built-in themes (nord, light, dark, cozy, darker).
 * Used to distinguish custom theme IDs from built-in theme names.
 */
/**
 * Functionality: isBuiltInTheme performs the is built in theme workflow used by renderer/lib/theme.ts.
 * Parameters: themeId (string).
 * Returns: Returns themeId is BuiltInThemeType.
 * Usage: Call isBuiltInTheme from the owning module or component when this behavior is required.
 */
export function isBuiltInTheme(themeId: string): themeId is BuiltInThemeType {
  return BUILT_IN_THEMES.includes(themeId as BuiltInThemeType);
}

/**
 * Generates a unique theme ID from theme name by slugifying and appending random 6-char suffix.
 * Example: "My Theme" → custom-my-theme-a1b2c3
 */
/**
 * Functionality: createCustomThemeId performs the create custom theme id workflow used by renderer/lib/theme.ts.
 * Parameters: name (string).
 * Returns: Returns string.
 * Usage: Call createCustomThemeId from the owning module or component when this behavior is required.
 */
export function createCustomThemeId(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `custom-${base || "theme"}-${suffix}`;
}

/**
 * Functionality: srgbToLinear performs the srgb to linear workflow used by renderer/lib/theme.ts.
 * Parameters: value (number).
 * Returns: Returns number.
 * Usage: Call srgbToLinear from the owning module or component when this behavior is required.
 */
function srgbToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Converts hex color to relative luminance per WCAG 2.1 standard.
 * Used as intermediate step for contrast ratio calculation.
 * Converts sRGB to linear RGB, then applies standard luminance formula.
 */
function relativeLuminance(hexColor: string): number {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 0;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Functionality: hexToRgb performs the hex to rgb workflow used by renderer/lib/theme.ts.
 * Parameters: hexColor (string).
 * Returns: Returns { r: number; g: number; b: number } | null.
 * Usage: Call hexToRgb from the owning module or component when this behavior is required.
 */
function hexToRgb(hexColor: string): { r: number; g: number; b: number } | null {
  const normalized = hexColor.trim().replace(/^#/, "");
  if (![3, 6].includes(normalized.length)) return null;
  const full = normalized.length === 3
    ? normalized
        .split("")
        .map((c) => `${c}${c}`)
        .join("")
    : normalized;

  const parsed = Number.parseInt(full, 16);
  if (Number.isNaN(parsed)) return null;

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

/**
 * Calculates WCAG contrast ratio between two hex colors using relative luminance.
 * Returns value like 4.5:1 (WCAG AA standard). Higher ratio = better contrast.
 * Formula: (lighter + 0.05) / (darker + 0.05)
 */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}


/**
 * React hook to access theme context (theme name, customThemes object, setTheme callback).
 * Must be used inside <ThemeProvider>; throws error if context not found.
 */
/**
 * Functionality: useTheme performs the use theme workflow used by renderer/lib/theme.ts.
 * Parameters: None.
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call useTheme from the owning module or component when this behavior is required.
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
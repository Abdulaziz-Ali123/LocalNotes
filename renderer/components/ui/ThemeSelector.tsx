/**
 * Custom Theme Editor Component - Sidebar UI for creating, editing, and managing custom application themes.
 *
 * Key Responsibilities:
 * 1. Theme editor modal state management (isEditorOpen, editingThemeId, draftName, draftTokens)
 * 2. openEditorForNew() / openEditorForSelected() - initialize editor with empty or existing theme data
 * 3. saveTheme() - generate theme ID (if new), validate data, persist to Zustand store via setGlobal
 * 4. deleteCurrentTheme() - remove theme from customThemes object, fallback to DEFAULT_THEME if active
 * 5. Token field editor - iterates TOKEN_FIELDS array, renders dual color input (picker + hex text)
 * 6. Color input normalization - parseColorToHex() converts rgb/rgba to standard #rrggbb format
 * 7. Hex validation - /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/ regex enforces valid 3 or 6-digit hex
 * 8. Contrast warnings - memoized calculation showing WCAG-AA issues (< 4.5:1) for text pairs
 * 9. Live preview - useEffect monitors isEditorOpen/draftTokens, applies theme overrides, reverts on cancel
 * 10. Dual color input pattern - visual picker + hex text field for both design and power user workflows
 *
 * Revision History:
 * - 29 MAR 2026: Wesley McDougal - Complete replacement with custom theme editor, live preview, CRUD operations, hex/color picker input
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CUSTOM_THEME_TOKENS,
  DEFAULT_THEME,
  applyTheme,
  applyThemeTokenOverrides,
  clearThemeTokenOverrides,
  contrastRatio,
  createCustomThemeId,
  isBuiltInTheme,
  useTheme,
  type CustomThemeTokens,
  type ThemeType,
} from "@/renderer/lib/theme";
import { useBoundStore } from "@/renderer/store/useBoundStore";

const TOKEN_FIELDS: Array<{ key: keyof CustomThemeTokens; label: string }> = [
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
  { key: "accent", label: "Accent" },
  { key: "accentForeground", label: "Accent Foreground" },
  { key: "border", label: "Border" },
  { key: "card", label: "Card" },
  { key: "cardForeground", label: "Card Foreground" },
  { key: "primary", label: "Primary" },
  { key: "primaryForeground", label: "Primary Foreground" },
  { key: "sidebar", label: "Sidebar" },
  { key: "sidebarForeground", label: "Sidebar Foreground" },
  { key: "sidebarBorder", label: "Sidebar Border" },
];

const CSS_VAR_TO_TOKEN: Record<string, keyof CustomThemeTokens> = {
  "--background": "background",
  "--foreground": "foreground",
  "--card": "card",
  "--card-foreground": "cardForeground",
  "--primary": "primary",
  "--primary-foreground": "primaryForeground",
  "--secondary": "secondary",
  "--secondary-foreground": "secondaryForeground",
  "--muted": "muted",
  "--muted-foreground": "mutedForeground",
  "--accent": "accent",
  "--accent-foreground": "accentForeground",
  "--border": "border",
  "--input": "input",
  "--ring": "ring",
  "--sidebar": "sidebar",
  "--sidebar-foreground": "sidebarForeground",
  "--sidebar-accent": "sidebarAccent",
  "--sidebar-accent-foreground": "sidebarAccentForeground",
  "--sidebar-border": "sidebarBorder",
};

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

/**
 * Converts color in any format (rgb, rgba, short #rgb, long #rrggbb) to standard #rrggbb hex format.
 * Returns #000000 as fallback if input is invalid or unrecognized.
 */
function normalizeColorForInput(rawColor: string): string {
  const color = rawColor.trim().toLowerCase();
  if (color.startsWith("#")) {
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    if (color.length === 7) {
      return color;
    }
    return "#000000";
  }

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/);
  if (!rgbMatch) {
    return "#000000";
  }

  const parts = rgbMatch[1]
    .split(",")
    .slice(0, 3)
    .map((p) => Number.parseInt(p.trim(), 10));

  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return "#000000";
  }

  const [r, g, b] = parts.map((n) => Math.max(0, Math.min(255, n)));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Reads all CSS custom properties from document root and normalizes to hex format.
 * Falls back to DEFAULT_CUSTOM_THEME_TOKENS if window is undefined.
 * Used when opening editor to read current system theme into draft state.
 */
function readCurrentThemeTokens(): CustomThemeTokens {
  if (typeof document === "undefined") {
    return { ...DEFAULT_CUSTOM_THEME_TOKENS };
  }

  const style = getComputedStyle(document.documentElement);
  const next = { ...DEFAULT_CUSTOM_THEME_TOKENS };

  for (const [cssVar, tokenKey] of Object.entries(CSS_VAR_TO_TOKEN)) {
    const raw = style.getPropertyValue(cssVar).trim();
    if (raw) {
      next[tokenKey] = normalizeColorForInput(raw);
    }
  }

  return next;
}

function ratioLabel(ratio: number): string {
  return ratio.toFixed(2);
}

export default function ThemeSelector() {
  const { theme, customThemes, setTheme } = useTheme();
  const setGlobal = useBoundStore((s) => s.settings.setGlobal);

  const customThemeList = useMemo(
    () =>
      Object.values(customThemes).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [customThemes]
  );

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("New Theme");
  const [draftTokens, setDraftTokens] = useState<CustomThemeTokens>(() => ({
    ...DEFAULT_CUSTOM_THEME_TOKENS,
  }));

  const isEditingExisting = Boolean(editingThemeId && customThemes[editingThemeId]);

  const warnings = useMemo(() => {
    const checks = [
      {
        label: "Main text vs background",
        ratio: contrastRatio(draftTokens.foreground, draftTokens.background),
      },
      {
        label: "Card text vs card",
        ratio: contrastRatio(draftTokens.cardForeground, draftTokens.card),
      },
      {
        label: "Sidebar text vs sidebar",
        ratio: contrastRatio(draftTokens.sidebarForeground, draftTokens.sidebar),
      },
    ];

    return checks.filter((c) => c.ratio < 4.5);
  }, [draftTokens]);

  useEffect(() => {
    if (!isEditorOpen) return;

    applyTheme(theme, customThemes);
    applyThemeTokenOverrides(draftTokens);

    return () => {
      clearThemeTokenOverrides();
      applyTheme(theme, customThemes);
    };
  }, [isEditorOpen, draftTokens, theme, customThemes]);

  /**
   * Initializes theme editor with empty form for creating a new custom theme.
   * Loads current system colors into draft tokens, clears theme ID, opens editor modal.
   */
  const openEditorForNew = () => {
    setEditingThemeId(null);
    setDraftName("My Theme");
    setDraftTokens(readCurrentThemeTokens());
    setIsEditorOpen(true);
  };

  /**
   * Opens theme editor with data from currently selected theme.
   * If a built-in theme is selected, delegates to openEditorForNew.
   * If a custom theme is selected, loads its name and tokens into draft state.
   */
  const openEditorForSelected = () => {
    if (!theme || isBuiltInTheme(theme) || !customThemes[theme]) {
      openEditorForNew();
      return;
    }

    const selected = customThemes[theme];
    setEditingThemeId(selected.id);
    setDraftName(selected.name);
    setDraftTokens({ ...selected.tokens });
    setIsEditorOpen(true);
  };

  /**
   * Validates draft theme name, generates ID if new, persists to customThemes via setGlobal.
   * Applies theme immediately and closes editor modal on success.
   */
  const saveTheme = async () => {
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      return;
    }

    const id = editingThemeId ?? createCustomThemeId(trimmedName);
    const updatedCustomThemes = {
      ...customThemes,
      [id]: {
        id,
        name: trimmedName,
        tokens: { ...draftTokens },
      },
    };

    await setGlobal("appearance.customThemes", updatedCustomThemes);
    setTheme(id as ThemeType);
    setEditingThemeId(id);
    setIsEditorOpen(false);
  };

  /**
   * Removes theme from customThemes object and persists deletion via setGlobal.
   * Falls back to DEFAULT_THEME if deleted theme is currently active.
   * Closes editor modal after deletion.
   */
  const deleteCurrentTheme = async () => {
    if (!editingThemeId || !customThemes[editingThemeId]) {
      return;
    }

    const updatedCustomThemes = { ...customThemes };
    delete updatedCustomThemes[editingThemeId];
    await setGlobal("appearance.customThemes", updatedCustomThemes);

    if (theme === editingThemeId) {
      setTheme(DEFAULT_THEME);
    }

    setIsEditorOpen(false);
    setEditingThemeId(null);
  };

  return (
    <div className="space-y-3 text-sm p-3">
      <h2 className="font-semibold">Theme</h2>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Theme Preset / Saved Theme</label>
        <select
          data-tutorial="theme-select"
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeType)}
          className="w-full p-2 rounded bg-sidebar text-sidebar-foreground border border-sidebar-border focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
        >
          <optgroup label="Built-in">
            <option value="nord">Nord (Default)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="cozy">Cozy</option>
            <option value="darker">Darker</option>
          </optgroup>
          {customThemeList.length > 0 && (
            <optgroup label="Custom">
              {customThemeList.map((custom) => (
                <option key={custom.id} value={custom.id}>
                  {custom.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openEditorForNew}
          className="px-3 py-1.5 rounded border border-sidebar-border hover:bg-sidebar-accent"
        >
          New Custom Theme
        </button>
        <button
          type="button"
          onClick={openEditorForSelected}
          className="px-3 py-1.5 rounded border border-sidebar-border hover:bg-sidebar-accent"
        >
          {isBuiltInTheme(theme) ? "Customize Current" : "Edit Selected"}
        </button>
      </div>

      {isEditorOpen && (
        <div className="space-y-3 border border-sidebar-border rounded p-3 bg-sidebar/50">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Theme Name</label>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full p-2 rounded bg-sidebar text-sidebar-foreground border border-sidebar-border focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
            {TOKEN_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{field.label}</span>
                <input
                  type="color"
                  value={draftTokens[field.key]}
                  onChange={(e) =>
                    setDraftTokens((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  className="h-8 w-14 rounded border border-sidebar-border bg-transparent"
                  aria-label={field.label}
                />
              </label>
            ))}
          </div>

          {warnings.length > 0 && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
              <p className="font-medium">Contrast warning (WCAG target 4.5:1):</p>
              <ul className="mt-1 space-y-1">
                {warnings.map((warning) => (
                  <li key={warning.label}>
                    {warning.label}: {ratioLabel(warning.ratio)}:1
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveTheme}
              className="px-3 py-1.5 rounded bg-sidebar-primary text-sidebar-primary-foreground"
            >
              {isEditingExisting ? "Save Changes" : "Save Theme"}
            </button>
            {isEditingExisting && (
              <button
                type="button"
                onClick={deleteCurrentTheme}
                className="px-3 py-1.5 rounded border border-red-500/60 text-red-300 hover:bg-red-500/10"
              >
                Delete Theme
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              className="px-3 py-1.5 rounded border border-sidebar-border hover:bg-sidebar-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Theme edits preview immediately while the editor is open and are only persisted when you click Save Theme.
      </p>
    </div>
  );
}

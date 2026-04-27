/**
 * Zustand settings slice.
 *
 * Loads settings from the main process on init and keeps them in sync.
 * Exposes setter helpers that persist changes via IPC and update local state.
 *
 * Git-history contributors: Wesley McDougal; Abdulaziz Ali; Shaun
 * Revision History:
 *  • Wesley McDougal - 29MAR2026 - Custom theme types and initial state
 *  • Wesley McDougal - 05APR2026 - Added sidebar layout types/defaults and persisted appearance layout state
 *  • Wesley McDougal - 07APR2026 - Added defaultModelId to AiSettings, loadError +
 *    retryLoad to SettingsSlice, and try/catch in initialize() to surface load failures.
 *  • Wesley McDougal - 19APR2026 - Added StatusBarSettings interface and statusBar field to EditorSettings;
 *    updated INITIAL_GLOBAL with statusBar defaults
 */

import { StateCreator } from "zustand";

// Re-declare the types inline so the renderer doesn't import from main/.
// These mirror main/settings/schema.ts exactly.

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

export type SidebarPosition = "left" | "right";
export type SidebarEdge = "left" | "right" | "bottom";
export type SidebarRailAlignment = "start" | "center" | "end";
export type SidebarLayoutScope = "global" | "project";

export interface SidebarLayoutSettings {
  panelPosition: SidebarPosition;
  rails: Record<SidebarEdge, string[]>;
  railAlignment: Record<SidebarEdge, SidebarRailAlignment>;
}

export interface AppearanceSettings {
  theme: ThemeType;
  fontSize: number;
  fontFamily: string;
  customThemes: Record<string, CustomThemeDefinition>;
  sidebarLayout: SidebarLayoutSettings;
  sidebarLayoutScope: SidebarLayoutScope;
}

export interface EditorSettings {
  autosaveEnabled: boolean;
  autosaveIntervalMs: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
}

export interface KeybindingMap {
  [key: string]: string;
}

export interface ModelCapabilities {
  fileUpload: boolean;
  voice: boolean;
  thinking: boolean;
}

export interface AiModelConfig {
  capabilities: ModelCapabilities;
}

export interface CustomModel {
  id: string;
  name: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  capabilities: ModelCapabilities;
}

export interface AiSettings {
  endpointUrl: string;
  apiKey: string;
  defaultRagEnabled: boolean;
  /** The user's currently preferred/active AI model. Written by
   *  handleModelSelect in AIChatPanel and read on new-chat creation so the
   *  last-used model is pre-selected across sessions. */
  defaultModelId?: string; // user's preferred model
  modelConfigs: Record<string, AiModelConfig>;
  customModels: CustomModel[];
}

export interface TrashSettings {
  autoPurgeDays: number;
}

export interface GlobalSettings {
  appearance: AppearanceSettings;
  editor: EditorSettings;
  trash: TrashSettings;
  keybindings: KeybindingMap;
  ai: AiSettings;
}

export interface KeybindingAction {
  id: string;
  label: string;
  category: "File" | "Edit" | "View";
  defaultAccelerator: string;
}

// ---------------------------------------------------------------------------
// Slice shape
// ---------------------------------------------------------------------------

export interface SettingsSlice {
  settings: {
    /** Whether settings have been loaded from main at least once. */
    loaded: boolean;
    /** Error message if settings failed to load; null when healthy.
     *  Displayed as a red retry banner in AIChatPanel. */
    loadError: string | null;
    /** The resolved global settings (defaults + overrides). */
    global: GlobalSettings;
    /** Registry of all bindable keybinding actions (from main). */
    keybindingActions: KeybindingAction[];

    /** Load settings from the main process. Call once on app init. */
    initialize: () => Promise<void>;

    /**
     * Update a single global setting by dot-path.
     * Persists to main process and updates local state.
     */
    setGlobal: (dotPath: string, value: any) => Promise<void>;

    /** Reset a single global setting to its default. */
    resetGlobal: (dotPath: string) => Promise<void>;

    /** Reset ALL global settings to defaults. */
    resetAllGlobal: () => Promise<void>;

    /** Directly replace the local settings state (used by onChange listener). */
    _replaceGlobal: (settings: GlobalSettings) => void;

    /** Retry loading settings after a failure: clears loadError then re-runs
     *  initialize(). Called by the Retry button in the AIChatPanel error banner.
     */
    retryLoad: () => Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// Default keybinding actions (renderer-side copy so the UI works immediately
// even before the main process IPC call completes)
// ---------------------------------------------------------------------------

const DEFAULT_KEYBINDING_ACTIONS: KeybindingAction[] = [
  { id: "app.openCommandPalette", label: "Open Command Palette", category: "View", defaultAccelerator: "CommandOrControl+K" },
  { id: "file.save", label: "Save", category: "File", defaultAccelerator: "CommandOrControl+S" },
  { id: "file.open", label: "Open Folder", category: "File", defaultAccelerator: "CommandOrControl+O" },
  { id: "file.newFile", label: "New File", category: "File", defaultAccelerator: "CommandOrControl+N" },
  { id: "file.newFolder", label: "New Folder", category: "File", defaultAccelerator: "CommandOrControl+Shift+N" },
  { id: "edit.undo", label: "Undo", category: "Edit", defaultAccelerator: "CommandOrControl+Z" },
  { id: "edit.redo", label: "Redo", category: "Edit", defaultAccelerator: "CommandOrControl+Shift+Z" },
  { id: "view.toggleSidebar", label: "Toggle Sidebar", category: "View", defaultAccelerator: "CommandOrControl+B" },
  { id: "view.togglePreview", label: "Toggle Preview", category: "View", defaultAccelerator: "CommandOrControl+P" },
  { id: "view.toggleLivePreview", label: "Toggle Live Preview", category: "View", defaultAccelerator: "CommandOrControl+Shift+P" },
  { id: "view.search", label: "Search", category: "View", defaultAccelerator: "CommandOrControl+F" },
  { id: "view.toggleDevTools", label: "Toggle Developer Tools", category: "View", defaultAccelerator: "CommandOrControl+Shift+I" },
];

const DEFAULT_KEYBINDINGS: KeybindingMap = Object.fromEntries(
  DEFAULT_KEYBINDING_ACTIONS.map((a) => [a.id, a.defaultAccelerator])
);

// ---------------------------------------------------------------------------
// Default AI model capabilities
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {};

const INITIAL_AI: AiSettings = {
  endpointUrl: "http://localhost:11434",
  apiKey: "",
  defaultRagEnabled: false,
  defaultModelId: undefined,
  modelConfigs: {},
  customModels: [],
};

const DEFAULT_SIDEBAR_ICON_ORDER = [
  "file",
  "search",
  "import",
  "ai",
  "theme",
  "tags",
  "trash",
  "share",
  "settings",
  "history",
];

const DEFAULT_SIDEBAR_RAILS = {
  left: [...DEFAULT_SIDEBAR_ICON_ORDER],
  right: [],
  top: [],
  bottom: [],
};

const DEFAULT_SIDEBAR_RAIL_ALIGNMENT = {
  left: "start",
  right: "start",
  top: "center",
  bottom: "center",
} as const;

// ---------------------------------------------------------------------------
// Default state (before loading)
// ---------------------------------------------------------------------------

const INITIAL_GLOBAL: GlobalSettings = {
  appearance: {
    theme: "nord",
    fontSize: 14,
    fontFamily: "monospace",
    customThemes: {},
    sidebarLayout: {
      panelPosition: "left",
      rails: {
        left: [...DEFAULT_SIDEBAR_RAILS.left],
        right: [...DEFAULT_SIDEBAR_RAILS.right],
        bottom: [...DEFAULT_SIDEBAR_RAILS.bottom],
      },
      railAlignment: {
        left: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.left,
        right: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.right,
        bottom: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.bottom,
      },
    },
    sidebarLayoutScope: "global",
  },
  editor: {
    autosaveEnabled: true,
    autosaveIntervalMs: 10_000,
    wordWrap: true,
    showLineNumbers: false,
  },
  trash: {
    autoPurgeDays: 30,
  },
  keybindings: DEFAULT_KEYBINDINGS,
  ai: INITIAL_AI,
};

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

/**
 * Functionality: createSettingsSlice performs the create settings slice workflow used by renderer/store/settings-slice.ts.
 * Parameters: set (inferred).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call createSettingsSlice from the owning module or component when this behavior is required.
 */
export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [],
  [],
  SettingsSlice
> = (set) => ({
  settings: {
    loaded: false,
    loadError: null,
    global: INITIAL_GLOBAL,
    keybindingActions: DEFAULT_KEYBINDING_ACTIONS,

    initialize: async () => {
      try {
        // window.settings may not exist if preload hasn't loaded yet
        if (typeof window === "undefined" || !window.settings) {
          set((state) => ({
            settings: { ...state.settings, loaded: true, loadError: null },
          }));
          return;
        }

        const [globalSettings, keybindingActions] = await Promise.all([
          window.settings.getGlobal(),
          window.settings.getKeybindingActions(),
        ]);

        set((state) => ({
          settings: {
            ...state.settings,
            loaded: true,
            loadError: null,
            global: globalSettings ?? INITIAL_GLOBAL,
            keybindingActions:
              keybindingActions && keybindingActions.length > 0
                ? keybindingActions
                : DEFAULT_KEYBINDING_ACTIONS,
          },
        }));

        // Listen for future changes pushed from main process
        window.settings.onChange((updated: GlobalSettings) => {
          set((state) => ({
            settings: {
              ...state.settings,
              global: updated,
            },
          }));
        });
      } catch (err: any) {
        console.error("Failed to load settings from main process:", err);
        // Store the error message so the UI can surface a retry banner.
        // Using state rather than throwing keeps the app usable with defaults.
        const errorMsg = err?.message || "Failed to load settings";
        set((state) => ({
          settings: {
            ...state.settings,
            loaded: true,
            loadError: errorMsg,
          },
        }));
      }
    },

    setGlobal: async (dotPath: string, value: any) => {
      try {
        const updated = await window.settings.setGlobal(dotPath, value);
        set((state) => ({
          settings: {
            ...state.settings,
            global: updated,
          },
        }));
      } catch (err) {
        console.error("Failed to set global setting:", err);
      }
    },

    resetGlobal: async (dotPath: string) => {
      try {
        const updated = await window.settings.resetGlobal(dotPath);
        set((state) => ({
          settings: {
            ...state.settings,
            global: updated,
          },
        }));
      } catch (err) {
        console.error("Failed to reset global setting:", err);
      }
    },

    resetAllGlobal: async () => {
      try {
        const updated = await window.settings.resetAllGlobal();
        set((state) => ({
          settings: {
            ...state.settings,
            global: updated,
          },
        }));
      } catch (err) {
        console.error("Failed to reset all global settings:", err);
      }
    },

    _replaceGlobal: (newSettings: GlobalSettings) => {
      set((state) => ({
        settings: {
          ...state.settings,
          global: newSettings,
        },
      }));
    },

    retryLoad: async () => {
      // Clear previous error and try loading again.
      // We call window.settings directly here to avoid a circular dependency
      // with useBoundStore (this slice IS part of that store).
      set((state) => ({
        settings: {
          ...state.settings,
          loadError: null,
        },
      }));
      try {
        if (typeof window === "undefined" || !window.settings) return;
        const [globalSettings, keybindingActions] = await Promise.all([
          window.settings.getGlobal(),
          window.settings.getKeybindingActions(),
        ]);
        set((state) => ({
          settings: {
            ...state.settings,
            loaded: true,
            loadError: null,
            global: globalSettings ?? state.settings.global,
            keybindingActions:
              keybindingActions && keybindingActions.length > 0
                ? keybindingActions
                : state.settings.keybindingActions,
          },
        }));
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to load settings";
        set((state) => ({
          settings: { ...state.settings, loaded: true, loadError: errorMsg },
        }));
      }
    },
  },
});

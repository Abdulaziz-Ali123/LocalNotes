/**
 * Zustand settings slice.
 *
 * Loads settings from the main process on init and keeps them in sync.
 * Exposes setter helpers that persist changes via IPC and update local state.
 */

import { StateCreator } from "zustand";

// Re-declare the types inline so the renderer doesn't import from main/.
// These mirror main/settings/schema.ts exactly.

export type ThemeType = "light" | "dark" | "nord" | "cozy" | "darker";

export interface AppearanceSettings {
  theme: ThemeType;
  fontSize: number;
  fontFamily: string;
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
  modelConfigs: Record<string, AiModelConfig>;
  customModels: CustomModel[];
}

export interface GlobalSettings {
  appearance: AppearanceSettings;
  editor: EditorSettings;
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
  };
}

// ---------------------------------------------------------------------------
// Default keybinding actions (renderer-side copy so the UI works immediately
// even before the main process IPC call completes)
// ---------------------------------------------------------------------------

const DEFAULT_KEYBINDING_ACTIONS: KeybindingAction[] = [
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

export const DEFAULT_MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  "llama3.2":    { fileUpload: false, voice: true,  thinking: false },
  "mistral":     { fileUpload: false, voice: true,  thinking: false },
  "gemma2":      { fileUpload: false, voice: true,  thinking: false },
  "phi3":        { fileUpload: false, voice: true,  thinking: false },
  "codellama":   { fileUpload: false, voice: true,  thinking: false },
  "deepseek-r1": { fileUpload: false, voice: true,  thinking: true  },
  "qwen2.5":     { fileUpload: false, voice: true,  thinking: true  },
  "llava":       { fileUpload: true,  voice: true,  thinking: false },
};

const INITIAL_AI: AiSettings = {
  endpointUrl: "http://localhost:11434",
  apiKey: "",
  modelConfigs: Object.fromEntries(
    Object.entries(DEFAULT_MODEL_CAPABILITIES).map(([id, caps]) => [
      id,
      { capabilities: caps },
    ])
  ),
  customModels: [],
};

// ---------------------------------------------------------------------------
// Default state (before loading)
// ---------------------------------------------------------------------------

const INITIAL_GLOBAL: GlobalSettings = {
  appearance: {
    theme: "nord",
    fontSize: 14,
    fontFamily: "monospace",
  },
  editor: {
    autosaveEnabled: true,
    autosaveIntervalMs: 10_000,
    wordWrap: true,
    showLineNumbers: false,
  },
  keybindings: DEFAULT_KEYBINDINGS,
  ai: INITIAL_AI,
};

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [],
  [],
  SettingsSlice
> = (set) => ({
  settings: {
    loaded: false,
    global: INITIAL_GLOBAL,
    keybindingActions: DEFAULT_KEYBINDING_ACTIONS,

    initialize: async () => {
      try {
        // window.settings may not exist if preload hasn't loaded yet
        if (typeof window === "undefined" || !window.settings) {
          set((state) => ({
            settings: { ...state.settings, loaded: true },
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
      } catch (err) {
        console.error("Failed to load settings from main process:", err);
        // Keep defaults — the UI still works, just without persisted overrides
        set((state) => ({
          settings: { ...state.settings, loaded: true },
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
  },
});

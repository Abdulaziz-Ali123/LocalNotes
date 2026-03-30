/**
 * Default values for all settings.
 *
 * This file is the single source of truth for what every setting should be
 * when the user hasn't explicitly changed it. The settings manager deep-merges
 * the user's sparse overrides on top of these defaults.
 * 
  * Revision History:
 *  • Wesley McDougal - 29MAR2026 - Default customThemes object and schema version bump to number 2
 */

import {
  GlobalSettings,
  ProjectSettings,
  KeybindingMap,
  AppearanceSettings,
  EditorSettings,
} from "./schema";

// ---------------------------------------------------------------------------
// Section defaults
// ---------------------------------------------------------------------------

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "nord",
  fontSize: 14,
  fontFamily: "monospace",
  customThemes: {},
};

export const DEFAULT_EDITOR: EditorSettings = {
  autosaveEnabled: true,
  autosaveIntervalMs: 10_000,
  wordWrap: true,
  showLineNumbers: false,
};

export const DEFAULT_KEYBINDINGS: KeybindingMap = {
  "file.save": "CommandOrControl+S",
  "file.open": "CommandOrControl+O",
  "file.newFile": "CommandOrControl+N",
  "file.newFolder": "CommandOrControl+Shift+N",
  "edit.undo": "CommandOrControl+Z",
  "edit.redo": "CommandOrControl+Shift+Z",
  "view.toggleSidebar": "CommandOrControl+B",
  "view.togglePreview": "CommandOrControl+P",
  "view.toggleLivePreview": "CommandOrControl+Shift+P",
  "view.search": "CommandOrControl+F",
  "view.toggleDevTools": "CommandOrControl+Shift+I",
};

export const DEFAULT_LLM = {
    defaultModelId: null,
    models: {},
};

export const DEFAULT_AI = {
  endpointUrl: "http://localhost:11434",
  apiKey: "",
  defaultRagEnabled: false,
  modelConfigs: {},
  customModels: [],
};

// ---------------------------------------------------------------------------
// Composite defaults
// ---------------------------------------------------------------------------

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  appearance: { ...DEFAULT_APPEARANCE },
  editor: { ...DEFAULT_EDITOR },
  keybindings: { ...DEFAULT_KEYBINDINGS },
  llm: {
    defaultModelId: DEFAULT_LLM.defaultModelId,
    models: { ...DEFAULT_LLM.models },
  },
  ai: { ...DEFAULT_AI },
};

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  editor: { ...DEFAULT_EDITOR },
};

/**
 * The current schema version. Bump this whenever the schema shape changes
 * and add a corresponding migration in migrations.ts.
 */
export const LATEST_SCHEMA_VERSION = 2;

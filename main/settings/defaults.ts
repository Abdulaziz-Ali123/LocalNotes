/**
 * Default values for all settings.
 *
 * This file is the single source of truth for what every setting should be
 * when the user hasn't explicitly changed it. The settings manager deep-merges
 * the user's sparse overrides on top of these defaults.
 *
 * Revision History:
 *  • Wesley McDougal - 29MAR2026 - Default customThemes object and schema version bump to number 2
 *  • Wesley McDougal - 05APR2026 - Added sidebar layout defaults and updated schema version for sidebar layout persistence
 *  • Wesley McDougal - 19APR2026 - Added statusBar defaults to DEFAULT_EDITOR; bumped LATEST_SCHEMA_VERSION to 6
 */

import {
  GlobalSettings,
  ProjectSettings,
  KeybindingMap,
  AppearanceSettings,
  EditorSettings,
  SidebarLayoutSettings,
} from "./schema";

// ---------------------------------------------------------------------------
// Section defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SIDEBAR_ICON_ORDER = [
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

export const DEFAULT_SIDEBAR_RAILS = {
  left: [...DEFAULT_SIDEBAR_ICON_ORDER],
  right: [],
  top: [],
  bottom: [],
};

export const DEFAULT_SIDEBAR_RAIL_ALIGNMENT = {
  left: "start",
  right: "start",
  top: "center",
  bottom: "center",
} as const;

export const DEFAULT_SIDEBAR_LAYOUT: SidebarLayoutSettings = {
  panelPosition: "left",
  rails: {
    left: [...DEFAULT_SIDEBAR_RAILS.left],
    right: [...DEFAULT_SIDEBAR_RAILS.right],
    top: [...DEFAULT_SIDEBAR_RAILS.top],
    bottom: [...DEFAULT_SIDEBAR_RAILS.bottom],
  },
  railAlignment: {
    left: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.left,
    right: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.right,
    top: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.top,
    bottom: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.bottom,
  },
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "nord",
  fontSize: 14,
  fontFamily: "monospace",
  customThemes: {},
  sidebarLayout: {
    panelPosition: DEFAULT_SIDEBAR_LAYOUT.panelPosition,
    rails: {
      left: [...DEFAULT_SIDEBAR_LAYOUT.rails.left],
      right: [...DEFAULT_SIDEBAR_LAYOUT.rails.right],
      top: [...DEFAULT_SIDEBAR_LAYOUT.rails.top],
      bottom: [...DEFAULT_SIDEBAR_LAYOUT.rails.bottom],
    },
    railAlignment: {
      left: DEFAULT_SIDEBAR_LAYOUT.railAlignment.left,
      right: DEFAULT_SIDEBAR_LAYOUT.railAlignment.right,
      top: DEFAULT_SIDEBAR_LAYOUT.railAlignment.top,
      bottom: DEFAULT_SIDEBAR_LAYOUT.railAlignment.bottom,
    },
  },
  sidebarLayoutScope: "global",
};

export const DEFAULT_EDITOR: EditorSettings = {
  autosaveEnabled: true,
  autosaveIntervalMs: 10_000,
  wordWrap: true,
  showLineNumbers: false,
};

export const DEFAULT_KEYBINDINGS: KeybindingMap = {
  "app.openCommandPalette": "CommandOrControl+K",
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

export const DEFAULT_TRASH = {
  autoPurgeDays: 30,
};

// ---------------------------------------------------------------------------
// Composite defaults
// ---------------------------------------------------------------------------

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  appearance: { ...DEFAULT_APPEARANCE },
  editor: { ...DEFAULT_EDITOR },
  trash: { ...DEFAULT_TRASH },
  keybindings: { ...DEFAULT_KEYBINDINGS },
  llm: {
    defaultModelId: DEFAULT_LLM.defaultModelId,
    models: { ...DEFAULT_LLM.models },
  },
  ai: { ...DEFAULT_AI },
};

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  appearance: {
    sidebarLayout: {
      panelPosition: DEFAULT_SIDEBAR_LAYOUT.panelPosition,
      rails: {
        left: [...DEFAULT_SIDEBAR_LAYOUT.rails.left],
        right: [...DEFAULT_SIDEBAR_LAYOUT.rails.right],
        top: [...DEFAULT_SIDEBAR_LAYOUT.rails.top],
        bottom: [...DEFAULT_SIDEBAR_LAYOUT.rails.bottom],
      },
      railAlignment: {
        left: DEFAULT_SIDEBAR_LAYOUT.railAlignment.left,
        right: DEFAULT_SIDEBAR_LAYOUT.railAlignment.right,
        top: DEFAULT_SIDEBAR_LAYOUT.railAlignment.top,
        bottom: DEFAULT_SIDEBAR_LAYOUT.railAlignment.bottom,
      },
    },
  },
  editor: { ...DEFAULT_EDITOR },
};

/**
 * The current schema version. Bump this whenever the schema shape changes
 * and add a corresponding migration in migrations.ts.
 */
export const LATEST_SCHEMA_VERSION = 6;

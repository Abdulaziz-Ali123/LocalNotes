/**
 * Settings Schema v1
 *
 * TypeScript interfaces defining the shape of all settings.
 * These interfaces are the single source of truth for the settings structure
 * and are shared between the main process SettingsManager and the renderer.
 * Git-history contributors: Wesley McDougal; Abdulaziz Ali; Shaun; Malek Kchaou
 * Revision History:
 *  • Wesley McDougal - 29MAR2026 - Added CustomThemeTokens and customThemes to AppearanceSettings
 *  • Wesley McDougal - 05APR2026 - Added sidebar layout schema types and appearance/project layout support
 */

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------

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
export type SidebarEdge = "left" | "right" | "top" | "bottom";
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

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export interface EditorSettings {
  autosaveEnabled: boolean;
  autosaveIntervalMs: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
}

// ---------------------------------------------------------------------------
// Keybindings
// ---------------------------------------------------------------------------

/**
 * Each key is a dot-separated action ID (e.g. "file.save").
 * Each value is an Electron accelerator string (e.g. "CommandOrControl+S").
 * An empty string means the shortcut is unbound.
 */
export interface KeybindingMap {
  "file.save": string;
  "file.open": string;
  "file.newFile": string;
  "file.newFolder": string;
  "edit.undo": string;
  "edit.redo": string;
  "view.toggleSidebar": string;
  "view.togglePreview": string;
  "view.toggleLivePreview": string;
  "view.search": string;
  "view.toggleDevTools": string;
  [key: string]: string; // allow custom / future keybindings
}

// ---------------------------------------------------------------------------
// LLM (Bring-your-own OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------

export interface LLMCapabilities {
    text: boolean;
    vision: boolean;
    voice: boolean;
}

export interface LLMModelSpec {
    id: string;          // stable key like "openai", "local", "lab"
    name: string;        // friendly label
    baseUrl: string;     // OpenAI-compatible base, typically ends with /v1
    apiKey?: string;     // empty for local is fine
    model: string;       // model name string sent to provider
    capabilities: LLMCapabilities;
}

export interface LLMSettings {
    defaultModelId: string | null;
    models: Record<string, LLMModelSpec>;
}

// ---------------------------------------------------------------------------
// AI (Ollama / OpenAI-compatible chat panel settings)
// ---------------------------------------------------------------------------

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
  modelConfigs: Record<string, AiModelConfig>;
  customModels: CustomModel[];
}

// ---------------------------------------------------------------------------
// Combined settings objects
// ---------------------------------------------------------------------------

/** The full global settings object (stored in userData). */
export interface GlobalSettings {
  appearance: AppearanceSettings;
  editor: EditorSettings;
  keybindings: KeybindingMap;
  llm: LLMSettings;
  ai: AiSettings;
}

/** Project-level settings (stored in .Local Notes/settings.json per project). */
export interface ProjectSettings {
  appearance: {
    sidebarLayout: SidebarLayoutSettings;
  };
  editor: EditorSettings;
}

// ---------------------------------------------------------------------------
// On-disk format (JSON wrapper with version)
// ---------------------------------------------------------------------------

/**
 * The raw shape of the JSON file on disk.
 * `version` tracks which schema migration has been applied.
 * `settings` holds the actual user-facing values.
 */
export interface SettingsFile<T = GlobalSettings | ProjectSettings> {
  version: number;
  settings: T;
}

// ---------------------------------------------------------------------------
// Path resolver contracts (provided by Tickets 1 & 2)
// ---------------------------------------------------------------------------

/** Ticket 1 (Wesley): returns the global settings directory path. */
export type GlobalPathResolver = () => string;

/** Ticket 2 (Atharva): returns the project settings directory for a given project root. */
export type ProjectPathResolver = (projectRoot: string) => string;

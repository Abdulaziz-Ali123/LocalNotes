/**
 * Barrel export for the settings module.
 *
 * Revision History:
 *  • Wesley McDougal - 05APR2026 - Exported sidebar layout-related settings types
 */

export { SettingsManager } from "./settings-manager";
export type { SettingsManagerOptions } from "./settings-manager";
export { registerSettingsIpc } from "./ipc-handlers";
export { buildMenuTemplate } from "./menu-builder";
export { KEYBINDING_ACTIONS, acceleratorToDisplay } from "./keybindings";
export { migrateSettings } from "./migrations";
export {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PROJECT_SETTINGS,
  LATEST_SCHEMA_VERSION,
} from "./defaults";
export type {
  GlobalSettings,
  ProjectSettings,
  KeybindingMap,
  AppearanceSettings,
  SidebarLayoutSettings,
  SidebarLayoutScope,
  SidebarEdge,
  SidebarPosition,
  EditorSettings,
  SettingsFile,
  ThemeType,
} from "./schema";

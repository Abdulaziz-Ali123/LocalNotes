/**
 * Keybinding action registry.
 *
 * Defines every bindable action in the app along with a human-readable
 * description, a category (for grouping in the Settings UI), and the default
 * Electron accelerator string.
 *
 * This registry is used by:
 *  - defaults.ts          — to derive DEFAULT_KEYBINDINGS
 *  - background.ts        — to rebuild the Electron Menu with resolved shortcuts
 *  - SettingsDialog.tsx    — to display the keybinding editor
 *  - useKeybindings hook  — to map actions to keydown events in the renderer
 */

export interface KeybindingAction {
  /** Unique action ID — matches the key in KeybindingMap (e.g. "file.save"). */
  id: string;
  /** User-facing label (e.g. "Save File"). */
  label: string;
  /** Category for grouping in the UI. */
  category: "File" | "Edit" | "View";
  /** Default Electron accelerator string. */
  defaultAccelerator: string;
}

/**
 * Complete list of all bindable actions.
 * Order here determines display order in the Settings UI.
 */
export const KEYBINDING_ACTIONS: KeybindingAction[] = [
  // File
  {
    id: "file.save",
    label: "Save",
    category: "File",
    defaultAccelerator: "CommandOrControl+S",
  },
  {
    id: "file.open",
    label: "Open Folder",
    category: "File",
    defaultAccelerator: "CommandOrControl+O",
  },
  {
    id: "file.newFile",
    label: "New File",
    category: "File",
    defaultAccelerator: "CommandOrControl+N",
  },
  {
    id: "file.newFolder",
    label: "New Folder",
    category: "File",
    defaultAccelerator: "CommandOrControl+Shift+N",
  },

  // Edit
  {
    id: "edit.undo",
    label: "Undo",
    category: "Edit",
    defaultAccelerator: "CommandOrControl+Z",
  },
  {
    id: "edit.redo",
    label: "Redo",
    category: "Edit",
    defaultAccelerator: "CommandOrControl+Shift+Z",
  },

  // View
  {
    id: "view.toggleSidebar",
    label: "Toggle Sidebar",
    category: "View",
    defaultAccelerator: "CommandOrControl+B",
  },
  {
    id: "view.togglePreview",
    label: "Toggle Preview",
    category: "View",
    defaultAccelerator: "CommandOrControl+P",
  },
  {
    id: "view.toggleLivePreview",
    label: "Toggle Live Preview",
    category: "View",
    defaultAccelerator: "CommandOrControl+Shift+P",
  },
  {
    id: "view.search",
    label: "Search",
    category: "View",
    defaultAccelerator: "CommandOrControl+F",
  },
  {
    id: "view.toggleDevTools",
    label: "Toggle Developer Tools",
    category: "View",
    defaultAccelerator: "CommandOrControl+Shift+I",
  },
];

/**
 * Helper: convert an Electron accelerator string to a human-readable label.
 * e.g. "CommandOrControl+Shift+S" -> "Ctrl+Shift+S" (Windows/Linux)
 *                                  -> "Cmd+Shift+S"  (Mac)
 */
export function acceleratorToDisplay(
  accelerator: string,
  platform: NodeJS.Platform = process.platform
): string {
  const isMac = platform === "darwin";
  return accelerator
    .replace(/CommandOrControl/g, isMac ? "Cmd" : "Ctrl")
    .replace(/Command/g, "Cmd")
    .replace(/Control/g, "Ctrl")
    .replace(/\+/g, " + ");
}

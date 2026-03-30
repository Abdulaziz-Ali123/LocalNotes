/**
 * Electron Menu builder.
 *
 * Builds the application menu template using the resolved keybinding settings
 * instead of hardcoded accelerators. Called on startup and whenever keybindings
 * change.
 * 
 • Brief description of each revision & author:
      Wesley McDougal - 29MAR2026 - Added menu command dispatch and auto-hide toggle
 */

import { app, dialog, shell, BrowserWindow, MenuItemConstructorOptions } from "electron";
import { GlobalSettings } from "./schema";

const isMac = process.platform === "darwin";

/**
 * Sends menu command to renderer via IPC channel 'menu:command'.
 * Validates mainWindow exists and is not destroyed before sending.
 * Called by menu item click handlers to dispatch commands (e.g., 'file.save', 'view.toggleSidebar').
 */
function sendMenuCommand(mainWindow: BrowserWindow | null, command: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("menu:command", command);
}

/**
 * Builds complete application menu template (File, Edit, View, Window, Help) from settings.
 * Reads keybindings from settings.keybindings to set menu item accelerators.
 * File, View menu items dispatch commands via sendMenuCommand IPC.
 * View menu includes Windows-only auto-hide checkbox bound to mainWindow.setAutoHideMenuBar().
 */
export function buildMenuTemplate(
  settings: GlobalSettings,
  mainWindow: BrowserWindow | null
): MenuItemConstructorOptions[] {
  const kb = settings.keybindings;

  const template: MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: "File",
      submenu: [
        {
          label: "New File",
          accelerator: kb["file.newFile"] || undefined,
          click: () => sendMenuCommand(mainWindow, "file.newFile"),
        },
        {
          label: "New Folder",
          accelerator: kb["file.newFolder"] || undefined,
          click: () => sendMenuCommand(mainWindow, "file.newFolder"),
        },
        { type: "separator" as const },
        {
          label: "Save",
          accelerator: kb["file.save"] || undefined,
          click: () => sendMenuCommand(mainWindow, "file.save"),
        },
        {
          label: "Open Folder...",
          accelerator: kb["file.open"] || undefined,
          click: () => sendMenuCommand(mainWindow, "file.open"),
        },
        {
          label: "Open File...",
          accelerator: kb["file.open"] || undefined,
          click: () =>
            dialog.showMessageBox({ message: "Opening file..." }),
        },
        { type: "separator" as const },
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },

    // Edit menu
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const, accelerator: kb["edit.undo"] || undefined },
        { role: "redo" as const, accelerator: kb["edit.redo"] || undefined },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" as const },
              { role: "delete" as const },
              { role: "selectAll" as const },
              { type: "separator" as const },
              {
                label: "Speech",
                submenu: [
                  { role: "startSpeaking" as const },
                  { role: "stopSpeaking" as const },
                ],
              },
            ]
          : [
              { role: "delete" as const },
              { type: "separator" as const },
              { role: "selectAll" as const },
            ]),
      ],
    },

    // View menu
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: kb["view.toggleSidebar"] || undefined,
          click: () => sendMenuCommand(mainWindow, "view.toggleSidebar"),
        },
        {
          label: "Search",
          accelerator: kb["view.search"] || undefined,
          click: () => sendMenuCommand(mainWindow, "view.search"),
        },
        { type: "separator" as const },
        { role: "reload" as const },
        { role: "forceReload" as const },
        {
          label: "Toggle Developer Tools",
          accelerator: kb["view.toggleDevTools"] || undefined,
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        ...(!isMac
          ? [
              {
                type: "separator" as const,
              },
              {
                label: "Auto-hide Menu Bar",
                type: "checkbox" as const,
                checked: mainWindow ? mainWindow.isMenuBarAutoHide() : false,
                click: (menuItem) => {
                  if (!mainWindow || mainWindow.isDestroyed()) {
                    return;
                  }

                  const autoHideEnabled = Boolean(menuItem.checked);
                  mainWindow.setAutoHideMenuBar(autoHideEnabled);

                  if (!autoHideEnabled) {
                    mainWindow.setMenuBarVisibility(true);
                  }
                },
              },
            ]
          : []),
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
      ],
    },

    // Window menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const },
              { type: "separator" as const },
              { role: "window" as const },
            ]
          : [{ role: "close" as const }]),
      ],
    },

    // Help menu
    {
      role: "help" as const,
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            await shell.openExternal("https://electronjs.org");
          },
        },
      ],
    },
  ];

  return template;
}

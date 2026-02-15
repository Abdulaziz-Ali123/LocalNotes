/**
 * Electron Menu builder.
 *
 * Builds the application menu template using the resolved keybinding settings
 * instead of hardcoded accelerators. Called on startup and whenever keybindings
 * change.
 */

import { app, dialog, shell, BrowserWindow, MenuItemConstructorOptions } from "electron";
import { GlobalSettings } from "./schema";

const isMac = process.platform === "darwin";

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
        isMac
          ? { role: "close" as const }
          : { role: "quit" as const },
        {
          label: "Open File...",
          accelerator: kb["file.open"] || undefined,
          click: () =>
            dialog.showMessageBox({ message: "Opening file..." }),
        },
        {
          label: "Open Folder...",
          accelerator: kb["file.open"] || undefined,
        },
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
        { role: "reload" as const },
        { role: "forceReload" as const },
        {
          label: "Toggle Developer Tools",
          accelerator: kb["view.toggleDevTools"] || undefined,
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
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

/**
 * Settings IPC handlers.
 *
 * Registers all settings-related IPC channels so the renderer can
 * get/set/reset both global and project settings.
 */

import { ipcMain, BrowserWindow, Menu } from "electron";
import { SettingsManager } from "./settings-manager";
import { KEYBINDING_ACTIONS } from "./keybindings";
import { buildMenuTemplate } from "./menu-builder";
import { GlobalSettings } from "./schema";
import { upsertLLMModel, listLLMModels, getDefaultLLMModel, deleteLLMModel } from "./llm-registry";

/**
 * Register all settings IPC handlers.
 *
 * @param manager  The initialised SettingsManager instance
 * @param getMainWindow  Getter for the main BrowserWindow (used to rebuild menus)
 */
export function registerSettingsIpc(
  manager: SettingsManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // -----------------------------------------------------------------------
  // Global settings
  // -----------------------------------------------------------------------

  ipcMain.handle("settings:getGlobal", async () => {
    return manager.getResolvedGlobal();
  });

  ipcMain.handle(
    "settings:setGlobal",
    async (_event, dotPath: string, value: any) => {
      const updated = await manager.setGlobal(dotPath, value);

      // If keybindings changed, rebuild the application menu
      if (dotPath.startsWith("keybindings")) {
        rebuildMenu(updated, getMainWindow());
      }

      // Notify renderer of the change so Zustand stays in sync
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send("settings:changed", updated);
      }

      return updated;
    }
  );

  ipcMain.handle("settings:resetGlobal", async (_event, dotPath: string) => {
    const updated = await manager.resetGlobal(dotPath);

    if (dotPath.startsWith("keybindings")) {
      rebuildMenu(updated, getMainWindow());
    }

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("settings:changed", updated);
    }

    return updated;
  });

  ipcMain.handle("settings:resetAllGlobal", async () => {
    const updated = await manager.resetAllGlobal();
    rebuildMenu(updated, getMainWindow());

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("settings:changed", updated);
    }

    return updated;
  });

  // -----------------------------------------------------------------------
  // LLM model registry (OpenAI-compatible endpoints)
  // -----------------------------------------------------------------------

  ipcMain.handle(
    "llm:upsertModel",
    async (_event, spec: any, setAsDefault: boolean = true) => {
      await upsertLLMModel(manager, spec, setAsDefault);

      // Notify renderer so Zustand (or any store) stays in sync
      const updated = manager.getResolvedGlobal();
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send("settings:changed", updated);
      }
    }
  );

  ipcMain.handle("llm:listModels", async () => {
    return listLLMModels(manager);
  });

  ipcMain.handle("llm:getDefaultModel", async () => {
    return getDefaultLLMModel(manager);
  });

  ipcMain.handle("llm:deleteModel", async (_event, modelId: string) => {
    await deleteLLMModel(manager, modelId);

    const updated = manager.getResolvedGlobal();
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("settings:changed", updated);
    }
  });

  // -----------------------------------------------------------------------
  // Project settings
  // -----------------------------------------------------------------------

  ipcMain.handle(
    "settings:getProject",
    async (_event, projectRoot: string) => {
      return manager.getResolvedProject(projectRoot);
    }
  );

  ipcMain.handle(
    "settings:loadProject",
    async (_event, projectRoot: string) => {
      return manager.loadProject(projectRoot);
    }
  );

  ipcMain.handle(
    "settings:setProject",
    async (_event, projectRoot: string, dotPath: string, value: any) => {
      return manager.setProject(projectRoot, dotPath, value);
    }
  );

  ipcMain.handle(
    "settings:resetProject",
    async (_event, projectRoot: string, dotPath: string) => {
      return manager.resetProject(projectRoot, dotPath);
    }
  );

  // -----------------------------------------------------------------------
  // Metadata / helpers
  // -----------------------------------------------------------------------

  ipcMain.handle("settings:getDefaults", () => {
    return manager.getDefaults();
  });

  ipcMain.handle("settings:getKeybindingActions", () => {
    return KEYBINDING_ACTIONS;
  });
}

// ---------------------------------------------------------------------------
// Menu rebuilder
// ---------------------------------------------------------------------------

function rebuildMenu(
  settings: GlobalSettings,
  win: BrowserWindow | null
): void {
  const template = buildMenuTemplate(settings, win);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

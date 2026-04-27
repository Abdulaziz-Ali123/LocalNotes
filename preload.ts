import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import path from "path";

const handler = {
  send(channel: string, value: unknown) {
    ipcRenderer.send(channel, value);
  },
  on(channel: string, callback: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
};

const fileSystemHandler = {
  readDirectory: (dirPath: string) => ipcRenderer.invoke("fs:readDirectory", dirPath),
  createFolder: (folderPath: string) => ipcRenderer.invoke("fs:createFolder", folderPath),
  createFile: (filePath: string, content?: string) =>
    ipcRenderer.invoke("fs:createFile", filePath, content),
  deleteItem: (itemPath: string, projectRoot?: string) => ipcRenderer.invoke("fs:deleteItem", itemPath, projectRoot),
  listTrash: (projectRoot: string) => ipcRenderer.invoke("fs:listTrash", projectRoot),
  restoreTrashItem: (projectRoot: string, itemId: string) =>
    ipcRenderer.invoke("fs:restoreTrashItem", projectRoot, itemId),
  deleteTrashItem: (projectRoot: string, itemId: string) =>
    ipcRenderer.invoke("fs:deleteTrashItem", projectRoot, itemId),
  renameItem: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke("fs:renameItem", oldPath, newPath),
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:writeFile", filePath, content),
  extname: (p: string) => path.extname(p),
  sep: path.sep,
  openFolderDialog: () => ipcRenderer.invoke("fs:openFolderDialog"),
  openSaveDialog: () => ipcRenderer.invoke("fs:openSaveDialog"),
  selectImportFiles: () => ipcRenderer.invoke("fs:selectImportFiles"),
  mergeFiles: (sourceFiles: string[], targetFile: string) => ipcRenderer.invoke("fs:mergeFiles", sourceFiles, targetFile),
  importFolder: (src: string, dest: string) => ipcRenderer.invoke("fs:importFolder", src, dest),
  copyFile: (src: string, dest: string) => ipcRenderer.invoke("fs:copyFile", src, dest),
  saveFileAs: (srcPath: string) => ipcRenderer.invoke("fs:saveFileAs", srcPath),
  basename: (filePath: string) => path.basename(filePath),
  dirname: (filePath: string) => path.dirname(filePath),
  join: (...segments: string[]) => path.join(...segments),
  exists: async (targetPath: string) => ipcRenderer.invoke("fs:exists", targetPath),
  isDirectory: (path: string) => ipcRenderer.invoke("fs:isDirectory", path),
};

const tabHandler = {
  getAllTabIds: () => ipcRenderer.invoke("tabs:getAllTabIds"),
  getSelectedTabId: () => ipcRenderer.invoke("tabs:getSelectedTabId"),
  select: (id: number) => ipcRenderer.invoke("tabs:select", id),
  close: (id: number) => ipcRenderer.invoke("tabs:close", id),
  new: () => ipcRenderer.invoke("tabs:new"),
  reorder: (ids: number[]) => ipcRenderer.invoke("tabs:reorder", ids),
};

contextBridge.exposeInMainWorld("ipc", {
  send(channel: string, value: unknown) {
    ipcRenderer.send(channel, value);
  },
  on(channel: string, callback: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  invoke(channel: string, data?: unknown) {
    return ipcRenderer.invoke(channel, data);
  },
});
contextBridge.exposeInMainWorld("fs", fileSystemHandler);
contextBridge.exposeInMainWorld("tabs", tabHandler);
contextBridge.exposeInMainWorld("autosaveAPI", {
  save: (filePath: string, content: string) =>
    ipcRenderer.invoke("autosave:save", { filePath, content }),
  load: (filePath: string) => ipcRenderer.invoke("autosave:load", filePath),
});
contextBridge.exposeInMainWorld("fileEvents", {
  onDeleted: (callback) =>
    ipcRenderer.on("file:deleted", (_, path) => callback(path)),
});

// ---------------------------------------------------------------------------
// Settings API
// ---------------------------------------------------------------------------
const settingsHandler = {
  getGlobal: () => ipcRenderer.invoke("settings:getGlobal"),
  setGlobal: (dotPath: string, value: any) =>
    ipcRenderer.invoke("settings:setGlobal", dotPath, value),
  resetGlobal: (dotPath: string) =>
    ipcRenderer.invoke("settings:resetGlobal", dotPath),
  resetAllGlobal: () => ipcRenderer.invoke("settings:resetAllGlobal"),

  getProject: (projectRoot: string) =>
    ipcRenderer.invoke("settings:getProject", projectRoot),
  loadProject: (projectRoot: string) =>
    ipcRenderer.invoke("settings:loadProject", projectRoot),
  setProject: (projectRoot: string, dotPath: string, value: any) =>
    ipcRenderer.invoke("settings:setProject", projectRoot, dotPath, value),
  resetProject: (projectRoot: string, dotPath: string) =>
    ipcRenderer.invoke("settings:resetProject", projectRoot, dotPath),

  getDefaults: () => ipcRenderer.invoke("settings:getDefaults"),
  getKeybindingActions: () => ipcRenderer.invoke("settings:getKeybindingActions"),

  /** Listen for settings changes pushed from the main process. */
  onChange: (callback: (settings: any) => void) => {
    const subscription = (_event: IpcRendererEvent, settings: any) =>
      callback(settings);
    ipcRenderer.on("settings:changed", subscription);
    return () => {
      ipcRenderer.removeListener("settings:changed", subscription);
    };
  },
};

contextBridge.exposeInMainWorld("settings", settingsHandler);

export type IpcHandler = typeof handler;
export type FileSystemHandler = typeof fileSystemHandler;
export type TabHandler = typeof tabHandler;
export type SettingsHandler = typeof settingsHandler;

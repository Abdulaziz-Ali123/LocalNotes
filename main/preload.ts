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
  deleteItem: (itemPath: string) => ipcRenderer.invoke("fs:deleteItem", itemPath),
  renameItem: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke("fs:renameItem", oldPath, newPath),
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:writeFile", filePath, content),
  extname: (p: string) => path.extname(p),
  sep: path.sep,
  openFolderDialog: () => ipcRenderer.invoke("fs:openFolderDialog"),
    selectImportFiles: () => ipcRenderer.invoke("fs:selectImportFiles"),
    selectExportDestination: () => ipcRenderer.invoke("fs:selectExportDestination"),
    exportFile: (source, destFolder) => ipcRenderer.invoke("fs:exportFile", source, destFolder),
    exportFolder: (sourceFolder, destFolder) => ipcRenderer.invoke("fs:exportFolder", sourceFolder, destFolder),
  mergeFiles: (sourceFiles: string[], targetFile: string) => ipcRenderer.invoke("fs:mergeFiles", sourceFiles, targetFile),
  importFolder: (src: string, dest: string) => ipcRenderer.invoke("fs:importFolder", src, dest),
  copyFile: (src: string, dest: string) => ipcRenderer.invoke("fs:copyFile", src, dest),
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

contextBridge.exposeInMainWorld("ipc", handler);
contextBridge.exposeInMainWorld("fs", fileSystemHandler);
contextBridge.exposeInMainWorld("tabs", tabHandler);
contextBridge.exposeInMainWorld("autosaveAPI", {
  save: (filePath: string, content: string) =>
    ipcRenderer.invoke("autosave:save", { filePath, content }),
  load: (filePath: string) => ipcRenderer.invoke("autosave:load", filePath),
});



export type IpcHandler = typeof handler;
export type FileSystemHandler = typeof fileSystemHandler;
export type TabHandler = typeof tabHandler;

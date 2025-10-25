import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import path from "path";

const handler = {
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
};

const fileSystemHandler = {
  readDirectory: (dirPath: string) =>
    ipcRenderer.invoke("fs:readDirectory", dirPath),
  createFolder: (folderPath: string) =>
    ipcRenderer.invoke("fs:createFolder", folderPath),
  createFile: (filePath: string, content?: string) =>
    ipcRenderer.invoke("fs:createFile", filePath, content),
  deleteItem: (itemPath: string) =>
    ipcRenderer.invoke("fs:deleteItem", itemPath),
  renameItem: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke("fs:renameItem", oldPath, newPath),
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:writeFile", filePath, content),
  openFolderDialog: () =>
    ipcRenderer.invoke("fs:openFolderDialog"),
  join: (...args: string[]) => path.join(...args),
  dirname: (p: string) => path.dirname(p),
  basename: (p: string) => path.basename(p),
  extname: (p: string) => path.extname(p),
  sep: path.sep,
};

contextBridge.exposeInMainWorld("ipc", handler);
contextBridge.exposeInMainWorld("fs", fileSystemHandler);

export type IpcHandler = typeof handler;
export type FileSystemHandler = typeof fileSystemHandler;

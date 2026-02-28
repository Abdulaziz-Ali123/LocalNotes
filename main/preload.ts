import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import path from "path";
import { DirectoryChunkerConfig, DirectoryChunkResult} from "./indexing/DirectoryChuncker";
import { Chunk } from "./indexing/chunking";
import { UUID } from "crypto";

interface DbResponse<T = any> {
   success: boolean;
    data?: T;
    error?: string;
}

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
  openSaveDialog: () => ipcRenderer.invoke("fs:openSaveDialog"),
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
    normalize: (p: string) => path.normalize(p),
};

const tabHandler = {
  getAllTabIds: () => ipcRenderer.invoke("tabs:getAllTabIds"),
  getSelectedTabId: () => ipcRenderer.invoke("tabs:getSelectedTabId"),
  select: (id: number) => ipcRenderer.invoke("tabs:select", id),
  close: (id: number) => ipcRenderer.invoke("tabs:close", id),
  new: () => ipcRenderer.invoke("tabs:new"),
  reorder: (ids: number[]) => ipcRenderer.invoke("tabs:reorder", ids),
};

const vectorDbHandler = {
    addDirectory: (uuid: string, path: string) => 
        ipcRenderer.invoke("db:addDirectory", uuid, path),
    updateDirectory: (id: UUID, name?: string, path?: string) => 
        ipcRenderer.invoke("db:updateDirectory", id, name, path),
    deleteDirectory: (id: UUID) => 
        ipcRenderer.invoke("db:deleteDirectory", id),
    getDirectory: (id: UUID) => 
        ipcRenderer.invoke("db:getDirectory", id),
    getAllDirectories: () => 
        ipcRenderer.invoke("db:getAllDirectories"),
    addFile: (directoryId: UUID, filePath: string, fileHash: string, lastModified: number) =>
        ipcRenderer.invoke("db:addFile", directoryId, filePath, fileHash, lastModified),
    updateFileHash: (fileId: UUID, fileHash: string, lastModified: number) =>
        ipcRenderer.invoke("db:updateFileHash", fileId, fileHash, lastModified),
    deleteFile: (fileId: UUID) =>
        ipcRenderer.invoke("db:deleteFile", fileId),
    getFilesByDirectory: (directoryId: UUID) =>
        ipcRenderer.invoke("db:getFilesByDirectory", directoryId),
    addChunk: (fileId: UUID, directoryId: UUID, contentHash: string, content: string, embedding: Buffer) =>
        ipcRenderer.invoke("db:addChunk", fileId, directoryId, contentHash, content, embedding),
    addChunks: (chunks: Array<{
        fileId: UUID;
        directoryId: UUID;
        contentHash: string;
        content: string;
        embedding: Buffer;
    }>) => ipcRenderer.invoke("db:addChunks", chunks),
    deleteChunksByFile: (fileId: UUID) =>
        ipcRenderer.invoke("db:deleteChunksByFile", fileId),
    getChunksByDirectory: (directoryId: UUID) =>
        ipcRenderer.invoke("db:getChunksByDirectory", directoryId),
    getChunksByFile: (fileId: UUID) =>
        ipcRenderer.invoke("db:getChunksByFile", fileId)
};

const chunkerHandler = {
    // Chunk entire directory
    chunkDirectory: (directoryPath: string, config?: DirectoryChunkerConfig): Promise<DbResponse<DirectoryChunkResult>> =>
        ipcRenderer.invoke("chunker:chunkDirectory", directoryPath, config),
    
    // Chunk single file
    chunkFile: (filePath: string, config?: DirectoryChunkerConfig["chunkingConfig"]): Promise<DbResponse<Chunk[]>> =>
       ipcRenderer.invoke("chunker:chunkFile", filePath, config),
  };


const indexerHandler = {
    // Index entire directory with placeholder embeddings
   indexDirectory: (
       directoryId: UUID, 
       directoryPath: string, 
       config?: DirectoryChunkerConfig
   ): Promise<DbResponse<{
       filesProcessed: number;
       filesSkipped: number;
       chunksCreated: number;
       errors: number;
       errorFiles: string[];
   }>> =>
       ipcRenderer.invoke("indexer:indexDirectory", directoryId, directoryPath, config),
   
   // Index single file with placeholder embeddings
   indexFile: (
       directoryId: UUID, 
       filePath: string, 
       config?: DirectoryChunkerConfig["chunkingConfig"]
   ): Promise<DbResponse<{
       fileId: UUID;
       chunksCreated: number;
   }>> =>
       ipcRenderer.invoke("indexer:indexFile", directoryId, filePath, config),
};

export default vectorDbHandler;


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
contextBridge.exposeInMainWorld("db", vectorDbHandler);
contextBridge.exposeInMainWorld("indexer", indexerHandler);
contextBridge.exposeInMainWorld("tabs", tabHandler);
contextBridge.exposeInMainWorld("chunker", chunkerHandler);
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

// Project Settings API
const projectSettingsHandler = {
  load: (projectRoot: string) => 
    ipcRenderer.invoke("projectSettings:load", projectRoot),
  save: (projectRoot: string, settings: any) => 
    ipcRenderer.invoke("projectSettings:save", projectRoot, settings),
  update: (projectRoot: string, updates: any) => 
    ipcRenderer.invoke("projectSettings:update", projectRoot, updates),
  addRecentFile: (projectRoot: string, filePath: string) => 
    ipcRenderer.invoke("projectSettings:addRecentFile", projectRoot, filePath),
  togglePinnedFile: (projectRoot: string, filePath: string) => 
    ipcRenderer.invoke("projectSettings:togglePinnedFile", projectRoot, filePath),
};

contextBridge.exposeInMainWorld("projectSettings", projectSettingsHandler);

export type IpcHandler = typeof handler;
export type FileSystemHandler = typeof fileSystemHandler;
export type TabHandler = typeof tabHandler;
export type VectorDbHandler = typeof vectorDbHandler;
export type ChunckerHandler = typeof chunkerHandler;
export type IndexHandler = typeof indexerHandler;
export type SettingsHandler = typeof settingsHandler;
export type ProjectSettingsHandler = typeof projectSettingsHandler;

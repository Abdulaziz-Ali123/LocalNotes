/**
 * File: main/preload.ts
 * Purpose: Exposes safe renderer APIs through Electron's preload bridge.
 * Author: Malek Kchaou (if you see this and you've worked on it add your name)
 * Update Log:
 *  - 2026-04-12: Atharva Patil - Added code for the quiz bridge. Exposes window.quiz APIs for host controls and session update listeners.
 * Date created: 2024-06
 * Last Updated: 2026-04-12
 *
 * Revision History:
 *  • Wesley McDougal - 07APR2026 - Added window.llm bridge: exposes chat() method
 *    that proxies LLM requests to the main process so API keys never reach the renderer.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import path from "path";
import { DirectoryChunkerConfig, DirectoryChunkResult} from "./indexing/DirectoryChuncker";
import { Chunk } from "./indexing/chunking";
import { UUID } from "crypto";
import { addEmbedding } from "./database/documentRepository";

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
    updateDirectory: (id: UUID, path?: string) => 
        ipcRenderer.invoke("db:updateDirectory", id, path),
    deleteDirectory: (id: UUID) => 
        ipcRenderer.invoke("db:deleteDirectory", id),
    getDirectory: (id: UUID) => 
        ipcRenderer.invoke("db:getDirectory", id),
    getAllDirectories: () => 
        ipcRenderer.invoke("db:getAllDirectories"),
    getDirectoryIdByPath: (path: string) => 
        ipcRenderer.invoke("db:getDirectoryIdByPath", path),
    addFile: (directoryId: UUID, filePath: string, fileHash: string, lastModified: number) =>
        ipcRenderer.invoke("db:addFile", directoryId, filePath, fileHash, lastModified),
    updateFileHash: (fileId: UUID, fileHash: string, lastModified: number) =>
        ipcRenderer.invoke("db:updateFileHash", fileId, fileHash, lastModified),
    deleteFile: (fileId: UUID) =>
        ipcRenderer.invoke("db:deleteFile", fileId),
    getFilesByDirectory: (directoryId: UUID) =>
        ipcRenderer.invoke("db:getFilesByDirectory", directoryId),
    addChunk: (fileId: UUID, contentHash: string, content: string) =>
        ipcRenderer.invoke("db:addChunk", fileId, contentHash, content),
    addChunks: (chunks: Array<{
        fileId: UUID;
        contentHash: string;
        content: string;
    }>) => ipcRenderer.invoke("db:addChunks", chunks),
    deleteChunksByFile: (fileId: UUID) =>
        ipcRenderer.invoke("db:deleteChunksByFile", fileId),
    getChunksByDirectory: (directoryId: UUID) =>
        ipcRenderer.invoke("db:getChunksByDirectory", directoryId),
    getChunksByFile: (fileId: UUID) =>
        ipcRenderer.invoke("db:getChunksByFile", fileId),
    addEmbedding: (embedding: Float32Array | number[]) =>
        ipcRenderer.invoke("db:addEmbedding", embedding),
    addEmbeddings: (embeddings: Array<Float32Array | number[]>) =>
        ipcRenderer.invoke("db:addEmbeddings", embeddings),
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

const watcherHandler = {
    // Start watching a directory
    start: (directoryId: UUID, directoryPath: string): Promise<DbResponse<void>> =>
        ipcRenderer.invoke("watcher:start", directoryId, directoryPath),
    
    // Stop watching a directory
    stop: (directoryId: UUID): Promise<DbResponse<void>> =>
        ipcRenderer.invoke("watcher:stop", directoryId),
    
    // Stop all watchers
    stopAll: (): Promise<DbResponse<void>> =>
        ipcRenderer.invoke("watcher:stopAll"),
    
    // Get all active watchers
    getActive: (): Promise<DbResponse<Array<{ directoryId: UUID; directoryPath: string }>>> =>
        ipcRenderer.invoke("watcher:getActive"),
    
    // Check if a directory is being watched
    isWatching: (directoryId: UUID): Promise<DbResponse<boolean>> =>
        ipcRenderer.invoke("watcher:isWatching", directoryId),
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
contextBridge.exposeInMainWorld("watcher", watcherHandler);
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

  // -----------------------------------------------------------------------
  // LLM model registry (OpenAI-compatible endpoints)
  // -----------------------------------------------------------------------
  llmUpsertModel: (spec: any, setAsDefault: boolean = true) =>
  ipcRenderer.invoke("llm:upsertModel", spec, setAsDefault),

  llmListModels: () => ipcRenderer.invoke("llm:listModels"),

  llmGetDefaultModel: () => ipcRenderer.invoke("llm:getDefaultModel"),

  llmDeleteModel: (modelId: string) => ipcRenderer.invoke("llm:deleteModel", modelId),

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

const quizHandler = {
  getServerInfo: () => ipcRenderer.invoke("quiz:getServerInfo"),
  createSession: (payload: {
    hostName: string;
    questionTimeSec: number;
    questions: Array<{ id?: string; prompt: string; options: string[]; correctAnswer: string }>;
  }) => ipcRenderer.invoke("quiz:createSession", payload),
  getSession: (code: string) => ipcRenderer.invoke("quiz:getSession", code),
  startQuiz: (code: string) => ipcRenderer.invoke("quiz:startQuiz", code),
  nextQuestion: (code: string) => ipcRenderer.invoke("quiz:nextQuestion", code),
  endQuiz: (code: string) => ipcRenderer.invoke("quiz:endQuiz", code),
  onSessionUpdated: (callback: (payload: { code: string; snapshot: any }) => void) => {
    const listener = (_event: IpcRendererEvent, payload: { code: string; snapshot: any }) => {
      callback(payload);
    };
    ipcRenderer.on("quiz:sessionUpdated", listener);
    return () => ipcRenderer.removeListener("quiz:sessionUpdated", listener);
  },
};

contextBridge.exposeInMainWorld("quiz", quizHandler);
// ---------------------------------------------------------------------------
// LLM Chat Bridge
// Proxies all LLM HTTP requests through the main process so that API keys
// are never accessible from the renderer / DevTools network panel.
// ---------------------------------------------------------------------------
const llmHandler = {
  /**
   * Send a chat completion request via the main-process IPC handler.
   * @param modelId       The id of the saved CustomModel to use.
   * @param messages      Conversation history in OpenAI message format.
   * @param thinkingEnabled  Whether to enable extended "thinking" mode (provider-dependent).
   * @returns             { success, content } on success; { success: false, error } on failure.
   */
  chat: (
    modelId: string,
    messages: Array<{ role: string; content: string }>,
    thinkingEnabled?: boolean
  ) =>
    ipcRenderer.invoke("llm:chat", modelId, messages, thinkingEnabled),
};

contextBridge.exposeInMainWorld("llm", llmHandler);

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

const ragHandler = {
    retrieveContext: (directoryId: string, query: string, topK?: number) => 
        ipcRenderer.invoke("rag:retrieveContext", { directoryId, query, topK })
};
contextBridge.exposeInMainWorld("rag", ragHandler);

/**
 * Expose only the minimal error-reporting surface needed by the renderer.
 * The renderer should not write files directly; it should report through IPC.
 */
contextBridge.exposeInMainWorld("localNotes", {
    errors: {
        /**
         * Sends a structured error payload to the main process.
         * The main process is responsible for persisting it in the central log.
         */
        report: (payload: {
            message: string;
            stack?: string;
            code?: string;
            context?: string;
            details?: Record<string, unknown>;
        }) => ipcRenderer.invoke("errors:report", payload),
    },

    // Preserve any existing APIs already exposed here.
    // Merge this into your current preload object rather than replacing it.
});

export type IpcHandler = typeof handler;
export type FileSystemHandler = typeof fileSystemHandler;
export type TabHandler = typeof tabHandler;
export type VectorDbHandler = typeof vectorDbHandler;
export type ChunckerHandler = typeof chunkerHandler;
export type IndexHandler = typeof indexerHandler;
export type WatcherHandler = typeof watcherHandler;
export type SettingsHandler = typeof settingsHandler;
export type QuizHandler = typeof quizHandler;
export type ProjectSettingsHandler = typeof projectSettingsHandler;
export type RagHandler = typeof ragHandler;


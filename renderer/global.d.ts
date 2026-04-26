/**
 * Git-history contributors: a157p624; Abdulaziz-Ali123; Malek Kchaou; Wesley McDougal; m518n748
 */

// Create this file as: renderer/types/window.d.ts

import type { DirectoryChunkResult, DirectoryChunkerConfig, Chunk } from "../../main/indexing/DirectoryChuncker";

type UUID = string;

interface DbResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

declare global {
    interface Window {
        db: {
            addDirectory: (uuid: string, path: string) => Promise<DbResponse>;
            updateDirectory: (id: UUID, path?: string) => Promise<DbResponse>;
            deleteDirectory: (id: UUID) => Promise<DbResponse>;
            getDirectory: (id: UUID) => Promise<DbResponse>;
            getAllDirectories: () => Promise<DbResponse>;
            getDirectoryIdByPath: (path: string) => Promise<DbResponse>;
            addFile: (directoryId: UUID, filePath: string, fileHash: string, lastModified: number) => Promise<DbResponse>;
            updateFileHash: (fileId: UUID, fileHash: string, lastModified: number) => Promise<DbResponse>;
            deleteFile: (fileId: UUID) => Promise<DbResponse>;
            getFilesByDirectory: (directoryId: UUID) => Promise<DbResponse>;
            addChunk: (fileId: UUID, directoryId: UUID, contentHash: string, content: string, embedding: Buffer) => Promise<DbResponse>;
            addChunks: (chunks: Array<{
                fileId: UUID;
                directoryId: UUID;
                contentHash: string;
                content: string;
                embedding: Buffer;
            }>) => Promise<DbResponse>;
            deleteChunksByFile: (fileId: UUID) => Promise<DbResponse>;
            getChunksByDirectory: (directoryId: UUID) => Promise<DbResponse>;
            getChunksByFile: (fileId: UUID) => Promise<DbResponse>;
        };

        chunker: {
            chunkDirectory: (
                directoryPath: string, 
                config?: DirectoryChunkerConfig
            ) => Promise<DbResponse<DirectoryChunkResult>>;
            
            chunkFile: (
                filePath: string, 
                config?: DirectoryChunkerConfig["chunkingConfig"]
            ) => Promise<DbResponse<Chunk[]>>;
        };

        indexer: {
            indexDirectory: (
                directoryId: UUID,
                directoryPath: string,
                config?: DirectoryChunkerConfig
            ) => Promise<DbResponse<{
                filesProcessed: number;
                filesSkipped: number;
                chunksCreated: number;
                errors: number;
                errorFiles: string[];
            }>>;
            
            indexFile: (
                directoryId: UUID,
                filePath: string,
                config?: DirectoryChunkerConfig["chunkingConfig"]
            ) => Promise<DbResponse<{
                fileId: UUID;
                chunksCreated: number;
            }>>;
        };

        fs: {
            readDirectory: (dirPath: string) => Promise<any>;
            createFolder: (folderPath: string) => Promise<DbResponse>;
            createFile: (filePath: string, content?: string) => Promise<DbResponse>;
            deleteItem: (itemPath: string) => Promise<DbResponse>;
            renameItem: (oldPath: string, newPath: string) => Promise<DbResponse>;
            readFile: (filePath: string) => Promise<any>;
            writeFile: (filePath: string, content: string) => Promise<DbResponse>;
            extname: (p: string) => string;
            sep: string;
            openFolderDialog: () => Promise<DbResponse>;
            openSaveDialog: () => Promise<DbResponse>;
            selectImportFiles: () => Promise<any>;
            selectExportDestination: () => Promise<any>;
            exportFile: (source: string, destFolder: string) => Promise<DbResponse>;
            exportFolder: (sourceFolder: string, destFolder: string) => Promise<DbResponse>;
            mergeFiles: (sourceFiles: string[], targetFile: string) => Promise<DbResponse>;
            importFolder: (src: string, dest: string) => Promise<DbResponse>;
            copyFile: (src: string, dest: string) => Promise<DbResponse>;
            basename: (filePath: string) => string;
            dirname: (filePath: string) => string;
            join: (...segments: string[]) => string;
            exists: (targetPath: string) => Promise<DbResponse>;
            isDirectory: (path: string) => Promise<DbResponse>;
        };

        tabs: {
            getAllTabIds: () => Promise<number[]>;
            getSelectedTabId: () => Promise<number>;
            select: (id: number) => Promise<void>;
            close: (id: number) => Promise<void>;
            new: () => Promise<number>;
            reorder: (ids: number[]) => Promise<void>;
        };

        autosaveAPI: {
            save: (filePath: string, content: string) => Promise<DbResponse>;
            load: (filePath: string) => Promise<string>;
        };

        fileEvents: {
            onDeleted: (callback: (path: string) => void) => void;
        };

        ipc: {
            on: (channel: string, callback: (...args: any[]) => void) => () => void;
            send: (channel: string, data: any) => void;
            invoke: (channel: string, data: any) => Promise<any>;
        };

        localNotes: {
            errors: {
                report: (payload: {
                    message: string;
                    stack?: string;
                    code?: string;
                    context?: string;
                    details?: Record<string, unknown>;
                }) => Promise<{ ok: boolean }>;
            };
        };
/**
 * Update Log: 
 *  - 2026-04-12: Atharva Patil - Added quiz API typings to the global Window interface. This includes methods for creating sessions, starting quizzes, navigating questions, fetching session data, and listening for session updates.
 * Quiz Global API Notes:
 * Extends Window with quiz APIs exposed from Electron preload.
 */
        quiz: {
            getServerInfo: () => Promise<any>;
            createSession: (payload: any) => Promise<any>;
            getSession: (code: string) => Promise<any>;
            startQuiz: (code: string) => Promise<any>;
            nextQuestion: (code: string) => Promise<any>;
            endQuiz: (code: string) => Promise<any>;
            onSessionUpdated: (callback: (payload: { code: string; snapshot: any }) => void) => () => void;
        };
    }
}

export { };

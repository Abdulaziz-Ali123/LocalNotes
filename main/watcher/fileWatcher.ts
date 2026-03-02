import chokidar, { FSWatcher } from "chokidar";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import {
    addFile,
    deleteFile,
    updateFileHash,
    getFilesByDirectory,
} from "@/main/database/documentRepository";
import { chunkAndStoreFile } from "@/main/indexing/DirectoryChuncker";

type UUID = string;

/**
 * Configuration for file watcher
 */
export interface FileWatcherConfig {
    supportedExtensions?: string[];
    ignorePatterns?: string[];
    maxFileSize?: number;
    debounceMs?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: FileWatcherConfig = {
    supportedExtensions: [".md", ".txt", ".markdown"],
    ignorePatterns: ["node_modules", ".git", "dist", "build", ".next", ".vscode"],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    debounceMs: 500,
};

/**
 * File watcher instance for a directory
 */
interface WatcherInstance {
    directoryId: UUID;
    directoryPath: string;
    watcher: FSWatcher;
    config: FileWatcherConfig;
}

/**
 * Store of active watchers
 */
const activeWatchers: Map<UUID, WatcherInstance> = new Map();

/**
 * Compute file hash
 */
function computeFileHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Check if file is supported
 */
function isSupportedFile(filePath: string, config: FileWatcherConfig): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const extensions = config.supportedExtensions || DEFAULT_CONFIG.supportedExtensions!;
    return extensions.includes(ext);
}

/**
 * Check if path should be ignored
 */
function shouldIgnore(filePath: string, config: FileWatcherConfig): boolean {
    const ignorePatterns = config.ignorePatterns || DEFAULT_CONFIG.ignorePatterns!;
    const relativePath = path.relative(process.cwd(), filePath);
    
    return ignorePatterns.some(pattern => {
        return relativePath.includes(path.sep + pattern + path.sep) || 
               relativePath.includes(pattern + path.sep) ||
               relativePath === pattern;
    });
}

/**
 * Get file from database by path
 */
async function getFileByPath(directoryId: UUID, filePath: string): Promise<any> {
    try {
        const files = getFilesByDirectory(directoryId);
        return (files as any[]).find((f: any) => f.file_path === filePath);
    } catch (error) {
        console.error("Error getting file by path:", error);
        return null;
    }
}

/**
 * Handle file addition
 */
async function handleFileAdd(
    directoryId: UUID,
    filePath: string,
    config: FileWatcherConfig
): Promise<void> {
    try {
        // Check if file is supported
        if (!isSupportedFile(filePath, config)) {
            console.log(`Skipping unsupported file: ${filePath}`);
            return;
        }

        // Check if file should be ignored
        if (shouldIgnore(filePath, config)) {
            console.log(`Ignoring file: ${filePath}`);
            return;
        }

        // Read file content
        const content = await fs.readFile(filePath, "utf-8");
        
        // Check file size
        if (content.length > (config.maxFileSize || DEFAULT_CONFIG.maxFileSize!)) {
            console.warn(`File too large: ${filePath}`);
            return;
        }

        // Compute hash
        const fileHash = computeFileHash(content);
        const stats = await fs.stat(filePath);
        const lastModified = stats.mtimeMs;

        // Check if file already exists in database
        const existingFile = await getFileByPath(directoryId, filePath);
        
        if (existingFile) {
            // File exists, check if it has changed
            if (existingFile.file_hash !== fileHash) {
                console.log(`File modified (from add event): ${filePath}`);
                await handleFileChange(directoryId, filePath, config);
            }
        } else {
            // Add file to database
            const { id: fileId } = addFile(directoryId, filePath, fileHash, lastModified);
            console.log(`File added to database: ${filePath}`);

            // Index the file (chunk and store)
            try {
                await chunkAndStoreFile(directoryId, filePath);
                console.log(`File indexed: ${filePath}`);
            } catch (error) {
                console.error(`Failed to index file ${filePath}:`, error);
            }
        }
    } catch (error) {
        console.error(`Error handling file add for ${filePath}:`, error);
    }
}

/**
 * Handle file change
 */
async function handleFileChange(
    directoryId: UUID,
    filePath: string,
    config: FileWatcherConfig
): Promise<void> {
    try {
        // Check if file is supported
        if (!isSupportedFile(filePath, config)) {
            return;
        }

        // Check if file should be ignored
        if (shouldIgnore(filePath, config)) {
            return;
        }

        // Get existing file from database
        const existingFile = await getFileByPath(directoryId, filePath);
        
        if (!existingFile) {
            // File not in database, treat as add
            console.log(`File not in database, treating as add: ${filePath}`);
            await handleFileAdd(directoryId, filePath, config);
            return;
        }

        // Read new content
        const content = await fs.readFile(filePath, "utf-8");
        
        // Check file size
        if (content.length > (config.maxFileSize || DEFAULT_CONFIG.maxFileSize!)) {
            console.warn(`File too large: ${filePath}`);
            return;
        }

        // Compute new hash
        const newFileHash = computeFileHash(content);
        const stats = await fs.stat(filePath);
        const lastModified = stats.mtimeMs;

        // Check if hash has changed
        if (existingFile.file_hash !== newFileHash) {
            // Update file hash
            updateFileHash(existingFile.id, newFileHash, lastModified);
            console.log(`File hash updated: ${filePath}`);

            // Re-index the file (delete old chunks and create new ones)
            try {
                await chunkAndStoreFile(directoryId, filePath);
                console.log(`File re-indexed: ${filePath}`);
            } catch (error) {
                console.error(`Failed to re-index file ${filePath}:`, error);
            }
        }
    } catch (error) {
        console.error(`Error handling file change for ${filePath}:`, error);
    }
}

/**
 * Handle file deletion
 */
async function handleFileUnlink(
    directoryId: UUID,
    filePath: string,
    config: FileWatcherConfig
): Promise<void> {
    try {
        // Get file from database
        const existingFile = await getFileByPath(directoryId, filePath);
        
        if (existingFile) {
            // Delete file and its chunks from database
            deleteFile(existingFile.id);
            console.log(`File deleted from database: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error handling file unlink for ${filePath}:`, error);
    }
}

/**
 * Start watching a directory
 */
export function startWatching(
    directoryId: UUID,
    directoryPath: string,
    config: Partial<FileWatcherConfig> = {}
): void {
    // Check if already watching
    if (activeWatchers.has(directoryId)) {
        console.log(`Already watching directory: ${directoryPath}`);
        return;
    }

    // Merge config with defaults
    const fullConfig: FileWatcherConfig = {
        ...DEFAULT_CONFIG,
        ...config,
    };

    // Create ignore patterns for chokidar
    const ignored = fullConfig.ignorePatterns?.map(pattern => 
        `**/${pattern}/**`
    ) || [];

    // Create watcher
    const watcher = chokidar.watch(directoryPath, {
        ignored: ignored,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: fullConfig.debounceMs,
            pollInterval: 100,
        },
        depth: 99, // Watch all subdirectories
    });

    // Set up event handlers
    watcher
        .on("add", (filePath) => {
            console.log(`Watcher: File added - ${filePath}`);
            handleFileAdd(directoryId, filePath, fullConfig);
        })
        .on("change", (filePath) => {
            console.log(`Watcher: File changed - ${filePath}`);
            handleFileChange(directoryId, filePath, fullConfig);
        })
        .on("unlink", (filePath) => {
            console.log(`Watcher: File deleted - ${filePath}`);
            handleFileUnlink(directoryId, filePath, fullConfig);
        })
        .on("error", (error) => {
            console.error(`Watcher error for ${directoryPath}:`, error);
        })
        .on("ready", () => {
            console.log(`✓ Watcher ready for directory: ${directoryPath}`);
        });

    // Store watcher instance
    activeWatchers.set(directoryId, {
        directoryId,
        directoryPath,
        watcher,
        config: fullConfig,
    });

    console.log(`Started watching directory: ${directoryPath}`);
}

/**
 * Stop watching a directory
 */
export async function stopWatching(directoryId: UUID): Promise<void> {
    const watcherInstance = activeWatchers.get(directoryId);
    
    if (!watcherInstance) {
        console.log(`No active watcher for directory ID: ${directoryId}`);
        return;
    }

    try {
        await watcherInstance.watcher.close();
        activeWatchers.delete(directoryId);
        console.log(`Stopped watching directory: ${watcherInstance.directoryPath}`);
    } catch (error) {
        console.error(`Error stopping watcher for directory ${directoryId}:`, error);
    }
}

/**
 * Stop all watchers
 */
export async function stopAllWatchers(): Promise<void> {
    console.log(`Stopping ${activeWatchers.size} active watcher(s)...`);
    
    const stopPromises = Array.from(activeWatchers.keys()).map(directoryId =>
        stopWatching(directoryId)
    );
    
    await Promise.all(stopPromises);
    console.log("All watchers stopped");
}

/**
 * Get all active watchers
 */
export function getActiveWatchers(): Array<{ directoryId: UUID; directoryPath: string }> {
    return Array.from(activeWatchers.values()).map(({ directoryId, directoryPath }) => ({
        directoryId,
        directoryPath,
    }));
}

/**
 * Check if a directory is being watched
 */
export function isWatching(directoryId: UUID): boolean {
    return activeWatchers.has(directoryId);
}

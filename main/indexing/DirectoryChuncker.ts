/**
 * Name of code artifact: main/indexing/DirectoryChuncker.ts
 * Brief description: Implements note chunking and indexing routines used by the local RAG workflow.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: a157p624; Wesley McDougal; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { chunkText, Chunk, ChunkingConfig } from "./chunking";
import {
    addFile,
    addChunk,
    deleteChunkById,
    getFileByPath,
    getFilesByDirectory,
    addEmbedding,
    updateFileHash,
    getChunksByFile,
} from "@/main/database/documentRepository";
import { embedChunk } from "../embeding/embeding";

type UUID = string;

/**
 * Supported file types
 */
const SUPPORTED_EXTENSIONS = [".md", ".txt", ".markdown"];

/**
 * Configuration for directory chunking
 */
export interface DirectoryChunkerConfig {
    supportedExtensions?: string[];
    ignorePatterns?: string[];
    maxFileSize?: number; // Max file size in bytes (default: 10MB)
    chunkingConfig?: ChunkingConfig;
}

/**
 * File with its chunks
 */
export interface FileWithChunks {
    filePath: string;
    fileName: string;
    chunks: Chunk[];
    error?: string;
}

interface ChunkSyncStats {
    chunksAdded: number;
    chunksRemoved: number;
    chunksUnchanged: number;
}

/**
 * Result of chunking a directory
 */
export interface DirectoryChunkResult {
    directoryPath: string;
    files: FileWithChunks[];
    totalFiles: number;
    totalChunks: number;
    errors: number;
}

const DEFAULT_CONFIG: DirectoryChunkerConfig = {
    supportedExtensions: SUPPORTED_EXTENSIONS,
    ignorePatterns: ["node_modules", ".git", "dist", "build", ".next", ".vscode"],
    maxFileSize: 10 * 1024 * 1024, // 10MB
};

/**
 * Compute file hash
 */
/**
 * Functionality: computeFileHash performs the compute file hash workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: content (string).
 * Returns: Returns string.
 * Usage: Call computeFileHash from the owning module or component when this behavior is required.
 */
function computeFileHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Check if file is supported
 */
/**
 * Functionality: isSupportedFile performs the is supported file workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: filePath (string); config (DirectoryChunkerConfig).
 * Returns: Returns boolean.
 * Usage: Call isSupportedFile from the owning module or component when this behavior is required.
 */
function isSupportedFile(filePath: string, config: DirectoryChunkerConfig): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const extensions = config.supportedExtensions || SUPPORTED_EXTENSIONS;
    return extensions.includes(ext);
}

/**
 * Check if path should be ignored
 */
/**
 * Functionality: shouldIgnore performs the should ignore workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: filePath (string); config (DirectoryChunkerConfig).
 * Returns: Returns boolean.
 * Usage: Call shouldIgnore from the owning module or component when this behavior is required.
 */
function shouldIgnore(filePath: string, config: DirectoryChunkerConfig): boolean {
    const ignorePatterns = config.ignorePatterns || DEFAULT_CONFIG.ignorePatterns!;

    return ignorePatterns.some(pattern => {
        return filePath.includes(path.sep + pattern + path.sep) ||
               filePath.includes(path.sep + pattern) ||
               filePath.startsWith(pattern);
    });
}

/**
 * Recursively find all supported files in directory
 */
/**
 * Functionality: findSupportedFiles performs the find supported files workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: dirPath (string); config (DirectoryChunkerConfig).
 * Returns: Returns Promise<string[]>.
 * Usage: Call findSupportedFiles from the owning module or component when this behavior is required.
 */
async function findSupportedFiles(
    dirPath: string,
    config: DirectoryChunkerConfig
): Promise<string[]> {
    const files: string[] = [];

        /**
     * Functionality: scan performs the scan workflow used by main/indexing/DirectoryChuncker.ts.
     * Parameters: currentPath (string).
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call scan from the owning module or component when this behavior is required.
     */
async function scan(currentPath: string) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                // Skip ignored paths
                if (shouldIgnore(fullPath, config)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await scan(fullPath);
                } else if (entry.isFile()) {
                    // Check if file is supported
                    if (!isSupportedFile(fullPath, config)) {
                        continue;
                    }

                    // Check file size
                    const stats = await fs.stat(fullPath);
                    const maxSize = config.maxFileSize || DEFAULT_CONFIG.maxFileSize!;
                    if (stats.size > maxSize) {
                        console.warn(`Skipping large file: ${fullPath} (${stats.size} bytes)`);
                        continue;
                    }

                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`Failed to scan directory ${currentPath}:`, error);
        }
    }

    await scan(dirPath);
    return files;
}

/**
 * Process a single file and return its chunks
 */
/**
 * Functionality: processFile performs the process file workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: filePath (string); config (DirectoryChunkerConfig).
 * Returns: Returns Promise<FileWithChunks>.
 * Usage: Call processFile from the owning module or component when this behavior is required.
 */
async function processFile(
    filePath: string,
    config: DirectoryChunkerConfig
): Promise<FileWithChunks> {
    const result: FileWithChunks = {
        filePath,
        fileName: path.basename(filePath),
        chunks: [],
    };

    try {
        // Read file content
        const content = await fs.readFile(filePath, "utf-8");

        // Chunk the content
        result.chunks = chunkText(content, filePath, config.chunkingConfig);

        console.log(`Processed ${filePath}: ${result.chunks.length} chunks`);
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`Failed to process file ${filePath}:`, error);
    }

    return result;
}

/**
 * Main function: Chunk all relevant files in a directory
 */
/**
 * Functionality: chunkDirectory performs the chunk directory workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: directoryPath (string); config (DirectoryChunkerConfig).
 * Returns: Returns Promise<DirectoryChunkResult>.
 * Usage: Call chunkDirectory from the owning module or component when this behavior is required.
 */
export async function chunkDirectory(
    directoryPath: string,
    config: DirectoryChunkerConfig = DEFAULT_CONFIG
): Promise<DirectoryChunkResult> {
    console.log(`Starting to chunk directory: ${directoryPath}`);

    // Find all supported files
    const filePaths = await findSupportedFiles(directoryPath, config);
    console.log(`Found ${filePaths.length} supported files`);

    // Process each file
    const files: FileWithChunks[] = [];
    let totalChunks = 0;
    let errors = 0;

    for (const filePath of filePaths) {
        const fileResult = await processFile(filePath, config);
        files.push(fileResult);

        if (fileResult.error) {
            errors++;
        } else {
            totalChunks += fileResult.chunks.length;
        }
    }

    const result: DirectoryChunkResult = {
        directoryPath,
        files,
        totalFiles: files.length,
        totalChunks,
        errors,
    };

    console.log(`Chunking complete: ${result.totalFiles} files, ${result.totalChunks} chunks, ${result.errors} errors`);

    return result;
}

/**
 * Chunk a single file (utility function)
 */
/**
 * Functionality: chunkSingleFile performs the chunk single file workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: filePath (string); config (ChunkingConfig).
 * Returns: Returns Promise<Chunk[]>.
 * Usage: Call chunkSingleFile from the owning module or component when this behavior is required.
 */
export async function chunkSingleFile(
    filePath: string,
    config?: ChunkingConfig
): Promise<Chunk[]> {
    const content = await fs.readFile(filePath, "utf-8");
    return chunkText(content, filePath, config);
}

/**
 * Get statistics about chunks
 */
/**
 * Functionality: getChunkStats performs the get chunk stats workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: result (DirectoryChunkResult).
 * Returns: Returns { averageChunksPerFile: number; totalTokensEstimate: number; filesWithErrors: string[]; }.
 * Usage: Call getChunkStats from the owning module or component when this behavior is required.
 */
export function getChunkStats(result: DirectoryChunkResult): {
    averageChunksPerFile: number;
    totalTokensEstimate: number;
    filesWithErrors: string[];
} {
    const filesWithErrors = result.files
        .filter(f => f.error)
        .map(f => f.filePath);

    const successfulFiles = result.files.filter(f => !f.error);
    const averageChunksPerFile = successfulFiles.length > 0
        ? result.totalChunks / successfulFiles.length
        : 0;

    // Rough token estimate (4 chars per token)
    const totalTokensEstimate = result.files.reduce((sum, file) => {
        return sum + file.chunks.reduce((chunkSum, chunk) => {
            return chunkSum + Math.ceil(chunk.content.length / 4);
        }, 0);
    }, 0);

    return {
        averageChunksPerFile,
        totalTokensEstimate,
        filesWithErrors,
    };
}

/**
 * Chunk directory and add to database with embeddings
 */
/**
 * Functionality: chunkAndStoreDirectory performs the chunk and store directory workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: directoryId (UUID); directoryPath (string); config (DirectoryChunkerConfig).
 * Returns: Returns Promise<{ filesProcessed: number; filesSkipped: number; chunksCreated: number; errors: number; errorFiles: string[]; }>.
 * Usage: Call chunkAndStoreDirectory from the owning module or component when this behavior is required.
 */
export async function chunkAndStoreDirectory(
    directoryId: UUID,
    directoryPath: string,
    config: DirectoryChunkerConfig = DEFAULT_CONFIG
): Promise<{
    filesProcessed: number;
    filesSkipped: number;
    chunksCreated: number;
    errors: number;
    errorFiles: string[];
}> {
    console.log(`Starting to chunk and store directory: ${directoryPath}`);

    const stats = {
        filesProcessed: 0,
        filesSkipped: 0,
        chunksCreated: 0,
        errors: 0,
        errorFiles: [] as string[],
    };

    try {
        // Find all supported files
        const filePaths = await findSupportedFiles(directoryPath, config);
        console.log(`Found ${filePaths.length} files to process`);

        // Process each file
        for (const filePath of filePaths) {
            try {
                // Read file content
                const content = await fs.readFile(filePath, "utf-8");

                const fileStat = await fs.stat(filePath);
                const lastModified = fileStat.mtimeMs;

                const result = await upsertFileChunks(
                    directoryId,
                    filePath,
                    content,
                    lastModified,
                    config.chunkingConfig
                );

                if (result.skipped) {
                    stats.filesSkipped++;
                    continue;
                }

                stats.filesProcessed++;
                stats.chunksCreated += result.chunkStats.chunksAdded;
                console.log(
                    `✓ Processed ${path.basename(filePath)}: +${result.chunkStats.chunksAdded} / -${result.chunkStats.chunksRemoved} / =${result.chunkStats.chunksUnchanged}`
                );

            } catch (error) {
                console.error(`Failed to process file ${filePath}:`, error);
                stats.errors++;
                stats.errorFiles.push(filePath);
            }
        }

        console.log("\n=== Chunking and Storage Complete ===");
        console.log(`Files processed: ${stats.filesProcessed}`);
        console.log(`Files skipped: ${stats.filesSkipped}`);
        console.log(`Chunks created: ${stats.chunksCreated}`);
        console.log(`Errors: ${stats.errors}`);

        return stats;

    } catch (error) {
        console.error("Fatal error during chunking and storage:", error);
        throw error;
    }
}

/**
 * Chunk single file and add to database with embeddings
 */
/**
 * Functionality: chunkAndStoreFile performs the chunk and store file workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: directoryId (UUID); filePath (string); config (ChunkingConfig).
 * Returns: Returns Promise<{ fileId: UUID; chunksCreated: number }>.
 * Usage: Call chunkAndStoreFile from the owning module or component when this behavior is required.
 */
export async function chunkAndStoreFile(
    directoryId: UUID,
    filePath: string,
    config?: ChunkingConfig
): Promise<{ fileId: UUID; chunksCreated: number }> {
    console.log(`Chunking and storing file: ${filePath}`);

    const content = await fs.readFile(filePath, "utf-8");
    const fileStat = await fs.stat(filePath);
    const lastModified = fileStat.mtimeMs;

    const result = await upsertFileChunks(
        directoryId,
        filePath,
        content,
        lastModified,
        config
    );

    if (result.skipped) {
        console.log(`Skipping unchanged file: ${filePath}`);
    } else {
        console.log(
            `✓ Stored ${filePath}: +${result.chunkStats.chunksAdded} / -${result.chunkStats.chunksRemoved} / =${result.chunkStats.chunksUnchanged}`
        );
    }

    return { fileId: result.fileId, chunksCreated: result.chunkStats.chunksAdded };
}

/**
 * Functionality: upsertFileChunks performs the upsert file chunks workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: directoryId (UUID); filePath (string); content (string); lastModified (number); chunkingConfig (ChunkingConfig).
 * Returns: Returns Promise<{ fileId: UUID; skipped: boolean; chunkStats: ChunkSyncStats }>.
 * Usage: Call upsertFileChunks from the owning module or component when this behavior is required.
 */
async function upsertFileChunks(
    directoryId: UUID,
    filePath: string,
    content: string,
    lastModified: number,
    chunkingConfig?: ChunkingConfig
): Promise<{ fileId: UUID; skipped: boolean; chunkStats: ChunkSyncStats }> {
    const fileHash = computeFileHash(content);
    const existingFile = getFileByPath(directoryId, filePath) as any | undefined;

    if (existingFile && existingFile.file_hash === fileHash) {
        return {
            fileId: existingFile.id,
            skipped: true,
            chunkStats: { chunksAdded: 0, chunksRemoved: 0, chunksUnchanged: 0 },
        };
    }

    const nextChunks = chunkText(content, filePath, chunkingConfig);

    let fileId: UUID;
    if (existingFile) {
        fileId = existingFile.id;
    } else {
        const created = addFile(directoryId, filePath, fileHash, lastModified);
        fileId = created.id;
    }

    const chunkStats = await syncChangedChunks(fileId, nextChunks);

    // Update file hash only after chunk+embedding updates succeed.
    updateFileHash(fileId, fileHash, lastModified);

    return {
        fileId,
        skipped: false,
        chunkStats,
    };
}

/**
 * Functionality: syncChangedChunks performs the sync changed chunks workflow used by main/indexing/DirectoryChuncker.ts.
 * Parameters: fileId (UUID); nextChunks (Chunk[]).
 * Returns: Returns Promise<ChunkSyncStats>.
 * Usage: Call syncChangedChunks from the owning module or component when this behavior is required.
 */
async function syncChangedChunks(fileId: UUID, nextChunks: Chunk[]): Promise<ChunkSyncStats> {
    const existingChunks = getChunksByFile(fileId) as Array<{ id: number; content_hash: string }>;

    const byHash = new Map<string, Array<{ id: number; content_hash: string }>>();
    for (const chunk of existingChunks) {
        const list = byHash.get(chunk.content_hash) ?? [];
        list.push(chunk);
        byHash.set(chunk.content_hash, list);
    }

    const toAdd: Chunk[] = [];
    let chunksUnchanged = 0;

    for (const nextChunk of nextChunks) {
        const matches = byHash.get(nextChunk.contentHash);
        if (matches && matches.length > 0) {
            matches.pop();
            chunksUnchanged++;
        } else {
            toAdd.push(nextChunk);
        }
    }

    const toDeleteIds: number[] = [];
    for (const remaining of Array.from(byHash.values())) {
        for (const chunk of remaining) {
            toDeleteIds.push(chunk.id);
        }
    }

    const embeddingsForAdds = await Promise.all(toAdd.map((chunk) => embedChunk(chunk.content)));

    for (const chunkId of toDeleteIds) {
        deleteChunkById(chunkId);
    }

    for (let i = 0; i < toAdd.length; i++) {
        const chunk = toAdd[i];
        addChunk(fileId, chunk.contentHash, chunk.content);
        addEmbedding(embeddingsForAdds[i]);
    }

    return {
        chunksAdded: toAdd.length,
        chunksRemoved: toDeleteIds.length,
        chunksUnchanged,
    };
}

// Re-export types for convenience
export type { Chunk, ChunkingConfig } from "./chunking";

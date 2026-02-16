import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import { chunkDirectory, DirectoryChunkerConfig } from "./DirectoryChuncker";
import {
    addFile,
    addChunk,
    getFilesByDirectory,
} from "@/main/database/documentRepository";

type UUID = string;

/**
 * Embedding generation function type
 */
export type EmbeddingFunction = (text: string) => Promise<number[]>;

/**
 * Generate placeholder embeddings for testing
 * Returns a 384-dimensional vector (common embedding size)
 */
export function generatePlaceholderEmbedding(text: string): number[] {
    const dimension = 384; // Standard embedding dimension
    const embedding: number[] = [];
    
    // Simple hash-based pseudo-random generation
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Generate deterministic "random" values based on hash
    for (let i = 0; i < dimension; i++) {
        const seed = (hash + i * 12345) & 0x7fffffff;
        const value = (Math.sin(seed) * 10000) % 1;
        embedding.push(value);
    }
    
    return embedding;
}

/**
 * Async wrapper for placeholder embedding (matches EmbeddingFunction signature)
 */
export async function placeholderEmbeddingFunction(text: string): Promise<number[]> {
    return generatePlaceholderEmbedding(text);
}

/**
 * Configuration for indexing and storing chunks
 */
export interface IndexAndStoreConfig {
    directoryId: UUID;
    directoryPath: string;
    embeddingFunction: EmbeddingFunction;
    chunkerConfig?: DirectoryChunkerConfig;
}

/**
 * Statistics for indexing operation
 */
export interface IndexingStats {
    filesProcessed: number;
    filesSkipped: number;
    chunksCreated: number;
    errors: number;
    errorFiles: string[];
}

/**
 * Compute file hash for change detection
 */
async function computeFileHash(filePath: string): Promise<string> {
    const crypto = require("crypto");
    const content = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Index a directory: chunk files and store in database with embeddings
 */
export async function indexDirectoryToDatabase(
    config: IndexAndStoreConfig
): Promise<IndexingStats> {
    const stats: IndexingStats = {
        filesProcessed: 0,
        filesSkipped: 0,
        chunksCreated: 0,
        errors: 0,
        errorFiles: [],
    };

    console.log(`Starting indexing for directory: ${config.directoryPath}`);

    try {
        // Step 1: Chunk all files in the directory
        const chunkResult = await chunkDirectory(
            config.directoryPath,
            config.chunkerConfig
        );

        console.log(`Found ${chunkResult.totalFiles} files with ${chunkResult.totalChunks} chunks`);

        // Step 2: Get existing files from database to check for duplicates
        const existingFilesRaw = getFilesByDirectory(config.directoryId) as any[];
        const existingFilesMap = new Map(
            existingFilesRaw.map(f => [f.file_path, f])
        );

        // Step 3: Process each file
        for (const fileResult of chunkResult.files) {
            try {
                // Skip files with errors during chunking
                if (fileResult.error) {
                    console.warn(`Skipping file with chunking error: ${fileResult.filePath}`);
                    stats.filesSkipped++;
                    stats.errorFiles.push(fileResult.filePath);
                    continue;
                }

                // Skip files with no chunks
                if (fileResult.chunks.length === 0) {
                    console.warn(`Skipping file with no chunks: ${fileResult.filePath}`);
                    stats.filesSkipped++;
                    continue;
                }

                // Compute file hash
                const fileHash = await computeFileHash(fileResult.filePath);
                const fileStat = await fs.stat(fileResult.filePath);
                const lastModified = fileStat.mtimeMs;

                // Check if file already exists with same hash
                const existingFile = existingFilesMap.get(fileResult.filePath);
                if (existingFile && existingFile.file_hash === fileHash) {
                    console.log(`Skipping unchanged file: ${fileResult.filePath}`);
                    stats.filesSkipped++;
                    continue;
                }

                // Add file to database (or it already exists and we'll update later)
                let fileId: UUID;
                if (existingFile) {
                    fileId = existingFile.id;
                    console.log(`File exists, will update: ${fileResult.filePath}`);
                    // TODO: In future, delete old chunks and update file hash
                    // For now, skip to avoid duplicates
                    stats.filesSkipped++;
                    continue;
                } else {
                    // FIXED: Use the returned UUID
                    const { id } = addFile(
                        config.directoryId,
                        fileResult.filePath,
                        fileHash,
                        lastModified
                    );
                    fileId = id;
                    console.log(`Added new file: ${fileResult.filePath} (${fileId})`);
                }

                // Step 4: Generate embeddings and store chunks
                console.log(`Processing ${fileResult.chunks.length} chunks for ${fileResult.fileName}`);
                
                for (let i = 0; i < fileResult.chunks.length; i++) {
                    const chunk = fileResult.chunks[i];
                    
                    try {
                        // Generate embedding
                        const embedding = await config.embeddingFunction(chunk.content);
                        
                        // Convert to buffer
                        const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
                        
                        // FIXED: Correct parameter order - no directoryId
                        addChunk(
                            fileId,
                            chunk.contentHash,  // contentHash is 2nd
                            chunk.content,      // content is 3rd
                            embeddingBuffer
                        );
                        
                        stats.chunksCreated++;
                        
                        if ((i + 1) % 10 === 0) {
                            console.log(`  Processed ${i + 1}/${fileResult.chunks.length} chunks`);
                        }
                    } catch (error) {
                        console.error(`Failed to process chunk ${i} for ${fileResult.filePath}:`, error);
                        stats.errors++;
                    }
                }

                stats.filesProcessed++;
                console.log(`✓ Completed ${fileResult.fileName}: ${fileResult.chunks.length} chunks`);

            } catch (error) {
                console.error(`Failed to process file ${fileResult.filePath}:`, error);
                stats.errors++;
                stats.errorFiles.push(fileResult.filePath);
            }
        }

        console.log("\n=== Indexing Complete ===");
        console.log(`Files processed: ${stats.filesProcessed}`);
        console.log(`Files skipped: ${stats.filesSkipped}`);
        console.log(`Chunks created: ${stats.chunksCreated}`);
        console.log(`Errors: ${stats.errors}`);

        return stats;

    } catch (error) {
        console.error("Fatal error during indexing:", error);
        throw error;
    }
}

/**
 * Index a single file to database
 */
export async function indexFileToDatabase(
    directoryId: UUID,
    filePath: string,
    embeddingFunction: EmbeddingFunction,
    chunkerConfig?: DirectoryChunkerConfig["chunkingConfig"]
): Promise<{ fileId: UUID; chunksCreated: number }> {
    console.log(`Indexing single file: ${filePath}`);

    // Import chunkSingleFile
    const { chunkSingleFile } = require("./DirectoryChuncker");
    
    // Chunk the file
    const chunks = await chunkSingleFile(filePath, chunkerConfig);
    
    if (chunks.length === 0) {
        throw new Error("No chunks generated for file");
    }

    // Compute file hash
    const fileHash = await computeFileHash(filePath);
    const fileStat = await fs.stat(filePath);
    const lastModified = fileStat.mtimeMs;

    // FIXED: Use the returned UUID
    const { id: fileId } = addFile(
        directoryId,
        filePath,
        fileHash,
        lastModified
    );

    // Process chunks
    let chunksCreated = 0;
    for (const chunk of chunks) {
        const embedding = await embeddingFunction(chunk.content);
        const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
        
        // FIXED: Correct parameter order - no directoryId
        addChunk(
            fileId,
            chunk.contentHash,  // contentHash is 2nd
            chunk.content,      // content is 3rd
            embeddingBuffer
        );
        
        chunksCreated++;
    }

    console.log(`✓ Indexed ${filePath}: ${chunksCreated} chunks`);

    return { fileId, chunksCreated };
}
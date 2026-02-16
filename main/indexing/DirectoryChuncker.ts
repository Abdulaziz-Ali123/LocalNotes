import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { chunkText, Chunk, ChunkingConfig } from "./chunking";
import {
    addFile,
    addChunk,
    getFilesByDirectory,
} from "@/main/database/documentRepository";

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
 * Generate placeholder embeddings for testing
 */
function generatePlaceholderEmbedding(text: string): number[] {
    const dimension = 384;
    const embedding: number[] = [];
    
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash = hash & hash;
    }
    
    for (let i = 0; i < dimension; i++) {
        const seed = (hash + i * 12345) & 0x7fffffff;
        const value = (Math.sin(seed) * 10000) % 1;
        embedding.push(value);
    }
    
    return embedding;
}

/**
 * Compute file hash
 */
function computeFileHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Check if file is supported
 */
function isSupportedFile(filePath: string, config: DirectoryChunkerConfig): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const extensions = config.supportedExtensions || SUPPORTED_EXTENSIONS;
    return extensions.includes(ext);
}

/**
 * Check if path should be ignored
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
async function findSupportedFiles(
    dirPath: string,
    config: DirectoryChunkerConfig
): Promise<string[]> {
    const files: string[] = [];
    
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
 * Chunk directory and add to database with placeholder embeddings
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
        // Get existing files from database
        const existingFilesRaw = getFilesByDirectory(directoryId) as any[];
        const existingFilesMap = new Map(
            existingFilesRaw.map(f => [f.file_path, f])
        );
        
        // Find all supported files
        const filePaths = await findSupportedFiles(directoryPath, config);
        console.log(`Found ${filePaths.length} files to process`);
        
        // Process each file
        for (const filePath of filePaths) {
            try {
                // Read file content
                const content = await fs.readFile(filePath, "utf-8");
                
                // Compute file hash
                const fileHash = computeFileHash(content);
                const fileStat = await fs.stat(filePath);
                const lastModified = fileStat.mtimeMs;
                
                // Check if file already exists with same hash
                const existingFile = existingFilesMap.get(filePath);
                if (existingFile && existingFile.file_hash === fileHash) {
                    console.log(`Skipping unchanged file: ${filePath}`);
                    stats.filesSkipped++;
                    continue;
                }
                
                // Chunk the file
                const chunks = chunkText(content, filePath, config.chunkingConfig);
                
                if (chunks.length === 0) {
                    console.warn(`No chunks generated for: ${filePath}`);
                    stats.filesSkipped++;
                    continue;
                }
                
                // Add file to database (or skip if exists)
                let fileId: UUID;
                if (existingFile) {
                    console.log(`File exists, skipping for now: ${filePath}`);
                    stats.filesSkipped++;
                    continue;
                } else {
                    // FIXED: Use the returned UUID
                    const { id } = addFile(
                        directoryId,
                        filePath,
                        fileHash,
                        lastModified
                    );
                    fileId = id;
                    console.log(`Added file: ${path.basename(filePath)} (${fileId.substring(0, 8)}...)`);
                }
                
                // Store chunks with placeholder embeddings
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    
                    try {
                        // Generate placeholder embedding
                        const embedding = generatePlaceholderEmbedding(chunk.content);
                        const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
                        
                        // FIXED: Correct parameter order - no directoryId
                        addChunk(
                            fileId,
                            chunk.contentHash,
                            chunk.content,
                            embeddingBuffer
                        );
                        
                        stats.chunksCreated++;
                    } catch (error) {
                        console.error(`Failed to store chunk ${i} for ${filePath}:`, error);
                        stats.errors++;
                    }
                }
                
                stats.filesProcessed++;
                console.log(`✓ Processed ${path.basename(filePath)}: ${chunks.length} chunks`);
                
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
 * Chunk single file and add to database with placeholder embeddings
 */
export async function chunkAndStoreFile(
    directoryId: UUID,
    filePath: string,
    config?: ChunkingConfig
): Promise<{ fileId: UUID; chunksCreated: number }> {
    console.log(`Chunking and storing file: ${filePath}`);
    
    // Read file content
    const content = await fs.readFile(filePath, "utf-8");
    
    // Chunk the content
    const chunks = chunkText(content, filePath, config);
    
    if (chunks.length === 0) {
        throw new Error("No chunks generated for file");
    }
    
    // Compute file hash
    const fileHash = computeFileHash(content);
    const fileStat = await fs.stat(filePath);
    const lastModified = fileStat.mtimeMs;
    
    // FIXED: Use the returned UUID
    const { id: fileId } = addFile(
        directoryId,
        filePath,
        fileHash,
        lastModified
    );
    
    // Store chunks with placeholder embeddings
    let chunksCreated = 0;
    for (const chunk of chunks) {
        const embedding = generatePlaceholderEmbedding(chunk.content);
        const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
        
      
        addChunk(
            fileId,
            chunk.contentHash,
            chunk.content,
            embeddingBuffer
        );
        
        chunksCreated++;
    }
    
    console.log(`✓ Stored ${filePath}: ${chunksCreated} chunks`);
    
    return { fileId, chunksCreated };
}

// Re-export types for convenience
export type { Chunk, ChunkingConfig } from "./chunking";
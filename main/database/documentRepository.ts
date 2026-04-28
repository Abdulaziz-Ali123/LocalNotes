/**
 * Purpose:
 *  Provides database operations for directories, files, chunks, and embeddings.
 *
 * Git-history contributors: Shaun; Wesley McDougal; Abdulaziz-Ali123; Abdulaziz Ali; a157p624
 * Revision History:
 *  • Wesley McDougal - 05APR2026 - Made addDirectory idempotent and prevented duplicate directory registration failures
 */

import { randomUUID } from "crypto";
import { getDB } from "@/main/database/sqllite";

type UUID = string;

/**
 * Functionality: addDirectory performs the add directory workflow used by main/database/documentRepository.ts.
 * Parameters: uuid (string); path (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call addDirectory from the owning module or component when this behavior is required.
 */
export function addDirectory(uuid: string, path: string) {
    const db = getDB();

    try {
        const existingById = db.prepare(`
            SELECT id, path FROM directories
            WHERE id = ?
        `).get(uuid) as { id: string; path: string } | undefined;

        if (existingById) {
            if (existingById.path !== path) {
                return db.prepare(`
                    UPDATE directories
                    SET path = ?
                    WHERE id = ?
                `).run(path, uuid);
            }

            return {
                changes: 0,
                lastInsertRowid: 0,
            };
        }

        const existingByPath = db.prepare(`
            SELECT id FROM directories
            WHERE path = ?
        `).get(path) as { id: string } | undefined;

        if (existingByPath) {
            return {
                changes: 0,
                lastInsertRowid: 0,
            };
        }

        const stmt = db.prepare(`
            INSERT INTO directories (id, path)
            VALUES (?, ?)
        `);
        return stmt.run(uuid, path);
    } catch (error) {
        console.error("Failed to add directory:", error);
        throw error;
    }
}

/**
 * Functionality: updateDirectory performs the update directory workflow used by main/database/documentRepository.ts.
 * Parameters: id (UUID); path (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call updateDirectory from the owning module or component when this behavior is required.
 */
export function updateDirectory(id: UUID, path?: string) {
    const db = getDB();

    const updates: string[] = [];
    const params: any[] = [];
    if (path) {
        updates.push("path = ?");
        params.push(path);
    }

    if (updates.length === 0) {
        throw new Error("No fields to update");
    }

    params.push(id);

    const sql = `
        UPDATE directories
        SET ${updates.join(", ")}
        WHERE id = ?
    `;

    try {
        const stmt = db.prepare(sql);
        return stmt.run(...params);
    } catch (error) {
        console.error("Failed to update directory:", error);
        throw error;
    }
}

/**
 * Functionality: deleteDirectory performs the delete directory workflow used by main/database/documentRepository.ts.
 * Parameters: id (UUID).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call deleteDirectory from the owning module or component when this behavior is required.
 */
export function deleteDirectory(id: UUID) {
    const db = getDB();

    const transaction = db.transaction(() => {
        // Delete chunks through files
        const files = db.prepare(`
            SELECT id FROM files WHERE directory_id = ?
        `).all(id) as Array<{ id: string }>;

        for (const file of files) {
            db.prepare(`DELETE FROM chunks WHERE file_id = ?`).run(file.id);
        }

        // Delete files
        db.prepare(`DELETE FROM files WHERE directory_id = ?`).run(id);

        // Delete directory
        db.prepare(`DELETE FROM directories WHERE id = ?`).run(id);
    });

    try {
        transaction();
    } catch (error) {
        console.error("Failed to delete directory:", error);
        throw error;
    }
}

/**
 * Functionality: getDirectory performs the get directory workflow used by main/database/documentRepository.ts.
 * Parameters: id (UUID).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call getDirectory from the owning module or component when this behavior is required.
 */
export function getDirectory(id: UUID) {
    const db = getDB();

    try {
        return db.prepare(`
            SELECT * FROM directories
            WHERE id = ?
        `).get(id);
    } catch (error) {
        console.error("Failed to get directory:", error);
        throw error;
    }
}

/**
 * Functionality: getAllDirectories performs the get all directories workflow used by main/database/documentRepository.ts.
 * Parameters: None.
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call getAllDirectories from the owning module or component when this behavior is required.
 */
export function getAllDirectories() {
    const db = getDB();

    try {
        return db.prepare(`
            SELECT * FROM directories
            ORDER BY created_at DESC
        `).all();
    } catch (error) {
        console.error("Failed to get directories:", error);
        throw error;
    }
}

/**
 * Functionality: getDirectoryIdByPath performs the get directory id by path workflow used by main/database/documentRepository.ts.
 * Parameters: path (string).
 * Returns: Returns string | undefined.
 * Usage: Call getDirectoryIdByPath from the owning module or component when this behavior is required.
 */
export function getDirectoryIdByPath(path: string): string | undefined {
    const db = getDB();

    try {
        const result = db.prepare(`
            SELECT id FROM directories
            WHERE path = ?
        `).get(path) as { id: string } | undefined;
        return result?.id;
    } catch (error) {
        console.error("Failed to get directory ID by path:", error);
        throw error;
    }
}


/**
 * Functionality: getFileByAbsolutePath performs the get file by absolute path workflow used by main/database/documentRepository.ts.
 * Parameters: filePath (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call getFileByAbsolutePath from the owning module or component when this behavior is required.
 */
export function getFileByAbsolutePath(filePath: string) {
    const db = getDB();

    try {
        return db.prepare(`
            SELECT *
            FROM files
            WHERE file_path = ?
            LIMIT 1
        `).get(filePath);
    } catch (error) {
        console.error("Failed to get file by absolute path:", error);
        throw error;
    }
}

/**
 * Functionality: addFile performs the add file workflow used by main/database/documentRepository.ts.
 * Parameters: directoryId (UUID); filePath (string); fileHash (string); lastModified (number).
 * Returns: Returns { id: UUID; result: any }.
 * Usage: Call addFile from the owning module or component when this behavior is required.
 */
export function addFile(
    directoryId: UUID,
    filePath: string,
    fileHash: string,
    lastModified: number
): { id: UUID; result: any } {
    const db = getDB();
    
    // Check if file already exists globally by path
    const existing = getFileByAbsolutePath(filePath) as any;
    if (existing) {
        const sql = `
            UPDATE files
            SET directory_id = ?, file_hash = ?, last_modified = ?
            WHERE id = ?
        `;
        const stmt = db.prepare(sql);
        const result = stmt.run(directoryId, fileHash, lastModified, existing.id);
        return { id: existing.id, result };
    }

    const id: UUID = randomUUID();
    const sql = `
        INSERT INTO files (
            id,
            directory_id,
            file_path,
            file_hash,
            last_modified
        )
        VALUES (?, ?, ?, ?, ?)
    `;

    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(id, directoryId, filePath, fileHash, lastModified);
        return { id, result };
    } catch (error) {
        console.error("Failed to add file:", error);
        throw error;
    }
}

/**
 * Functionality: updateFileHash performs the update file hash workflow used by main/database/documentRepository.ts.
 * Parameters: fileId (UUID); fileHash (string); lastModified (number).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call updateFileHash from the owning module or component when this behavior is required.
 */
export function updateFileHash(
    fileId: UUID,
    fileHash: string,
    lastModified: number
) {
    const db = getDB();

    const sql = `
        UPDATE files
        SET file_hash = ?, last_modified = ?
        WHERE id = ?
    `;

    try {
        const stmt = db.prepare(sql);
        return stmt.run(fileHash, lastModified, fileId);
    } catch (error) {
        console.error("Failed to update file:", error);
        throw error;
    }
}

/**
 * Functionality: deleteFile performs the delete file workflow used by main/database/documentRepository.ts.
 * Parameters: fileId (UUID).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call deleteFile from the owning module or component when this behavior is required.
 */
export function deleteFile(fileId: UUID) {
    const db = getDB();

    const transaction = db.transaction(() => {
        db.prepare(`
            DELETE FROM chunks
            WHERE file_id = ?
        `).run(fileId);

        db.prepare(`
            DELETE FROM files
            WHERE id = ?
        `).run(fileId);
    });

    try {
        transaction();
    } catch (error) {
        console.error("Failed to delete file:", error);
        throw error;
    }
}

/**
 * Functionality: getFilesByDirectory performs the get files by directory workflow used by main/database/documentRepository.ts.
 * Parameters: directoryId (UUID).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call getFilesByDirectory from the owning module or component when this behavior is required.
 */
export function getFilesByDirectory(directoryId: UUID) {
    const db = getDB();

    try {
        return db.prepare(`
            SELECT *
            FROM files
            WHERE directory_id = ?
            ORDER BY created_at DESC
        `).all(directoryId);
    } catch (error) {
        console.error("Failed to get files:", error);
        throw error;
    }
}

/**
 * Functionality: getFileByPath performs the get file by path workflow used by main/database/documentRepository.ts.
 * Parameters: directoryId (UUID); filePath (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call getFileByPath from the owning module or component when this behavior is required.
 */
export function getFileByPath(directoryId: UUID, filePath: string) {
    const db = getDB();

    try {
        return db.prepare(`
            SELECT *
            FROM files
            WHERE directory_id = ? AND file_path = ?
            LIMIT 1
        `).get(directoryId, filePath);
    } catch (error) {
        console.error("Failed to get file by path:", error);
        throw error;
    }
}

/**
 * Functionality: addChunk performs the add chunk workflow used by main/database/documentRepository.ts.
 * Parameters: fileId (UUID); contentHash (string); content (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call addChunk from the owning module or component when this behavior is required.
 */
export function addChunk(
    fileId: UUID,
    contentHash: string,
    content: string
) {
    const db = getDB();
    const id: UUID = randomUUID();

    const sql = `
        INSERT INTO chunks (
            file_id,
            content_hash,
            content
        )
        VALUES (?, ?, ?)
    `;

    try {
        const stmt = db.prepare(sql);
        return stmt.run(
            fileId,
            contentHash,
            content,
        );
    } catch (error) {
        console.error("Failed to add chunk:", error);
        throw error;
    }
}

/**
 * Functionality: addEmbedding performs the add embedding workflow used by main/database/documentRepository.ts.
 * Parameters: embedding (Float32Array | number[]).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call addEmbedding from the owning module or component when this behavior is required.
 */
export function addEmbedding(
    embedding: Float32Array | number[],
) {
    const db = getDB();

    const sql = `
        INSERT INTO embeddings (
            embedding
        )
        VALUES (?)
    `;

    try {
        const stmt = db.prepare(sql);
        return stmt.run(
            embedding
        );
    } catch (error) {
        console.error("Failed to add embedding:", error);
        throw error;
    }
}

/**
 * Functionality: deleteChunksByFile performs the delete chunks by file workflow used by main/database/documentRepository.ts.
 * Parameters: fileId (UUID).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call deleteChunksByFile from the owning module or component when this behavior is required.
 */
export function deleteChunksByFile(fileId: UUID) {
    const db = getDB();

    try {
        return db.prepare(`
            DELETE FROM chunks
            WHERE file_id = ?
        `).run(fileId);
    } catch (error) {
        console.error("Failed to delete chunks:", error);
        throw error;
    }
}

/**
 * Functionality: deleteChunkById performs the delete chunk by id workflow used by main/database/documentRepository.ts.
 * Parameters: chunkId (number).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call deleteChunkById from the owning module or component when this behavior is required.
 */
export function deleteChunkById(chunkId: number) {
    const db = getDB();

    try {
        return db.prepare(`
            DELETE FROM chunks
            WHERE id = ?
        `).run(chunkId);
    } catch (error) {
        console.error("Failed to delete chunk by id:", error);
        throw error;
    }
}

// Updated: join through files to get chunks by directory
/**
 * Functionality: getChunksByDirectory performs the get chunks by directory workflow used by main/database/documentRepository.ts.
 * Parameters: directoryId (UUID).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call getChunksByDirectory from the owning module or component when this behavior is required.
 */
export function getChunksByDirectory(directoryId: UUID) {
    const db = getDB();

    try {
        return db.prepare(`
            SELECT c.*
            FROM chunks c
            JOIN files f ON c.file_id = f.id
            WHERE f.directory_id = ?
            ORDER BY c.created_at DESC
        `).all(directoryId);
    } catch (error) {
        console.error("Failed to fetch chunks:", error);
        throw error;
    }
}

/**
 * Functionality: getChunksByFile performs the get chunks by file workflow used by main/database/documentRepository.ts.
 * Parameters: fileId (UUID).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call getChunksByFile from the owning module or component when this behavior is required.
 */
export function getChunksByFile(fileId: UUID) {
    const db = getDB();

    try {
        return db.prepare(`
            SELECT *
            FROM chunks
            WHERE file_id = ?
            ORDER BY created_at DESC
        `).all(fileId);
    } catch (error) {
        console.error("Failed to fetch file chunks:", error);
        throw error;
    }
}

/**
 * Functionality: searchSimilarChunks performs the search similar chunks workflow used by main/database/documentRepository.ts.
 * Parameters: directoryId (UUID); queryEmbedding (Float32Array | number[]); topK (number).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call searchSimilarChunks from the owning module or component when this behavior is required.
 */
export function searchSimilarChunks(
    directoryId: UUID,
    queryEmbedding: Float32Array | number[],
    topK: number = 5
) {
    const db = getDB();

    try {
        const float32ArrayBinding = queryEmbedding instanceof Float32Array
            ? queryEmbedding
            : new Float32Array(queryEmbedding);

        // Uses the vec0 extension's virtual table `embeddings` and joins on the actual
        // chunks to filter down by `directoryId`.
        const sql = `
            SELECT
                c.id,
                c.file_id,
                c.content,
                f.file_path,
                vec.distance
            FROM embeddings vec
            INNER JOIN chunks c ON c.id = vec.rowid
            INNER JOIN files f ON f.id = c.file_id
            WHERE vec.embedding MATCH ? AND vec.k = ?
              AND f.directory_id = ?
            ORDER BY vec.distance ASC
        `;

        const stmt = db.prepare(sql);
        return stmt.all(float32ArrayBinding, topK, directoryId);
    } catch (error) {
        console.error("Failed to search similar chunks:", error);
        throw error;
    }
}
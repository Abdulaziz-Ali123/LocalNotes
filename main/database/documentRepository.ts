import { randomUUID } from "crypto";
import { getDB } from "@/main/database/sqllite";

type UUID = string;

export function addDirectory(uuid: string, path: string) {
    const db = getDB();

    const sql = `
        INSERT INTO directories (id, path)
        VALUES (?, ?)
    `;

    try {
        const stmt = db.prepare(sql);
        return stmt.run(uuid, path);
    } catch (error) {
        console.error("Failed to add directory:", error);
        throw error;
    }
}

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

export function addFile(
    directoryId: UUID,
    filePath: string,
    fileHash: string,
    lastModified: number
): { id: UUID; result: any } {
    const db = getDB();
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
        const stmt = db.prepare(sql);``
        return stmt.run(
            embedding
        );
    } catch (error) {
        console.error("Failed to add embedding:", error);
        throw error;
    }
}

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

// Updated: join through files to get chunks by directory
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
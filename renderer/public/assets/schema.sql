/**
 * Name of code artifact: renderer/public/assets/schema.sql
 * Brief description: Defines the SQLite schema used by LocalNotes local persistence and vector indexing.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

CREATE TABLE IF NOT EXISTS directories (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    directory_id TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,
    last_modified INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(directory_id) REFERENCES directories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY,
    file_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE embeddings USING vec0(
    embedding float[384]
);


CREATE TRIGGER delete_embedding_after_chunk_delete
AFTER DELETE ON chunks
BEGIN
    DELETE FROM embeddings WHERE rowid = OLD.id;
END;


CREATE INDEX IF NOT EXISTS idx_files_directory ON files(directory_id);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_chunks_content_hash ON chunks(content_hash);
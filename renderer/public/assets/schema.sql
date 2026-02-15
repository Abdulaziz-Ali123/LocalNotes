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
    FOREIGN KEY(directory_id) REFERENCES directories(id)
);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(file_id) REFERENCES files(id)
);


CREATE INDEX IF NOT EXISTS idx_files_directory ON files(directory_id);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_chunks_content_hash ON chunks(content_hash);
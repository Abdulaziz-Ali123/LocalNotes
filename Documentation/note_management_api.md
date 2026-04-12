# LocalNotes - Note Management API Documentation

This document serves as a developer-facing guide for the internal note management APIs exposed to the renderer process via Electron's `contextBridge`. These APIs provide safe access to the native file system, embedded Vector Database (SQLite), document chunking, indexing for RAG, and project-level settings.

---

## 1. Core Architecture

### Context Isolation
LocalNotes enforces strict Context Isolation. The renderer process cannot directly access Node.js or Electron native APIs (like `fs`, `path`, `crypto`). Instead, safe wrappers are exposed via `window.<module>`, mapping to `ipcRenderer.invoke` endpoints in `main/preload.ts`.

### Standard Response Model
Most asynchronous operations return a `DbResponse<T>` interface to create a unified error-handling standard:

```typescript
interface DbResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}
```

---

## 2. File System API (`window.fs`)

Handles direct manipulation of local files, including reading/writing markdown files and accessing OS-level dialogs.

| Method | Signature | Description |
|---|---|---|
| `exists` | `(path: string) => Promise<DbResponse<boolean>>` | Checks if a file/folder exists. |
| `readFile` | `(path: string) => Promise<DbResponse<string>>` | Reads file content as UTF-8. |
| `writeFile` | `(path: string, content: string) => Promise<DbResponse<void>>` | Writes content to a file. |
| `createFolder`| `(path: string) => Promise<DbResponse<void>>` | Creates a new directory. |
| `createFile` | `(path: string, content?: string) => Promise<DbResponse<void>>` | Creates a file with optional data. |
| `deleteItem`| `(path: string) => Promise<DbResponse<void>>` | Deletes file or directory. |
| `renameItem`| `(oldPath: string, newPath: string) => Promise<DbResponse<void>>` | Renames or moves a file. |
| `openFolderDialog`| `() => Promise<DbResponse<string>>` | Prompts native directory selection UI. |

*Note on utility functions (Synchronous): `fs.join`, `fs.basename`, `fs.dirname`, `fs.extname`, and `fs.normalize` directly wrap Node's `path` module.*

---

## 3. Vector Database API (`window.db`)

Manages embedded SQLite storage mapping directories, file metadata, text chunks, and their vector embeddings. 

| Method | Signature | Description |
|---|---|---|
| `addDirectory` | `(uuid: UUID, path: string) => Promise<DbResponse<any>>` | Tracks a directory for indexing. Handled with UPSERT semantics on `id`. |
| `getDirectory` | `(id: UUID) => Promise<DbResponse<DirectoryModel>>` | Fetch a directory configuration. |
| `getAllDirectories` | `() => Promise<DbResponse<DirectoryModel[]>>` | Lists all indexed folders. |
| `getDirectoryIdByPath` | `(path: string) => Promise<DbResponse<string>>` | Retrieve DB ID for known path. |
| `addFile` | `(dirId: UUID, path: string, hash: string, modifiedAt: number)` | Maps a file system path inside DB. |
| `getFilesByDirectory` | `(dirId: UUID) => Promise<DbResponse<FileModel[]>>` | List all indexed files in dir. |
| `addChunk` | `(fileId: UUID, contentHash: string, content: string)` | Stores an individual document chunk. |
| `getChunksByFile` | `(fileId: UUID) => Promise<DbResponse<ChunkModel[]>>` | Retrieve chunks for rendering. |

---

## 4. AI & Indexing APIs

LocalNotes uses a multi-step pipeline for RAG: **Chunking** -> **Embedding Storage** -> **RAG Retrieval**.

### Chunking API (`window.chunker`)
| Method | Signature | Description |
|---|---|---|
| `chunkFile` | `(path: string, config?: ChunkingConfig) => Promise<DbResponse<Chunk[]>>` | Reads & chunks a single file in memory. |
| `chunkDirectory` | `(path: string, config?: DirectoryChunkerConfig) => Promise<DbResponse<DirectoryChunkResult>>` | Scans + chunks all `.md/.txt` files without DB writes. |

### Indexing API (`window.indexer`)
Coordinates splitting files, embedding, and SQLite writes using `window.db` endpoints.
| Method | Signature | Description |
|---|---|---|
| `indexDirectory` | `(dirId: UUID, dirPath: string, config?: DirectoryChunkerConfig)` | Heavy operation mapping entire folder to vector space. Returns indexing stats (processed, skipped, created). |
| `indexFile` | `(dirId: UUID, filePath: string, config?: ChunkingConfig)` | Updates specific file chunks and embeddings differentially. |

### RAG API (`window.rag`)
| Method | Signature | Description |
|---|---|---|
| `retrieveContext` | `(directoryId: string, query: string, topK?: number)` | Returns relevant text blocks matching query embedding. |

#### Data Models (Chunking)
```typescript
interface DirectoryChunkerConfig {
    supportedExtensions?: string[]; // e.g. [".md", ".txt"]
    ignorePatterns?: string[];
    maxFileSize?: number;
    chunkingConfig?: ChunkingConfig;
}

interface DirectoryChunkResult {
    directoryPath: string;
    files: FileWithChunks[];
    totalFiles: number;
    totalChunks: number;
    errors: number;
}
```

---

## 5. File Watcher API (`window.watcher`)

The watcher auto-updates the indexer when files shift.
| Method | Description |
|---|---|
| `start(dirId: UUID, path: string)` | Attaches chokidar listener to directory. |
| `stop(dirId: UUID)` | Terminates a running listener. |
| `stopAll()` | Teardown utility on shutdown/pause. |
| `getActive()` | List actively watched roots. |

---

## 6. Utilities & AutoSave (`window.autosaveAPI`, `window.tabs`)

#### Tabs
- `tabs.getAllTabIds()` / `tabs.getSelectedTabId()`: Fetch state.
- `tabs.select(id)` / `tabs.close(id)` / `tabs.new()`: Lifecycle actions.

#### Autosave
- `autosaveAPI.save(filePath, content)` / `autosaveAPI.load(filePath)`: High-priority debounce disk writes.
- `fileEvents.onDeleted(callback)`: Event emitter pushed when external system deletes tracked file.

---

## 7. Error Handling (`window.localNotes.errors`)

If an action returns `!result.success`, the `result.error` string should usually be exposed via UI notifications.
For unexpected rendering exceptions or telemetry, developers must use the error reporter channel:

```typescript
window.localNotes.errors.report({
    message: "Critical component mounting failure",
    stack: error.stack,
    context: "AIChatPanel",
    details: { modelName: "llama3.2" }
});
```
This guarantees structured persistence (logging) managed solely by the main process without letting UI threads crash blindly.

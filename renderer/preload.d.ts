/**
 * Name of code artifact: renderer/preload.d.ts
 * Brief description: Defines TypeScript type declarations shared across LocalNotes modules.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: a157p624; Abdulaziz Ali; Wesley McDougal; Shaun; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import {
  IpcHandler,
  FileSystemHandler,
  SettingsHandler,
  ProjectSettingsHandler,
  WatcherHandler,
  RagHandler,
  VectorDbHandler,
  IndexHandler,
  ChunckerHandler,
  QuizHandler
} from "../main/preload";

declare global {
  interface Window {
    ipc: IpcHandler;
    fs: FileSystemHandler;
    settings: SettingsHandler;
    projectSettings: ProjectSettingsHandler;
    watcher: WatcherHandler;
    rag: RagHandler;
    quiz: QuizHandler; // Atharva Patil - Added quiz handler to the preload bridge.
    db: VectorDbHandler;
    indexer: IndexHandler;
    chunker: ChunckerHandler;
    tabs: {
      getAllTabIds: () => Promise<number[]>;
      getSelectedTabId: () => Promise<number>;
      select: (id: number) => Promise<void>;
      close: (id: number) => Promise<void>;
      new: () => Promise<number>;
      reorder: (ids: number[]) => Promise<void>;
      getContent: (id: number) => Promise<string>;
      setContent: (id: number, content: string) => Promise<void>;
      getFilePath: (id: number) => Promise<string | null>;
      setFilePath: (id: number, filePath: string | null) => Promise<void>;
    };
  }
}

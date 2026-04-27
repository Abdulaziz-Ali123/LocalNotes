/**
 * Name of code artifact: renderer/types/tabs.d.ts
 * Brief description: Defines TypeScript type declarations shared across LocalNotes modules.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Malek Kchaou; Wesley McDougal; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

export interface TabInfo {
    id: number;
    name: string;
    content: string;
    filePath: string | null;
    mode?: string | null;
    fileType?: 'text' | 'binary'; // Add this
    mimeType?: string; // Add this
}

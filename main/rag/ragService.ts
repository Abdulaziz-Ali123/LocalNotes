/**
 * Name of code artifact: main/rag/ragService.ts
 * Brief description: Provides retrieval-augmented generation IPC helpers for local note context lookup.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Abdulaziz Ali
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { ipcMain } from "electron";
import { searchSimilarChunks } from "../database/documentRepository";
import { embedChunk } from "../embeding/embeding";

interface RetrieveRequest {
    directoryId: string;
    query: string;
    topK?: number;
}

/**
 * Functionality: registerRagIpc performs the register rag ipc workflow used by main/rag/ragService.ts.
 * Parameters: None.
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call registerRagIpc from the owning module or component when this behavior is required.
 */
export function registerRagIpc() {
    ipcMain.handle("rag:retrieveContext", async (_, req: RetrieveRequest) => {
        try {
            const { directoryId, query, topK = 5 } = req;

            // 1. Embed the user's query
            const queryEmbedding = await embedChunk(query);

            // 2. Search db
            const results = searchSimilarChunks(directoryId, queryEmbedding, topK) as Array<{
                id: number;
                file_id: string;
                content: string;
                file_path: string;
                distance: number;
            }>;

            // 3. Format context string
            if (!results || results.length === 0) {
                return { success: true, contextText: "" };
            }

            const formattedContexts = results.map(r =>
                `--- File: ${r.file_path} ---\n${r.content}`
            );

            const finalContextText = `Current user note context material:\n\n${formattedContexts.join("\n\n")}`;

            return {
                success: true,
                contextText: finalContextText,
                sources: results.map(r => r.file_path)
            };
        } catch (error: any) {
            console.error("Failed to retrieve context:", error);
            return {
                success: false,
                error: error.message,
                contextText: ""
            };
        }
    });
}

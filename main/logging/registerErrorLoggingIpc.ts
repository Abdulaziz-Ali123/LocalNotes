/**
 * File: main/ipc/registerErrorLoggingIpc.ts
 * Purpose: Registers the IPC handler used by the renderer to report application errors.
 * Summary of what was added/changed:
 * - Adds a single IPC route for centralized renderer-to-main error logging.
 * - Keeps error log persistence owned by the main process.
 * Author: Malek Kchaou
 * Git-history contributors: Malek Kchaou
 * Date Created: 2026-03-28
 * Last Updated: 2026-03-28
 */

import { ipcMain } from "electron";
import { logMainError, logRendererError } from "../logging/errorLogger";

/**
 * Registers the renderer error reporting IPC handler once during app startup.
 * The renderer sends safe structured payloads and main persists them centrally.
 */
export function registerErrorLoggingIpc(): void {
    ipcMain.handle("errors:report", async (_event, payload) => {
        try {
            logRendererError({
                source: "renderer",
                message: payload?.message ?? "Unknown renderer error",
                stack: payload?.stack,
                code: payload?.code,
                context: payload?.context,
                details: payload?.details,
                timestamp: new Date().toISOString(),
            });

            return { ok: true };
        } catch (error) {
            logMainError(error, "ipc.errors.report");
            return { ok: false };
        }
    });
}
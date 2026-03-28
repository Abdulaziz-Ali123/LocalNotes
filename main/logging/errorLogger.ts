/**
 * File: main/logging/errorLogger.ts
 * Purpose: Centralized main-process error logging for LocalNotes.
 * Summary of what was added/changed:
 * - Adds a single logger utility for writing structured error entries to disk.
 * - Normalizes unknown thrown values into a consistent log payload.
 * - Supports logging errors coming from both main and renderer processes.
 * Author: Malek Kchaou
 * Date: 2026-03-28
 * Housekeeping note:
 * - Keep this file lightweight and dependency-free so it can be reused from any IPC handler.
 */

import fs from "fs";
import path from "path";
import { app } from "electron";

/**
 * Represents the process or layer where the error originated.
 * Keeping this narrow makes logs easier to scan later.
 */
export type ErrorSource = "main" | "renderer";

/**
 * This is the safe structured payload accepted by the logger.
 * It is intentionally simple so it can be sent over IPC without friction.
 */
export interface ErrorLogPayload {
    source: ErrorSource;
    message: string;
    stack?: string;
    code?: string;
    context?: string;
    details?: Record<string, unknown>;
    timestamp?: string;
}

/**
 * Returns the folder where LocalNotes log files should be stored.
 * We keep logs under Electron's userData path so this works consistently
 * across environments and does not require extra user setup.
 */
function getLogDirectory(): string {
    const logDir = path.join(app.getPath("userData"), "logs");

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    return logDir;
}

/**
 * The current implementation writes all application errors into one log file.
 * This is the lowest-overhead option and is sufficient for debugging.
 */
function getLogFilePath(): string {
    return path.join(getLogDirectory(), "errors.log");
}

/**
 * Converts unknown thrown values into a predictable structure.
 * This prevents logger crashes and makes sure even weird thrown values
 * like strings or objects still become readable log entries.
 */
export function normalizeError(
    error: unknown,
    source: ErrorSource,
    context?: string,
    details?: Record<string, unknown>
): ErrorLogPayload {
    const timestamp = new Date().toISOString();

    if (error instanceof Error) {
        return {
            source,
            message: error.message,
            stack: error.stack,
            context,
            details,
            timestamp,
        };
    }

    if (typeof error === "string") {
        return {
            source,
            message: error,
            context,
            details,
            timestamp,
        };
    }

    return {
        source,
        message: "Unknown error",
        context,
        details: {
            ...(details ?? {}),
            rawError: error,
        },
        timestamp,
    };
}

/**
 * Appends one structured log entry to disk.
 * The format is newline-delimited JSON so it is easy to inspect manually
 * and easy to parse later if we want filtering tools.
 */
export function writeErrorLog(payload: ErrorLogPayload): void {
    const filePath = getLogFilePath();

    const entry = {
        ...payload,
        timestamp: payload.timestamp ?? new Date().toISOString(),
    };

    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

/**
 * Convenience helper used inside main-process try/catch blocks.
 * It normalizes the thrown value, writes it to disk, and returns the
 * normalized payload in case the caller wants to do additional handling.
 */
export function logMainError(
    error: unknown,
    context?: string,
    details?: Record<string, unknown>
): ErrorLogPayload {
    const payload = normalizeError(error, "main", context, details);
    writeErrorLog(payload);
    return payload;
}

/**
 * Handles errors explicitly reported by the renderer process.
 * This keeps all persisted logging centralized in main, even when the
 * error originated in renderer code.
 */
export function logRendererError(payload: ErrorLogPayload): void {
    writeErrorLog({
        ...payload,
        source: "renderer",
        timestamp: payload.timestamp ?? new Date().toISOString(),
    });
}
/**
 * File: renderer/lib/reportAppError.ts
 * Purpose: Shared renderer helper for central error reporting in LocalNotes.
 * Summary of what was added/changed:
 * - Adds a reusable helper for reporting renderer errors to the main-process logger.
 * - Normalizes unknown thrown values into a safe structured payload.
 * - Prevents repeated error-reporting boilerplate across renderer features.
 * Author: Malek Kchaou
 * Git-history contributors: Malek Kchaou
 * Date: 2026-03-28
 */

export interface ReportAppErrorOptions {
    error: unknown;
    context?: string;
    details?: Record<string, unknown>;
}

/**
 * Converts an unknown thrown value into a predictable message/stack pair.
 * This makes renderer error reporting resilient even when code throws strings
 * or other non-Error values.
 */
function normalizeRendererError(error: unknown): {
    message: string;
    stack?: string;
} {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack,
        };
    }

    if (typeof error === "string") {
        return {
            message: error,
        };
    }

    return {
        message: "Unknown renderer error",
    };
}

/**
 * Reports a renderer error to the centralized main-process logger using
 * the preload bridge exposed on window.localNotes.
 *
 * This helper intentionally fails safely. If error reporting itself breaks,
 * it falls back to console.error rather than throwing a second error.
 */
/**
 * Functionality: reportAppError performs the report app error workflow used by renderer/lib/reportAppError.ts.
 * Parameters: { error, context, details, } (ReportAppErrorOptions).
 * Returns: Returns Promise<void>.
 * Usage: Call reportAppError from the owning module or component when this behavior is required.
 */
export async function reportAppError({
    error,
    context,
    details,
}: ReportAppErrorOptions): Promise<void> {
    const normalized = normalizeRendererError(error);

    try {
        await window.localNotes.errors.report({
            message: normalized.message,
            stack: normalized.stack,
            context,
            details,
        });
    } catch (reportingError) {
        /**
         * Last-resort fallback so the reporting path itself does not cause
         * additional user-facing failures.
         */
        console.error("Failed to report renderer error:", reportingError);
    }
}
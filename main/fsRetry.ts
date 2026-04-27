/**
 * Name of code artifact: main/fsRetry.ts
 * Brief description: Provides source code for the LocalNotes Electron and Next.js application.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Malek Kchaou
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

/**
 * Functionality: sleep performs the sleep workflow used by main/fsRetry.ts.
 * Parameters: ms (number).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call sleep from the owning module or component when this behavior is required.
 */
function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Functionality: isTransientFsError performs the is transient fs error workflow used by main/fsRetry.ts.
 * Parameters: err (any).
 * Returns: Returns boolean.
 * Usage: Call isTransientFsError from the owning module or component when this behavior is required.
 */
export function isTransientFsError(err: any): boolean {
    const code = err?.code as string | undefined;
    return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

/**
 * Functionality: withRetry performs the with retry workflow used by main/fsRetry.ts.
 * Parameters: fn (() => Promise<T>); opts ({ retries?: number; baseDelayMs?: number }).
 * Returns: Returns Promise<{ value: T; retriesUsed: number }>.
 * Usage: Call withRetry from the owning module or component when this behavior is required.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    opts?: { retries?: number; baseDelayMs?: number }
): Promise<{ value: T; retriesUsed: number }> {
    const retries = opts?.retries ?? 3;
    const baseDelayMs = opts?.baseDelayMs ?? 40;

    let attempt = 0;
    while (true) {
        try {
            const value = await fn();
            return { value, retriesUsed: attempt };
        } catch (err) {
            if (attempt >= retries || !isTransientFsError(err)) throw err;
            const delay = baseDelayMs * Math.pow(2, attempt);
            await sleep(delay);
            attempt++;
        }
    }
}

/**
 * Name of code artifact: main/fsQueue.ts
 * Brief description: Provides source code for the LocalNotes Electron and Next.js application.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Malek Kchaou
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

type Task<T> = () => Promise<T>;

/**
 * Class functionality: Defines the AsyncQueue class used by main/fsQueue.ts.
 * Parameters: Constructor parameters are documented on the constructor when applicable.
 * Returns: Returns the class constructor for creating or organizing related behavior.
 * Usage: Instantiate or reference AsyncQueue from modules that need this grouped behavior.
 */
export class AsyncQueue {
    private last: Promise<unknown> = Promise.resolve();

        /**
     * Functionality: enqueue performs the enqueue workflow used by main/fsQueue.ts.
     * Parameters: task (Task<T>).
     * Returns: Returns Promise<T>.
     * Usage: Call enqueue from the owning module or component when this behavior is required.
     */
enqueue<T>(task: Task<T>): Promise<T> {
        const run = this.last.then(task, task);
        this.last = run.then(
            () => undefined,
            () => undefined
        );
        return run;
    }
}

const queues = new Map<string, AsyncQueue>();

/**
 * Functionality: getQueue performs the get queue workflow used by main/fsQueue.ts.
 * Parameters: key (string).
 * Returns: Returns AsyncQueue.
 * Usage: Call getQueue from the owning module or component when this behavior is required.
 */
export function getQueue(key: string): AsyncQueue {
    let q = queues.get(key);
    if (!q) {
        q = new AsyncQueue();
        queues.set(key, q);
    }
    return q;
}
type Task<T> = () => Promise<T>;

export class AsyncQueue {
    private last: Promise<unknown> = Promise.resolve();

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

export function getQueue(key: string): AsyncQueue {
    let q = queues.get(key);
    if (!q) {
        q = new AsyncQueue();
        queues.set(key, q);
    }
    return q;
}
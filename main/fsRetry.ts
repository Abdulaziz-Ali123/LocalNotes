function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

export function isTransientFsError(err: any): boolean {
    const code = err?.code as string | undefined;
    return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

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

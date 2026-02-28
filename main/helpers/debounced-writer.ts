import fs from "fs/promises";
import path from "path";
import { withRetry } from "../fsRetry";

type Waiter = {
  resolve: (value: { success: true }) => void;
  reject: (error: unknown) => void;
};

type QueueOptions = {
  debounceMs?: number;
  maxWaitMs?: number;
};

type PendingWrite = {
  filePath: string;
  content: string;
  timer: NodeJS.Timeout | null;
  inFlight: boolean;
  currentFlush: Promise<void> | null;
  waiters: Waiter[];
  firstQueuedAt: number;
  debounceMs: number;
  maxWaitMs: number;
};

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_MAX_WAIT_MS = 1500;

export class DebouncedWriter {
  private pending = new Map<string, PendingWrite>();

  async enqueue(filePath: string, content: string, options?: QueueOptions): Promise<{ success: true }> {
    const normalizedPath = path.normalize(filePath);
    const now = Date.now();
    const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const maxWaitMs = options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;

    let state = this.pending.get(normalizedPath);
    if (!state) {
      state = {
        filePath: normalizedPath,
        content,
        timer: null,
        inFlight: false,
        currentFlush: null,
        waiters: [],
        firstQueuedAt: now,
        debounceMs,
        maxWaitMs,
      };
      this.pending.set(normalizedPath, state);
    } else {
      state.content = content;
      state.debounceMs = debounceMs;
      state.maxWaitMs = maxWaitMs;
      if (state.waiters.length === 0 && !state.inFlight) {
        state.firstQueuedAt = now;
      }
    }

    const result = new Promise<{ success: true }>((resolve, reject) => {
      state!.waiters.push({ resolve, reject });
    });

    this.schedule(state, now);
    return result;
  }

  hasPending(): boolean {
    return this.pending.size > 0;
  }

  async flushAll(): Promise<void> {
    const keys = Array.from(this.pending.keys());
    await Promise.all(keys.map((key) => this.flush(key, true)));
  }

  private schedule(state: PendingWrite, now: number): void {
    if (state.inFlight) {
      return;
    }

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    const elapsed = now - state.firstQueuedAt;
    const remainingMaxWait = Math.max(0, state.maxWaitMs - elapsed);
    const delay = Math.min(state.debounceMs, remainingMaxWait);

    state.timer = setTimeout(() => {
      void this.flush(state.filePath, false);
    }, delay);
  }

  private async flush(key: string, immediate: boolean): Promise<void> {
    const state = this.pending.get(key);
    if (!state) {
      return;
    }

    if (state.inFlight) {
      await state.currentFlush;
      if (immediate && this.pending.has(key)) {
        await this.flush(key, true);
      }
      return;
    }

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    if (state.waiters.length === 0) {
      this.pending.delete(key);
      return;
    }

    const contentToWrite = state.content;
    const waitersForThisFlush = state.waiters.splice(0, state.waiters.length);
    state.inFlight = true;

    const executeFlush = async () => {
      try {
        await this.commit(state.filePath, contentToWrite);
        waitersForThisFlush.forEach((waiter) => waiter.resolve({ success: true }));
      } catch (error) {
        waitersForThisFlush.forEach((waiter) => waiter.reject(error));
      } finally {
        state.inFlight = false;
        state.currentFlush = null;

        if (state.waiters.length > 0) {
          state.firstQueuedAt = Date.now();
          if (immediate) {
            await this.flush(key, true);
          } else {
            this.schedule(state, Date.now());
          }
        } else {
          this.pending.delete(key);
        }
      }
    };

    state.currentFlush = executeFlush();
    await state.currentFlush;
  }

  private async commit(filePath: string, content: string): Promise<void> {
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });

    await withRetry(async () => {
      const handle = await fs.open(filePath, "w");
      try {
        await handle.writeFile(content, { encoding: "utf-8" });
        await handle.sync();
      } finally {
        await handle.close();
      }
    });
  }
}

export const debouncedWriter = new DebouncedWriter();

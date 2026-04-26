/**
 * Name of code artifact: main/helpers/debounced-writer.ts
 * Brief description: Provides main-process helper utilities shared across Electron startup and file operations.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

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

/**
 * Class functionality: Defines the DebouncedWriter class used by main/helpers/debounced-writer.ts.
 * Parameters: Constructor parameters are documented on the constructor when applicable.
 * Returns: Returns the class constructor for creating or organizing related behavior.
 * Usage: Instantiate or reference DebouncedWriter from modules that need this grouped behavior.
 */
export class DebouncedWriter {
  private pending = new Map<string, PendingWrite>();

    /**
   * Functionality: enqueue performs the enqueue workflow used by main/helpers/debounced-writer.ts.
   * Parameters: filePath (string); content (string); options (QueueOptions).
   * Returns: Returns Promise<{ success: true }>.
   * Usage: Call enqueue from the owning module or component when this behavior is required.
   */
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

    /**
   * Functionality: hasPending performs the has pending workflow used by main/helpers/debounced-writer.ts.
   * Parameters: None.
   * Returns: Returns boolean.
   * Usage: Call hasPending from the owning module or component when this behavior is required.
   */
hasPending(): boolean {
    return this.pending.size > 0;
  }

    /**
   * Functionality: flushAll performs the flush all workflow used by main/helpers/debounced-writer.ts.
   * Parameters: None.
   * Returns: Returns Promise<void>.
   * Usage: Call flushAll from the owning module or component when this behavior is required.
   */
async flushAll(): Promise<void> {
    const keys = Array.from(this.pending.keys());
    await Promise.all(keys.map((key) => this.flush(key, true)));
  }

    /**
   * Functionality: schedule performs the schedule workflow used by main/helpers/debounced-writer.ts.
   * Parameters: state (PendingWrite); now (number).
   * Returns: Returns void.
   * Usage: Call schedule from the owning module or component when this behavior is required.
   */
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

    /**
   * Functionality: flush performs the flush workflow used by main/helpers/debounced-writer.ts.
   * Parameters: key (string); immediate (boolean).
   * Returns: Returns Promise<void>.
   * Usage: Call flush from the owning module or component when this behavior is required.
   */
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

        /**
     * Functionality: executeFlush performs the execute flush workflow used by main/helpers/debounced-writer.ts.
     * Parameters: None.
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call executeFlush from the owning module or component when this behavior is required.
     */
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

    /**
   * Functionality: commit performs the commit workflow used by main/helpers/debounced-writer.ts.
   * Parameters: filePath (string); content (string).
   * Returns: Returns Promise<void>.
   * Usage: Call commit from the owning module or component when this behavior is required.
   */
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

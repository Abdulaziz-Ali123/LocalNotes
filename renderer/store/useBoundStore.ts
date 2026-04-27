/**
 * Name of code artifact: renderer/store/useBoundStore.ts
 * Brief description: Defines Zustand state slices and store wiring for renderer application state.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Shaun; Wesley McDougal; Malek Kchaou; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { TabsSlice } from "@/renderer/types/tab-slice";
import { SettingsSlice, createSettingsSlice } from "./settings-slice";
import { merge } from "lodash";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createTabSlice } from "./tab-slice";

type Store = TabsSlice & SettingsSlice;
export const useBoundStore = create(
  persist<Store>(
    (...a) => ({
      ...createTabSlice(...a),
      ...createSettingsSlice(...a),
    }),
    {
      name: "electron-storage",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        //? We need this otherwise action (functions inside the state) will be undefined.
        return merge({}, currentState, persistedState);
      },
      partialize: (state) =>
        ({
          tabs: {},
          // Settings are NOT persisted to localStorage — they live on disk via main process.
        }) as unknown as Store,
    }
  )
);

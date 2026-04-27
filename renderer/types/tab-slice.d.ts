/**
 * Name of code artifact: renderer/types/tab-slice.d.ts
 * Brief description: Defines TypeScript type declarations shared across LocalNotes modules.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { TabInfo } from "./tabs";

export interface TabsSlice {
  tabs: {
    items: TabInfo[];
    selectedTabId: number;
    selectedTabIndex: number;
    initialize: () => Promise<void>;
    setSelectedTab: (tab: TabInfo) => Promise<void>;
    remove: (tab: TabInfo) => void;
    add: () => Promise<void>;
    reorder: (tabs: TabInfo[]) => void;
  };
}
export interface TabsSlice {
  tabs: {
    /**
     * Array of active tabs.
     */
    items: TabInfo[];

    /**
     * Focused tab id.
     */
    selectedTabId: number;

    /**
     * The index of the selected tab in the items array.
     */
    selectedTabIndex: number;

    /**
     * Initializes the tabs. Must call this before using other methods in here.
     */
    initialize: () => Promise<void>;

    /**
     * Sets the selected tab.
     */
    setSelectedTab: (tab: TabInfo) => void;

    /**
     * Removes a tab
     */
    remove: (tab: TabInfo) => void;

    /**
     * Creates a new tab.
     */
    add: () => void;

    /**
     * Reorder tabs in the order of the given TabInfo array.
     */
    reorder: (tabs: TabInfo[]) => void;
  };
}

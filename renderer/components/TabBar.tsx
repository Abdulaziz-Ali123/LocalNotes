/**
 * Name of code artifact: renderer/components/TabBar.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import React from "react";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { Plus } from "lucide-react";
import { Tab } from "./Tab";

/**
 * Functionality: TabBar performs the tab bar workflow used by renderer/components/TabBar.tsx.
 * Parameters: None.
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call TabBar from the owning module or component when this behavior is required.
 */
export default function TabBar() {
  const tabs = useBoundStore((state) => state.tabs.items);
  const setSelectedTab = useBoundStore((state) => state.tabs.setSelectedTab);
  const remove = useBoundStore((state) => state.tabs.remove);
  const add = useBoundStore((state) => state.tabs.add);
  const reorderTabs = useBoundStore((state) => state.tabs.reorder);
  const selectedTabId = useBoundStore((state) => state.tabs.selectedTabId);
  const selectedTabIndex = useBoundStore((state) => state.tabs.selectedTabIndex);

  return (
    <React.Fragment>
      <div data-tutorial="tab-bar" className="flex flex-row  bg-background h-10 gap-10 app-drag-region w-full">
        <div></div>
        <div className=" flex flex-flex-row justify-between mt-2 pb-0 w-5/6 rounded-t-md app-nodrag-region">
          <Reorder.Group
            as="ul"
            axis="x"
            onReorder={reorderTabs}
            className="flex-grow flex-nowrap flex justify-start items-center pr-[10px] w-full"
            values={tabs}
          >
            <AnimatePresence initial={false}>
              {tabs.map((item, index) => (
                <Tab
                  key={item.id}
                  item={item}
                  isSelected={selectedTabId === item.id}
                  onClick={() => setSelectedTab(item)}
                  onRemove={() => remove(item)}
                  showSeperator={index !== selectedTabIndex - 1 && tabs.length > 2}
                />
              ))}

              <motion.button
                className="app-nodrag-region flex items-center justify-center hover:bg-accent rounded-md h-6 w-6 transition-all duration-300 ml-2"
                onClick={add}
                whileTap={{ scale: 0.9 }}
              >
                <Plus size={16} />
              </motion.button>
            </AnimatePresence>
          </Reorder.Group>
        </div>
      </div>
    </React.Fragment>
  );
}

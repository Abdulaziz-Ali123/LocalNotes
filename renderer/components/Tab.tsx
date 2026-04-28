/**
 * Name of code artifact: renderer/components/Tab.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Abdulaziz-Ali123; Wesley McDougal; Malek Kchaou
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { TabInfo } from "@/renderer/types/tabs";
import { motion, Reorder } from "framer-motion";
import { cn } from "@/renderer/lib/util";
import { X } from "lucide-react";

interface Props {
  item: TabInfo;
  isSelected: boolean;
  showSeperator: boolean;
  onClick: () => void;
  onRemove: () => void;
}

/**
 * Functionality: Tab performs the tab workflow used by renderer/components/Tab.tsx.
 * Parameters: { item, onClick, onRemove, isSelected, showSeperator } (Props).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call Tab from the owning module or component when this behavior is required.
 */
export const Tab = ({ item, onClick, onRemove, isSelected, showSeperator }: Props) => {
  return (
    <Reorder.Item
      value={item}
      id={item.id.toString()}
      initial={{
        opacity: 0,
        y: 10,
      }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.15, ease: "easeOut" },
      }}
      exit={{
        opacity: 0,
        y: -10,
        transition: { duration: 0.1 },
      }}
      whileDrag={{ scale: 1.02 }}
      className={cn(
        isSelected
          ? "bg-secondary text-foreground"
          : "bg-background hover:bg-primary-foreground",
        "app-nodrag-region",
        "min-w-[120px] max-w-[200px] pl-4 relative cursor-pointer h-8 flex justify-between items-center flex-1 overflow-hidden select-none rounded-t-md border-r border-border/20"
      )}
      onClick={onClick}
    >
      <motion.span className="truncate w-10/12 text-xs font-medium">{item.name}</motion.span>

      <motion.div
        layout
        className="absolute top-0 bottom-0 right-[0px] flex items-center justify-end pr-2"
      >
        <motion.button
          onPointerDown={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          initial={false}
          className="hover:bg-accent/50 rounded-full p-0.5 transition-colors"
        >
          <X
            size={14}
            className={cn("transition-all duration-300")}
          ></X>
        </motion.button>
      </motion.div>
    </Reorder.Item>
  );
};

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

export const Tab = ({
  item,
  onClick,
  onRemove,
  isSelected,
  showSeperator,
}: Props) => {
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
        isSelected ? "bg-secondary text-foreground" : "bg-background ",
        "app-nodrag-region",
        "w-full pl-4 relative cursor-pointer h-8 flex justify-between items-center flex-1 overflow-hidden select-none rounded-t-md",
      )}
      onClick={onClick}
    >
      <motion.span>{`${item.name}`}</motion.span>

      <motion.div
        layout
        className="absolute top-0 bottom-0 right-[0px] flex algin-center items-center justify-end flex-shrink-0 pr-2"
      >
        <motion.button
          onPointerDown={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          initial={false}
        >
          <X
            color={"var(--foreground)"}
            className={cn("rounded-full transition-all duratoin-300")}
          ></X>
        </motion.button>
      </motion.div>
    </Reorder.Item>
  );
};

/**
 * Name of code artifact: renderer/components/TagIndicators.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: m518n748
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import React, { useEffect, useState } from "react";
import { cn } from "renderer/lib/util";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagIndicatorsProps {
  itemPath: string;
  rootPath: string | null;
  maxDisplay?: number;
  className?: string;
}

/**
 * Functionality: TagIndicators performs the tag indicators workflow used by renderer/components/TagIndicators.tsx.
 * Parameters: { itemPath, rootPath, maxDisplay = 3, className, } (TagIndicatorsProps).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call TagIndicators from the owning module or component when this behavior is required.
 */
export default function TagIndicators({
  itemPath,
  rootPath,
  maxDisplay = 3,
  className,
}: TagIndicatorsProps) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (rootPath && itemPath) {
      loadTags();
    }

        /**
     * Functionality: onTagsUpdated performs the on tags updated workflow used by renderer/components/TagIndicators.tsx.
     * Parameters: None.
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call onTagsUpdated from the owning module or component when this behavior is required.
     */
const onTagsUpdated = () => {
      loadTags();
    };

    window.addEventListener("tags-updated", onTagsUpdated);
    return () => {
      window.removeEventListener("tags-updated", onTagsUpdated);
    };
  }, [itemPath, rootPath]);

    /**
   * Functionality: loadTags performs the load tags workflow used by renderer/components/TagIndicators.tsx.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call loadTags from the owning module or component when this behavior is required.
   */
const loadTags = async () => {
    if (!rootPath || !itemPath) return;
    try {
      const tagsFilePath = window.fs.join(rootPath, ".notepad-tags.json");
      const result = await window.fs.readFile(tagsFilePath);
      if (result.success && result.data) {
        const data = JSON.parse(result.data as string);
        const allTags = data.tags || [];
        // Normalize item path to forward-slash for lookup
        const normalizedItemPath = itemPath.replace(/\\/g, "/");
        const assignedTagIds = data.items?.[normalizedItemPath]?.tagIds || data.items?.[itemPath]?.tagIds || [];
        const assignedTags = allTags.filter((tag: Tag) =>
          assignedTagIds.includes(tag.id)
        );
        setTags(assignedTags);
      }
    } catch (error) {
      console.error("Error loading tags:", error);
      setTags([]);
    }
  };

  if (tags.length === 0) return null;

  const displayedTags = tags.slice(0, maxDisplay);
  const hiddenCount = tags.length - displayedTags.length;

  return (
    <div className={cn("flex gap-1 items-center", className)}>
      {displayedTags.map((tag) => (
        <div
          key={tag.id}
          className="w-2.5 h-2.5 rounded-full border border-gray-400"
          style={{ backgroundColor: tag.color }}
          title={tag.name}
        />
      ))}
      {hiddenCount > 0 && (
        <span className="text-xs text-muted-foreground px-1">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

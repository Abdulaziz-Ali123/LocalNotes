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

    const onTagsUpdated = () => {
      loadTags();
    };

    window.addEventListener("tags-updated", onTagsUpdated);
    return () => {
      window.removeEventListener("tags-updated", onTagsUpdated);
    };
  }, [itemPath, rootPath]);

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

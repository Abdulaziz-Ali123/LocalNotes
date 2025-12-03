import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "renderer/lib/util";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagFilterPanelProps {
  rootPath: string | null;
  onFiltersChange: (selectedTagIds: string[]) => void;
  selectedTagIds?: string[];
}

export default function TagFilterPanel({ rootPath, onFiltersChange, selectedTagIds: propSelectedTagIds }: TagFilterPanelProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchingItems, setMatchingItems] = useState<string[]>([]);

  // Load tags from file
  useEffect(() => {
    if (rootPath) {
      loadTags();
    }
  }, [rootPath]);

  // If parent provides selectedTagIds (controlled), keep in sync
  useEffect(() => {
    if (!rootPath) return;
    if (propSelectedTagIds && Array.isArray(propSelectedTagIds)) {
      setSelectedTagIds(propSelectedTagIds);
      computeMatchingItems(propSelectedTagIds);
    }
  }, [propSelectedTagIds, rootPath]);

  const loadTags = async () => {
    if (!rootPath) return;

    setLoading(true);
    try {
      const tagsFilePath = window.fs.join(rootPath, ".notepad-tags.json");
      const result = await window.fs.readFile(tagsFilePath);

      if (result.success) {
        const data = JSON.parse(result.data);
        setAllTags(data.tags || []);
      } else {
        setAllTags([]);
      }
    } catch (error) {
      console.error("Failed to load tags:", error);
      setAllTags([]);
    } finally {
      setLoading(false);
    }
  };

  // Listen for external updates to tags (TagModal writes triggers this)
  useEffect(() => {
    const onTagsUpdated = () => {
      loadTags();
      if (selectedTagIds.length > 0) computeMatchingItems(selectedTagIds);
    };
    window.addEventListener("tags-updated", onTagsUpdated);
    return () => window.removeEventListener("tags-updated", onTagsUpdated);
  }, [rootPath, selectedTagIds]);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const updated = prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];
      onFiltersChange(updated);
      // recompute matching items
      computeMatchingItems(updated);
      return updated;
    });
  };

  const handleClearFilters = () => {
    setSelectedTagIds([]);
    onFiltersChange([]);
    setMatchingItems([]);
  };

  const computeMatchingItems = async (filterIds: string[]) => {
    if (!rootPath) return setMatchingItems([]);
    if (filterIds.length === 0) return setMatchingItems([]);

    try {
      const tagsFilePath = window.fs.join(rootPath, ".notepad-tags.json");
      const result = await window.fs.readFile(tagsFilePath);
      if (!result.success || !result.data) return setMatchingItems([]);
      const data = JSON.parse(result.data as string);
      const items = data.items || {};

      // normalize keys stored in file (handle backslashes)
      const normalizedItems: Record<string, { tagIds: string[] }> = {};
      Object.keys(items).forEach((k) => {
        const norm = k.replace(/\\/g, "/");
        normalizedItems[norm] = items[k];
      });

      const matches: string[] = [];
      Object.keys(normalizedItems).forEach((itemPath) => {
        const tagIds: string[] = normalizedItems[itemPath].tagIds || [];
        if (tagIds.some((t) => filterIds.includes(t))) {
          matches.push(itemPath);
        }
      });
      setMatchingItems(matches);
    } catch (e) {
      console.error("Failed to compute matching items:", e);
      setMatchingItems([]);
    }
  };

  // keep matching items in sync when selectedTagIds or rootPath change
  useEffect(() => {
    if (selectedTagIds.length > 0) {
      computeMatchingItems(selectedTagIds);
    } else {
      setMatchingItems([]);
    }
  }, [selectedTagIds, rootPath]);

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading tags...
      </div>
    );
  }

  if (allTags.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No tags created yet. Create a tag by right-clicking files or folders.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div>
        <h2 className="text-sm font-semibold mb-3 text-foreground">Filter by Tags</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Select tags to show only files/folders with those tags (inclusive)
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {allTags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => handleToggleTag(tag.id)}
            className={cn(
              "flex items-center gap-2 p-2 rounded-md text-sm transition-all text-left",
              selectedTagIds.includes(tag.id)
                ? "bg-accent/30 ring-1 ring-accent"
                : "hover:bg-muted"
            )}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="flex-1 truncate">{tag.name}</span>
            {selectedTagIds.includes(tag.id) && (
              <div className="w-4 h-4 rounded border border-accent flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 bg-accent rounded-sm" />
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedTagIds.length > 0 && (
        <div className="pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="w-full text-xs"
          >
            Clear Filters
          </Button>
        </div>
      )}

      {matchingItems.length > 0 && (
        <div className="pt-2 border-t border-border">
          <h3 className="text-sm font-semibold mb-2">Matching Items</h3>
          <div className="flex flex-col gap-2 text-sm">
            {matchingItems.map((p) => (
              <div key={p} className="flex flex-col truncate p-2">
                <span className="font-medium">{window.fs.basename(p)}</span>
                <span className="text-xs text-muted-foreground truncate">{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-border text-xs text-muted-foreground">
        <p className="mb-1">
          {selectedTagIds.length === 0
            ? "No filters applied"
            : `Showing items with ${selectedTagIds.length} tag${
                selectedTagIds.length > 1 ? "s" : ""
              }`}
        </p>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { X, Plus, Edit2, Trash2, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "renderer/lib/util";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagAssignment {
  tagId: string;
}

interface TagModalProps {
  isOpen: boolean;
  itemPath: string | null;
  rootPath: string | null;
  onClose: () => void;
}

const PRESET_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#FFA07A", // Light Salmon
  "#98D8C8", // Mint
  "#F7DC6F", // Yellow
  "#BB8FCE", // Purple
  "#85C1E2", // Light Blue
  "#F8B88B", // Peach
  "#ABEBC6", // Light Green
];

export default function TagModal({ isOpen, itemPath, rootPath, onClose }: TagModalProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", color: PRESET_COLORS[0] });

  // Load tags from file
  useEffect(() => {
    if (isOpen && itemPath && rootPath) {
      loadTags();
    }
  }, [isOpen, itemPath, rootPath]);

  const loadTags = async () => {
    if (!itemPath || !rootPath) return;
    try {
      const tagsFilePath = window.fs.join(rootPath, ".notepad-tags.json");
      const result = await window.fs.readFile(tagsFilePath);
      if (result.success && result.data) {
        const data = JSON.parse(result.data as string);
        
        // Load all tags
        setAllTags(data.tags || []);

        // Load assigned tags for this item (normalize itemPath to forward-slash)
        const normalizedPath = itemPath.replace(/\\/g, "/");
        setAssignedTagIds(data.items?.[normalizedPath]?.tagIds || data.items?.[itemPath]?.tagIds || []);
      } else {
        setAllTags([]);
        setAssignedTagIds([]);
      }
    } catch (error) {
      console.error("Error loading tags:", error);
      setAllTags([]);
      setAssignedTagIds([]);
    }
  };

  const saveTagsFile = async (tags: Tag[], itemTagIds: string[]) => {
    if (!rootPath || !itemPath) return;
    try {
      const tagsFilePath = window.fs.join(rootPath, ".notepad-tags.json");
      let existingData = { tags: [] as Tag[], items: {} as Record<string, { tagIds: string[] }> };
      
      // Try to load existing data
      try {
        const result = await window.fs.readFile(tagsFilePath);
        if (result.success && result.data) {
          existingData = JSON.parse(result.data as string);
        }
      } catch (e) {
        // File doesn't exist, that's okay
      }

      // Update tags and items
      existingData.tags = tags;

      // Normalize existing item keys to forward-slash form and set current item
      existingData.items = existingData.items || {};
      const normalizedItems: Record<string, { tagIds: string[] }> = {};
      Object.keys(existingData.items).forEach((k) => {
        const norm = k.replace(/\\/g, "/");
        normalizedItems[norm] = existingData.items[k];
      });
      const normalizedPath = itemPath.replace(/\\/g, "/");
      normalizedItems[normalizedPath] = { tagIds: itemTagIds };
      existingData.items = normalizedItems;

      await window.fs.writeFile(tagsFilePath, JSON.stringify(existingData, null, 2));
    } catch (error) {
      console.error("Error saving tags:", error);
    }
  };

  const handleAddTag = async () => {
    if (!formData.name.trim()) return;

    const newTag: Tag = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      color: formData.color,
    };

    const updatedTags = [...allTags, newTag];
    setAllTags(updatedTags);
    
    await saveTagsFile(updatedTags, assignedTagIds);
    // Notify other components that tags file changed
    try {
      window.dispatchEvent(new Event("tags-updated"));
    } catch (e) {}
    setFormData({ name: "", color: PRESET_COLORS[0] });
    setShowAddForm(false);
  };

  const handleUpdateTag = async (id: string) => {
    if (!formData.name.trim()) return;

    const updatedTags = allTags.map((tag) =>
      tag.id === id
        ? { ...tag, name: formData.name.trim(), color: formData.color }
        : tag
    );

    setAllTags(updatedTags);
    
    await saveTagsFile(updatedTags, assignedTagIds);
    try {
      window.dispatchEvent(new Event("tags-updated"));
    } catch (e) {}
    setFormData({ name: "", color: PRESET_COLORS[0] });
    setEditingId(null);
  };

  const handleDeleteTag = async (id: string) => {
    const updatedTags = allTags.filter((tag) => tag.id !== id);
    const updatedAssignments = assignedTagIds.filter((tagId) => tagId !== id);
    
    setAllTags(updatedTags);
    setAssignedTagIds(updatedAssignments);
    
    await saveTagsFile(updatedTags, updatedAssignments);
    try {
      window.dispatchEvent(new Event("tags-updated"));
    } catch (e) {}
  };

  const handleToggleTagAssignment = async (tagId: string) => {
    const updatedAssignments = assignedTagIds.includes(tagId)
      ? assignedTagIds.filter((id) => id !== tagId)
      : [...assignedTagIds, tagId];

    setAssignedTagIds(updatedAssignments);
    
    await saveTagsFile(allTags, updatedAssignments);
    try {
      window.dispatchEvent(new Event("tags-updated"));
    } catch (e) {}
  };

  const startEdit = (tag: Tag) => {
    setFormData({ name: tag.name, color: tag.color });
    setEditingId(tag.id);
    setShowAddForm(false);
  };

  const startAdd = () => {
    setFormData({ name: "", color: PRESET_COLORS[0] });
    setShowAddForm(true);
    setEditingId(null);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({ name: "", color: PRESET_COLORS[0] });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Manage Tags</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {/* Tags List */}
          {!showAddForm && editingId === null && (
            <div className="space-y-2">
              {allTags.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No tags created yet
                </p>
              ) : (
                allTags.map((tag) => {
                  const isAssigned = assignedTagIds.includes(tag.id);
                  return (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-md hover:bg-accent/50 transition"
                    >
                      <button
                        onClick={() => handleToggleTagAssignment(tag.id)}
                        className="flex items-center gap-3 flex-1 text-left cursor-pointer select-none"
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2 transition",
                            isAssigned
                              ? "border-foreground bg-opacity-100"
                              : "border-gray-300"
                          )}
                          style={{
                            backgroundColor: isAssigned ? tag.color : "transparent",
                          }}
                        />
                        <span className="text-sm font-medium">{tag.name}</span>
                        {isAssigned && (
                          <Check className="h-4 w-4 text-foreground ml-auto mr-2" />
                        )}
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(tag)}
                          className="p-1.5 hover:bg-accent rounded-md transition"
                          title="Edit tag"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="p-1.5 hover:bg-destructive/20 rounded-md transition text-destructive"
                          title="Delete tag"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Add Form */}
          {showAddForm && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tag Name</label>
                <Input
                  type="text"
                  placeholder="Enter tag name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTag();
                    if (e.key === "Escape") handleCancel();
                  }}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Select Color
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        setFormData({ ...formData, color })
                      }
                      className={cn(
                        "w-full aspect-square rounded-md border-2 transition",
                        formData.color === color
                          ? "border-foreground ring-2 ring-foreground ring-offset-2"
                          : "border-gray-300 hover:border-gray-400"
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddTag}
                  disabled={!formData.name.trim()}
                  className="flex-1"
                >
                  Add Tag
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Edit Form */}
          {editingId !== null && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Tag Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter tag name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateTag(editingId);
                    if (e.key === "Escape") handleCancel();
                  }}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Select Color
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        setFormData({ ...formData, color })
                      }
                      className={cn(
                        "w-full aspect-square rounded-md border-2 transition",
                        formData.color === color
                          ? "border-foreground ring-2 ring-foreground ring-offset-2"
                          : "border-gray-300 hover:border-gray-400"
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleUpdateTag(editingId)}
                  disabled={!formData.name.trim()}
                  className="flex-1"
                >
                  Update Tag
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showAddForm && editingId === null && (
          <div className="p-4 border-t">
            <Button
              onClick={startAdd}
              className="w-full"
              variant="default"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Tag
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

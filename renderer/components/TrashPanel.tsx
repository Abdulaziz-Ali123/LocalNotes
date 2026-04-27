/*
 * Atharva Patil - 26APR2026 - Sidebar to manage deleted notes and attachments, allowing users to restore or permanently delete items from the trash.
*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/renderer/components/ui/button";

interface TrashItem {
  id: string;
  name: string;
  originalPath: string;
  trashedPath: string;
  isDirectory: boolean;
  deletedAt: string;
}

interface TrashPanelProps {
  rootPath: string | null;
  onFileSelect: (filePath: string) => void;
}

export default function TrashPanel({ rootPath, onFileSelect }: TrashPanelProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const loadTrash = useCallback(async () => {
    if (!rootPath) {
      setItems([]);
      setSelectedId(null);
      return;
    }

    setLoading(true);
    const result = await window.fs.listTrash(rootPath);
    setLoading(false);
    if (!result.success || !Array.isArray(result.data)) {
      setItems([]);
      setSelectedId(null);
      return;
    }

    const nextItems = result.data as TrashItem[];
    setItems(nextItems);
    setPendingDeleteId(null);
    if (nextItems.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && nextItems.some((item) => item.id === prev) ? prev : nextItems[0].id));
  }, [rootPath]);

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  useEffect(() => {
    const readPreview = async () => {
      setPreviewText("");
      setPreviewImage(null);

      if (!selectedItem || selectedItem.isDirectory) return;
      const result = await window.fs.readFile(selectedItem.trashedPath);
      if (!result?.success) {
        setPreviewText("Unable to preview this item.");
        return;
      }

      if (result.type === "binary" && result.data) {
        setPreviewImage(`data:${result.mimeType || "image/png"};base64,${result.data}`);
        return;
      }

      setPreviewText(String(result.data ?? ""));
    };

    void readPreview();
  }, [selectedItem]);

  const handleRestore = async (itemId: string) => {
    if (!rootPath) return;
    const result = await window.fs.restoreTrashItem(rootPath, itemId);
    if (!result.success) {
      alert(`Failed to restore item: ${result.error}`);
      return;
    }

    const restoredPath = result.data?.restoredPath;
    await loadTrash();

    if (restoredPath) {
      const isDirResult = await window.fs.isDirectory(restoredPath);
      if (!isDirResult?.data) {
        onFileSelect(restoredPath);
      }
    }
  };

  const handleDeleteForever = async (itemId: string) => {
    if (!rootPath) return;

    const result = await window.fs.deleteTrashItem(rootPath, itemId);
    if (!result.success) {
      alert(`Failed to permanently delete item: ${result.error}`);
      return;
    }

    await loadTrash();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-semibold">Trash</div>
        <div className="text-xs text-muted-foreground">
          Deleted notes and attachments are kept here until restored or purged.
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="w-1/2 border-r border-border overflow-auto">
          {!rootPath ? (
            <div className="p-4 text-sm text-muted-foreground">Open a notes folder to view Trash.</div>
          ) : loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading trash…</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Trash is empty.</div>
          ) : (
            <ul className="p-2 space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setPendingDeleteId(null);
                    }}
                    className={`w-full text-left px-2 py-2 rounded-md border ${
                      selectedId === item.id ? "border-ring bg-accent/30" : "border-transparent hover:bg-accent/20"
                    }`}
                  >
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{item.originalPath}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(item.deletedAt).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="w-1/2 min-h-0 flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="text-sm font-medium truncate">
              {selectedItem ? selectedItem.name : "Preview"}
            </div>
            {selectedItem && (
              <div className="text-[11px] text-muted-foreground truncate">{selectedItem.originalPath}</div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-3">
            {!selectedItem ? (
              <div className="text-sm text-muted-foreground">Select an item to preview.</div>
            ) : selectedItem.isDirectory ? (
              <div className="text-sm text-muted-foreground">Folder preview is not available.</div>
            ) : previewImage ? (
              <img src={previewImage} alt={selectedItem.name} className="max-w-full h-auto rounded border border-border" />
            ) : (
              <pre className="text-xs whitespace-pre-wrap break-words">{previewText}</pre>
            )}
          </div>

          <div className="p-3 border-t border-border flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedItem}
              onClick={() => selectedItem && void handleRestore(selectedItem.id)}
            >
              Restore
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!selectedItem}
              onClick={() => {
                if (!selectedItem) return;
                if (pendingDeleteId === selectedItem.id) {
                  setPendingDeleteId(null);
                  void handleDeleteForever(selectedItem.id);
                  return;
                }
                setPendingDeleteId(selectedItem.id);
              }}
            >
              {selectedItem && pendingDeleteId === selectedItem.id
                ? "Confirm Delete Forever"
                : "Delete Forever"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
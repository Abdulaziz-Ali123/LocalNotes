import React, { useState, useEffect } from "react";
import { File, Folder, Tree, type TreeViewElement } from "./ui/file-tree";
import { Button } from "./ui/button";
import { FolderOpen, FilePlus, FolderPlus, Trash2, Edit2 } from "lucide-react";

interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

interface FileSystemTreeProps {
  onFileSelect?: (filePath: string) => void;
}

export default function FileSystemTree({ onFileSelect }: FileSystemTreeProps) {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [treeElements, setTreeElements] = useState<TreeViewElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    isDirectory: boolean;
  } | null>(null);
  const [loadedFolders, setLoadedFolders] = useState<Set<string>>(new Set());

  const openFolder = async () => {
    const result = await window.fs.openFolderDialog();
    if (result.success && result.data) {
      setRootPath(result.data);
      loadDirectory(result.data);
    }
  };

  const loadDirectory = async (dirPath: string, parentId?: string) => {
    const result = await window.fs.readDirectory(dirPath);
    if (result.success && result.data) {
      const items: FileSystemItem[] = result.data;

      // Convert to TreeViewElement format
      const elements: TreeViewElement[] = items
        .sort((a, b) => {
          // Folders first, then files
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((item) => ({
          id: item.path,
          name: item.name,
          isSelectable: true,
          children: item.isDirectory ? [] : undefined,
        }));

      if (parentId) {
        // Update children of a specific folder
        setTreeElements((prev) => updateTreeChildren(prev, parentId, elements));
        setLoadedFolders((prev) => {
          const newSet = new Set(prev);
          newSet.add(parentId);
          return newSet;
        });
      } else {
        // Set root elements
        setTreeElements(elements);
        setLoadedFolders(new Set([dirPath]));
      }
    }
  };

  const updateTreeChildren = (
    tree: TreeViewElement[],
    targetId: string,
    newChildren: TreeViewElement[]
  ): TreeViewElement[] => {
    return tree.map((node) => {
      if (node.id === targetId) {
        return { ...node, children: newChildren };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeChildren(node.children, targetId, newChildren),
        };
      }
      return node;
    });
  };

  const handleFileSelect = (fileId: string) => {
    setSelectedId(fileId);
    if (onFileSelect) {
      onFileSelect(fileId);
    }
  };

  const createNewFolder = async (parentPath: string) => {
    const folderName = prompt("Enter folder name:");
    if (folderName) {
      const newFolderPath = `${parentPath}/${folderName}`;
      const result = await window.fs.createFolder(newFolderPath);
      if (result.success) {
        // Mark parent as not loaded and reload
        setLoadedFolders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(parentPath);
          return newSet;
        });
        await loadDirectory(parentPath, parentPath);
      } else {
        alert(`Failed to create folder: ${result.error}`);
      }
    }
  };

  const createNewFile = async (parentPath: string) => {
    const fileName = prompt("Enter file name:");
    if (fileName) {
      const newFilePath = `${parentPath}/${fileName}`;
      const result = await window.fs.createFile(newFilePath, "");
      if (result.success) {
        // Mark parent as not loaded and reload
        setLoadedFolders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(parentPath);
          return newSet;
        });
        await loadDirectory(parentPath, parentPath);
      } else {
        alert(`Failed to create file: ${result.error}`);
      }
    }
  };

  const deleteItem = async (itemPath: string) => {
    const confirmed = confirm(`Are you sure you want to delete this item?`);
    if (confirmed) {
      const result = await window.fs.deleteItem(itemPath);
      if (result.success) {
        // Reload the parent directory
        const parentPath = itemPath.substring(0, itemPath.lastIndexOf("/"));
        const reloadPath = parentPath || rootPath!;
        setLoadedFolders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(reloadPath);
          return newSet;
        });
        await loadDirectory(reloadPath, parentPath || undefined);
      } else {
        alert(`Failed to delete item: ${result.error}`);
      }
    }
  };

  const renameItem = async (oldPath: string) => {
    const oldName = oldPath.substring(oldPath.lastIndexOf("/") + 1);
    const newName = prompt("Enter new name:", oldName);
    if (newName && newName !== oldName) {
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"));
      const newPath = `${parentPath}/${newName}`;
      const result = await window.fs.renameItem(oldPath, newPath);
      if (result.success) {
        // Reload the parent directory
        const reloadPath = parentPath || rootPath!;
        setLoadedFolders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(reloadPath);
          return newSet;
        });
        await loadDirectory(reloadPath, parentPath || undefined);
      } else {
        alert(`Failed to rename item: ${result.error}`);
      }
    }
  };

  const handleFolderClick = async (folderId: string) => {
    // Only load if not already loaded
    if (!loadedFolders.has(folderId)) {
      await loadDirectory(folderId, folderId);
    }
  };

  const renderTree = (elements: TreeViewElement[]): React.ReactNode => {
    return elements.map((element) => {
      if (element.children !== undefined) {
        return (
          <div
            key={element.id}
            onClickCapture={() => handleFolderClick(element.id)}
          >
            <Folder
              element={element.name}
              value={element.id}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  path: element.id,
                  isDirectory: true,
                });
              }}
            >
              {element.children &&
                element.children.length > 0 &&
                renderTree(element.children)}
            </Folder>
          </div>
        );
      } else {
        return (
          <File
            key={element.id}
            value={element.id}
            onClick={() => handleFileSelect(element.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                path: element.id,
                isDirectory: false,
              });
            }}
          >
            <p>{element.name}</p>
          </File>
        );
      }
    });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const createNewFolderPrompt = async () => {
    const folderName = prompt("Enter new folder name:");
    if (folderName) {
      const result = await window.fs.openFolderDialog();
      if (result.success && result.data) {
        const parentPath = result.data;
        const newFolderPath = `${parentPath}/${folderName}`;
        const createResult = await window.fs.createFolder(newFolderPath);
        if (createResult.success) {
          setRootPath(newFolderPath);
          loadDirectory(newFolderPath);
        } else {
          alert(`Failed to create folder: ${createResult.error}`);
        }
      }
    }
  };

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <FolderOpen className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground text-center">No folder opened</p>
        <div className="flex gap-2">
          <Button onClick={openFolder} variant="outline">
            <FolderOpen className="mr-2 h-4 w-4" />
            Open Folder
          </Button>
          <Button onClick={createNewFolderPrompt} variant="outline">
            <FolderPlus className="mr-2 h-4 w-4" />
            Create Folder
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="flex items-center justify-between p-2 border-b bg-sidebar/50">
        <span
          className="text-sm font-semibold truncate flex-1"
          title={rootPath}
        >
          {rootPath.split("/").pop()}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => createNewFile(rootPath)}
            title="New File (Ctrl+N)"
            className="h-8 w-8 hover:bg-accent"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => createNewFolder(rootPath)}
            title="New Folder (Ctrl+Shift+N)"
            className="h-8 w-8 hover:bg-accent"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="h-full overflow-auto"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            path: rootPath,
            isDirectory: true,
          });
        }}
      >
        <Tree
          className="p-2"
          elements={treeElements}
          initialSelectedId={selectedId}
          initialExpandedItems={[]}
        >
          {renderTree(treeElements)}
        </Tree>
      </div>

      {contextMenu && (
        <div
          className="fixed bg-popover border rounded-md shadow-md py-1 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          {contextMenu.isDirectory && (
            <>
              <button
                className="w-full px-4 py-2 text-sm hover:bg-accent text-left flex items-center gap-2"
                onClick={() => {
                  createNewFile(contextMenu.path);
                  setContextMenu(null);
                }}
              >
                <FilePlus className="h-4 w-4" />
                New File
              </button>
              <button
                className="w-full px-4 py-2 text-sm hover:bg-accent text-left flex items-center gap-2"
                onClick={() => {
                  createNewFolder(contextMenu.path);
                  setContextMenu(null);
                }}
              >
                <FolderPlus className="h-4 w-4" />
                New Folder
              </button>
            </>
          )}
          <button
            className="w-full px-4 py-2 text-sm hover:bg-accent text-left flex items-center gap-2"
            onClick={() => {
              renameItem(contextMenu.path);
              setContextMenu(null);
            }}
          >
            <Edit2 className="h-4 w-4" />
            Rename
          </button>
          <button
            className="w-full px-4 py-2 text-sm hover:bg-accent text-left flex items-center gap-2 text-destructive"
            onClick={() => {
              deleteItem(contextMenu.path);
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { File, Folder, Tree, type TreeViewElement } from "./ui/file-tree";
import { Button } from "./ui/button";
import { FolderOpen, FilePlus, FolderPlus, Trash2, Edit2 } from "lucide-react";
import InputDialog from "./InputDialog";

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
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(
    null
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    isDirectory: boolean;
  } | null>(null);
  const [loadedFolders, setLoadedFolders] = useState<Set<string>>(new Set());
  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    defaultValue: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: "",
    placeholder: "",
    defaultValue: "",
    onConfirm: () => {},
  });

  const openFolder = async () => {
    const result = await window.fs.openFolderDialog();
    if (result.success && result.data) {
      setRootPath(result.data);
      setSelectedFolderPath(result.data); // Select root by default
      loadDirectory(result.data);
    }
  };

  // Load folder from localStorage on mount
  useEffect(() => {
    const savedFolderPath = localStorage.getItem("currentFolderPath");
    if (savedFolderPath) {
      setRootPath(savedFolderPath);
      setSelectedFolderPath(savedFolderPath);
      loadDirectory(savedFolderPath);
    }
  }, []);

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
          // Wrap everything under the root folder node itself
          const rootNode: TreeViewElement = {
              id: dirPath,
              name: window.fs.basename(dirPath),
              isSelectable: true,
              children:elements,
          };
        setTreeElements([rootNode]);
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
    setInputDialog({
      isOpen: true,
      title: "Create New Folder",
      placeholder: "Folder name",
      defaultValue: "",
      onConfirm: async (folderName) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        const newFolderPath = `${parentPath}/${folderName}`;
        const result = await window.fs.createFolder(newFolderPath);
        if (result.success) {
          // Mark parent as not loaded and reload
          setLoadedFolders((prev) => {
            const newSet = new Set(prev);
            newSet.delete(parentPath);
            return newSet;
          });

          // If creating in root, reload root. Otherwise reload subfolder
          if (parentPath === rootPath) {
            await loadDirectory(parentPath);
          } else {
            await loadDirectory(parentPath, parentPath);
          }
        } else {
          alert(`Failed to create folder: ${result.error}`);
        }
      },
    });
  };

  const createNewFile = async (parentPath: string) => {
    setInputDialog({
      isOpen: true,
      title: "Create New File",
      placeholder: "File name (e.g., notes.txt)",
      defaultValue: "",
      onConfirm: async (fileName) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        const newFilePath = `${parentPath}/${fileName}`;
        const result = await window.fs.createFile(newFilePath, "");
        if (result.success) {
          // Mark parent as not loaded and reload
          setLoadedFolders((prev) => {
            const newSet = new Set(prev);
            newSet.delete(parentPath);
            return newSet;
          });

          // If creating in root, reload root. Otherwise reload subfolder
          if (parentPath === rootPath) {
            await loadDirectory(parentPath);
          } else {
            await loadDirectory(parentPath, parentPath);
          }
        } else {
          alert(`Failed to create file: ${result.error}`);
        }
      },
    });
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

        // If deleting from root, reload root. Otherwise reload subfolder
        if (reloadPath === rootPath) {
          await loadDirectory(reloadPath);
        } else {
          await loadDirectory(reloadPath, reloadPath);
        }
      } else {
        alert(`Failed to delete item: ${result.error}`);
      }
    }
  };

  const renameItem = async (oldPath: string) => {
      const oldName = window.fs.basename(oldPath);               // "file.md"
      const parentPath = window.fs.dirname(oldPath);             // "C:\folder"

      if (!oldPath || !parentPath) {
          alert("Invalid path: cannot rename root or outside directory.");
          return;
      }

      setInputDialog({
          isOpen: true,
          title: "Rename File or Folder",
          placeholder: "New name (include extension)",
          defaultValue: oldName,
          onConfirm: async (newName) => {
              if (!newName || newName === oldName) return;

              const newPath = window.fs.join(parentPath, newName.trim());
              const result = await window.fs.renameItem(oldPath, newPath);

              if (result.success) {
                  // CASE 1: Renamed the ROOT folder itself
                  if (oldPath === rootPath) {
                      const newRootPath = newPath;
                      setRootPath(newRootPath);
                      setSelectedFolderPath(newRootPath);
                      localStorage.setItem("currentFolderPath", newRootPath);

                      // Reload tree to reflect the renamed root
                      await loadDirectory(newRootPath);
                      alert("Root folder renamed successfully!");
                      return;
                  }

                  // CASE 2: Renamed a child file/folder
                  const reloadPath = parentPath || rootPath!;
                  setLoadedFolders((prev) => {
                      const newSet = new Set(prev);
                      newSet.delete(reloadPath);
                      return newSet;
                  });

                  if (reloadPath === rootPath) {
                      await loadDirectory(reloadPath);
                  } else {
                      await loadDirectory(reloadPath, reloadPath);
                  }
              } else {
                  alert(`Failed to rename item: ${result.error}`);
              }
          },
      });
  };


  const handleFolderClick = async (folderId: string, e?: React.MouseEvent) => {
    // Set this folder as selected
    setSelectedFolderPath(folderId);

    // Only load if not already loaded
    if (!loadedFolders.has(folderId)) {
      await loadDirectory(folderId, folderId);
    }
  };

  const renderTree = (elements: TreeViewElement[]): React.ReactNode => {
    return elements.map((element) => {
      if (element.children !== undefined) {
        const isSelected = selectedFolderPath === element.id;
        return (
          <div
            key={element.id}
            onClickCapture={() => handleFolderClick(element.id)}
          >
            <Folder
              element={element.name}
              value={element.id}
              isSelect={isSelected}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
              e.stopPropagation();
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
    setInputDialog({
      isOpen: true,
      title: "Create New Folder",
      placeholder: "Folder name",
      defaultValue: "",
      onConfirm: async (folderName) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        const result = await window.fs.openFolderDialog();
        if (result.success && result.data) {
          const parentPath = result.data;
          const newFolderPath = `${parentPath}/${folderName}`;
          const createResult = await window.fs.createFolder(newFolderPath);
          if (createResult.success) {
            setRootPath(newFolderPath);
            setSelectedFolderPath(newFolderPath); // Select the newly created folder
            loadDirectory(newFolderPath);
          } else {
            alert(`Failed to create folder: ${createResult.error}`);
          }
        }
      },
    });
  };

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <FolderOpen className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground text-center">No folder opened</p>
        <p className="text-sm text-muted-foreground text-center">
          Please open or create a folder from the home page
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="flex items-center justify-between p-2 border-b">
        <span
          className="text-sm font-semibold truncate flex-1"
          title={selectedFolderPath || rootPath || "No folder selected"}
              >
                  {selectedFolderPath || rootPath || "No folder selected"}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => createNewFile(selectedFolderPath || rootPath)}
            title={`New File in ${
              selectedFolderPath ? selectedFolderPath.split("/").pop() : "root"
            }`}
            className="h-8 w-8 hover:bg-accent"
          >
            <FilePlus className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => createNewFolder(selectedFolderPath || rootPath)}
            title={`New Folder in ${
              selectedFolderPath ? selectedFolderPath.split("/").pop() : "root"
            }`}
            className="h-8 w-8 hover:bg-accent"
          >
            <FolderPlus className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div
        className="h-full overflow-auto"
        onClick={(e) => {
          // If clicking on the container itself (not a folder), reset to root
          if (e.target === e.currentTarget) {
            setSelectedFolderPath(rootPath);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            path: selectedFolderPath || rootPath,
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
                <FilePlus className="h-6 w-6" />
                New File
              </button>
              <button
                className="w-full px-4 py-2 text-sm hover:bg-accent text-left flex items-center gap-2"
                onClick={() => {
                  createNewFolder(contextMenu.path);
                  setContextMenu(null);
                }}
              >
                <FolderPlus className="h-6 w-6" />
                New Folder
              </button>
            </>
          )}
          <button
            className="w-full px-4 py-2 text-sm hover:bg-accent text-left flex items-center gap-2"
            onClick={() => {
              console.log("Renaming path:", contextMenu.path, "Is directory?", contextMenu.isDirectory);
              renameItem(contextMenu.path);
              setContextMenu(null);
            }}
          >
            <Edit2 className="h-6 w-6" />
            Rename
          </button>
          <button
            className="w-full px-4 py-2 text-sm hover:bg-accent text-left flex items-center gap-2 text-destructive"
            onClick={() => {
              deleteItem(contextMenu.path);
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-6 w-6" />
            Delete
          </button>
        </div>
      )}

      <InputDialog
        isOpen={inputDialog.isOpen}
        title={inputDialog.title}
        placeholder={inputDialog.placeholder}
        defaultValue={inputDialog.defaultValue}
        onConfirm={inputDialog.onConfirm}
        onCancel={() => setInputDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

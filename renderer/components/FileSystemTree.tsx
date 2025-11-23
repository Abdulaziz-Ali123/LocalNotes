import React, { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from "react";
import { File, Folder, Tree, type TreeViewElement } from "./ui/file-tree";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FolderOpen, FilePlus, FolderPlus, Trash2, Edit2, Search, X } from "lucide-react";
import InputDialog from "./InputDialog";

interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

interface SearchResult {
  path: string;
  matches: number;
}

interface FileSystemTreeProps {
  onFileSelect?: (filePath: string) => void;
  autoOpen?: boolean;
  isVisible?: boolean;
}

export interface FileSystemTreeRef {
  createNewFile: (parentPath: string) => void;
  createNewFolder: (parentPath: string) => void;
}

const FileSystemTree = forwardRef<FileSystemTreeRef, FileSystemTreeProps>(
  ({ onFileSelect, autoOpen = true, isVisible = true }, ref) => {
    const [rootPath, setRootPath] = useState<string | null>(null);
    const [treeElements, setTreeElements] = useState<TreeViewElement[]>([]);
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      path: string;
      isDirectory: boolean;
    } | null>(null);
    const [loadedFolders, setLoadedFolders] = useState<Set<string>>(new Set());
    const [isInitializing, setIsInitializing] = useState<boolean>(true);

    // Search states
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [useRegex, setUseRegex] = useState<boolean>(false);
    const [matchCase, setMatchCase] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchResults, setSearchResults] = useState<Set<string>>(new Set());

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

    // Expose functions to parent component via ref
    useImperativeHandle(ref, () => ({
      createNewFile: (parentPath: string) => {
        createNewFile(parentPath);
      },
      createNewFolder: (parentPath: string) => {
        createNewFolder(parentPath);
      },
    }));

    // Search through file contents
    const searchFileContents = async (dirPath: string, query: string): Promise<SearchResult[]> => {
      const results: SearchResult[] = [];

      try {
        const dirResult = await window.fs.readDirectory(dirPath);
        if (!dirResult.success || !dirResult.data) return results;

        const items: FileSystemItem[] = dirResult.data;

        for (const item of items) {
          if (item.isDirectory) {
            // Recursively search subdirectories
            const subResults = await searchFileContents(item.path, query);
            results.push(...subResults);
          } else {
            // Search file content
            try {
              const fileResult = await window.fs.readFile(item.path);
              if (fileResult.success && fileResult.data) {
                const content = fileResult.data as string;
                let matches = 0;

                if (useRegex) {
                  try {
                    const flags = matchCase ? "g" : "gi";
                    const regex = new RegExp(query, flags);
                    const found = content.match(regex);
                    matches = found ? found.length : 0;
                  } catch (e) {
                    // Invalid regex, skip
                    continue;
                  }
                } else {
                  const searchText = matchCase ? content : content.toLowerCase();
                  const searchQuery = matchCase ? query : query.toLowerCase();
                  let pos = 0;
                  while ((pos = searchText.indexOf(searchQuery, pos)) !== -1) {
                    matches++;
                    pos += searchQuery.length;
                  }
                }

                if (matches > 0) {
                  results.push({ path: item.path, matches });
                }
              }
            } catch (e) {
              // Skip files that can't be read (binary files, etc.)
              continue;
            }
          }
        }
      } catch (e) {
        console.error("Error searching directory:", e);
      }

      return results;
    };

    // Trigger search
    const handleSearch = async () => {
      if (!searchQuery.trim() || !rootPath) return;

      setIsSearching(true);
      setSearchResults(new Set());

      try {
        const results = await searchFileContents(rootPath, searchQuery);
        const resultPaths = new Set(results.map((r) => r.path));
        setSearchResults(resultPaths);
      } catch (e) {
        console.error("Search error:", e);
        alert("An error occurred while searching");
      } finally {
        setIsSearching(false);
      }
    };

    // Clear search
    const clearSearch = () => {
      setSearchQuery("");
      setSearchResults(new Set());
    };

    // Filter tree based on search results
    const filterTreeByResults = (
      elements: TreeViewElement[],
      results: Set<string>
    ): TreeViewElement[] => {
      if (results.size === 0) return elements;

      return elements.reduce<TreeViewElement[]>((acc, element) => {
        if (element.children !== undefined) {
          // It's a folder
          const filteredChildren = filterTreeByResults(element.children, results);

          // Include folder if it has matching children
          if (filteredChildren.length > 0) {
            acc.push({
              ...element,
              children: filteredChildren,
            });
          }
        } else {
          // It's a file - include if in results
          if (results.has(element.id)) {
            acc.push(element);
          }
        }

        return acc;
      }, []);
    };

    const filteredTreeElements = useMemo(() => {
      if (searchResults.size === 0) {
        return treeElements;
      }
      return filterTreeByResults(treeElements, searchResults);
    }, [treeElements, searchResults]);

    const openFolder = async () => {
      const result = await window.fs.openFolderDialog();
      if (result.success && result.data) {
        setRootPath(result.data);
        localStorage.setItem("currentFolderPath", result.data);
        setSelectedFolderPath(result.data);
        loadDirectory(result.data);
      }
    };

    // Load folder from localStorage on mount
    useEffect(() => {
      if (!autoOpen) {
        setIsInitializing(false);
        return;
      }

      const savedFolderPath = localStorage.getItem("currentFolderPath");
      if (savedFolderPath) {
        setRootPath(savedFolderPath);
        setSelectedFolderPath(savedFolderPath);
        loadDirectory(savedFolderPath);
        setIsInitializing(false);
      } else {
        const timer = setTimeout(() => {
          setIsInitializing(false);
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [autoOpen]);

    useEffect(() => {
      if (!isVisible) return;
      if (rootPath) return;

      const savedFolderPath = localStorage.getItem("currentFolderPath");
      if (savedFolderPath) {
        setRootPath(savedFolderPath);
        setSelectedFolderPath(savedFolderPath);
        loadDirectory(savedFolderPath);
      }
    }, [isVisible, rootPath]);

    const loadDirectory = async (dirPath: string, parentId?: string) => {
      const result = await window.fs.readDirectory(dirPath);
      if (!result.success || !result.data) return;

      const items: TreeViewElement[] = result.data
        .sort((a, b) => {
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
        setTreeElements((prev) => {
          const updateNode = (tree: TreeViewElement[]): TreeViewElement[] => {
            return tree.map((node) => {
              if (node.id === parentId) {
                const existingChildrenMap = new Map(node.children?.map((c) => [c.id, c]) || []);
                const mergedChildren = items.map((item) => {
                  if (existingChildrenMap.has(item.id)) {
                    const existing = existingChildrenMap.get(item.id)!;
                    return { ...item, children: existing.children };
                  }
                  return item;
                });
                return { ...node, children: mergedChildren };
              }
              if (node.children) {
                return { ...node, children: updateNode(node.children) };
              }
              return node;
            });
          };
          return updateNode(prev);
        });

        setLoadedFolders((prev) => new Set(prev).add(parentId));
      } else {
        setTreeElements([
          { id: dirPath, name: window.fs.basename(dirPath), isSelectable: true, children: items },
        ]);
        setLoadedFolders(new Set([dirPath]));
        setRootPath(dirPath);
        localStorage.setItem("currentFolderPath", dirPath);
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
            setLoadedFolders((prev) => {
              const newSet = new Set(prev);
              newSet.delete(parentPath);
              return newSet;
            });

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
            setLoadedFolders((prev) => {
              const newSet = new Set(prev);
              newSet.delete(parentPath);
              return newSet;
            });

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
          const parentPath = itemPath.substring(0, itemPath.lastIndexOf("/"));
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
          alert(`Failed to delete item: ${result.error}`);
        }
      }
    };

    const renameItem = async (oldPath: string) => {
      const oldName = window.fs.basename(oldPath);
      const parentPath = window.fs.dirname(oldPath);

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
            if (oldPath === rootPath) {
              const newRootPath = newPath;
              setRootPath(newRootPath);
              setSelectedFolderPath(newRootPath);
              localStorage.setItem("currentFolderPath", newRootPath);

              await loadDirectory(newRootPath);
              alert("Root folder renamed successfully!");
              return;
            }

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
      setSelectedFolderPath(folderId);

      if (!loadedFolders.has(folderId)) {
        await loadDirectory(folderId, folderId);
      }
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, sourcePath: string) => {
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", sourcePath);
      console.log("Dragging:", sourcePath);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (
      e: React.DragEvent<HTMLDivElement>,
      targetPath: string,
      isTargetFolder: boolean
    ) => {
      e.preventDefault();
      e.stopPropagation();

      const sourcePath = e.dataTransfer.getData("text/plain");
      if (!sourcePath || sourcePath === targetPath) return;

      const destinationFolder = isTargetFolder ? targetPath : window.fs.dirname(targetPath);
      const newPath = window.fs.join(destinationFolder, window.fs.basename(sourcePath));
      if (newPath === sourcePath) return;

      const parentExists = await window.fs.exists(destinationFolder);
      if (!parentExists?.success || !parentExists.data) return;

      const result = await window.fs.renameItem(sourcePath, newPath);
      if (!result.success) {
        alert(`Failed to move item: ${result.error}`);
        return;
      }

      const sourceParent = window.fs.dirname(sourcePath);
      const isDir = (await window.fs.isDirectory(newPath)).data;

      let foldersToReload: string[] = [];

      if (isDir) {
        foldersToReload = [sourceParent, destinationFolder, newPath];
      } else {
        foldersToReload =
          sourceParent === destinationFolder ? [sourceParent] : [sourceParent, destinationFolder];
      }

      const prevLoaded = new Set(loadedFolders);
      const prevSelected = selectedFolderPath;

      setLoadedFolders((prev) => {
        const set = new Set(prev);
        foldersToReload.forEach((f) => set.delete(f));
        return set;
      });

      setTimeout(async () => {
        for (const f of foldersToReload) {
          await loadDirectory(f, f);
        }

        setLoadedFolders((prev) => {
          const set = new Set(prev);
          prevLoaded.forEach((f) => set.add(f));
          foldersToReload.forEach((f) => set.add(f));
          return set;
        });

        setSelectedFolderPath((prev) => {
          if (prev === sourcePath) return newPath;
          return prevSelected;
        });
      }, 100);
    };

    const renderTree = (elements: TreeViewElement[]): React.ReactNode => {
      return elements.map((element) => {
        const isFolder = element.children !== undefined;
        const isSelected = selectedFolderPath === element.id;

        return (
          <div
            key={element.id}
            draggable
            onDragStart={(e) => handleDragStart(e, element.id)}
            onDragOver={(e) => handleDragOver(e)}
            onDrop={(e) => handleDrop(e, element.id, isFolder)}
          >
            {isFolder ? (
              <div onClickCapture={() => handleFolderClick(element.id)}>
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
                  {element.children && element.children.length > 0 && renderTree(element.children)}
                </Folder>
              </div>
            ) : (
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
            )}
          </div>
        );
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
              localStorage.setItem("currentFolderPath", newFolderPath);
              setSelectedFolderPath(newFolderPath);
              loadDirectory(newFolderPath);
            } else {
              alert(`Failed to create folder: ${createResult.error}`);
            }
          }
        },
      });
    };

    if (isInitializing) {
      return null;
    }

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
                console.log(
                  "Renaming path:",
                  contextMenu.path,
                  "Is directory?",
                  contextMenu.isDirectory
                );
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
);

export default FileSystemTree;
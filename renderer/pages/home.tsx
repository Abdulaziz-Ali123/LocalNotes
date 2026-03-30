import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { RiRobot2Line, RiCloseLine, RiInformationLine } from "react-icons/ri";
import { useRouter } from "next/router";
import { Button } from "@/renderer/components/ui/button";
import InputDialog from "@/renderer/components/InputDialog";

export default function HomePage() {
  const router = useRouter();
  const [inputDialog, setInputDialog] = useState({
    isOpen: false,
    title: "",
    placeholder: "",
    defaultValue: "",
    onConfirm: (value: string) => {},
  });
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState("");
  const [showRagModal, setShowRagModal] = useState(false);
  const [pendingRagInit, setPendingRagInit] = useState<{uuid: string, path: string} | null>(null);

  const handleOpenFolder = async () => {
    if (!window.fs?.openFolderDialog || !window.db?.addDirectory || !window.indexer?.indexDirectory) {
      alert("App APIs are not available. Please restart the app to reload preload scripts.");
      return;
    }

    const result = await window.fs.openFolderDialog();
    if (result.success && result.data) {
      try {
        setIsIndexing(true);
        setIndexingStatus("Searching for existing repository...");
        
        // Store the folder path in localStorage
        localStorage.setItem("currentFolderPath", result.data);

        // Check if directory already exists in database
        const existingDir = await window.db.getDirectoryIdByPath(result.data);
        let uuid: string;

        if (existingDir.success && existingDir.data) {
          uuid = existingDir.data;
          console.log("Existing directory found with ID:", uuid);
          
          // Check if .Local Notes exists, if not, it might need re-indexing
          const localNotesDir = window.fs.join(result.data, ".Local Notes");
          const existsRes = await window.fs.exists(localNotesDir);
          
          if (existsRes.success && existsRes.data) {
            // Already initialized, just go to editor
            router.push("/editor");
            return;
          } else {
            // Found in DB but no folder, prompt to re-init
            setPendingRagInit({ uuid, path: result.data });
            setShowRagModal(true);
            setIsIndexing(false);
          }
        } else {
          // New directory, prompt to initialize RAG
          uuid = window.crypto.randomUUID();
          setPendingRagInit({ uuid, path: result.data });
          setShowRagModal(true);
          setIsIndexing(false);
        }
      } catch (error) {
        console.error("Error:", error);
        alert(`Failed to open and index folder: ${error}`);
        setIndexingStatus("");
        setIsIndexing(false);
      }
    }
  };

  const handleCreateFolder = async () => {
    if (!window.fs?.openFolderDialog || !window.fs?.createFolder || !window.db?.addDirectory) {
      alert("App APIs are not available. Please restart the app to reload preload scripts.");
      return;
    }

    setInputDialog({
      isOpen: true,
      title: "Create New Folder",
      placeholder: "Folder name",
      defaultValue: "",
      onConfirm: async (folderName) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        
        const result = await window.fs.openFolderDialog();
        if (result.success && result.data) {
          try {
            const parentPath = result.data;
            const newFolderPath = `${parentPath}/${folderName}`;
            
            // Create the folder
            const createResult = await window.fs.createFolder(newFolderPath);
            if (!createResult.success) {
              throw new Error(createResult.error || "Failed to create folder");
            }
            
            // Store the folder path in localStorage
            localStorage.setItem("currentFolderPath", newFolderPath);

            // Set up pending init and show modal
            const uuid: string = window.crypto.randomUUID();
            setPendingRagInit({ uuid, path: newFolderPath });
            setShowRagModal(true);
          } catch (error) {
            console.error("Error:", error);
            alert(`Failed to create folder: ${error}`);
          }
        }
      },
    });
  };

  const startRagInitialization = async () => {
    if (!pendingRagInit) return;
    
    try {
      setIsIndexing(true);
      setIndexingStatus("Registering folder...");
      
      const { uuid, path } = pendingRagInit;

      // Check if already in DB (might be re-indexing)
      const existingDir = await window.db.getDirectoryIdByPath(path);
      if (!existingDir.success || !existingDir.data) {
        const dirResult = await window.db.addDirectory(uuid, path);
        if (!dirResult.success) {
          throw new Error(dirResult.error || "Failed to add directory to database");
        }
      }

      // Ensure .Local Notes/.env exists
      const localNotesDir = window.fs.join(path, ".Local Notes");
      await window.fs.createFolder(localNotesDir);
      await window.fs.writeFile(window.fs.join(localNotesDir, ".env"), `DIRECTORY_ID=${uuid}`);
      
      setIndexingStatus("Indexing files (this may take a moment)...");
      const storeResult = await window.indexer.indexDirectory(uuid, path);

      if (storeResult.success) {
        setIndexingStatus("Complete!");
        setTimeout(() => {
          router.push("/editor");
        }, 500);
      } else {
        throw new Error(storeResult.error || "Failed to index directory");
      }
    } catch (error) {
      console.error("RAG Init Error:", error);
      alert(`Failed to initialize AI search: ${error}`);
      setIsIndexing(false);
      setShowRagModal(false);
    }
  };

  return (
    <React.Fragment>
      <div className="flex flex-col justify-center items-center bg-secondary">
        {/* this is the region that will allow dragging the window*/}
        <div className="w-full p-5 app-drag-region"> </div>
        <div className="h-screen flex justify-center items-center bg-seco">
          <div className="p-5 h-auto w-[600px] flex items-center flex-col justify-center rounded-2xl shadow-neumorph bg-secondary">
            <div>
              <Image
                className="ml-auto mr-auto pb-5"
                src="/images/logo.png"
                datatype=""
                alt="Logo image"
                width={256}
                height={256}
              />
            </div>
            
            {/* Show indexing status */}
            {isIndexing && (
              <div className="w-4/5 mb-4 p-4 bg-accent/20 rounded-lg text-center">
                <p className="text-lg font-semibold">{indexingStatus}</p>
              </div>
            )}
            
            <div className="grid grid-col-1 text-2xl w-4/5 ">
              <div className="flex flex-row justify-between items-center py-3">
                <span>
                  Create New Folder
                  <p className="text-sm pb-3">Create a new folder to hold your notes</p>
                </span>
                <button
                  onClick={handleCreateFolder}
                  disabled={isIndexing}
                  className="bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Folder
                </button>
              </div>
              <hr className="border-foreground/20" />

              <div className="flex flex-row justify-between items-center py-3">
                <span>
                  Open an Existing Folder
                  <p className="text-sm pb-3">Open an existing folder that holds your notes</p>
                </span>
                <button
                  onClick={handleOpenFolder}
                  disabled={isIndexing}
                  className="bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isIndexing ? "Indexing..." : "Open Folder"}
                </button>
              </div>

              <hr className="border-foreground/20" />
              <div className="flex flex-row justify-between items-center py-3">
                <span>
                  Configure Settings
                  <p className="text-sm pb-3">Edit settings like themes</p>
                </span>
                <button 
                  disabled={isIndexing}
                  className="bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Configure
                </button>
              </div>
            </div>
          </div>
        </div>

        <InputDialog
          isOpen={inputDialog.isOpen}
          title={inputDialog.title}
          placeholder={inputDialog.placeholder}
          defaultValue={inputDialog.defaultValue}
          onConfirm={inputDialog.onConfirm}
          onCancel={() => setInputDialog((prev) => ({ ...prev, isOpen: false }))}
        />

        {/* RAG Initialization Modal */}
        {showRagModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !isIndexing && setShowRagModal(false)}
          >
            <div 
              className="bg-secondary border border-border rounded-lg shadow-xl w-[450px] overflow-hidden animate-in fade-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <RiRobot2Line className="w-5 h-5 text-accent" />
                  <h2 className="text-lg font-semibold">Initialize AI Search</h2>
                </div>
                {!isIndexing && (
                  <button
                    onClick={() => setShowRagModal(false)}
                    className="rounded-md p-1 hover:bg-accent/20 transition-colors"
                  >
                    <RiCloseLine className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  To enable AI features for this folder, we need to index your notes. 
                  This creates a hidden <code className="bg-muted px-1 rounded font-mono text-xs">.Local Notes</code> folder.
                </p>

                {isIndexing ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-4 bg-muted/30 rounded-lg border border-dashed border-border">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                    <p className="text-sm font-medium animate-pulse">{indexingStatus}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/50 rounded-lg flex gap-3 border border-border text-xs text-muted-foreground">
                    <RiInformationLine className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <p>
                      Your notes are broken into small chunks and stored locally as mathematical 
                      embeddings. No data ever leaves your machine.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {!isIndexing && (
                <div className="px-6 py-4 bg-muted/20 border-t border-border flex justify-end gap-3">
                  <button 
                    onClick={() => {
                      setShowRagModal(false);
                      router.push("/editor");
                    }}
                    className="h-9 px-4 text-sm font-medium rounded-md hover:bg-accent/10 transition-colors"
                  >
                    Skip for now
                  </button>
                  <button 
                    onClick={startRagInitialization}
                    className="h-9 px-4 text-sm font-medium bg-accent text-accent-foreground rounded-md shadow-neumorph-sm active:shadow-neumorph-insert transition-all"
                  >
                    Initialize & Index
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}
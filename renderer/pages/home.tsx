/**
 * File: renderer/pages/home.tsx
 * Update Log:
 *  - 2026-04-12: Atharva Patil - Home page now includes quiz host/join launch actions.
 * Purpose:
 *  Entry page for creating or opening note directories and initializing indexing workflows.
 *
 * Revision History:
 *  • Wesley McDougal - 05APR2026 - Added idempotent directory registration flow for open/create/index paths
 */

import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { RiRobot2Line, RiCloseLine, RiInformationLine } from "react-icons/ri";
import { useRouter } from "next/router";
import { Button } from "@/renderer/components/ui/button";
import InputDialog from "@/renderer/components/InputDialog";
import { useBoundStore } from "@/renderer/store/useBoundStore";

export default function HomePage() {
  const router = useRouter();
  const globalAiSettings = useBoundStore((s) => s.settings.global.ai);
  const defaultRagEnabled = globalAiSettings?.defaultRagEnabled ?? false;

  const handleLocalNotesEnv = async (folderPath: string) => {
    const localNotesDir = window.fs.join(folderPath, ".localnotes");
    const envPath = window.fs.join(localNotesDir, ".env");
    
    const localNotesRes = await window.fs.exists(localNotesDir);
    const hasLocalNotes = localNotesRes.success ? localNotesRes.data : false;
    
    if (!hasLocalNotes) {
      await window.fs.createFolder(localNotesDir);
    }

    const envRes = await window.fs.exists(envPath);
    const hasEnv = envRes.success ? envRes.data : false;
    let uuid = crypto.randomUUID();
    let ragEnabledStr = defaultRagEnabled ? "true" : "false";
    let indexedStr = "false";
    let needsWrite = false;

    if (hasEnv) {
      const envContent = await window.fs.readFile(envPath);
      if (envContent.success) {
        const lines = envContent.data.split("\\n");
        let foundRag = false;
        lines.forEach((line: string) => {
          if (line.startsWith("DIRECTORY_ID=")) uuid = line.split("=")[1].trim();
          if (line.startsWith("INDEXED=")) indexedStr = line.split("=")[1].trim();
          if (line.startsWith("RAG_ENABLED=")) {
            ragEnabledStr = line.split("=")[1].trim();
            foundRag = true;
          }
        });

        if (!foundRag) {
          const userWantsRag = await new Promise<boolean>((resolve) => {
            setRagDialog({ isOpen: true, resolve });
          });
          ragEnabledStr = userWantsRag ? "true" : "false";
          needsWrite = true;
        }
      }
    } else {
      const userWantsRag = await new Promise<boolean>((resolve) => {
        setRagDialog({ isOpen: true, resolve });
      });
      ragEnabledStr = userWantsRag ? "true" : "false";
      needsWrite = true;
    }

    if (needsWrite) {
      const newEnvContent = `DIRECTORY_ID=${uuid}\\nRAG_ENABLED=${ragEnabledStr}\\nINDEXED=${indexedStr}`;
      await window.fs.writeFile(envPath, newEnvContent);
    }
    
    return { uuid, ragEnabledStr, indexedStr };
  };

  const [ragDialog, setRagDialog] = useState<{
    isOpen: boolean;
    resolve: (value: boolean) => void;
  }>({
    isOpen: false,
    resolve: () => {},
  });

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

  const ensureDirectoryRegistered = async (uuid: string, path: string) => {
    const existingDir = await window.db.getDirectoryIdByPath(path);

    if (existingDir.success && typeof existingDir.data === "string" && existingDir.data.length > 0) {
      return existingDir.data;
    }

    const dirResult = await window.db.addDirectory(uuid, path);
    if (!dirResult.success) {
      throw new Error(dirResult.error || "Failed to add directory");
    }

    return uuid;
  };

  const handleOpenFolder = async () => {
    if (!window.fs?.openFolderDialog || !window.db?.addDirectory || !window.db?.getDirectoryIdByPath || !window.indexer?.indexDirectory) {
      alert("App APIs are not available. Please restart the app to reload preload scripts.");
      return;
    }

    const result = await window.fs.openFolderDialog();
    if (result.success && result.data) {
      try {
        // Parse or Create .localnotes/.env
        const { uuid, ragEnabledStr } = await handleLocalNotesEnv(result.data);

        setIsIndexing(true);
        setIndexingStatus("Searching for existing repository...");
        
        // Store the folder path in localStorage
        localStorage.setItem("currentFolderPath", result.data);

        const directoryId = await ensureDirectoryRegistered(uuid, result.data);

        console.log("Directory ready with ID:", directoryId);
        
        // Index the directory if RAG is enabled
        if (ragEnabledStr === "true") {
          setIndexingStatus("Indexing files...");
          const storeResult = await window.indexer.indexDirectory(directoryId, result.data);

          if (storeResult.success && storeResult.data) {
            console.log(`✓ Indexing complete!`);
            console.log(`Files processed: ${storeResult.data.filesProcessed}`);
            console.log(`Chunks created: ${storeResult.data.chunksCreated}`);
            
            setIndexingStatus("Complete!");
            
            // Navigate to editor page
            setTimeout(() => {
              router.push("/editor");
            }, 500);
          } else {
            throw new Error(storeResult.error || "Failed to index directory");
          }
        } else {
          router.push("/editor");
        }
      } catch (error) {
        console.error("Error:", error);
        alert(`Failed to open folder: ${error}`);
        setIndexingStatus("");
        setIsIndexing(false);
      }
    }
  };

  const handleCreateFolder = async () => {
    if (!window.fs?.openFolderDialog || !window.fs?.createFolder || !window.db?.addDirectory || !window.db?.getDirectoryIdByPath) {
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

            // Parse or Create .localnotes/.env
            const { uuid, ragEnabledStr } = await handleLocalNotesEnv(newFolderPath);

            const directoryId = await ensureDirectoryRegistered(uuid, newFolderPath);

            if (directoryId) {
              console.log("Directory ready in database with ID:", directoryId);
              
              if (ragEnabledStr === "true") {
                setIsIndexing(true);
                setIndexingStatus("Initializing index...");
                const indexResult = await window.indexer.indexDirectory(directoryId, newFolderPath);
                if (indexResult.success) {
                  console.log("Empty directory index initialized successfully.");
                  setIndexingStatus("Complete!");
                } else {
                  console.error("Failed to initialize index:", indexResult.error);
                }
                setTimeout(() => {
                  router.push("/editor");
                }, 500);
              } else {
                router.push("/editor");
              }
            }
          } catch (error) {
            console.error("Error:", error);
            alert(`Failed to create folder: ${error}`);
            setIsIndexing(false);
            setIndexingStatus("");
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

      const directoryId = await ensureDirectoryRegistered(uuid, path);

      // Ensure .Local Notes/.env exists
      const localNotesDir = window.fs.join(path, ".Local Notes");
      await window.fs.createFolder(localNotesDir);
      await window.fs.writeFile(window.fs.join(localNotesDir, ".env"), `DIRECTORY_ID=${uuid}`);
      
      setIndexingStatus("Indexing files (this may take a moment)...");
      const storeResult = await window.indexer.indexDirectory(directoryId, path);

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
                  Host a Quiz Session
                  <p className="text-sm pb-3">Start a local multiplayer quiz lobby</p>
                </span>
                <button
                  disabled={isIndexing}
                  onClick={() => router.push("/quiz/host")}
                  className="bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Host Quiz
                </button>
              </div>

              <hr className="border-foreground/20" />
              <div className="flex flex-row justify-between items-center py-3">
                <span>
                  Join a Quiz Session
                  <p className="text-sm pb-3">Join by game code, link, or QR address</p>
                </span>
                <button
                  disabled={isIndexing}
                  onClick={() => router.push("/quiz/join")}
                  className="bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join Quiz
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

        {ragDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background border border-border rounded-lg shadow-lg w-[400px] p-6">
              <h2 className="text-lg font-semibold mb-2">Index this directory?</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Do you want to map and index this directory for AI capabilities? If you select Yes, the directory will be continuously indexed so the AI can understand your notes.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => {
                  ragDialog.resolve(false);
                  setRagDialog((prev) => ({ ...prev, isOpen: false }));
                }}>
                  No
                </Button>
                <Button onClick={() => {
                  ragDialog.resolve(true);
                  setRagDialog((prev) => ({ ...prev, isOpen: false }));
                }}>
                  Yes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}
import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
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

  const handleOpenFolder = async () => {
    const result = await window.fs.openFolderDialog();
    if (result.success && result.data) {
      try {
        setIsIndexing(true);
        setIndexingStatus("Adding directory to database...");
        
        // Store the folder path in localStorage
        localStorage.setItem("currentFolderPath", result.data);

        // Generate UUID and add directory to database
        const uuid: string = crypto.randomUUID();
        const dirResult = await window.db.addDirectory(uuid, result.data);
        
        if (!dirResult.success) {
          throw new Error(dirResult.error || "Failed to add directory");
        }
        
        console.log("Directory added with ID:", uuid);
        
        // Index the directory
        setIndexingStatus("Indexing files...");
        const storeResult = await window.indexer.indexDirectory(uuid, result.data);

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
      } catch (error) {
        console.error("Error:", error);
        alert(`Failed to open and index folder: ${error}`);
        setIndexingStatus("");
        setIsIndexing(false);
      }
    }
  };

  const handleCreateFolder = async () => {
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

            // Add directory to database
            const uuid: string = crypto.randomUUID();
            const storeResult = await window.db.addDirectory(uuid, newFolderPath);

            if (storeResult.success) {
              console.log("Directory added to database with ID:", uuid);
              // Navigate to editor page
              router.push("/editor");
            } else {
              throw new Error(storeResult.error || "Failed to add directory to database");
            }
          } catch (error) {
            console.error("Error:", error);
            alert(`Failed to create folder: ${error}`);
          }
        }
      },
    });
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
      </div>
    </React.Fragment>
  );
}
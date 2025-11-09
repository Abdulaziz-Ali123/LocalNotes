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

  const handleOpenFolder = async () => {
    const result = await window.fs.openFolderDialog();
    if (result.success && result.data) {
      // Store the folder path in localStorage
      localStorage.setItem("currentFolderPath", result.data);
      // Navigate to editor page
      router.push("/editor");
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
          const parentPath = result.data;
          const newFolderPath = `${parentPath}/${folderName}`;
          const createResult = await window.fs.createFolder(newFolderPath);
          if (createResult.success) {
            // Store the folder path in localStorage
            localStorage.setItem("currentFolderPath", newFolderPath);
            // Navigate to editor page
            router.push("/editor");
          } else {
            alert(`Failed to create folder: ${createResult.error}`);
          }
        }
      },
    });
  };

  return (
    <React.Fragment>
      <div className="flex flex-col justify-center items-center">
        {/* this is is the region that will allow dragging the window*/}
        <div className="w-full p-5 app-drag-region"> </div>
        <div className="h-screen flex justify-center items-center">
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
            <div className="grid grid-col-1 text-2xl w-4/5 ">
              <div className="flex flex-row justify-between items-center py-3">
                <span>
                  Create New Folder
                  <p className="text-sm pb-3">
                    Create a new folder to hold your notes
                  </p>
                </span>
                <button
                  onClick={handleCreateFolder}
                  className="bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all"
                >
                  Create Folder
                </button>
              </div>
              <hr className="border-foreground/20" />

              <div className="flex flex-row justify-between items-center py-3">
                <span>
                  Open an Existing Folder
                  <p className="text-sm pb-3">
                    Open an existing folder that hold your notes
                  </p>
                </span>
                <button
                  onClick={handleOpenFolder}
                  className="bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all"
                >
                  Open Folder
                </button>
              </div>

              <hr className="border-foreground/20" />
              <div className="flex flex-row justify-between items-center py-3">
                <span>
                  Configure Settings
                  <p className="text-sm pb-3">Edit settings like themes</p>
                </span>
                <button className="bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all">
                  {" "}
                  Configure{" "}
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
          onCancel={() =>
            setInputDialog((prev) => ({ ...prev, isOpen: false }))
          }
        />
      </div>
    </React.Fragment>
  );
}

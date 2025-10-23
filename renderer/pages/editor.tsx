import React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/renderer/components/ui/resizable";
import { FileTree } from "@/renderer/components/filetree";
import { Button } from "@/renderer/components/ui/button";
import { FolderPlusIcon } from "lucide-react";

export default function Editor() {
  return (
    <React.Fragment>
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-screen w-full bg-sidebar"
      >
        <ResizablePanel defaultSize={25}>
          <div className="flex h-full items-center justify-center p-6">
            <div className="w-full h-full">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="w-fit h-fit">
                  <FolderPlusIcon className="size-4" />
                </Button>
              </div>
              <FileTree />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent" />
        <ResizablePanel defaultSize={75} minSize={60}>
          <div className="flex h-[97%] items-center justify-center p-6 rounded-3xl bg-secondary">
            <span className="font-semibold">Text Editor</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </React.Fragment>
  );
}

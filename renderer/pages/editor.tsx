import React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/renderer/components/ui/resizable";
import { File, Folder, Tree } from "@/renderer/components/ui/file-tree";

const ELEMENTS = [
  {
    id: "1",
    isSelectable: true,
    name: "src",
    children: [
      {
        id: "2",
        isSelectable: true,
        name: "app",
        children: [
          {
            id: "3",
            isSelectable: true,
            name: "layout.tsx",
          },
          {
            id: "4",
            isSelectable: true,
            name: "page.tsx",
          },
        ],
      },
      {
        id: "5",
        isSelectable: true,
        name: "components",
        children: [
          {
            id: "6",
            isSelectable: true,
            name: "header.tsx",
          },
          {
            id: "7",
            isSelectable: true,
            name: "footer.tsx",
          },
        ],
      },
      {
        id: "8",
        isSelectable: true,
        name: "lib",
        children: [
          {
            id: "9",
            isSelectable: true,
            name: "utils.ts",
          },
        ],
      },
    ],
  },
];

export function FileTreeDemo() {
  return (
    <Tree
      className="bg-background overflow-hidden rounded-md p-2"
      initialSelectedId="7"
      initialExpandedItems={[
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "11",
      ]}
      elements={ELEMENTS}
    >
      <Folder element="src" value="1">
        <Folder value="2" element="app">
          <File value="3">
            <p>layout.tsx</p>
          </File>
          <File value="4">
            <p>page.tsx</p>
          </File>
        </Folder>
        <Folder value="5" element="components">
          <Folder value="6" element="ui">
            <File value="7">
              <p>button.tsx</p>
            </File>
          </Folder>
          <File value="8">
            <p>header.tsx</p>
          </File>
          <File value="9">
            <p>footer.tsx</p>
          </File>
        </Folder>
        <Folder value="10" element="lib">
          <File value="11">
            <p>utils.ts</p>
          </File>
        </Folder>
      </Folder>
    </Tree>
  );
}

export default function Editor() {
  return (
    <React.Fragment>
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-screen w-full bg-sidebar"
      >
        <ResizablePanel defaultSize={25}>
          <div className="flex h-full items-center justify-center p-6">
            <FileTreeDemo />
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

/**
 * Name of code artifact: renderer/components/filetree.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Shaun; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { Tree, Folder, File } from "./ui/file-tree";

export const ELEMENTS = [
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

/**
 * Functionality: FileTree performs the file tree workflow used by renderer/components/filetree.tsx.
 * Parameters: None.
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call FileTree from the owning module or component when this behavior is required.
 */
export function FileTree() {
  return (
    <Tree
      className="bg-background overflow-hidden rounded-md p-2"
      initialSelectedId="7"
      initialExpandedItems={["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]}
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

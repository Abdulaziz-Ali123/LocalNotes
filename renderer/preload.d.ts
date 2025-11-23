import { IpcHandler, FileSystemHandler } from "../main/preload";

declare global {
  interface Window {
    ipc: IpcHandler;
    fs: FileSystemHandler;
    tabs: {
      getAllTabIds: () => Promise<number[]>;
      getSelectedTabId: () => Promise<number>;
      select: (id: number) => Promise<void>;
      close: (id: number) => Promise<void>;
      new: () => Promise<number>;
      reorder: (ids: number[]) => Promise<void>;
      getContent: (id: number) => Promise<string>;
      setContent: (id: number, content: string) => Promise<void>;
      getFilePath: (id: number) => Promise<string | null>;
      setFilePath: (id: number, filePath: string | null) => Promise<void>;
    };
  }
}

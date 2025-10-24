import { IpcHandler, FileSystemHandler } from "../main/preload";

declare global {
  interface Window {
    ipc: IpcHandler;
    fs: FileSystemHandler;
  }
}

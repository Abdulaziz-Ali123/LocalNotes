export {};

declare global {
  interface Window {
    autosaveAPI: {
      save: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      load: (filePath: string) => Promise<string>;
    };
    tabs: {
      getAllTabIds: () => Promise<number[]>;
      getSelectedTabId: () => Promise<number>;
      select: (id: number) => void;
      close: (id: number) => void;
      new: () => Promise<number>;
      reorder: (ids: number[]) => void;
    };
  }
}
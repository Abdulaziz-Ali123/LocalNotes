export {};

declare global {
  interface Window {
    autosaveAPI: {
      save: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      load: (filePath: string) => Promise<string>;
    };
  }
}
export interface TabInfo {
    id: number;
    name: string;
    content: string;
    filePath: string | null;
    mode?: string | null;
    fileType?: 'text' | 'binary'; // Add this
    mimeType?: string; // Add this
}

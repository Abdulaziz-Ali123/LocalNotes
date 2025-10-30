import React, { useState, useEffect } from "react";
import { produce } from "immer";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { TabsSlice } from "@/renderer/types/tab-slice";
import EditorSpace from "@/renderer/pages/editorSpace"

const AUTOSAVE_INTERVAL = 5000;

export default function Editor() {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>("");
    const [saveMessage, setSaveMessage] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState<boolean>(true);
    const [livePreview, setLivePreview] = useState<boolean>(false);
    
    const initializeTabs = useBoundStore((state) => state.tabs.initialize);
    
    useEffect(() => {
        initializeTabs();
    }, [initializeTabs]);


    // Handle file selction from tree
    const handleFileSelect = async (filePath: string) => {
        const result = await window.fs.readFile(filePath);
        if (!result.success) {
            console.error("Failed to read file:", result.error);
            return;
        }

        const selectedTabId = useBoundStore.getState().tabs.selectedTabId;
        
        // Update tab state directly
        useBoundStore.setState(
            produce((state: TabsSlice) => {
                const tab = state.tabs.items.find((t: any) => t.id === selectedTabId);
                if (tab) {
                    tab.content = result.data;
                    tab.filePath = filePath;
                    tab.name = window.fs.basename(filePath);
                }
                return state;
            })
        );
        
        setSelectedFile(filePath);
        setFileContent(result.data);
    };

    // Load file content when selected file changes

    // Load content when selected tab changes
    const selectedTabId = useBoundStore((state) => state.tabs.selectedTabId);
    const selectedTab = useBoundStore((state) => 
        state.tabs.items.find(tab => tab.id === state.tabs.selectedTabId)
    );

    useEffect(() => {
        if (selectedTab) {
            setSelectedFile(selectedTab.filePath);
            setFileContent(selectedTab.content);
        }
    }, [selectedTabId, selectedTab]);


    // Hande save action
    const handleSave = async () => {
        const selectedTabId = useBoundStore.getState().tabs.selectedTabId;
        const tabState = useBoundStore.getState().tabs;
        const filePath = selectedTab?.filePath || null;
        
        if (!filePath) return;
        
        setIsSaving(true);
        const result = await window.fs.writeFile(filePath, fileContent);
        setIsSaving(false);

        if (result.success) {
            // Update tab content after successful save
            const fileName = window.fs.basename(filePath);
            setSaveMessage(`Saved "${fileName}"`);
            setTimeout(() => setSaveMessage(""), 2000);
        } else {
            setSaveMessage(`Failed to save: ${result.error}`);
            setTimeout(() => setSaveMessage(""), 3000);
        }
    };

    // Autosave periodically
    useEffect(() => {
        if (!selectedFile) return;

        const interval = setInterval(() => {
            window.autosaveAPI.save(selectedFile, fileContent);
        }, AUTOSAVE_INTERVAL);

        return () => clearInterval(interval);
    }, [selectedFile, fileContent]);

    return (
        <React.Fragment>
            <div className="flex flex-col justify-center">
                <div className="flex flex-row">
                    {/* Activity rail / fixed */}
                    <div className="flex flex-col items-center gap-10">
                        <div className=""></div>
                         <div className="flex flex-col items-center h-full gap-2 px-2 py-4 bg-sidebar border-r">
                            <button className="size-10 rounded-md hover:bg-accent p-2" title="Files">📁</button>
                            <button className="size-10 rounded-md hover:bg-accent p-2" title="Search">🔍</button>
                        </div>
                    </div>
                    {/* space where user can edit and preview files */}
                    <EditorSpace
                        handleFileSelect={ handleFileSelect }
                        selectedFile = { selectedFile }
                        handleSave = { handleSave}
                        isSaving = { isSaving } 
                        setPreviewMode = { setPreviewMode }
                        setLivePreview = { setLivePreview } 
                        previewMode = { previewMode } 
                        livePreview = { livePreview }
                        fileContent = { fileContent } 
                        setFileContent = { setFileContent}
                        saveMessage = { saveMessage }
                    >

                    </EditorSpace>
                </div>
            </div>

        </React.Fragment>
    );
}

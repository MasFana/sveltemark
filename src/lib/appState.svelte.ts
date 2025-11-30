import {
    type Folder,
    type File,
    getAllFolders,
    getAllFiles,
    getFileById,
    updateFileContent,
    updateFileTitle,
    updateFolderName,
    createFolder,
    createFile,
    deleteFile,
    deleteFolder,
    toggleFolderOpen,
    initializeDB,
    resetWelcomeFile
} from './db';

// Types for file tree structure
export interface FileTreeItem {
    type: 'folder' | 'file';
    id: number;
    name: string;
    parentId: number | null;
    isOpen?: boolean;
    children?: FileTreeItem[];
}

// Global reactive state using Svelte 5 runes
let activeFileId = $state<number | null>(null);
let buffer = $state<string>('');
let dirty = $state<boolean>(false);
let isSaving = $state<boolean>(false);
let folders = $state<Folder[]>([]);
let files = $state<File[]>([]);
let isInitialized = $state<boolean>(false);
let viewOnlyMode = $state<boolean>(false);
let autoHideUI = $state<boolean>(typeof localStorage !== 'undefined' ? localStorage.getItem('autoHideUI') === 'true' : false);

// Debounce timer
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 1000;

// Derived state for file tree
const fileTree = $derived(buildFileTree(folders, files));

// Derived state for active file
const activeFile = $derived(
    activeFileId === null ? undefined : files.find((f) => f.id === activeFileId)
);

// Build hierarchical file tree from flat arrays
function buildFileTree(folders: Folder[], files: File[]): FileTreeItem[] {
    const folderMap: Record<string, FileTreeItem[]> = {};

    // Initialize root level
    folderMap['null'] = [];

    // Add all folders to map
    for (const folder of folders) {
        const key = String(folder.parentId);
        if (!(key in folderMap)) {
            folderMap[key] = [];
        }

        const folderItem: FileTreeItem = {
            type: 'folder',
            id: folder.id!,
            name: folder.name,
            parentId: folder.parentId,
            isOpen: folder.isOpen,
            children: []
        };

        folderMap[key].push(folderItem);
    }

    // Add files to their respective folders
    for (const file of files) {
        const fileItem: FileTreeItem = {
            type: 'file',
            id: file.id!,
            name: file.title,
            parentId: file.folderId
        };

        // Find the folder and add file to it
        for (const items of Object.values(folderMap)) {
            const folder = items.find((item: FileTreeItem) => item.type === 'folder' && item.id === file.folderId);
            if (folder && folder.children) {
                folder.children.push(fileItem);
                break;
            }
        }
    }

    // Build tree recursively
    function attachChildren(items: FileTreeItem[]): FileTreeItem[] {
        for (const item of items) {
            if (item.type === 'folder') {
                const childFolders = folderMap[String(item.id)] || [];
                item.children = [...(item.children || []), ...attachChildren(childFolders)];
                // Sort: folders first, then files, alphabetically
                item.children.sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });
            }
        }
        return items;
    }

    const rootItems = folderMap['null'] || [];
    return attachChildren(rootItems).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

// Actions
async function initialize(): Promise<void> {
    if (isInitialized) return;

    await initializeDB();
    await refreshData();
    isInitialized = true;

    // Auto-select first file if available
    if (files.length > 0 && activeFileId === null) {
        await selectFile(files[0].id!);
    }
}

async function refreshData(): Promise<void> {
    folders = await getAllFolders();
    files = await getAllFiles();
}

async function selectFile(id: number): Promise<void> {
    // Save current file before switching
    if (dirty && activeFileId !== null) {
        await saveNow();
    }

    const file = await getFileById(id);
    if (file) {
        activeFileId = id;
        buffer = file.content;
        dirty = false;
    }
}

function updateBuffer(content: string): void {
    buffer = content;
    dirty = true;
    isSaving = true;

    // Clear existing timer
    if (saveTimer) {
        clearTimeout(saveTimer);
    }

    // Set new debounced save
    saveTimer = setTimeout(async () => {
        await saveNow();
    }, DEBOUNCE_MS);
}

async function saveNow(): Promise<void> {
    if (activeFileId === null || !dirty) {
        isSaving = false;
        return;
    }

    try {
        await updateFileContent(activeFileId, buffer);
        dirty = false;
        isSaving = false;

        // Update local files array
        const index = files.findIndex((f) => f.id === activeFileId);
        if (index !== -1) {
            files[index] = { ...files[index], content: buffer, updatedAt: new Date() };
        }
    } catch (error) {
        console.error('Failed to save:', error);
        isSaving = false;
    }
}

async function newFolder(name: string, parentId: number | null = null): Promise<number> {
    const id = await createFolder(name, parentId);
    await refreshData();
    return id;
}

async function newFile(folderId: number, title: string): Promise<number> {
    const id = await createFile(folderId, title, '');
    await refreshData();
    await selectFile(id);
    return id;
}

async function removeFile(id: number): Promise<void> {
    await deleteFile(id);
    if (activeFileId === id) {
        activeFileId = null;
        buffer = '';
        dirty = false;
    }
    await refreshData();
}

async function removeFolder(id: number): Promise<void> {
    // Check if active file is in this folder
    const activeInFolder = files.some((f) => f.folderId === id && f.id === activeFileId);
    await deleteFolder(id);
    if (activeInFolder) {
        activeFileId = null;
        buffer = '';
        dirty = false;
    }
    await refreshData();
}

async function toggleFolder(id: number): Promise<void> {
    await toggleFolderOpen(id);
    await refreshData();
}

async function renameFile(id: number, newTitle: string): Promise<void> {
    await updateFileTitle(id, newTitle);
    await refreshData();
}

async function renameFolder(id: number, newName: string): Promise<void> {
    await updateFolderName(id, newName);
    await refreshData();
}

function toggleViewOnlyMode(): void {
    viewOnlyMode = !viewOnlyMode;
}

function setViewOnlyMode(value: boolean): void {
    viewOnlyMode = value;
}

function toggleAutoHideUI(): void {
    autoHideUI = !autoHideUI;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('autoHideUI', String(autoHideUI));
    }
}

function setAutoHideUI(value: boolean): void {
    autoHideUI = value;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('autoHideUI', String(autoHideUI));
    }
}

// Reset Welcome.md to original content
async function showHelp(): Promise<void> {
    const fileId = await resetWelcomeFile();
    await refreshData();
    await selectFile(fileId);
}

// Export/Import backup functions
async function exportBackup(): Promise<string> {
    const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        folders: folders,
        files: files
    };
    return JSON.stringify(backup, null, 2);
}

async function importBackup(jsonString: string): Promise<void> {
    const backup = JSON.parse(jsonString);

    if (!backup.folders || !backup.files) {
        throw new Error('Invalid backup format');
    }

    // Clear existing data
    for (const file of files) {
        if (file.id) await deleteFile(file.id);
    }
    for (const folder of folders) {
        if (folder.id) await deleteFolder(folder.id);
    }

    // Import folders first (maintaining hierarchy)
    const folderIdMap: Record<number, number> = {};
    for (const folder of backup.folders) {
        const oldId = folder.id;
        const newId = await createFolder(folder.name, folder.parentId ? folderIdMap[folder.parentId] || null : null);
        folderIdMap[oldId] = newId;
    }

    // Import files
    for (const file of backup.files) {
        const newFolderId = folderIdMap[file.folderId];
        if (newFolderId) {
            await createFile(newFolderId, file.title, file.content);
        }
    }

    // Refresh and reset state
    await refreshData();
    activeFileId = null;
    buffer = '';
    dirty = false;
}

// Print current file
function printCurrentFile(): void {
    if (!activeFile) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${activeFile.title}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown-dark.min.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
            <style>
                body { 
                    padding: 40px; 
                    max-width: 900px; 
                    margin: 0 auto;
                    background: #0d1117;
                }
                .markdown-body {
                    background: #0d1117;
                }
                @media print {
                    body { 
                        background: white; 
                        color: black;
                    }
                    .markdown-body {
                        background: white;
                        color: black;
                    }
                }
            </style>
        </head>
        <body class="markdown-body">
            <div id="content">Loading...</div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
            <script>
                // Content will be injected
            </script>
        </body>
        </html>
    `);

    // We'll set content via the Preview's rendered HTML
    printWindow.document.close();
    printWindow.print();
}

// Export the store as a singleton object
export const appState = {
    // Getters (reactive)
    get activeFileId() {
        return activeFileId;
    },
    get buffer() {
        return buffer;
    },
    get dirty() {
        return dirty;
    },
    get isSaving() {
        return isSaving;
    },
    get folders() {
        return folders;
    },
    get files() {
        return files;
    },
    get fileTree() {
        return fileTree;
    },
    get activeFile() {
        return activeFile;
    },
    get isInitialized() {
        return isInitialized;
    },
    get viewOnlyMode() {
        return viewOnlyMode;
    },
    get autoHideUI() {
        return autoHideUI;
    },

    // Actions
    initialize,
    refreshData,
    selectFile,
    updateBuffer,
    saveNow,
    newFolder,
    newFile,
    removeFile,
    removeFolder,
    toggleFolder,
    renameFile,
    renameFolder,
    toggleViewOnlyMode,
    setViewOnlyMode,
    toggleAutoHideUI,
    setAutoHideUI,
    exportBackup,
    importBackup,
    printCurrentFile,
    showHelp
};

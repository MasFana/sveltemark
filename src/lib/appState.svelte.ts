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
    moveFile,
    moveFolder,
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
let viewOnlyMode = $state<boolean>(typeof localStorage !== 'undefined' ? localStorage.getItem('viewOnlyMode') === 'true' : false);
let autoHideUI = $state<boolean>(typeof localStorage !== 'undefined' ? localStorage.getItem('autoHideUI') === 'true' : false);
let wordWrap = $state<boolean>(typeof localStorage !== 'undefined' ? localStorage.getItem('wordWrap') !== 'false' : true);
let syncScrollEnabled = $state<boolean>(typeof localStorage !== 'undefined' ? localStorage.getItem('syncScrollEnabled') !== 'false' : true);

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

        // Root-level file (no folder)
        if (file.folderId === null) {
            folderMap['null'].push(fileItem);
            continue;
        }

        // Find the folder and add file to it
        let foundFolder = false;
        for (const items of Object.values(folderMap)) {
            const folder = items.find((item: FileTreeItem) => item.type === 'folder' && item.id === file.folderId);
            if (folder && folder.children) {
                folder.children.push(fileItem);
                foundFolder = true;
                break;
            }
        }

        // If folder not found (orphaned file), add to root
        if (!foundFolder) {
            folderMap['null'].push(fileItem);
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

    // Try to restore last opened file from localStorage
    const lastFileId = typeof localStorage !== 'undefined'
        ? localStorage.getItem('lastOpenedFileId')
        : null;

    if (lastFileId) {
        const fileId = parseInt(lastFileId, 10);
        const fileExists = files.some(f => f.id === fileId);
        if (fileExists) {
            await selectFile(fileId);
            return;
        }
    }

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

        // Persist last opened file to localStorage
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lastOpenedFileId', String(id));
        }
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

async function newFolder(name: string, parentId: number | null = null, autoRename: boolean = true): Promise<number> {
    try {
        const id = await createFolder(name, parentId, autoRename);
        await refreshData();
        return id;
    } catch (error) {
        console.error('Failed to create folder:', error);
        throw error;
    }
}

async function newFile(folderId: number | null, title: string, autoRename: boolean = true): Promise<number> {
    try {
        const id = await createFile(folderId, title, '', autoRename);
        await refreshData();
        await selectFile(id);
        return id;
    } catch (error) {
        console.error('Failed to create file:', error);
        throw error;
    }
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
    try {
        await updateFileTitle(id, newTitle);
        await refreshData();
    } catch (error) {
        console.error('Failed to rename file:', error);
        throw error;
    }
}

async function renameFolder(id: number, newName: string): Promise<void> {
    try {
        await updateFolderName(id, newName);
        await refreshData();
    } catch (error) {
        console.error('Failed to rename folder:', error);
        throw error;
    }
}

async function moveFileToFolder(fileId: number, newFolderId: number | null): Promise<void> {
    await moveFile(fileId, newFolderId);
    await refreshData();
}

async function moveFolderToParent(folderId: number, newParentId: number | null): Promise<void> {
    try {
        await moveFolder(folderId, newParentId);
        await refreshData();
    } catch (error) {
        console.error('Failed to move folder:', error);
        throw error;
    }
}

function toggleViewOnlyMode(): void {
    viewOnlyMode = !viewOnlyMode;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('viewOnlyMode', String(viewOnlyMode));
    }
}

function setViewOnlyMode(value: boolean): void {
    viewOnlyMode = value;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('viewOnlyMode', String(viewOnlyMode));
    }
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

function toggleWordWrap(): void {
    wordWrap = !wordWrap;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('wordWrap', String(wordWrap));
    }
}

function setWordWrap(value: boolean): void {
    wordWrap = value;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('wordWrap', String(wordWrap));
    }
}

function toggleSyncScroll(): void {
    syncScrollEnabled = !syncScrollEnabled;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('syncScrollEnabled', String(syncScrollEnabled));
    }
}

function setSyncScroll(value: boolean): void {
    syncScrollEnabled = value;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('syncScrollEnabled', String(syncScrollEnabled));
    }
}

// Reset Welcome to original content
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
    // Sort folders to ensure parents are created before children
    const sortedFolders = [...backup.folders].sort((a, b) => {
        // Root folders (parentId === null) come first
        if (a.parentId === null && b.parentId !== null) return -1;
        if (a.parentId !== null && b.parentId === null) return 1;
        return 0;
    });

    const folderIdMap: Record<number, number> = {};
    for (const folder of sortedFolders) {
        const oldId = folder.id;
        const newParentId = folder.parentId !== null ? folderIdMap[folder.parentId] ?? null : null;
        const newId = await createFolder(folder.name, newParentId);
        folderIdMap[oldId] = newId;

        // Preserve folder open/closed state
        if (folder.isOpen === false) {
            await toggleFolderOpen(newId);
        }
    }

    // Import files (including root-level files where folderId is null)
    for (const file of backup.files) {
        const newFolderId = file.folderId !== null ? folderIdMap[file.folderId] ?? null : null;
        await createFile(newFolderId, file.title, file.content);
    }

    // Refresh and reset state
    await refreshData();
    activeFileId = null;
    buffer = '';
    dirty = false;

    // Select first file if available
    if (files.length > 0) {
        await selectFile(files[0].id!);
    }
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
    get activeFileFolderId() {
        return activeFile?.folderId ?? null;
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
    get wordWrap() {
        return wordWrap;
    },
    get syncScrollEnabled() {
        return syncScrollEnabled;
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
    moveFileToFolder,
    moveFolderToParent,
    toggleViewOnlyMode,
    setViewOnlyMode,
    toggleAutoHideUI,
    setAutoHideUI,
    toggleWordWrap,
    setWordWrap,
    toggleSyncScroll,
    setSyncScroll,
    exportBackup,
    importBackup,
    printCurrentFile,
    showHelp
};

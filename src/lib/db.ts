import Dexie, { type EntityTable } from 'dexie';

// TypeScript interfaces for our tables
export interface Folder {
    id?: number;
    name: string;
    parentId: number | null;
    isOpen: boolean;
}

export interface File {
    id?: number;
    folderId: number | null;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

// Define the database
const db = new Dexie('SvelteMarkDB') as Dexie & {
    folders: EntityTable<Folder, 'id'>;
    files: EntityTable<File, 'id'>;
};

// Schema definition
db.version(1).stores({
    folders: '++id, name, parentId, isOpen',
    files: '++id, folderId, title, createdAt, updatedAt'
});

export { db };

// Helper functions for database operations

// Check if a folder name already exists in the same parent
export async function folderNameExists(
    name: string,
    parentId: number | null,
    excludeId?: number
): Promise<boolean> {
    // Dexie doesn't support null as a key, so we need to filter manually
    let folders: Folder[];
    if (parentId === null) {
        folders = await db.folders.filter(f => f.parentId === null).toArray();
    } else {
        folders = await db.folders.where('parentId').equals(parentId).toArray();
    }

    return folders.some(folder =>
        folder.name === name && folder.id !== excludeId
    );
}

// Generate unique folder name with number suffix if needed
export async function generateUniqueFolderName(
    baseName: string,
    parentId: number | null,
    excludeId?: number
): Promise<string> {
    const exists = await folderNameExists(baseName, parentId, excludeId);
    if (!exists) return baseName;

    let counter = 1;
    let newName = `${baseName} ${counter}`;
    while (await folderNameExists(newName, parentId, excludeId)) {
        counter++;
        newName = `${baseName} ${counter}`;
    }
    return newName;
}

// Check if a file name already exists in the same folder
export async function fileNameExists(
    title: string,
    folderId: number | null,
    excludeId?: number
): Promise<boolean> {
    // Dexie doesn't support null as a key, so we need to filter manually
    let files: File[];
    if (folderId === null) {
        files = await db.files.filter(f => f.folderId === null).toArray();
    } else {
        files = await db.files.where('folderId').equals(folderId).toArray();
    }

    return files.some(file =>
        file.title === title && file.id !== excludeId
    );
}

// Generate unique file name with number suffix if needed
export async function generateUniqueFileName(
    baseName: string,
    folderId: number | null,
    excludeId?: number
): Promise<string> {
    const exists = await fileNameExists(baseName, folderId, excludeId);
    if (!exists) return baseName;

    // Handle file extension
    const lastDot = baseName.lastIndexOf('.');
    const hasExtension = lastDot > 0;
    const nameWithoutExt = hasExtension ? baseName.substring(0, lastDot) : baseName;
    const extension = hasExtension ? baseName.substring(lastDot) : '';

    let counter = 1;
    let newName = `${nameWithoutExt} ${counter}${extension}`;
    while (await fileNameExists(newName, folderId, excludeId)) {
        counter++;
        newName = `${nameWithoutExt} ${counter}${extension}`;
    }
    return newName;
}

export async function createFolder(
    name: string,
    parentId: number | null = null,
    autoRename: boolean = false
): Promise<number> {
    let finalName = name;

    // Auto-generate unique name if requested
    if (autoRename) {
        finalName = await generateUniqueFolderName(name, parentId);
    } else {
        // Check for duplicate name
        const exists = await folderNameExists(name, parentId);
        if (exists) {
            throw new Error(`A folder named "${name}" already exists in this location.`);
        }
    }

    const id = await db.folders.add({
        name: finalName,
        parentId,
        isOpen: true
    });
    return id as number;
}

export async function createFile(
    folderId: number | null,
    title: string,
    content: string = '',
    autoRename: boolean = false
): Promise<number> {
    let finalTitle = title;

    // Auto-generate unique name if requested
    if (autoRename) {
        finalTitle = await generateUniqueFileName(title, folderId);
    } else {
        // Check for duplicate name
        const exists = await fileNameExists(title, folderId);
        if (exists) {
            throw new Error(`A file named "${title}" already exists in this location.`);
        }
    }

    const now = new Date();
    const id = await db.files.add({
        folderId,
        title: finalTitle,
        content,
        createdAt: now,
        updatedAt: now
    });
    return id as number;
}

export async function updateFileContent(id: number, content: string): Promise<void> {
    await db.files.update(id, {
        content,
        updatedAt: new Date()
    });
}

export async function updateFileTitle(id: number, title: string): Promise<void> {
    // Get the file to check its folder
    const file = await db.files.get(id);
    if (!file) {
        throw new Error('File not found');
    }

    // Check for duplicate name (excluding current file)
    const exists = await fileNameExists(title, file.folderId, id);
    if (exists) {
        throw new Error(`A file named "${title}" already exists in this location.`);
    }

    await db.files.update(id, {
        title,
        updatedAt: new Date()
    });
}

export async function updateFolderName(id: number, name: string): Promise<void> {
    // Get the folder to check its parent
    const folder = await db.folders.get(id);
    if (!folder) {
        throw new Error('Folder not found');
    }

    // Check for duplicate name (excluding current folder)
    const exists = await folderNameExists(name, folder.parentId, id);
    if (exists) {
        throw new Error(`A folder named "${name}" already exists in this location.`);
    }

    await db.folders.update(id, { name });
}

export async function deleteFile(id: number): Promise<void> {
    await db.files.delete(id);
}

export async function deleteFolder(id: number): Promise<void> {
    // Delete all files in the folder
    await db.files.where('folderId').equals(id).delete();
    // Delete all subfolders recursively
    const subfolders = await db.folders.where('parentId').equals(id).toArray();
    for (const subfolder of subfolders) {
        if (subfolder.id) {
            await deleteFolder(subfolder.id);
        }
    }
    // Delete the folder itself
    await db.folders.delete(id);
}

export async function toggleFolderOpen(id: number): Promise<void> {
    const folder = await db.folders.get(id);
    if (folder) {
        await db.folders.update(id, { isOpen: !folder.isOpen });
    }
}

export async function moveFile(fileId: number, newFolderId: number | null): Promise<void> {
    const file = await db.files.get(fileId);
    if (!file) {
        throw new Error('File not found');
    }

    // Check for duplicate name in destination and rename if needed
    const uniqueName = await generateUniqueFileName(file.title, newFolderId, fileId);

    await db.files.update(fileId, {
        folderId: newFolderId,
        title: uniqueName
    });
}

export async function moveFolder(folderId: number, newParentId: number | null): Promise<void> {
    // Prevent moving a folder into itself or its descendants
    if (newParentId !== null) {
        let currentId: number | null = newParentId;
        while (currentId !== null) {
            if (currentId === folderId) {
                throw new Error('Cannot move a folder into itself or its descendants');
            }
            const parentFolder: Folder | undefined = await db.folders.get(currentId);
            currentId = parentFolder?.parentId ?? null;
        }
    }

    const folder = await db.folders.get(folderId);
    if (!folder) {
        throw new Error('Folder not found');
    }

    // Check for duplicate name in destination and rename if needed
    const uniqueName = await generateUniqueFolderName(folder.name, newParentId, folderId);

    await db.folders.update(folderId, {
        parentId: newParentId,
        name: uniqueName
    });
}

export async function getAllFolders(): Promise<Folder[]> {
    return await db.folders.toArray();
}

export async function getFilesInFolder(folderId: number): Promise<File[]> {
    return await db.files.where('folderId').equals(folderId).toArray();
}

export async function getFileById(id: number): Promise<File | undefined> {
    return await db.files.get(id);
}

export async function getAllFiles(): Promise<File[]> {
    return await db.files.toArray();
}

// Welcome content template
export const WELCOME_CONTENT = `# Welcome to SvelteMark! 📝
    
![alt](/logo.webp)

**Your local-first, privacy-focused markdown editor** built with Svelte 5.

> 🔒 **100% Private** • 📴 **Works Offline** • 🚀 **Lightning Fast**

---

## ⚡ Key Features

| Feature | Description |
|---------|-------------|
| 🔒 **Privacy First** | All data stored locally in IndexedDB, never leaves your device |
| 📴 **Offline Ready** | Full PWA support - install as an app, works without internet |
| ✏️ **Live Preview** | Real-time markdown rendering with GitHub styling |
| 📐 **Math & Diagrams** | LaTeX equations (KaTeX) and Mermaid diagrams |
| 🗂️ **File Management** | Organize with folders, drag & drop support |
| 🎨 **GitHub Theme** | Beautiful dark interface matching GitHub's design |

---

## ⌨️ Keyboard Shortcuts

### Text Formatting

| Shortcut | Action |
|----------|--------|
| \`Ctrl+B\` | **Bold** |
| \`Ctrl+I\` | *Italic* |
| \`Ctrl+\`\` | \`Code\` |
| \`Ctrl+~\` | ~~Strikethrough~~ |

### Editor Control

| Shortcut | Action |
|----------|--------|
| \`Ctrl+H\` | Show Help Panel |
| \`Ctrl+F\` | Find & Replace |
| \`Ctrl+P\` | Print Document |
| \`Ctrl+S\` | Save Now |
| \`Ctrl+/\` | Toggle Comment |

### Selection

| Shortcut | Action |
|----------|--------|
| \`Ctrl+D\` | Select Next |
| \`Ctrl+Shift+L\` | Select All Occurrences |

---

## 🚀 Quick Examples

### Code Block

\`\`\`javascript
console.log("Hello, SvelteMark!");
\`\`\`

### Math

Inline: $E = mc^2$ | Block: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$

### Diagram

\`\`\`mermaid
graph LR
    A[Write] --> B[Preview] --> C[Save]
\`\`\`

### Task List

- [x] Local storage
- [x] Offline support
- [ ] More features

---

## 💡 Tips

- 🖱️ **Right-click** for context menu formatting options
- 📂 **Drag & drop** to reorganize files and folders
- 💾 **Export** your notes as JSON backup anytime
- 📴 **Install** as an app for offline access

---

**Open Source** on [GitHub](https://github.com/MasFana/sveltemarkdown) • MIT License

Happy writing! 🚀
`;

// Initialize with default data if empty
export async function initializeDB(): Promise<void> {
    const folderCount = await db.folders.count();
    if (folderCount === 0) {
        // Create a default folder
        const folderId = await createFolder('Notes');
        // Create a welcome file
        await createFile(folderId, 'Welcome', WELCOME_CONTENT);
    }
}

// Reset or create Welcome file
export async function resetWelcomeFile(): Promise<number> {
    // Check if Notes folder exists
    let notesFolder = await db.folders.where('name').equals('Notes').first();

    if (!notesFolder) {
        // Create Notes folder if it doesn't exist
        const folderId = await createFolder('Notes');
        notesFolder = await db.folders.get(folderId);
    }

    if (!notesFolder?.id) {
        throw new Error('Could not find or create Notes folder');
    }

    // Check if Welcome already exists
    const existingWelcome = await db.files
        .where('folderId').equals(notesFolder.id)
        .and(f => f.title === 'Welcome')
        .first();

    if (existingWelcome?.id) {
        // Update existing file
        await updateFileContent(existingWelcome.id, WELCOME_CONTENT);
        return existingWelcome.id;
    } else {
        // Create new Welcome
        return await createFile(notesFolder.id, 'Welcome', WELCOME_CONTENT);
    }
}

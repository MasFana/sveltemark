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
    folderId: number;
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
export async function createFolder(
    name: string,
    parentId: number | null = null
): Promise<number> {
    const id = await db.folders.add({
        name,
        parentId,
        isOpen: true
    });
    return id as number;
}

export async function createFile(
    folderId: number,
    title: string,
    content: string = ''
): Promise<number> {
    const now = new Date();
    const id = await db.files.add({
        folderId,
        title,
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
    await db.files.update(id, {
        title,
        updatedAt: new Date()
    });
}

export async function updateFolderName(id: number, name: string): Promise<void> {
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
export const WELCOME_CONTENT = `# Welcome to SvelteMark Studio! 📝

This is your **local-first** markdown editor with powerful features.

## ✨ Features

- 📂 **File Explorer** - Organize your notes in folders
- ✍️ **Live Preview** - See your markdown rendered in real-time
- 🔄 **Auto-save** - Your work is automatically saved
- 📊 **Mermaid Diagrams** - Create flowcharts and diagrams
- 🧮 **Math Support** - Write equations with KaTeX
- 🖨️ **Print** - Print your documents (Ctrl+P)
- 💾 **Export/Import** - Backup and restore your notes
- 👁️ **View-Only Mode** - Focus on reading
- 🔲 **Auto-Hide UI** - Distraction-free writing

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save now |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+P | Print |

## 📝 Markdown Examples

### Code Blocks

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
\`\`\`

### Math Equations

Inline math: $E = mc^2$

Block math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

### Mermaid Diagram

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
\`\`\`

### Task Lists

- [x] Create markdown editor
- [x] Add live preview
- [x] Support syntax highlighting
- [ ] Add more features

### Blockquotes

> "The best way to predict the future is to create it."
> — Abraham Lincoln

---

**Tip:** Right-click on files/folders to rename or delete them!

Happy writing! 🚀
`;

// Initialize with default data if empty
export async function initializeDB(): Promise<void> {
    const folderCount = await db.folders.count();
    if (folderCount === 0) {
        // Create a default folder
        const folderId = await createFolder('Notes');
        // Create a welcome file
        await createFile(folderId, 'Welcome.md', WELCOME_CONTENT);
    }
}

// Reset or create Welcome.md file
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

    // Check if Welcome.md already exists
    const existingWelcome = await db.files
        .where('folderId').equals(notesFolder.id)
        .and(f => f.title === 'Welcome.md')
        .first();

    if (existingWelcome?.id) {
        // Update existing file
        await updateFileContent(existingWelcome.id, WELCOME_CONTENT);
        return existingWelcome.id;
    } else {
        // Create new Welcome.md
        return await createFile(notesFolder.id, 'Welcome.md', WELCOME_CONTENT);
    }
}

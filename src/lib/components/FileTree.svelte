<script lang="ts">
	import { tick } from 'svelte';
	import type { FileTreeItem } from '$lib/appState.svelte';
	import { appState } from '$lib/appState.svelte';
	import FileTree from './FileTree.svelte';

	interface Props {
		items: FileTreeItem[];
		depth?: number;
		onDragStart?: (item: FileTreeItem, event: DragEvent) => void;
		onDragEnd?: () => void;
		dragOverItem?: FileTreeItem | null;
		setDragOverItem?: (item: FileTreeItem | null) => void;
		parentFolderId?: number | null;
		sharedState?: {
			creatingType: 'file' | 'folder' | null;
			creatingInFolder: number | null;
			createValue: string;
			createInputRef: HTMLInputElement | null;
			renamingItem: FileTreeItem | null;
			renameValue: string;
		};
		setSharedState?: (updates: Partial<Props['sharedState']>) => void;
	}

	let { 
		items, 
		depth = 0,
		onDragStart: parentDragStart,
		onDragEnd: parentDragEnd,
		dragOverItem: parentDragOverItem,
		setDragOverItem: parentSetDragOverItem,
		parentFolderId = null,
		sharedState,
		setSharedState
	}: Props = $props();

	// Context menu state
	let contextMenu = $state<{ x: number; y: number; item: FileTreeItem | null } | null>(null);
	
	// Creation and rename state (shared across tree)
	// At root level, create local state, otherwise use shared state
	const isRoot = depth === 0;
	
	// Local state for root level
	let localCreatingType = $state<'file' | 'folder' | null>(null);
	let localCreatingInFolder = $state<number | null>(null);
	let localCreateValue = $state<string>('');
	let localCreateInputRef = $state<HTMLInputElement | null>(null);
	let localRenamingItem = $state<FileTreeItem | null>(null);
	let localRenameValue = $state<string>('');

	// Getters for state values
	const creatingType = $derived(isRoot ? localCreatingType : sharedState?.creatingType ?? null);
	const creatingInFolder = $derived(isRoot ? localCreatingInFolder : sharedState?.creatingInFolder ?? null);
	const createValue = $derived(isRoot ? localCreateValue : sharedState?.createValue ?? '');
	const createInputRef = $derived(isRoot ? localCreateInputRef : sharedState?.createInputRef ?? null);
	const renamingItem = $derived(isRoot ? localRenamingItem : sharedState?.renamingItem ?? null);
	const renameValue = $derived(isRoot ? localRenameValue : sharedState?.renameValue ?? '');

	// Setters for state values
	function setCreatingType(value: 'file' | 'folder' | null) {
		if (isRoot) localCreatingType = value;
		else setSharedState?.({ creatingType: value });
	}
	function setCreatingInFolder(value: number | null) {
		if (isRoot) localCreatingInFolder = value;
		else setSharedState?.({ creatingInFolder: value });
	}
	function setCreateValue(value: string) {
		if (isRoot) localCreateValue = value;
		else setSharedState?.({ createValue: value });
	}
	function setCreateInputRef(value: HTMLInputElement | null) {
		if (isRoot) localCreateInputRef = value;
		else setSharedState?.({ createInputRef: value });
	}
	function setRenamingItem(value: FileTreeItem | null) {
		if (isRoot) localRenamingItem = value;
		else setSharedState?.({ renamingItem: value });
	}
	function setRenameValue(value: string) {
		if (isRoot) localRenameValue = value;
		else setSharedState?.({ renameValue: value });
	}
	
	// Create shared state object to pass to children
	const childSharedState = $derived({
		creatingType: localCreatingType,
		creatingInFolder: localCreatingInFolder,
		createValue: localCreateValue,
		createInputRef: localCreateInputRef,
		renamingItem: localRenamingItem,
		renameValue: localRenameValue
	});
	
	function handleSetSharedState(updates: Partial<Props['sharedState']>) {
		if (!updates) return;
		if (updates.creatingType !== undefined) localCreatingType = updates.creatingType;
		if (updates.creatingInFolder !== undefined) localCreatingInFolder = updates.creatingInFolder;
		if (updates.createValue !== undefined) localCreateValue = updates.createValue;
		if (updates.createInputRef !== undefined) localCreateInputRef = updates.createInputRef;
		if (updates.renamingItem !== undefined) localRenamingItem = updates.renamingItem;
		if (updates.renameValue !== undefined) localRenameValue = updates.renameValue;
	}
	
	// Svelte action to focus input and store ref
	function focusInput(node: HTMLInputElement) {
		setCreateInputRef(node);
		node.focus();
		node.select();
		return {
			destroy() {
				setCreateInputRef(null);
			}
		};
	}
	
	// Svelte action to focus rename input
	function focusRenameInput(node: HTMLInputElement) {
		node.focus();
		// Select filename without extension for files
		const value = node.value;
		const lastDot = value.lastIndexOf('.');
		if (lastDot > 0) {
			node.setSelectionRange(0, lastDot);
		} else {
			node.select();
		}
		return {};
	}

	// Expose method for external components (like Sidebar buttons) to trigger creation
	// Creates in the same folder as the currently active file (VS Code style - instant create + rename)
	export async function startCreatingFromExternal(type: 'file' | 'folder', folderId: number | null = null) {
		if (isRoot) {
			// If no folderId provided, use the active file's folder
			const targetFolderId = folderId ?? appState.activeFileFolderId;
			await createAndRename(type, targetFolderId);
		}
	}
	
	// VS Code style: Create immediately with default name, then enter rename mode
	async function createAndRename(type: 'file' | 'folder', folderId: number | null = null) {
		closeContextMenu();
		
		// If creating in a folder, make sure it's open
		if (folderId !== null) {
			// Find folder in the tree recursively
			const findFolder = (items: FileTreeItem[]): FileTreeItem | undefined => {
				for (const item of items) {
					if (item.type === 'folder' && item.id === folderId) return item;
					if (item.children) {
						const found = findFolder(item.children);
						if (found) return found;
					}
				}
				return undefined;
			};
			const folder = findFolder(appState.fileTree);
			if (folder && !folder.isOpen) {
				await appState.toggleFolder(folderId);
			}
		}
		
		try {
			let newItemId: number;
			let newItemName: string;
			
			if (type === 'file') {
				// Create file with default name without .md (autoRename handles duplicates)
				newItemId = await appState.newFile(folderId, 'New File');
				// Get the actual name (might be "New File 1" etc)
				const newFile = appState.files.find(f => f.id === newItemId);
				newItemName = newFile?.title ?? 'New File';
			} else {
				// Create folder with default name (autoRename handles duplicates)
				newItemId = await appState.newFolder('New Folder', folderId);
				// Get the actual name (might be "New Folder 1" etc)
				const newFolder = appState.folders.find(f => f.id === newItemId);
				newItemName = newFolder?.name ?? 'New Folder';
			}
			
			// Wait for DOM to update after state changes
			await tick();
			
			// Enter rename mode for the newly created item
			// Use direct local state setter at root level for reliability
			if (isRoot) {
				localRenamingItem = {
					type,
					id: newItemId,
					name: newItemName,
					parentId: folderId
				};
				localRenameValue = newItemName;
			} else {
				// For non-root, use the shared state setter
				setSharedState?.({
					renamingItem: {
						type,
						id: newItemId,
						name: newItemName,
						parentId: folderId
					},
					renameValue: newItemName
				});
			}
		} catch (error) {
			console.error('Failed to create:', error);
			if (error instanceof Error) {
				alert(error.message);
			}
		}
	}

	// Drag and drop state (only manage at root level)
	let draggingItem = $state<FileTreeItem | null>(null);
	let localDragOverItem = $state<FileTreeItem | null>(null);

	// Use parent's drag state if provided, otherwise use local state
	const dragOverItem = $derived(isRoot ? localDragOverItem : parentDragOverItem);

	function setDragOverItem(item: FileTreeItem | null) {
		if (isRoot) {
			localDragOverItem = item;
		} else if (parentSetDragOverItem) {
			parentSetDragOverItem(item);
		}
	}

	function handleFileClick(item: FileTreeItem) {
		if (renamingItem?.id === item.id && renamingItem?.type === item.type) return; // Don't select while renaming
		if (item.type === 'file') {
			appState.selectFile(item.id);
		} else {
			appState.toggleFolder(item.id);
		}
	}

	function handleKeydown(event: KeyboardEvent, item: FileTreeItem) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleFileClick(item);
		}
	}

	function handleContextMenu(event: MouseEvent, item: FileTreeItem | null = null) {
		event.preventDefault();
		event.stopPropagation();
		contextMenu = { x: event.clientX, y: event.clientY, item };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function handleRename(item: FileTreeItem) {
		setRenamingItem(item);
		setRenameValue(item.name);
		closeContextMenu();
	}

	async function submitRename() {
		const currentRenamingItem = renamingItem;
		const currentRenameValue = renameValue;
		
		if (!currentRenamingItem || !currentRenameValue.trim()) {
			setRenamingItem(null);
			return;
		}

		try {
			if (currentRenamingItem.type === 'file') {
				await appState.renameFile(currentRenamingItem.id, currentRenameValue.trim());
			} else {
				await appState.renameFolder(currentRenamingItem.id, currentRenameValue.trim());
			}
			setRenamingItem(null);
		} catch (error) {
			// Show error to user
			if (error instanceof Error) {
				alert(error.message);
			}
			// Keep the input open so user can correct
		}
	}

	function handleRenameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitRename();
		} else if (event.key === 'Escape') {
			setRenamingItem(null);
		}
	}

	function updateRenameValue(value: string) {
		setRenameValue(value);
	}

	async function handleDelete(item: FileTreeItem) {
		const confirmMsg = item.type === 'folder' 
			? `Delete folder "${item.name}" and all its contents?`
			: `Delete file "${item.name}"?`;
		
		if (confirm(confirmMsg)) {
			if (item.type === 'file') {
				await appState.removeFile(item.id);
			} else {
				await appState.removeFolder(item.id);
			}
		}
		closeContextMenu();
	}

	// Handle creating new file/folder (VS Code style)
	async function startCreating(type: 'file' | 'folder', folderId: number | null = null) {
		setCreatingType(type);
		setCreatingInFolder(folderId);
		setCreateValue('');
		closeContextMenu();
		
		// If creating in a folder, make sure it's open
		if (folderId !== null) {
			const folder = items.find(f => f.id === folderId && f.type === 'folder');
			if (folder && !folder.isOpen) {
				await appState.toggleFolder(folderId);
			}
		}
		
		// Focus the input after it's rendered
		setTimeout(() => {
			const inputRef = createInputRef;
			if (inputRef) {
				inputRef.focus();
			}
		}, 0);
	}

	async function submitCreate() {
		const type = creatingType;
		let value = createValue.trim();
		const folderId = creatingInFolder;
		
		if (!type) {
			cancelCreate();
			return;
		}
		
		// Use default name if empty
		if (!value) {
			value = type === 'file' ? 'New File' : 'New Folder';
		}

		try {
			if (type === 'file') {
				await appState.newFile(folderId, value);
			} else {
				const newId = await appState.newFolder(value, folderId);
				// Open the parent folder if needed
				if (folderId !== null) {
					const folder = appState.fileTree.find(f => f.id === folderId);
					if (folder && !folder.isOpen) {
						await appState.toggleFolder(folderId);
					}
				}
			}
			cancelCreate();
		} catch (error) {
			// Show error to user
			if (error instanceof Error) {
				alert(error.message);
			}
			// Keep the input open so user can correct
		}
	}

	function cancelCreate() {
		setCreatingType(null);
		setCreatingInFolder(null);
		setCreateValue('');
		setCreateInputRef(null);
	}

	function handleCreateKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitCreate();
		} else if (event.key === 'Escape') {
			cancelCreate();
		}
	}
	
	function updateCreateValue(value: string) {
		setCreateValue(value);
	}

	// Drag and Drop handlers
	function handleDragStart(event: DragEvent, item: FileTreeItem) {
		if (renamingItem) return;
		
		if (isRoot) {
			draggingItem = item;
		} else if (parentDragStart) {
			parentDragStart(item, event);
		}

		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', JSON.stringify({
				type: item.type,
				id: item.id,
				name: item.name,
				parentId: item.parentId
			}));
		}

		// Add a small delay to show the drag effect
		const target = event.currentTarget as HTMLElement;
		requestAnimationFrame(() => {
			target.classList.add('dragging');
		});
	}

	function handleDragEnd(event: DragEvent) {
		const target = event.currentTarget as HTMLElement;
		target.classList.remove('dragging');
		
		if (isRoot) {
			draggingItem = null;
			localDragOverItem = null;
		} else if (parentDragEnd) {
			parentDragEnd();
		}
	}

	function handleDragOver(event: DragEvent, item: FileTreeItem) {
		event.preventDefault();
		event.stopPropagation();
		
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}

		// Only folders can be drop targets
		if (item.type === 'folder') {
			setDragOverItem(item);
		}
	}

	function handleDragLeave(event: DragEvent) {
		// Only clear if we're leaving to outside the tree
		const relatedTarget = event.relatedTarget as HTMLElement;
		if (!relatedTarget?.closest('.tree-button')) {
			setDragOverItem(null);
		}
	}

	async function handleDrop(event: DragEvent, targetItem: FileTreeItem) {
		event.preventDefault();
		event.stopPropagation();

		setDragOverItem(null);

		const data = event.dataTransfer?.getData('text/plain');
		if (!data) return;

		try {
			const draggedData = JSON.parse(data);
			const draggedType = draggedData.type as 'file' | 'folder';
			const draggedId = draggedData.id as number;

			// Can only drop onto folders
			if (targetItem.type !== 'folder') return;

			// Don't drop on itself
			if (draggedType === 'folder' && draggedId === targetItem.id) return;

			// Don't drop if already in this folder
			if (draggedData.parentId === targetItem.id) return;

			if (draggedType === 'file') {
				await appState.moveFileToFolder(draggedId, targetItem.id);
			} else {
				await appState.moveFolderToParent(draggedId, targetItem.id);
			}

			// Open the target folder to show the moved item
			if (!targetItem.isOpen) {
				await appState.toggleFolder(targetItem.id);
			}
		} catch (error) {
			console.error('Failed to handle drop:', error);
		}
	}

	// Close context menu when clicking outside
	function handleWindowClick() {
		closeContextMenu();
	}
</script>

<svelte:window onclick={handleWindowClick} />

<ul class="file-tree" style="--depth: {depth}">
	<!-- Root level context menu trigger (only at depth 0) -->
	{#if depth === 0}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div 
			class="root-context-trigger"
			oncontextmenu={(e) => handleContextMenu(e, null)}
		></div>
	{/if}
	
	<!-- Show creation input at root level if creating at root -->
	{#if depth === 0 && creatingType !== null && creatingInFolder === null}
		<li class="tree-item creating">
			<div class="tree-button creating-input">
				<span class="icon">
					{#if creatingType === 'folder'}
						<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
							<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
							<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
						</svg>
					{/if}
				</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					class="create-input"
					placeholder={creatingType === 'folder' ? 'Folder name...' : 'File name...'}
					value={createValue}
					oninput={(e) => updateCreateValue(e.currentTarget.value)}
					onkeydown={handleCreateKeydown}
					onblur={submitCreate}
					use:focusInput
					autofocus
				/>
			</div>
		</li>
	{/if}
	
	{#each items as item (`${item.type}-${item.id}`)}
		<li class="tree-item">
			<button
				class="tree-button"
				class:active={item.type === 'file' && item.id === appState.activeFileId}
				class:folder={item.type === 'folder'}
				class:file={item.type === 'file'}
				class:drag-over={dragOverItem?.id === item.id && item.type === 'folder'}
				draggable="true"
				onclick={() => handleFileClick(item)}
				onkeydown={(e) => handleKeydown(e, item)}
				oncontextmenu={(e) => handleContextMenu(e, item)}
				ondragstart={(e) => handleDragStart(e, item)}
				ondragend={(e) => handleDragEnd(e)}
				ondragover={(e) => handleDragOver(e, item)}
				ondragleave={(e) => handleDragLeave(e)}
				ondrop={(e) => handleDrop(e, item)}
			>
				<span class="icon">
					{#if item.type === 'folder'}
						{#if item.isOpen}
							<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
								<path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
								<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
							</svg>
						{/if}
					{:else}
						<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
							<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
						</svg>
					{/if}
				</span>
				{#if renamingItem?.id === item.id && renamingItem?.type === item.type}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						class="rename-input"
						value={renameValue}
						oninput={(e) => updateRenameValue(e.currentTarget.value)}
						onkeydown={handleRenameKeydown}
						onblur={submitRename}
						use:focusRenameInput
						autofocus
					/>
				{:else}
					<span class="name">{item.name}</span>
				{/if}
				{#if item.type === 'folder'}
					<span class="chevron" class:open={item.isOpen}>
						<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
							<path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
						</svg>
					</span>
				{/if}
			</button>

			{#if item.type === 'folder' && item.isOpen}
				<!-- Show creation input inside folder if creating in this folder -->
				{#if creatingType !== null && creatingInFolder === item.id}
					<ul class="file-tree" style="--depth: {depth + 1}">
						<li class="tree-item creating">
							<div class="tree-button creating-input">
								<span class="icon">
									{#if creatingType === 'folder'}
										<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
											<path d="M1.75 1A.75.75 0 001 1.75v12.5c0 .414.336.75.75.75h12.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75H7.5L6.5 2H1.75zM2.5 4h11v9.5h-11V4z"/>
										</svg>
									{:else}
										<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
											<path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v11.5A1.75 1.75 0 0110.25 16h-8.5A1.75 1.75 0 010 14.25V2.75C0 1.784.784 1 1.75 1zm0 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25h-8.5z"/>
										</svg>
									{/if}
								</span>
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="text"
									class="create-input"
									placeholder={creatingType === 'folder' ? 'Folder name...' : 'File name...'}
									value={createValue}
									oninput={(e) => updateCreateValue(e.currentTarget.value)}
									onkeydown={handleCreateKeydown}
									onblur={submitCreate}
									use:focusInput
									autofocus
								/>
							</div>
						</li>
					</ul>
				{/if}
				
				{#if item.children && item.children.length > 0}
					<FileTree 
						items={item.children} 
						depth={depth + 1}
						parentFolderId={item.id}
						onDragStart={(dragItem, event) => {
							if (isRoot) {
								draggingItem = dragItem;
							} else if (parentDragStart) {
								parentDragStart(dragItem, event);
							}
						}}
						onDragEnd={() => {
							if (isRoot) {
								draggingItem = null;
								localDragOverItem = null;
							} else if (parentDragEnd) {
								parentDragEnd();
							}
						}}
						dragOverItem={isRoot ? localDragOverItem : parentDragOverItem}
						setDragOverItem={setDragOverItem}
						sharedState={isRoot ? childSharedState : sharedState}
						setSharedState={isRoot ? handleSetSharedState : setSharedState}
					/>
				{/if}
			{/if}
		</li>
	{/each}
</ul>

<!-- Context Menu -->
{#if contextMenu}
	<div 
		class="context-menu"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px"
	>
		{#if contextMenu.item === null}
			<!-- Root context menu -->
			<button class="context-item" onclick={() => createAndRename('file', null)}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
					<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
				</svg>
				New File
			</button>
			<button class="context-item" onclick={() => createAndRename('folder', null)}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
					<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
				</svg>
				New Folder
			</button>
		{:else}
			<!-- Item context menu -->
			{#if contextMenu.item.type === 'file'}
				<!-- For files, show creation options in the same folder -->
				<button class="context-item" onclick={() => createAndRename('file', contextMenu!.item!.parentId)}>
					<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
						<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
					</svg>
					New File
				</button>
				<button class="context-item" onclick={() => createAndRename('folder', contextMenu!.item!.parentId)}>
					<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
						<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
					</svg>
					New Folder
				</button>
				<div class="context-separator"></div>
				<button class="context-item" onclick={() => handleRename(contextMenu!.item!)}>
					<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
						<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
					</svg>
					Rename
				</button>
				<button class="context-item danger" onclick={() => handleDelete(contextMenu!.item!)}>
					<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
						<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
					</svg>
					Delete
				</button>
			{:else if contextMenu.item.type === 'folder'}
				<!-- For folders, show creation options first, then rename/delete -->
				<button class="context-item" onclick={() => createAndRename('file', contextMenu!.item!.id)}>
					<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
						<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
					</svg>
					New File
				</button>
				<button class="context-item" onclick={() => createAndRename('folder', contextMenu!.item!.id)}>
					<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
						<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
					</svg>
					New Folder
				</button>
				<div class="context-separator"></div>
				<button class="context-item" onclick={() => handleRename(contextMenu!.item!)}>
					<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
						<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
					</svg>
					Rename
				</button>
				<button class="context-item danger" onclick={() => handleDelete(contextMenu!.item!)}>
					<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
						<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
					</svg>
					Delete
				</button>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.file-tree {
		list-style: none;
		padding: 0;
		margin: 0;
		padding-left: calc(var(--depth) * 12px);
		background: transparent;
		width: 100%;
		min-height: 0;
	}

	.tree-item {
		margin: 0;
	}

	.tree-button {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 4px 8px;
		border: none;
		background: transparent;
		color: #c9d1d9;
		font-size: 13px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.tree-button:hover {
		background: #21262d;
	}

	.tree-button.active {
		background: #1f6feb;
		color: #ffffff;
	}

	.tree-button.drag-over {
		background: #1a3a5c;
		outline: 2px dashed #58a6ff;
		outline-offset: -2px;
	}

	:global(.tree-button.dragging) {
		opacity: 0.5;
	}

	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: #8b949e;
	}

	.tree-button.folder .icon {
		color: #d29922;
	}

	.tree-button.file .icon {
		color: #3fb950;
	}

	.tree-button.active .icon {
		color: inherit;
	}

	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chevron {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.15s;
		color: #8b949e;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.rename-input,
	.create-input {
		flex: 1;
		background: #0d1117;
		border: 1px solid #58a6ff;
		color: #c9d1d9;
		font-size: 13px;
		font-family: inherit;
		padding: 2px 4px;
		border-radius: 4px;
		outline: none;
		min-width: 0;
		box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.2);
	}

	.creating-input {
		background: transparent;
		cursor: default;
	}

	.creating-input:hover {
		background: transparent;
	}

	.tree-item.creating {
		margin: 2px 0;
	}

	.root-context-trigger {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: auto;
		z-index: -1;
	}

	.context-menu {
		position: fixed;
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 6px;
		padding: 4px 0;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		z-index: 1000;
		min-width: 140px;
	}

	.context-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 12px;
		border: none;
		background: transparent;
		color: #c9d1d9;
		font-size: 13px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.context-item:hover {
		background: #1f6feb;
	}

	.context-item.danger:hover {
		background: #da3633;
		color: #ffffff;
	}

	.context-item svg {
		flex-shrink: 0;
	}

	.context-separator {
		height: 1px;
		background: #30363d;
		margin: 4px 0;
	}
</style>

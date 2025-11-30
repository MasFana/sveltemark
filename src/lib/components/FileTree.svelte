<script lang="ts">
	import type { FileTreeItem } from '$lib/appState.svelte';
	import { appState } from '$lib/appState.svelte';
	import FileTree from './FileTree.svelte';

	interface Props {
		items: FileTreeItem[];
		depth?: number;
	}

	let { items, depth = 0 }: Props = $props();

	// Context menu and rename state
	let contextMenu = $state<{ x: number; y: number; item: FileTreeItem } | null>(null);
	let renamingItem = $state<FileTreeItem | null>(null);
	let renameValue = $state<string>('');

	function handleFileClick(item: FileTreeItem) {
		if (renamingItem?.id === item.id) return; // Don't select while renaming
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

	function handleContextMenu(event: MouseEvent, item: FileTreeItem) {
		event.preventDefault();
		event.stopPropagation();
		contextMenu = { x: event.clientX, y: event.clientY, item };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function handleRename(item: FileTreeItem) {
		renamingItem = item;
		renameValue = item.name;
		closeContextMenu();
	}

	async function submitRename() {
		if (!renamingItem || !renameValue.trim()) {
			renamingItem = null;
			return;
		}

		if (renamingItem.type === 'file') {
			await appState.renameFile(renamingItem.id, renameValue.trim());
		} else {
			await appState.renameFolder(renamingItem.id, renameValue.trim());
		}
		renamingItem = null;
	}

	function handleRenameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitRename();
		} else if (event.key === 'Escape') {
			renamingItem = null;
		}
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

	// Close context menu when clicking outside
	function handleWindowClick() {
		closeContextMenu();
	}
</script>

<svelte:window onclick={handleWindowClick} />

<ul class="file-tree" style="--depth: {depth}">
	{#each items as item (item.id)}
		<li class="tree-item">
			<button
				class="tree-button"
				class:active={item.type === 'file' && item.id === appState.activeFileId}
				class:folder={item.type === 'folder'}
				class:file={item.type === 'file'}
				onclick={() => handleFileClick(item)}
				onkeydown={(e) => handleKeydown(e, item)}
				oncontextmenu={(e) => handleContextMenu(e, item)}
			>
				<span class="icon">
					{#if item.type === 'folder'}
						{#if item.isOpen}
							<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
								<path d="M1.5 14.25V1.75A.75.75 0 012.25 1H6.5l1 1h6.25a.75.75 0 01.75.75v11.5a.75.75 0 01-.75.75H2.25a.75.75 0 01-.75-.75zM3 3v10.5h10V3.5H7.19l-1-1H3z"/>
							</svg>
						{:else}
							<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
								<path d="M1.75 1A.75.75 0 001 1.75v12.5c0 .414.336.75.75.75h12.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75H7.5L6.5 2H1.75zM2.5 4h11v9.5h-11V4z"/>
							</svg>
						{/if}
					{:else}
						<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
							<path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v11.5A1.75 1.75 0 0110.25 16h-8.5A1.75 1.75 0 010 14.25V2.75C0 1.784.784 1 1.75 1zm0 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25h-8.5z"/>
						</svg>
					{/if}
				</span>
				{#if renamingItem?.id === item.id}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						class="rename-input"
						bind:value={renameValue}
						onkeydown={handleRenameKeydown}
						onblur={submitRename}
						autofocus
					/>
				{:else}
					<span class="name">{item.name}</span>
				{/if}
				{#if item.type === 'folder'}
					<span class="chevron" class:open={item.isOpen}>
						<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
							<path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/>
						</svg>
					</span>
				{/if}
			</button>

			{#if item.type === 'folder' && item.isOpen && item.children && item.children.length > 0}
				<FileTree items={item.children} depth={depth + 1} />
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
		<button class="context-item" onclick={() => handleRename(contextMenu!.item)}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
				<path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.46 11.1a.25.25 0 00-.064.108l-.457 1.6 1.6-.457a.25.25 0 00.108-.064l8.61-8.61a.25.25 0 000-.354l-1.086-1.086z"/>
			</svg>
			Rename
		</button>
		<button class="context-item danger" onclick={() => handleDelete(contextMenu!.item)}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
				<path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"/>
			</svg>
			Delete
		</button>
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

	.rename-input {
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
</style>

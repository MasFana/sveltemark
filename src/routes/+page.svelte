<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, Editor, Preview, Sidebar, Toolbar } from '$lib';
	import 'katex/dist/katex.min.css';
	import 'github-markdown-css/github-markdown-dark.css';
	import 'highlight.js/styles/github-dark.css';

	let editorRef = $state<Editor | undefined>(undefined);
	let previewRef = $state<Preview | undefined>(undefined);

	// Auto-hide UI state
	let showSidebar = $state(true);
	let showToolbar = $state(true);
	let mouseNearSidebar = $state(false);
	let mouseNearToolbar = $state(false);

	// Resizable pane state (persisted in localStorage)
	const DEFAULT_SIDEBAR_WIDTH = 250;
	const DEFAULT_EDITOR_PERCENT = 50;
	
	let sidebarWidth = $state(DEFAULT_SIDEBAR_WIDTH);
	let editorWidthPercent = $state(DEFAULT_EDITOR_PERCENT);
	let isResizingSidebar = $state(false);
	let isResizingEditor = $state(false);

	// Load saved layout from localStorage
	function loadLayoutState() {
		if (typeof localStorage !== 'undefined') {
			const savedSidebar = localStorage.getItem('sidebarWidth');
			const savedEditor = localStorage.getItem('editorWidthPercent');
			if (savedSidebar) sidebarWidth = Number(savedSidebar);
			if (savedEditor) editorWidthPercent = Number(savedEditor);
		}
	}

	// Save layout state to localStorage
	function saveLayoutState() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('sidebarWidth', String(sidebarWidth));
			localStorage.setItem('editorWidthPercent', String(editorWidthPercent));
		}
	}

	// Reset layout to defaults
	function resetLayout() {
		sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
		editorWidthPercent = DEFAULT_EDITOR_PERCENT;
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem('sidebarWidth');
			localStorage.removeItem('editorWidthPercent');
		}
	}

	onMount(async () => {
		loadLayoutState();
		await appState.initialize();
	});

	// Track which pane initiated the scroll to prevent feedback loops
	let scrollSource: 'editor' | 'preview' | null = null;

	function handleEditorChange(content: string) {
		appState.updateBuffer(content);
	}

	// Proportional scroll sync: Editor → Preview
	function handleEditorScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
		if (scrollSource === 'preview') return;
		scrollSource = 'editor';
		
		const maxScroll = scrollInfo.scrollHeight - scrollInfo.clientHeight;
		const percent = maxScroll > 0 ? scrollInfo.scrollTop / maxScroll : 0;
		previewRef?.scrollToPercent(percent);
		
		// Reset scroll source after a small delay
		requestAnimationFrame(() => {
			scrollSource = null;
		});
	}

	// Proportional scroll sync: Preview → Editor
	function handlePreviewScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
		if (scrollSource === 'editor') return;
		scrollSource = 'preview';
		
		const maxScroll = scrollInfo.scrollHeight - scrollInfo.clientHeight;
		const percent = maxScroll > 0 ? scrollInfo.scrollTop / maxScroll : 0;
		editorRef?.scrollToPercent(percent);
		
		// Reset scroll source after a small delay
		requestAnimationFrame(() => {
			scrollSource = null;
		});
	}

	// Handle mouse movement for auto-hide
	function handleMouseMove(event: MouseEvent) {
		if (!appState.autoHideUI) {
			showSidebar = true;
			showToolbar = true;
			return;
		}

		const x = event.clientX;
		const y = event.clientY;

		// Check if hovering over a dropdown menu
		const target = event.target as HTMLElement;
		const isInDropdown = target.closest('.dropdown-menu') !== null || 
		                     target.closest('.toolbar') !== null ||
		                     target.closest('.toolbar-row') !== null;

		// Near sidebar (left edge) or in sidebar
		const isInSidebar = target.closest('.sidebar-wrapper') !== null;
		mouseNearSidebar = x < 50 || isInSidebar;
		showSidebar = mouseNearSidebar || x < 260 || isInSidebar;

		// Near toolbar (top edge) or in toolbar/dropdown
		mouseNearToolbar = y < 20 || isInDropdown;
		showToolbar = mouseNearToolbar || y < 80 || isInDropdown;
	}

	// Print function
	async function handlePrint() {
		// Get content with light-themed mermaid diagrams for printing
		const content = await previewRef?.getHTMLForPrint?.() || previewRef?.getHTML?.() || '';
		const printWindow = window.open('', '_blank');
		if (!printWindow) return;

		printWindow.document.write(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>${appState.activeFile?.title || 'Document'}</title>
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css">
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
				<style>
					body { 
						padding: 40px; 
						max-width: 900px; 
						margin: 0 auto;
						background: white;
						color: #24292f;
					}
					.markdown-body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
						background: white;
						color: #24292f;
					}
					pre, code {
						background: #f6f8fa !important;
					}
					@media print {
						body { padding: 20px; }
					}
				</style>
			</head>
			<body class="markdown-body">
				${content}
			</body>
			</html>
		`);
		
		printWindow.document.close();
		setTimeout(() => {
			printWindow.print();
		}, 250);
	}

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey) {
			switch (event.key.toLowerCase()) {
				case 's':
					event.preventDefault();
					appState.saveNow();
					break;
				case 'b':
					event.preventDefault();
					editorRef?.toggleBold();
					break;
				case 'i':
					event.preventDefault();
					editorRef?.toggleItalic();
					break;
				case 'p':
					event.preventDefault();
					handlePrint();
					break;
			}
		}
	}

	// Sidebar resize handlers
	function startSidebarResize(event: MouseEvent) {
		event.preventDefault();
		isResizingSidebar = true;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	// Editor/Preview resize handlers
	function startEditorResize(event: MouseEvent) {
		event.preventDefault();
		isResizingEditor = true;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	// Handle mouse move for resizing
	function handleResizeMove(event: MouseEvent) {
		if (isResizingSidebar) {
			const newWidth = Math.max(150, Math.min(500, event.clientX));
			sidebarWidth = newWidth;
		}
		
		if (isResizingEditor) {
			const container = document.querySelector('.editor-preview-container') as HTMLElement;
			if (container) {
				const rect = container.getBoundingClientRect();
				const relativeX = event.clientX - rect.left;
				const percent = (relativeX / rect.width) * 100;
				editorWidthPercent = Math.max(20, Math.min(80, percent));
			}
		}
	}

	// Handle mouse up to stop resizing
	function handleResizeEnd() {
		if (isResizingSidebar || isResizingEditor) {
			isResizingSidebar = false;
			isResizingEditor = false;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			saveLayoutState();
		}
	}
</script>

<svelte:window 
	onkeydown={handleKeydown} 
	onmousemove={(e) => { handleMouseMove(e); handleResizeMove(e); }}
	onmouseup={handleResizeEnd}
/>

<div class="app" class:auto-hide={appState.autoHideUI} class:resizing={isResizingSidebar || isResizingEditor}>
	{#if appState.isInitialized}
		<div 
			class="sidebar-wrapper" 
			class:hidden={appState.autoHideUI && !showSidebar}
			style="width: {sidebarWidth}px;"
		>
			<Sidebar />
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div 
				class="resize-handle resize-handle-sidebar"
				onmousedown={startSidebarResize}
				role="separator"
				aria-orientation="vertical"
			></div>
		</div>
	{/if}

	<main class="main-content">
		{#if appState.activeFile}
			<div class="toolbar-row" class:hidden={appState.autoHideUI && !showToolbar}>
				<Toolbar editor={editorRef} onPrint={handlePrint} />
				<div class="status-area">
					<button class="reset-layout-btn" title="Reset layout" onclick={resetLayout}>
						<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
							<path d="M5.56 7.56H4.5a.5.5 0 000 1h2a.5.5 0 00.5-.5v-2a.5.5 0 00-1 0v.59c-.41-.59-.97-1.06-1.63-1.37A4.5 4.5 0 001 9.5a4.5 4.5 0 004.5 4.5 4.5 4.5 0 004.4-3.5H8.86a3.5 3.5 0 01-6.72 0A3.5 3.5 0 015.5 6.5c.53 0 1.03.12 1.48.32l.58-.74zM8 1.5a6.5 6.5 0 016.5 6.5 6.5 6.5 0 01-.15 1.38l-.97-.24c.08-.37.12-.75.12-1.14a5.5 5.5 0 00-11 0c0 .39.04.77.12 1.14l-.97.24A6.5 6.5 0 011.5 8 6.5 6.5 0 018 1.5z"/>
						</svg>
					</button>
					{#if appState.viewOnlyMode}
						<span class="view-mode-badge">View Only</span>
					{/if}
					<span class="file-name">{appState.activeFile.title}</span>
					{#if appState.dirty}
						<span class="unsaved-dot" title="Unsaved changes">●</span>
					{/if}
					{#if appState.isSaving}
						<span class="saving">Saving...</span>
					{:else if !appState.viewOnlyMode}
						<span class="saved">✓</span>
					{/if}
				</div>
			</div>

			<div class="editor-preview-container">
				{#if !appState.viewOnlyMode}
					<div class="editor-pane" style="flex: 0 0 {editorWidthPercent}%;">
						<Editor
							bind:this={editorRef}
							value={appState.buffer}
							onchange={handleEditorChange}
							onscroll={handleEditorScroll}
						/>
					</div>
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<div 
						class="resize-handle resize-handle-editor"
						onmousedown={startEditorResize}
						role="separator"
						aria-orientation="vertical"
					></div>
				{/if}
				<div class="preview-pane" class:full-width={appState.viewOnlyMode}>
					<Preview
						bind:this={previewRef}
						content={appState.buffer}
						onscroll={handlePreviewScroll}
					/>
				</div>
			</div>
		{:else if !appState.isInitialized}
			<div class="empty-state">
				<div class="empty-content">
					<h2>SvelteMark</h2>
					<p>Loading...</p>
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<div class="empty-content">
					<h2>SvelteMark</h2>
					<p>Select a file from the sidebar to start editing</p>
					<p class="hint">Or create a new file using the + button</p>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
		background: #0d1117;
		color: #c9d1d9;
		overflow: hidden;
	}

	:global(*) {
		box-sizing: border-box;
	}

	/* GitHub dark scrollbar */
	:global(*::-webkit-scrollbar) {
		width: 12px;
		height: 12px;
	}

	:global(*::-webkit-scrollbar-track) {
		background: #0d1117;
	}

	:global(*::-webkit-scrollbar-thumb) {
		background: #30363d;
		border-radius: 6px;
		border: 3px solid #0d1117;
	}

	:global(*::-webkit-scrollbar-thumb:hover) {
		background: #484f58;
	}

	.app {
		display: flex;
		height: 100%;
		width: 100%;
		overflow: hidden;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}

	/* Sidebar wrapper for auto-hide */
	.sidebar-wrapper {
		height: 100%;
		display: flex;
		position: relative;
		flex-shrink: 0;
		transition: transform 0.2s ease, opacity 0.2s ease;
	}

	.sidebar-wrapper.hidden {
		transform: translateX(-100%);
		opacity: 0;
		position: absolute;
		z-index: 100;
		height: 100%;
	}

	/* Disable transitions while resizing */
	.app.resizing .sidebar-wrapper,
	.app.resizing .editor-pane,
	.app.resizing .preview-pane {
		transition: none;
	}

	/* Resize handles */
	.resize-handle {
		width: 2px;
		background: transparent;
		cursor: col-resize;
		flex-shrink: 0;
		transition: background-color 0.15s;
		z-index: 10;
	}

	.resize-handle:hover,
	.resize-handle:active {
		background: #58a6ff;
		width: 4px;
	}

	.resize-handle-sidebar {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
	}

	.resize-handle-editor {
		background: #30363d;
	}

	.resize-handle-editor:hover,
	.resize-handle-editor:active {
		background: #58a6ff;
	}

	/* Toolbar auto-hide */
	.toolbar-row.hidden {
		transform: translateY(-100%);
		opacity: 0;
		position: absolute;
		z-index: 100;
		width: 100%;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.toolbar-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #161b22;
		border-bottom: 1px solid #30363d;
		height: 41px;
		min-height: 41px;
		box-sizing: border-box;
		transition: transform 0.2s ease, opacity 0.2s ease;
	}

	.status-area {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		font-size: 12px;
	}

	.reset-layout-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: transparent;
		color: #8b949e;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.15s, color 0.15s;
	}

	.reset-layout-btn:hover {
		background: #21262d;
		color: #c9d1d9;
	}

	.view-mode-badge {
		background: #1f6feb;
		color: #ffffff;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
	}

	.file-name {
		color: #8b949e;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.unsaved-dot {
		color: #d29922;
		font-size: 14px;
	}

	.saving {
		color: #d29922;
	}

	.saved {
		color: #3fb950;
	}

	.editor-preview-container {
		flex: 1;
		display: flex;
		overflow: hidden;
	}

	.editor-pane {
		min-width: 200px;
		overflow: hidden;
		border-right: none;
	}

	.preview-pane {
		flex: 1;
		min-width: 200px;
		overflow: hidden;
	}

	.preview-pane.full-width {
		flex: 1;
		max-width: 900px;
		margin: 0 auto;
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0d1117;
	}

	.empty-content {
		text-align: center;
	}

	.empty-content h2 {
		font-size: 24px;
		font-weight: 400;
		margin-bottom: 16px;
		color: #c9d1d9;
	}

	.empty-content p {
		color: #8b949e;
		margin: 8px 0;
	}

	.empty-content .hint {
		font-size: 12px;
	}
</style>

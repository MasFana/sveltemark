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

	onMount(async () => {
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
</script>

<svelte:window onkeydown={handleKeydown} onmousemove={handleMouseMove} />

<div class="app" class:auto-hide={appState.autoHideUI}>
	{#if appState.isInitialized}
		<div class="sidebar-wrapper" class:hidden={appState.autoHideUI && !showSidebar}>
			<Sidebar />
		</div>
	{/if}

	<main class="main-content">
		{#if appState.activeFile}
			<div class="toolbar-row" class:hidden={appState.autoHideUI && !showToolbar}>
				<Toolbar editor={editorRef} onPrint={handlePrint} />
				<div class="status-area">
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
					<div class="editor-pane">
						<Editor
							bind:this={editorRef}
							value={appState.buffer}
							onchange={handleEditorChange}
							onscroll={handleEditorScroll}
						/>
					</div>
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
					<h2>SvelteMark Studio</h2>
					<p>Loading...</p>
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<div class="empty-content">
					<h2>SvelteMark Studio</h2>
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
		transition: transform 0.2s ease, opacity 0.2s ease;
	}

	.sidebar-wrapper.hidden {
		transform: translateX(-100%);
		opacity: 0;
		position: absolute;
		z-index: 100;
		height: 100%;
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
		transition: transform 0.2s ease, opacity 0.2s ease;
	}

	.status-area {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		font-size: 12px;
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
		flex: 1;
		min-width: 0;
		overflow: hidden;
		border-right: 1px solid #30363d;
	}

	.preview-pane {
		flex: 1;
		min-width: 0;
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

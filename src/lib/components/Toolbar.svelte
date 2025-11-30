<script lang="ts">
	import type Editor from './Editor.svelte';
	import { appState } from '$lib/appState.svelte';

	interface Props {
		editor?: Editor;
		onPrint?: () => void;
		onResetLayout?: () => void;
	}

	let { editor, onPrint, onResetLayout }: Props = $props();
	let showInsertMenu = $state(false);
	let showMoreMenu = $state(false);
	let fileInput: HTMLInputElement;

	// Button refs for dropdown positioning
	let insertBtnRef = $state<HTMLButtonElement | null>(null);
	let moreBtnRef = $state<HTMLButtonElement | null>(null);

	// Dropdown position state
	let insertMenuPos = $state({ top: 0, left: 0 });
	let moreMenuPos = $state({ top: 0, left: 0, alignRight: false });

	// Calculate dropdown position from button
	function updateInsertMenuPos() {
		if (insertBtnRef) {
			const rect = insertBtnRef.getBoundingClientRect();
			insertMenuPos = { top: rect.bottom + 4, left: rect.left };
		}
	}

	function updateMoreMenuPos() {
		if (moreBtnRef) {
			const rect = moreBtnRef.getBoundingClientRect();
			const alignRight = rect.right > window.innerWidth - 180;
			moreMenuPos = { 
				top: rect.bottom + 4, 
				left: alignRight ? rect.right : rect.left,
				alignRight 
			};
		}
	}

	function handleBold() {
		editor?.toggleBold();
	}

	function handleItalic() {
		editor?.toggleItalic();
	}

	function handleStrikethrough() {
		editor?.wrapSelection('~~', '~~');
	}

	function handleCode() {
		editor?.toggleCode();
	}

	function handleLink() {
		editor?.insertLink();
	}

	function handleImage() {
		editor?.insertImage();
	}

	function handleCodeBlock() {
		editor?.insertCodeBlock();
	}

	function handleHeading(level: number) {
		editor?.insertHeading(level);
	}

	function handleQuote() {
		editor?.insertText('\n> ');
	}

	function handleBulletList() {
		editor?.insertText('\n- Item 1\n- Item 2\n- Item 3\n');
	}

	function handleNumberedList() {
		editor?.insertText('\n1. Item 1\n2. Item 2\n3. Item 3\n');
	}

	function handleTaskList() {
		editor?.insertText('\n- [ ] Task 1\n- [ ] Task 2\n- [x] Completed task\n');
	}

	function handleTable() {
		editor?.insertText('\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n');
	}

	function handleHorizontalRule() {
		editor?.insertText('\n---\n');
	}

	function handleMermaid() {
		editor?.insertText('\n```mermaid\ngraph TD\n    A[Start] --> B[Process]\n    B --> C[End]\n```\n');
	}

	function handleMermaidSequence() {
		editor?.insertText('\n```mermaid\nsequenceDiagram\n    Alice->>Bob: Hello Bob\n    Bob-->>Alice: Hi Alice\n```\n');
	}

	function handleMermaidFlowchart() {
		editor?.insertText('\n```mermaid\nflowchart LR\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Do something]\n    B -->|No| D[Do something else]\n    C --> E[End]\n    D --> E\n```\n');
	}

	function handleMermaidPie() {
		editor?.insertText('\n```mermaid\npie title Distribution\n    "Category A" : 40\n    "Category B" : 35\n    "Category C" : 25\n```\n');
	}

	function handleMathInline() {
		editor?.wrapSelection('$', '$');
	}

	function handleMathBlock() {
		editor?.insertText('\n$$\n\\int_{a}^{b} f(x) \\, dx\n$$\n');
	}

	function toggleViewOnly() {
		appState.toggleViewOnlyMode();
	}

	function toggleAutoHide() {
		appState.toggleAutoHideUI();
		closeMenus();
	}

	function toggleWordWrap() {
		appState.toggleWordWrap();
		closeMenus();
	}

	async function handleExport() {
		const backup = await appState.exportBackup();
		const blob = new Blob([backup], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `sveltemark-backup-${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
		closeMenus();
	}

	function handleImportClick() {
		fileInput?.click();
		closeMenus();
	}

	async function handleImportFile(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const content = e.target?.result as string;
				await appState.importBackup(content);
				alert('Backup imported successfully!');
			} catch (err) {
				alert('Failed to import backup: ' + (err as Error).message);
			}
		};
		reader.readAsText(file);
		target.value = '';
	}

	function handlePrint() {
		onPrint?.();
		closeMenus();
	}

	async function handleHelp() {
		await appState.showHelp();
		closeMenus();
	}

	function closeMenus() {
		showInsertMenu = false;
		showMoreMenu = false;
	}
</script>

<svelte:window onclick={closeMenus} />

<input 
	type="file" 
	accept=".json" 
	bind:this={fileInput} 
	onchange={handleImportFile}
	style="display: none;"
/>

<div class="toolbar">
	<!-- Text formatting -->
	<div class="toolbar-group">
		<button class="toolbar-btn" title="Bold (Ctrl+B)" onclick={handleBold} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M4 2a1 1 0 00-1 1v10a1 1 0 001 1h5.5a3.5 3.5 0 001.852-6.47A3.5 3.5 0 008.5 2H4zm4.5 5a1.5 1.5 0 000-3H5v3h3.5zM5 9v3h4.5a1.5 1.5 0 000-3H5z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Italic (Ctrl+I)" onclick={handleItalic} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M6 2.75A.75.75 0 016.75 2h6.5a.75.75 0 010 1.5h-2.505l-3.858 9H9.25a.75.75 0 010 1.5h-6.5a.75.75 0 010-1.5h2.505l3.858-9H6.75A.75.75 0 016 2.75z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Strikethrough" onclick={handleStrikethrough} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M7.581 3.25c-2.036 0-2.778 1.082-2.778 1.786 0 .055.002.107.006.157a.75.75 0 01-1.496.114 3.56 3.56 0 01-.01-.271c0-1.832 1.75-3.286 4.278-3.286 1.418 0 2.721.58 3.514 1.093a.75.75 0 11-.814 1.26c-.64-.414-1.662-.853-2.7-.853zm3.474 5.25h3.195a.75.75 0 010 1.5H1.75a.75.75 0 010-1.5h6.018c-.835-.336-1.478-.588-1.478-1.536 0-.39.114-.763.303-1.072H1.75a.75.75 0 010-1.5H14.25a.75.75 0 010 1.5h-2.783c.903.584 1.588 1.358 1.588 2.608 0 .117-.006.232-.019.344h.039z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Inline Code" onclick={handleCode} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.47 8.53a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z"/>
			</svg>
		</button>
	</div>

	<div class="toolbar-divider"></div>

	<!-- Headings -->
	<div class="toolbar-group">
		<button class="toolbar-btn" title="Heading 1" onclick={() => handleHeading(1)} disabled={appState.viewOnlyMode}>
			<span class="text-btn">H1</span>
		</button>
		<button class="toolbar-btn" title="Heading 2" onclick={() => handleHeading(2)} disabled={appState.viewOnlyMode}>
			<span class="text-btn">H2</span>
		</button>
		<button class="toolbar-btn" title="Heading 3" onclick={() => handleHeading(3)} disabled={appState.viewOnlyMode}>
			<span class="text-btn">H3</span>
		</button>
	</div>

	<div class="toolbar-divider"></div>

	<!-- Lists -->
	<div class="toolbar-group">
		<button class="toolbar-btn" title="Bullet List" onclick={handleBulletList} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M2 4a1 1 0 100-2 1 1 0 000 2zm3.75-1.5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zM3 8a1 1 0 11-2 0 1 1 0 012 0zm-1 6a1 1 0 100-2 1 1 0 000 2z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Numbered List" onclick={handleNumberedList} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M2.003 2.5a.5.5 0 00-.723-.447l-1.003.5a.5.5 0 00.446.894l.28-.14V6H.5a.5.5 0 000 1h2a.5.5 0 000-1h-.497V2.5zM5.75 2.5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zM.924 10.32l.003-.004a.851.851 0 01.144-.153A.66.66 0 011.5 10c.195 0 .306.068.374.146a.57.57 0 01.128.376c0 .453-.269.682-.8 1.078l-.035.025C.692 11.98 0 12.495 0 13.5a.5.5 0 00.5.5h2a.5.5 0 000-1H1.123c.025-.045.064-.104.136-.186.249-.283.664-.63 1.044-.92l.035-.025c.444-.328 1.162-.86 1.162-1.869a1.57 1.57 0 00-.396-1.085A1.64 1.64 0 001.5 9c-.37 0-.666.12-.896.284a1.85 1.85 0 00-.471.478l-.002.002a.5.5 0 00.794.607z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Task List" onclick={handleTaskList} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M6 2a.75.75 0 01.75.75v.5c0 .138.112.25.25.25h4.5a.75.75 0 010 1.5h-4.5a.25.25 0 01-.25-.25v-.5A2.25 2.25 0 004.5 2H3.75a.75.75 0 01-.75-.75V.75A.75.75 0 013.75 0h.5a2.25 2.25 0 012.25 2zM2.5 5.25a.75.75 0 00-1.5 0v8a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0016 13.25v-8a.75.75 0 00-1.5 0v8a.75.75 0 01-.75.75H3.25a.75.75 0 01-.75-.75v-8zm4.03.97l-1.28 1.28-.72-.72a.75.75 0 00-1.06 1.06l1.25 1.25a.75.75 0 001.06 0l1.81-1.81a.75.75 0 00-1.06-1.06zm0 4l-1.28 1.28-.72-.72a.75.75 0 00-1.06 1.06l1.25 1.25a.75.75 0 001.06 0l1.81-1.81a.75.75 0 00-1.06-1.06z"/>
			</svg>
		</button>
	</div>

	<div class="toolbar-divider"></div>

	<!-- Links & Media -->
	<div class="toolbar-group">
		<button class="toolbar-btn" title="Insert Link" onclick={handleLink} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-.025 5.632a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 10-2.83 2.83l2.5 2.5a2 2 0 002.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 01-4.95 0l-2.5-2.5a3.5 3.5 0 014.95-4.95l1.25-1.25z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Insert Image" onclick={handleImage} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h.94a.76.76 0 01.03-.03l6.077-6.078a1.75 1.75 0 012.412-.06L14.5 10.31V2.75a.25.25 0 00-.25-.25H1.75zm12.5 11H4.81l5.048-5.047a.25.25 0 01.344-.009l4.298 3.889v.917a.25.25 0 01-.25.25zm1.75-.25V2.75A1.75 1.75 0 0014.25 1H1.75A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25zM5.5 6a.5.5 0 11-1 0 .5.5 0 011 0zM7 6a2 2 0 11-4 0 2 2 0 014 0z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Code Block" onclick={handleCodeBlock} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H1.75zM6.22 3.22a.75.75 0 011.06 0l2.5 2.5a.75.75 0 010 1.06l-2.5 2.5a.75.75 0 01-1.06-1.06L8.19 6.25 6.22 4.28a.75.75 0 010-1.06z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Insert Table" onclick={handleTable} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zM1.5 6.5v3h4V6.5h-4zm5.5 0v3h4V6.5h-4zm5.5 0v3h2V6.5h-2zm2-1.5V1.75a.25.25 0 00-.25-.25H10.5V5h4zm-5.5 0V1.5h-4V5h4zm-5.5 0V1.75a.25.25 0 00-.25-.25H1.75a.25.25 0 00-.25.25V5h4zm0 6.5h-4v2.75c0 .138.112.25.25.25H5.5V11zm1.5 3h4v-3h-4v3zm5.5 0h2.75a.25.25 0 00.25-.25V11h-3v3z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Blockquote" onclick={handleQuote} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M1.75 2.5h10.5a.75.75 0 010 1.5H1.75a.75.75 0 010-1.5zm4 5h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 010-1.5zm0 5h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 010-1.5zM2.5 7.75a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6z"/>
			</svg>
		</button>
		<button class="toolbar-btn" title="Horizontal Rule" onclick={handleHorizontalRule} disabled={appState.viewOnlyMode}>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M0 7.75A.75.75 0 01.75 7h14.5a.75.75 0 010 1.5H.75A.75.75 0 010 7.75z"/>
			</svg>
		</button>
	</div>

	<div class="toolbar-divider"></div>

	<!-- Diagrams (Mermaid) -->
	<div class="toolbar-group dropdown-wrapper">
		<button 
			bind:this={insertBtnRef}
			class="toolbar-btn dropdown-btn" 
			title="Insert Diagram" 
			onclick={(e) => { e.stopPropagation(); showInsertMenu = !showInsertMenu; updateInsertMenuPos(); }}
			disabled={appState.viewOnlyMode}
		>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M1.75 0A1.75 1.75 0 000 1.75v3.5C0 6.216.784 7 1.75 7h3.5A1.75 1.75 0 007 5.25V4h2v8H5.75A1.75 1.75 0 004 13.75v.5c0 .966.784 1.75 1.75 1.75h4.5A1.75 1.75 0 0012 14.25v-.5A1.75 1.75 0 0010.25 12H10V4h.75A1.75 1.75 0 0012.5 2.25v-.5A1.75 1.75 0 0010.75 0h-9zm0 1.5h9a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25H10h-.25A1.75 1.75 0 008 4.25V4h-.25A1.75 1.75 0 006 2.25v-.5a.25.25 0 01.25-.25h-4.5a.25.25 0 00-.25.25v3.5c0 .138.112.25.25.25h3.5a.25.25 0 00.25-.25v-3.5a.25.25 0 00-.25-.25z"/>
			</svg>
			<svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10" class="dropdown-arrow">
				<path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
			</svg>
		</button>
		{#if showInsertMenu}
			<div class="dropdown-menu dropdown-menu-fixed" style="top: {insertMenuPos.top}px; left: {insertMenuPos.left}px;">
				<button class="dropdown-item" onclick={handleMermaid}>
					<span class="dropdown-icon">📊</span>
					Basic Diagram
				</button>
				<button class="dropdown-item" onclick={handleMermaidFlowchart}>
					<span class="dropdown-icon">🔀</span>
					Flowchart
				</button>
				<button class="dropdown-item" onclick={handleMermaidSequence}>
					<span class="dropdown-icon">🔄</span>
					Sequence Diagram
				</button>
				<button class="dropdown-item" onclick={handleMermaidPie}>
					<span class="dropdown-icon">🥧</span>
					Pie Chart
				</button>
			</div>
		{/if}
	</div>

	<!-- Math -->
	<div class="toolbar-group">
		<button class="toolbar-btn" title="Inline Math" onclick={handleMathInline} disabled={appState.viewOnlyMode}>
			<span class="text-btn">∑</span>
		</button>
		<button class="toolbar-btn" title="Math Block" onclick={handleMathBlock} disabled={appState.viewOnlyMode}>
			<span class="text-btn">∫</span>
		</button>
	</div>

	<div class="toolbar-divider"></div>

	<!-- More menu (Export, Import, Print, Auto-hide, Reset Layout) -->
	<div class="toolbar-group dropdown-wrapper">
		<button 
			bind:this={moreBtnRef}
			class="toolbar-btn dropdown-btn" 
			title="More options" 
			onclick={(e) => { e.stopPropagation(); showMoreMenu = !showMoreMenu; updateMoreMenuPos(); }}
		>
			<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
				<path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
			</svg>
		</button>
		{#if showMoreMenu}
			<div 
				class="dropdown-menu dropdown-menu-fixed" 
				style="top: {moreMenuPos.top}px; {moreMenuPos.alignRight ? `right: ${window.innerWidth - moreMenuPos.left}px;` : `left: ${moreMenuPos.left}px;`}"
			>
				<button class="dropdown-item" onclick={handlePrint}>
					<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
						<path d="M5 1a1 1 0 00-1 1v2H3a2 2 0 00-2 2v4a2 2 0 002 2h1v2a1 1 0 001 1h6a1 1 0 001-1v-2h1a2 2 0 002-2V6a2 2 0 00-2-2h-1V2a1 1 0 00-1-1H5zm0 1.5h6v1.5H5V2.5zm-2 4a.5.5 0 11-1 0 .5.5 0 011 0zm2 4.5v3h6v-3H5z"/>
					</svg>
					Print
				</button>
				<div class="dropdown-divider"></div>
				<button class="dropdown-item" onclick={handleExport}>
					<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
						<path d="M8.75 1a.75.75 0 00-1.5 0v6.59L5.53 5.87a.75.75 0 00-1.06 1.06l3 3a.75.75 0 001.06 0l3-3a.75.75 0 00-1.06-1.06L8.75 7.59V1zM1.5 10.75a.75.75 0 111.5 0v2.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25v-2.5a.75.75 0 111.5 0v2.5A1.75 1.75 0 0112.75 15h-9.5A1.75 1.75 0 011.5 13.25v-2.5z"/>
					</svg>
					Export Backup
				</button>
				<button class="dropdown-item" onclick={handleImportClick}>
					<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
						<path d="M8.75 1.75a.75.75 0 00-1.5 0V7H2.75a.75.75 0 000 1.5h4.5v5.25a.75.75 0 001.5 0V8.5h4.5a.75.75 0 000-1.5h-4.5V1.75z"/>
					</svg>
					Import Backup
				</button>
				<div class="dropdown-divider"></div>
				<button class="dropdown-item" onclick={toggleAutoHide}>
					<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
						{#if appState.autoHideUI}
							<path d="M10.97 4.97a.75.75 0 011.07 1.05l-3.99 4.99a.75.75 0 01-1.08.02L4.324 8.384a.75.75 0 111.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 01.02-.022z"/>
						{/if}
					</svg>
					Auto-hide UI
					{#if appState.autoHideUI}
						<span class="check-mark">✓</span>
					{/if}
				</button>
				<button class="dropdown-item" onclick={toggleWordWrap}>
					<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
						{#if appState.wordWrap}
							<path d="M10.97 4.97a.75.75 0 011.07 1.05l-3.99 4.99a.75.75 0 01-1.08.02L4.324 8.384a.75.75 0 111.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 01.02-.022z"/>
						{/if}
					</svg>
					Word Wrap
					{#if appState.wordWrap}
						<span class="check-mark">✓</span>
					{/if}
				</button>
				<button class="dropdown-item" onclick={() => { onResetLayout?.(); closeMenus(); }}>
					<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
						<path d="M5.56 7.56H4.5a.5.5 0 000 1h2a.5.5 0 00.5-.5v-2a.5.5 0 00-1 0v.59c-.41-.59-.97-1.06-1.63-1.37A4.5 4.5 0 001 9.5a4.5 4.5 0 004.5 4.5 4.5 4.5 0 004.4-3.5H8.86a3.5 3.5 0 01-6.72 0A3.5 3.5 0 015.5 6.5c.53 0 1.03.12 1.48.32l.58-.74zM8 1.5a6.5 6.5 0 016.5 6.5 6.5 6.5 0 01-.15 1.38l-.97-.24c.08-.37.12-.75.12-1.14a5.5 5.5 0 00-11 0c0 .39.04.77.12 1.14l-.97.24A6.5 6.5 0 011.5 8 6.5 6.5 0 018 1.5z"/>
					</svg>
					Reset Layout
				</button>
				<div class="dropdown-divider"></div>
				<button class="dropdown-item" onclick={handleHelp}>
					<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
						<path d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-6.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM6.92 6.085h.001a.749.749 0 11-1.342-.67c.169-.339.436-.701.849-.977C6.845 4.16 7.369 4 8 4a2.756 2.756 0 011.637.525c.503.377.863.965.863 1.725 0 .448-.115.83-.329 1.15-.205.307-.47.513-.692.662-.109.072-.22.138-.313.195l-.006.004a6.24 6.24 0 00-.26.16.952.952 0 00-.276.245.75.75 0 01-1.248-.832c.184-.264.42-.489.692-.661.103-.067.207-.132.313-.195l.007-.004c.1-.061.182-.11.258-.161a.969.969 0 00.277-.245A.73.73 0 009.25 6.25a.753.753 0 00-.287-.543 1.267 1.267 0 00-.753-.227c-.369 0-.622.106-.808.234a1.294 1.294 0 00-.413.496zm.08 6.165h1.998v-1.498H7v1.498z"/>
					</svg>
					Help / Reset Welcome
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		background: #161b22;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		overflow-y: visible;
		scrollbar-width: none;
		-ms-overflow-style: none;
		position: relative;
	}

	.toolbar::-webkit-scrollbar {
		display: none;
	}

	.toolbar-group {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}

	.toolbar-divider {
		width: 1px;
		height: 20px;
		background: #30363d;
		margin: 0 6px;
		flex-shrink: 0;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		color: #c9d1d9;
		cursor: pointer;
		border-radius: 6px;
		transition: background-color 0.1s;
	}

	.toolbar-btn:hover:not(:disabled) {
		background: #21262d;
	}

	.toolbar-btn:active:not(:disabled) {
		background: #30363d;
	}

	.toolbar-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.text-btn {
		font-size: 11px;
		font-weight: 600;
	}

	/* Dropdown styles */
	.dropdown-wrapper {
		position: relative;
		z-index: 1000;
	}

	.dropdown-btn {
		width: auto;
		padding: 0 6px;
		gap: 2px;
	}

	.dropdown-arrow {
		opacity: 0.7;
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 4px;
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 6px;
		padding: 4px 0;
		min-width: 160px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		z-index: 1000;
	}

	.dropdown-menu-fixed {
		position: fixed;
		margin-top: 0;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: transparent;
		color: #c9d1d9;
		font-size: 13px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.dropdown-item:hover {
		background: #21262d;
	}

	.dropdown-item svg {
		flex-shrink: 0;
		color: #8b949e;
	}

	.dropdown-divider {
		height: 1px;
		background: #30363d;
		margin: 4px 0;
	}

	.check-mark {
		margin-left: auto;
		color: #3fb950;
	}

	.dropdown-icon {
		width: 20px;
		text-align: center;
	}

	/* Responsive toolbar - hide less important items on smaller screens */
	@media (max-width: 900px) {
		/* Hide H3 and some dividers */
		.toolbar-group:nth-child(4) button:nth-child(3) {
			display: none;
		}
	}

	@media (max-width: 768px) {
		.toolbar {
			padding: 4px 0;
			gap: 2px;
		}

		.toolbar-divider {
			margin: 0 2px;
		}

		.toolbar-btn {
			width: 26px;
			height: 26px;
		}
	}

	@media (max-width: 600px) {
		.toolbar {
			padding: 4px 0;
			gap: 1px;
		}

		.toolbar-btn {
			width: 24px;
			height: 24px;
		}

		.toolbar-divider {
			margin: 0 2px;
			height: 16px;
		}

		.text-btn {
			font-size: 10px;
		}
	}

	@media (max-width: 480px) {
		.toolbar {
			padding: 2px 0;
		}

		.toolbar-btn {
			width: 22px;
			height: 22px;
		}

		.dropdown-btn {
			padding: 0 4px;
		}

		.dropdown-arrow {
			width: 8px;
			height: 8px;
		}
	}
</style>

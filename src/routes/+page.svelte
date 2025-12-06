<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, Editor, Preview, Sidebar, Toolbar } from '$lib';
	import { extractTableOfContents } from '$lib/markdown';
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

	// Table of Contents state (persisted)
	let showTOC = $state(false);
	let activeHeadingId = $state<string | null>(null);
	interface TOCItem {
		level: number;
		text: string;
		id: string;
	}
	let tocItems = $state<TOCItem[]>([]);

	// Load TOC state from localStorage
	function loadTOCState() {
		if (typeof localStorage !== 'undefined') {
			const savedTOC = localStorage.getItem('showTOC');
			if (savedTOC !== null) showTOC = savedTOC === 'true';
		}
	}

	// Save TOC state to localStorage
	function saveTOCState() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('showTOC', String(showTOC));
		}
	}

	// Track active heading on scroll
	function updateActiveHeading() {
		if (tocItems.length === 0) return;
		
		const previewPane = document.querySelector('.preview-pane');
		if (!previewPane) return;
		
		const headings = tocItems.map(item => document.getElementById(item.id)).filter(Boolean) as HTMLElement[];
		if (headings.length === 0) return;

		let currentActive: string | null = null;
		const previewRect = previewPane.getBoundingClientRect();
		const offset = 100; // Offset from top of preview pane to consider heading as active

		for (const heading of headings) {
			const rect = heading.getBoundingClientRect();
			// Calculate position relative to the preview pane
			const relativeTop = rect.top - previewRect.top;
			if (relativeTop <= offset) {
				currentActive = heading.id;
			}
		}

		// If no heading is above the threshold, use the first one
		if (!currentActive && headings.length > 0) {
			currentActive = headings[0].id;
		}

		activeHeadingId = currentActive;
	}

	// Extract TOC from markdown content using AST-based extraction
	// This properly handles duplicates and ignores # symbols in code blocks
	// Uses the same slug generation as the HTML renderer (github-slugger)
	$effect(() => {
		if (appState.buffer) {
			const tocFromAST = extractTableOfContents(appState.buffer);
			tocItems = tocFromAST.map(item => ({
				level: item.level,
				text: item.text,
				id: item.id
			}));
		} else {
			tocItems = [];
		}
	});

	// Auto-hide UI effect: hide sidebar/toolbar when enabled, show when disabled
	$effect(() => {
		if (appState.autoHideUI) {
			// When auto-hide is enabled, hide the UI elements
			showSidebar = false;
			showToolbar = false;
		} else {
			// When auto-hide is disabled, show the UI elements and restore sidebar state
			showSidebar = true;
			showToolbar = true;
			showDesktopSidebar = true;
		}
	});

	// Scroll to heading in preview
	function scrollToHeading(id: string) {
		const element = document.getElementById(id);
		if (element) {
			// Find the scrollable preview container (the div with overflow)
			const previewContainer = element.closest('.preview-container');
			if (previewContainer) {
				// Calculate position relative to the scroll container
				const containerRect = previewContainer.getBoundingClientRect();
				const elementRect = element.getBoundingClientRect();
				const scrollTop = previewContainer.scrollTop + (elementRect.top - containerRect.top) - 20;
				previewContainer.scrollTo({
					top: scrollTop,
					behavior: 'smooth'
				});
			}
		}
		// Close TOC on mobile after clicking
		if (window.innerWidth < 768) {
			showTOC = false;
		}
	}

	// Responsive state
	let isMobile = $state(false);
	let showMobileSidebar = $state(false);
	let showDesktopSidebar = $state(true);

	onMount(() => {
		// Check if mobile on mount
		const checkMobile = () => {
			isMobile = window.innerWidth < 768;
			if (!isMobile) {
				showMobileSidebar = false;
			}
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		
		// Re-measure sections on window resize (affects wrapped text)
		let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
		const handleResize = () => {
			if (resizeTimeout) clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				syncSectionDimensions();
			}, 200);
		};
		window.addEventListener('resize', handleResize);
		
		return () => {
			window.removeEventListener('resize', checkMobile);
			window.removeEventListener('resize', handleResize);
			if (resizeTimeout) clearTimeout(resizeTimeout);
		};
	});

	// Resizable pane state (persisted in localStorage)
	const DEFAULT_SIDEBAR_WIDTH = 250;
	const DEFAULT_EDITOR_PERCENT = 50;
	const DEFAULT_SHOW_SIDEBAR = true;
	const DEFAULT_TOC_WIDTH = 250;
	
	let sidebarWidth = $state(DEFAULT_SIDEBAR_WIDTH);
	let editorWidthPercent = $state(DEFAULT_EDITOR_PERCENT);
	let tocWidth = $state(DEFAULT_TOC_WIDTH);
	let isResizingSidebar = $state(false);
	let isResizingEditor = $state(false);
	let isResizingTOC = $state(false);

	// Load saved layout from localStorage
	function loadLayoutState() {
		if (typeof localStorage !== 'undefined') {
			const savedSidebar = localStorage.getItem('sidebarWidth');
			const savedEditor = localStorage.getItem('editorWidthPercent');
			const savedShowSidebar = localStorage.getItem('showDesktopSidebar');
			const savedTocWidth = localStorage.getItem('tocWidth');
			if (savedSidebar) sidebarWidth = Number(savedSidebar);
			if (savedEditor) editorWidthPercent = Number(savedEditor);
			if (savedShowSidebar !== null) showDesktopSidebar = savedShowSidebar === 'true';
			if (savedTocWidth) tocWidth = Number(savedTocWidth);
		}
	}

	// Save layout state to localStorage
	function saveLayoutState() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('sidebarWidth', String(sidebarWidth));
			localStorage.setItem('editorWidthPercent', String(editorWidthPercent));
			localStorage.setItem('showDesktopSidebar', String(showDesktopSidebar));
			localStorage.setItem('tocWidth', String(tocWidth));
		}
	}

	// Reset layout to defaults
	function resetLayout() {
		sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
		editorWidthPercent = DEFAULT_EDITOR_PERCENT;
		showDesktopSidebar = DEFAULT_SHOW_SIDEBAR;
		tocWidth = DEFAULT_TOC_WIDTH;
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem('sidebarWidth');
			localStorage.removeItem('editorWidthPercent');
			localStorage.removeItem('showDesktopSidebar');
			localStorage.removeItem('tocWidth');
		}
	}

	onMount(async () => {
		loadLayoutState();
		loadTOCState();
		await appState.initialize();
		
		// Initial section measurement after a short delay to ensure DOM is ready
		setTimeout(() => {
			syncSectionDimensions();
		}, 500);
	});

	// Re-measure sections when word wrap changes (line heights change with wrapping)
	$effect(() => {
		// Access wordWrap to create dependency
		const _wordWrap = appState.wordWrap;
		
		// Use animation frames to allow editor to update its layout
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					syncSectionDimensions();
				});
			});
		});
	});

	// Re-measure sections when sidebar or view mode changes (affects editor width)
	$effect(() => {
		// Create dependencies on layout changes that affect width
		const _showDesktopSidebar = showDesktopSidebar;
		const _viewOnlyMode = appState.viewOnlyMode;
		
		// Skip initial run
		if (!editorRef || !previewRef) return;
		
		// Use animation frames to allow layout to settle
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					syncSectionDimensions();
				});
			});
		});
	});

	// Track which pane initiated the scroll to prevent feedback loops
	let scrollSource: 'editor' | 'preview' | null = null;
	let scrollSourceTimeout: ReturnType<typeof setTimeout> | null = null;
	let measureSectionsTimeout: ReturnType<typeof setTimeout> | null = null;
	let scrollRemeasureTimeout: ReturnType<typeof setTimeout> | null = null;
	let isResizingLayout = $derived(isResizingSidebar || isResizingEditor || isResizingTOC);

	// Debounced re-measure to refresh CodeMirror's height map as the user scrolls
	function scheduleScrollRemeasure() {
		if (scrollRemeasureTimeout) return;
		scrollRemeasureTimeout = setTimeout(() => {
			syncSectionDimensions();
			scrollRemeasureTimeout = null;
		}, 120);
	}

	function handleEditorChange(content: string) {
		appState.updateBuffer(content);
		
		// Schedule section measurement after content changes
		if (measureSectionsTimeout) {
			clearTimeout(measureSectionsTimeout);
		}
		measureSectionsTimeout = setTimeout(() => {
			syncSectionDimensions();
		}, 100);
	}

	// Sync section dimensions between editor and preview
	function syncSectionDimensions() {
		if (!editorRef || !previewRef) return;
		
		// Get section info from preview (which has the block line ranges)
		const previewSections = previewRef.getSectionInfo?.() || [];
		
		if (previewSections.length > 0) {
			// Measure corresponding sections in editor
			const sections = previewSections.map(s => ({ 
				startLine: s.startLine, 
				endLine: s.endLine 
			}));
			editorRef.measureSections?.(sections);
		}
	}

	// Track last scroll positions to avoid micro-updates
	let lastEditorScrollTop = 0;
	let lastPreviewScrollTop = 0;
	
	// Dynamic scroll threshold based on viewport (0.05% of client height, min 0.5px, max 2px)
	function getScrollSyncThreshold(): number {
		const editorDims = editorRef?.getScrollDimensions?.();
		if (!editorDims) return 0.5;
		return Math.max(0.5, Math.min(2, editorDims.clientHeight * 0.0005));
	}

	// Section descriptor linking editor and preview dimensions
	interface SectionDesc {
		editorDimension: { startOffset: number; endOffset: number; height: number };
		previewDimension: { startOffset: number; endOffset: number; height: number };
	}

	// Build section descriptors for scroll mapping
	interface ScrollMappingData {
		sections: SectionDesc[];
	}

	// Build scroll mapping data
	function buildScrollMapping(): ScrollMappingData | null {
		const editorSections = editorRef?.getEditorSections?.() || [];
		const previewSections = previewRef?.getSectionInfo?.() || [];
		
		if (editorSections.length === 0 || previewSections.length === 0) return null;
		
		const numSections = Math.min(editorSections.length, previewSections.length);
		const sections: SectionDesc[] = [];
		
		for (let i = 0; i < numSections; i++) {
			sections.push({
				editorDimension: editorSections[i].editorDimension,
				previewDimension: previewSections[i].previewDimension
			});
		}
		
		return { sections };
	}

	// Map scroll position from editor to preview using viewport-relative anchors
	// The key insight: we create anchor points where each section's START reaches the viewport TOP.
	// For the editor, scrollTop = section.startOffset means that section is at viewport top.
	// For the preview, scrollTop = section.startOffset means that section is at viewport top.
	// We also need to ensure scrolling to the END of editor maps to END of preview.
	function syncEditorToPreview(editorScrollTop: number): number | null {
		const mapping = buildScrollMapping();
		if (!mapping || mapping.sections.length === 0) return null;
		
		const previewDims = previewRef?.getScrollDimensions?.();
		const editorDims = editorRef?.getScrollDimensions?.();
		if (!previewDims || !editorDims) return null;
		
		const previewMaxScroll = previewDims.scrollHeight - previewDims.clientHeight;
		const editorMaxScroll = editorDims.scrollHeight - editorDims.clientHeight;
		const { sections } = mapping;
		
		// Edge cases - handle zero or very small scroll ranges
		if (editorMaxScroll <= 1) return 0;
		if (previewMaxScroll <= 1) return 0;
		
		// Quick path for start and end
		if (editorScrollTop <= 0) return 0;
		if (editorScrollTop >= editorMaxScroll - 1) return previewMaxScroll;
		
		// Find which section we're currently in based on scroll position
		// A section is "at viewport top" when scrollTop >= section.startOffset
		let currentSectionIdx = 0;
		for (let i = 0; i < sections.length; i++) {
			if (editorScrollTop >= sections[i].editorDimension.startOffset) {
				currentSectionIdx = i;
			} else {
				break;
			}
		}
		
		const currentSection = sections[currentSectionIdx];
		const nextSection = sections[currentSectionIdx + 1];
		
		// Calculate how far we are within the current section (0 to 1)
		let posInSection = 0;
		const sectionStart = currentSection.editorDimension.startOffset;
		
		if (nextSection) {
			const sectionEnd = nextSection.editorDimension.startOffset;
			const sectionRange = sectionEnd - sectionStart;
			if (sectionRange > 0) {
				posInSection = Math.max(0, Math.min(1, (editorScrollTop - sectionStart) / sectionRange));
			}
		} else {
			// Last section - interpolate to document end (editorMaxScroll)
			// Use the actual section height or distance to max scroll, whichever is larger
			const sectionHeight = currentSection.editorDimension.height;
			const distanceToEnd = editorMaxScroll - sectionStart;
			const effectiveRange = Math.max(sectionHeight, distanceToEnd);
			
			if (effectiveRange > 0) {
				posInSection = Math.max(0, Math.min(1, (editorScrollTop - sectionStart) / effectiveRange));
			}
		}
		
		// Map to preview: find corresponding position
		const previewSectionStart = currentSection.previewDimension.startOffset;
		let previewScrollTop: number;
		
		if (nextSection) {
			const previewSectionEnd = nextSection.previewDimension.startOffset;
			previewScrollTop = previewSectionStart + (previewSectionEnd - previewSectionStart) * posInSection;
		} else {
			// Last section - map to document end
			const sectionHeight = currentSection.previewDimension.height;
			const distanceToEnd = previewMaxScroll - previewSectionStart;
			const effectiveRange = Math.max(sectionHeight, distanceToEnd);
			
			previewScrollTop = previewSectionStart + effectiveRange * posInSection;
		}
		
		return Math.min(Math.max(0, previewScrollTop), previewMaxScroll);
	}

	// Map scroll position from preview to editor (mirror of above)
	function syncPreviewToEditor(previewScrollTop: number): number | null {
		const mapping = buildScrollMapping();
		if (!mapping || mapping.sections.length === 0) return null;
		
		const editorDims = editorRef?.getScrollDimensions?.();
		const previewDims = previewRef?.getScrollDimensions?.();
		if (!editorDims || !previewDims) return null;
		
		const editorMaxScroll = editorDims.scrollHeight - editorDims.clientHeight;
		const previewMaxScroll = previewDims.scrollHeight - previewDims.clientHeight;
		const { sections } = mapping;
		
		// Edge cases - handle zero or very small scroll ranges
		if (previewMaxScroll <= 1) return 0;
		if (editorMaxScroll <= 1) return 0;
		
		// Quick path for start and end
		if (previewScrollTop <= 0) return 0;
		if (previewScrollTop >= previewMaxScroll - 1) return editorMaxScroll;
		
		// Find which section we're currently in based on scroll position
		let currentSectionIdx = 0;
		for (let i = 0; i < sections.length; i++) {
			if (previewScrollTop >= sections[i].previewDimension.startOffset) {
				currentSectionIdx = i;
			} else {
				break;
			}
		}
		
		const currentSection = sections[currentSectionIdx];
		const nextSection = sections[currentSectionIdx + 1];
		
		// Calculate how far we are within the current section (0 to 1)
		let posInSection = 0;
		const sectionStart = currentSection.previewDimension.startOffset;
		
		if (nextSection) {
			const sectionEnd = nextSection.previewDimension.startOffset;
			const sectionRange = sectionEnd - sectionStart;
			if (sectionRange > 0) {
				posInSection = Math.max(0, Math.min(1, (previewScrollTop - sectionStart) / sectionRange));
			}
		} else {
			// Last section - interpolate to document end (previewMaxScroll)
			// Use the actual section height or distance to max scroll, whichever is larger
			const sectionHeight = currentSection.previewDimension.height;
			const distanceToEnd = previewMaxScroll - sectionStart;
			const effectiveRange = Math.max(sectionHeight, distanceToEnd);
			
			if (effectiveRange > 0) {
				posInSection = Math.max(0, Math.min(1, (previewScrollTop - sectionStart) / effectiveRange));
			}
		}
		
		// Map to editor: find corresponding position
		const editorSectionStart = currentSection.editorDimension.startOffset;
		let editorScrollTop: number;
		
		if (nextSection) {
			const editorSectionEnd = nextSection.editorDimension.startOffset;
			editorScrollTop = editorSectionStart + (editorSectionEnd - editorSectionStart) * posInSection;
		} else {
			// Last section - map to document end
			const sectionHeight = currentSection.editorDimension.height;
			const distanceToEnd = editorMaxScroll - editorSectionStart;
			const effectiveRange = Math.max(sectionHeight, distanceToEnd);
			
			editorScrollTop = editorSectionStart + effectiveRange * posInSection;
		}
		
		return Math.min(Math.max(0, editorScrollTop), editorMaxScroll);
	}

	// Real-time scroll sync: Editor → Preview
	function handleEditorScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
		if (!appState.syncScrollEnabled) return;
		if (scrollSource === 'preview') return;
		if (isResizingLayout) return; // Don't sync during resize
		scheduleScrollRemeasure();
		
		// Skip micro-updates
		const threshold = getScrollSyncThreshold();
		if (Math.abs(scrollInfo.scrollTop - lastEditorScrollTop) < threshold) return;
		lastEditorScrollTop = scrollInfo.scrollTop;
		
		// Mark editor as scroll source
		scrollSource = 'editor';
		if (scrollSourceTimeout) clearTimeout(scrollSourceTimeout);
		scrollSourceTimeout = setTimeout(() => { scrollSource = null; }, 100);
		
		// Use StackEdit-style section-based sync
		const targetScroll = syncEditorToPreview(scrollInfo.scrollTop);
		if (targetScroll !== null && previewRef) {
			previewRef.scrollToOffset(targetScroll);
		} else {
			// Fallback to percentage-based
			const maxScroll = scrollInfo.scrollHeight - scrollInfo.clientHeight;
			const percent = maxScroll > 0 ? scrollInfo.scrollTop / maxScroll : 0;
			previewRef?.scrollToPercent(percent);
		}
	}

	// Real-time scroll sync: Preview → Editor (StackEdit-style)
	function handlePreviewScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
		if (!appState.syncScrollEnabled) return;
		if (scrollSource === 'editor') return;
		if (isResizingLayout) return; // Don't sync during resize
		scheduleScrollRemeasure();
		
		// Skip micro-updates
		const threshold = getScrollSyncThreshold();
		if (Math.abs(scrollInfo.scrollTop - lastPreviewScrollTop) < threshold) return;
		lastPreviewScrollTop = scrollInfo.scrollTop;
		
		// Mark preview as scroll source
		scrollSource = 'preview';
		if (scrollSourceTimeout) clearTimeout(scrollSourceTimeout);
		scrollSourceTimeout = setTimeout(() => { scrollSource = null; }, 100);
		
		// Use StackEdit-style section-based sync
		const targetScroll = syncPreviewToEditor(scrollInfo.scrollTop);
		if (targetScroll !== null && editorRef) {
			editorRef.scrollToOffset(targetScroll);
		} else {
			// Fallback to percentage-based
			const maxScroll = scrollInfo.scrollHeight - scrollInfo.clientHeight;
			const percent = maxScroll > 0 ? scrollInfo.scrollTop / maxScroll : 0;
			editorRef?.scrollToPercent(percent);
		}
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

		// Check if hovering over a dropdown menu or toolbar
		const target = event.target as HTMLElement;
		const isInDropdown = target.closest('.dropdown-menu') !== null || 
		                     target.closest('.toolbar') !== null ||
		                     target.closest('.toolbar-row') !== null;

		// Sidebar: trigger at the very edge (10px), stay visible while hovering over sidebar
		const isInSidebar = target.closest('.sidebar-wrapper') !== null;
		const atLeftEdge = x <= 10;
		mouseNearSidebar = atLeftEdge || isInSidebar;
		showSidebar = atLeftEdge || isInSidebar;

		// Toolbar: trigger at the very top edge (10px), stay visible while hovering over toolbar
		const atTopEdge = y <= 10;
		mouseNearToolbar = atTopEdge || isInDropdown;
		showToolbar = atTopEdge || isInDropdown;
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
						padding-top: 0 !important;
					}
					pre, code {
						background: #f6f8fa !important;
					}
					/* Hide copy button in print */
					.copy-code-btn {
						display: none !important;
					}
					/* Code block wrapper - remove extra styling for print */
					.code-block-wrapper {
						position: static;
						margin: 16px 0;
					}
					/* Fix pre tag wrapping Mermaid - neutralize whitespace preservation */
					.code-block-wrapper pre:has(.mermaid),
					pre:has(.mermaid) {
						white-space: normal !important;
						background: transparent !important;
						border: none !important;
						padding: 0 !important;
						margin: 0 !important;
						overflow: visible !important;
					}
					/* Mermaid diagram styling for print */
					.mermaid {
						text-align: center;
						margin: 1em 0 !important;
						padding: 0 !important;
						background: transparent;
						page-break-inside: auto;
						overflow: visible !important;
						height: auto !important;
						width: 100% !important;
					}
					.mermaid svg {
						max-width: 100% !important;
						width: 100% !important;
						height: auto !important;
						max-height: 100% !important;
						display: block;
						margin: 0 auto;
					}
					/* KaTeX display math styling */
					.katex-display {
						display: block;
						margin: 1em 0;
						text-align: center;
						overflow-x: auto;
						overflow-y: hidden;
					}
					.katex-display > .katex {
						display: inline-block;
						text-align: initial;
					}
					/* Ensure KaTeX inline math doesn't break */
					.katex {
						font-size: 1.1em;
					}
					@media print {
						body { padding: 20px; }
						.katex-display {
							page-break-inside: avoid;
						}
						/* Reset the pre tag to remove whitespace/padding issues */
						.code-block-wrapper pre {
							white-space: normal !important;
							background: transparent !important;
							border: none !important;
						}
						.mermaid {
							page-break-inside: avoid;
							margin: 1em 0 !important;
							padding: 0 !important;
							height: auto !important;
						}
						.mermaid svg {
							max-width: 100% !important;
							width: 100% !important;
							height: auto !important;
						}
					}
				</style>
			</head>
			<body class="markdown-body">
				${content}
			</body>
			</html>
		`);
		
		printWindow.document.close();
		
		// Wait for stylesheets and fonts to load before printing
		setTimeout(() => {
			printWindow.print();
		}, 500);
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

	// TOC resize handlers
	function startTOCResize(event: MouseEvent) {
		event.preventDefault();
		isResizingTOC = true;
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

		if (isResizingTOC) {
			// Calculate width from right edge of window
			const newWidth = Math.max(150, Math.min(400, window.innerWidth - event.clientX));
			tocWidth = newWidth;
		}
	}

	// Handle mouse up to stop resizing
	function handleResizeEnd() {
		if (isResizingSidebar || isResizingEditor || isResizingTOC) {
			const needsRemeasure = isResizingSidebar || isResizingEditor;
			isResizingSidebar = false;
			isResizingEditor = false;
			isResizingTOC = false;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			saveLayoutState();
			
			// Re-measure sections after resize (affects wrapped text width)
			if (needsRemeasure) {
				// Use multiple animation frames to ensure layout has settled
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							syncSectionDimensions();
						});
					});
				});
			}
		}
	}

	// Import backup from empty state
	let emptyStateFileInput = $state<HTMLInputElement | null>(null);
	
	function handleEmptyStateImportClick() {
		emptyStateFileInput?.click();
	}
	
	async function handleEmptyStateImportFile(event: Event) {
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
	
	async function handleEmptyStateNewFile() {
		await appState.newFile(null, 'Untitled');
	}
</script>

<svelte:window 
	onkeydown={handleKeydown} 
	onmousemove={(e) => { handleMouseMove(e); handleResizeMove(e); }}
	onmouseup={handleResizeEnd}
/>

<div class="app" class:auto-hide={appState.autoHideUI} class:resizing={isResizingSidebar || isResizingEditor} class:mobile={isMobile} class:sidebar-collapsed={!showDesktopSidebar && !isMobile}>
	{#if appState.isInitialized}
		<!-- Mobile sidebar overlay -->
		{#if isMobile && showMobileSidebar}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div 
				class="mobile-overlay" 
				onclick={() => { showMobileSidebar = false; }}
				role="button"
				tabindex="-1"
				aria-label="Close sidebar"
			></div>
		{/if}
		
		<div 
			class="sidebar-wrapper" 
			class:hidden={isMobile ? !showMobileSidebar : (appState.autoHideUI ? !showSidebar : !showDesktopSidebar)}
			class:mobile-sidebar={isMobile}
			style={isMobile ? '' : `width: ${appState.autoHideUI ? (showSidebar ? sidebarWidth : 0) : (showDesktopSidebar ? sidebarWidth : 0)}px;`}
		>
			<Sidebar />
			{#if !isMobile && (appState.autoHideUI ? showSidebar : showDesktopSidebar)}
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div 
					class="resize-handle resize-handle-sidebar"
					onmousedown={startSidebarResize}
					role="separator"
					aria-orientation="vertical"
				></div>
			{/if}
		</div>
	{/if}

	<main class="main-content">
		{#if appState.activeFile}
			<div class="toolbar-row" class:hidden={appState.autoHideUI && !showToolbar}>
				<button 
					class="sidebar-toggle-btn" 
					title={isMobile ? 'Toggle sidebar' : (showDesktopSidebar ? 'Hide sidebar' : 'Show sidebar')}
					onclick={() => {
						if (isMobile) {
							showMobileSidebar = !showMobileSidebar;
						} else {
							showDesktopSidebar = !showDesktopSidebar;
							saveLayoutState();
						}
					}}
				>
					<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
						<path d="M1 2.75A.75.75 0 011.75 2h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 2.75zm0 5A.75.75 0 011.75 7h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 7.75zM1.75 12a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75z"/>
					</svg>
				</button>
				<Toolbar editor={editorRef} onPrint={handlePrint} onResetLayout={resetLayout} />
				<div class="status-area">
					<button 
						class="toc-btn" 
						class:active={showTOC}
						title="Table of Contents" 
						onclick={() => { showTOC = !showTOC; saveTOCState(); }}
						disabled={tocItems.length === 0}
					>
						<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
							<path d="M2 4a1 1 0 100-2 1 1 0 000 2zm3.75-1.5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zM3 8a1 1 0 11-2 0 1 1 0 012 0zm-1 6a1 1 0 100-2 1 1 0 000 2z"/>
						</svg>
					</button>
					<button 
						class="view-toggle-btn" 
						class:active={appState.viewOnlyMode}
						title={appState.viewOnlyMode ? 'Switch to Edit Mode' : 'Switch to View Only'}
						onclick={() => appState.toggleViewOnlyMode()}
					>
						{#if appState.viewOnlyMode}
							<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
								<path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 010 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.831.88 9.577.43 8.9a1.62 1.62 0 010-1.798c.45-.678 1.367-1.932 2.637-3.023C4.33 2.992 6.019 2 8 2zM1.679 7.932a.12.12 0 000 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 000-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717zM8 10a2 2 0 110-4 2 2 0 010 4z"/>
							</svg>
						{:else}
							<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
								<path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.46 11.1a.25.25 0 00-.064.108l-.457 1.6 1.6-.457a.25.25 0 00.108-.064l8.61-8.61a.25.25 0 000-.354l-1.086-1.086z"/>
							</svg>
						{/if}
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

			<div class="editor-preview-wrapper">
				<div class="editor-preview-container">
					{#if !appState.viewOnlyMode && !isMobile}
						<!-- Desktop: Show editor when not in view-only mode -->
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
					{#if isMobile}
						<!-- Mobile: Show either editor or preview based on view mode -->
						{#if appState.viewOnlyMode}
							<div class="preview-pane full-width">
								<Preview
									bind:this={previewRef}
									content={appState.buffer}
									onscroll={(e) => { handlePreviewScroll(e); updateActiveHeading(); }}
									ondimensionschange={syncSectionDimensions}
								/>
							</div>
						{:else}
							<div class="editor-pane full-width">
								<Editor
									bind:this={editorRef}
									value={appState.buffer}
									onchange={handleEditorChange}
									onscroll={handleEditorScroll}
									ondimensionschange={syncSectionDimensions}
								/>
							</div>
						{/if}
					{:else}
						<!-- Desktop: Always show preview -->
						<div class="preview-pane" class:full-width={appState.viewOnlyMode}>
							<Preview
								bind:this={previewRef}
								content={appState.buffer}
								onscroll={(e) => { handlePreviewScroll(e); updateActiveHeading(); }}
								ondimensionschange={syncSectionDimensions}
							/>
						</div>
					{/if}
				</div>

				<!-- Table of Contents Panel (Right side) -->
				{#if showTOC && tocItems.length > 0}
					<aside class="toc-panel" style="width: {tocWidth}px;">
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<div 
							class="toc-resize-handle"
							onmousedown={startTOCResize}
							role="separator"
							aria-orientation="vertical"
						></div>
						<div class="toc-header">
							<span>Table of Contents</span>
							<button class="toc-close" onclick={() => { showTOC = false; saveTOCState(); }} aria-label="Close table of contents">
								<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
									<path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
								</svg>
							</button>
						</div>
						<nav class="toc-list">
							{#each tocItems as item}
								<button 
									class="toc-item toc-level-{item.level}"
									class:active={activeHeadingId === item.id}
									onclick={() => scrollToHeading(item.id)}
								>
									{item.text}
								</button>
							{/each}
						</nav>
					</aside>
				{/if}
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
					<svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64" class="empty-icon">
						<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
					</svg>
					<h2>Welcome to SvelteMark</h2>
					<p>A beautiful markdown editor with live preview</p>
					<div class="empty-actions">
						<button class="empty-btn primary" onclick={handleEmptyStateNewFile}>
							<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
								<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
							</svg>
							New File
						</button>
						<button class="empty-btn secondary" onclick={handleEmptyStateImportClick}>
							<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
								<path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
							</svg>
							Import Backup
						</button>
					</div>
					<p class="hint">Or select a file from the sidebar</p>
				</div>
				<input 
					type="file" 
					accept=".json" 
					bind:this={emptyStateFileInput}
					onchange={handleEmptyStateImportFile}
					style="display: none;"
				/>
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
		scroll-behavior: smooth;

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
		overflow: visible;
	}

	.toolbar-row {
		display: flex;
		align-items: center;
		background: #161b22;
		border-bottom: 1px solid #30363d;
		height: 41px;
		min-height: 41px;
		box-sizing: border-box;
		transition: transform 0.2s ease, opacity 0.2s ease;
		position: relative;
		z-index: 100;
		overflow: visible;
	}

	.status-area {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		font-size: 12px;
		flex-shrink: 0;
		margin-left: auto;
		position: relative;
		z-index: 10;
	}

	/* View toggle button */
	.view-toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		background: transparent;
		color: #8b949e;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.15s, color 0.15s;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
	}

	.view-toggle-btn:hover {
		background: #21262d;
		color: #c9d1d9;
	}

	.view-toggle-btn.active {
		background: #238636;
		color: #ffffff;
	}

	/* Desktop/Mobile visibility helpers */
	.desktop-only {
		display: flex;
	}

	.mobile-only {
		display: none;
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

	/* Editor/Preview wrapper with TOC */
	.editor-preview-wrapper {
		background-color: #0d1117;
		flex: 1;
		display: flex;
		overflow: hidden;
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

	.editor-pane.full-width {
		flex: 1;
		min-width: 0;
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

	/* Table of Contents Panel (Right side) */
	.toc-panel {
		min-width: 150px;
		max-width: 400px;
		background: #161b22;
		border-left: 1px solid #30363d;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		flex-shrink: 0;
		position: relative;
	}

	.toc-resize-handle {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		cursor: col-resize;
		background: transparent;
		transition: background-color 0.15s;
		z-index: 10;
	}

	.toc-resize-handle:hover {
		background: #58a6ff;
	}

	.toc-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px;
		font-size: 12px;
		font-weight: 600;
		color: #8b949e;
		border-bottom: 1px solid #30363d;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.toc-close {
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

	.toc-close:hover {
		background: #21262d;
		color: #c9d1d9;
	}

	.toc-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.toc-item {
		display: block;
		width: 100%;
		padding: 6px 12px;
		border: none;
		background: transparent;
		color: #c9d1d9;
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.15s, color 0.15s;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.toc-item:hover {
		background: #21262d;
		color: #58a6ff;
	}

	.toc-item.active {
		background: #1f6feb22;
		color: #58a6ff;
		border-left: 2px solid #58a6ff;
	}

	.toc-level-1 { padding-left: 12px; font-weight: 600; }
	.toc-level-2 { padding-left: 24px; }
	.toc-level-3 { padding-left: 36px; font-size: 12px; }
	.toc-level-4 { padding-left: 48px; font-size: 12px; color: #8b949e; }
	.toc-level-5 { padding-left: 60px; font-size: 11px; color: #8b949e; }
	.toc-level-6 { padding-left: 72px; font-size: 11px; color: #8b949e; }

	.toc-level-1.active { padding-left: 10px; }
	.toc-level-2.active { padding-left: 22px; }
	.toc-level-3.active { padding-left: 34px; }
	.toc-level-4.active { padding-left: 46px; }
	.toc-level-5.active { padding-left: 58px; }
	.toc-level-6.active { padding-left: 70px; }

	/* TOC button in status area */
	.toc-btn {
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

	.toc-btn:hover:not(:disabled) {
		background: #21262d;
		color: #c9d1d9;
	}

	.toc-btn.active {
		background: #21262d;
		color: #58a6ff;
	}

	.toc-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Mobile styles */
	.mobile-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 99;
	}

	.mobile-sidebar {
		position: fixed !important;
		top: 0;
		left: 0;
		bottom: 0;
		width: 280px !important;
		z-index: 10000;
		transform: translateX(0) !important;
		opacity: 1 !important;
	}

	.mobile-sidebar.hidden {
		transform: translateX(-100%) !important;
	}

	.mobile-menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: none;
		background: transparent;
		color: #c9d1d9;
		cursor: pointer;
		border-radius: 6px;
		margin-right: 8px;
		flex-shrink: 0;
	}

	.mobile-menu-btn:hover {
		background: #21262d;
	}

	/* Sidebar toggle button */
	.sidebar-toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: none;
		background: transparent;
		color: #8b949e;
		cursor: pointer;
		border-radius: 6px;
		margin-left: 8px;
		flex-shrink: 0;
		transition: background-color 0.15s, color 0.15s;
		position: relative;
		z-index: 10;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
	}

	.sidebar-toggle-btn:hover {
		background: #21262d;
		color: #c9d1d9;
	}

	.sidebar-toggle-btn:active {
		background: #30363d;
	}

	.sidebar-collapsed .sidebar-toggle-btn {
		color: #58a6ff;
	}

	/* Responsive breakpoints */
	@media (max-width: 768px) {
		.sidebar-wrapper:not(.mobile-sidebar) {
			display: none;
		}

		.toc-panel {
			position: fixed;
			top: 41px;
			right: 0;
			bottom: 0;
			width: 280px !important;
			max-width: 80vw;
			z-index: 50;
			box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
		}

		.toc-resize-handle {
			display: none;
		}

		.status-area {
			padding: 0 6px;
			gap: 4px;
		}

		.file-name {
			max-width: 100px;
		}

		.preview-pane.full-width,
		.editor-pane.full-width {
			max-width: 100%;
			padding: 0;
		}

		.sidebar-toggle-btn {
			width: 32px;
			height: 32px;
			margin-left: 4px;
		}

		/* Show view toggle, hide reset on mobile */
		.desktop-only {
			display: none !important;
		}

		.mobile-only {
			display: flex !important;
		}

		.toc-btn {
			width: 28px;
			height: 28px;
		}
	}

	@media (max-width: 600px) {
		.file-name {
			max-width: 60px;
		}

		.status-area {
			gap: 2px;
			padding: 0 4px;
		}

		.toc-btn,
		.view-toggle-btn {
			width: 26px;
			height: 26px;
		}

		.sidebar-toggle-btn {
			width: 30px;
			height: 30px;
			margin-left: 2px;
		}
	}

	@media (max-width: 480px) {
		.file-name {
			display: none;
		}

		.view-mode-badge {
			display: none;
		}

		.sidebar-toggle-btn {
			margin-left: 2px;
		}

		.status-area {
			padding: 0 4px;
		}
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

	.empty-icon {
		color: #30363d;
		margin-bottom: 16px;
	}

	.empty-content h2 {
		font-size: 24px;
		font-weight: 400;
		margin-bottom: 8px;
		color: #c9d1d9;
	}

	.empty-content p {
		color: #8b949e;
		margin: 8px 0;
	}

	.empty-content .hint {
		font-size: 12px;
		margin-top: 16px;
	}

	.empty-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
		margin-top: 24px;
	}

	.empty-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: 1px solid transparent;
	}

	.empty-btn.primary {
		background: #238636;
		color: #ffffff;
		border-color: #238636;
	}

	.empty-btn.primary:hover {
		background: #2ea043;
		border-color: #2ea043;
	}

	.empty-btn.secondary {
		background: #21262d;
		color: #c9d1d9;
		border-color: #30363d;
	}

	.empty-btn.secondary:hover {
		background: #30363d;
		border-color: #58a6ff;
		color: #58a6ff;
	}
</style>

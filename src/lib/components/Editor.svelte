<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
	import { EditorState, Compartment, EditorSelection, Prec } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
	import { languages } from '@codemirror/language-data';
	import { HighlightStyle, syntaxHighlighting, bracketMatching, foldGutter, indentOnInput, foldKeymap } from '@codemirror/language';
	import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, type CompletionContext, type Completion } from '@codemirror/autocomplete';
	import { searchKeymap, highlightSelectionMatches, search, openSearchPanel } from '@codemirror/search';
	import { lintKeymap } from '@codemirror/lint';
	import { tags } from '@lezer/highlight';
	import { appState } from '$lib/appState.svelte';

	interface Props {
		value?: string;
		onchange?: (value: string) => void;
		onscroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
		ondimensionschange?: () => void; // Called when section dimensions are measured/updated
		class?: string;
	}

	let { value = '', onchange, onscroll, ondimensionschange, class: className = '' }: Props = $props();

	let editorContainer: HTMLDivElement;
	let view: EditorView | null = null;
	let isUpdating = false;
	let isSyncingScroll = false;

	// Text buffering for performance optimization
	let changeBuffer: string | null = null;
	let changeTimeout: ReturnType<typeof setTimeout> | null = null;
	const BUFFER_DELAY = 50; // milliseconds - debounce rapid changes

	// Context menu state
	let contextMenu = $state<{ x: number; y: number; subMenu?: string } | null>(null);
	let hoveredCategory = $state<string | null>(null);
	let hasSelection = $state(false);

	// Help overlay state
	let showHelpOverlay = $state(false);

	// Prevent recursive shortcut calls
	let isProcessingShortcut = false;

	// Section dimensions for smart scroll sync
	interface SectionDimension {
		startOffset: number;  // Pixel offset from top of container
		endOffset: number;    // End pixel offset
		height: number;       // Height in pixels
	}

	interface EditorSectionInfo {
		startLine: number;
		endLine: number;
		editorDimension: SectionDimension;
	}

	let editorSections: EditorSectionInfo[] = [];

	// Compartments for dynamic switching
	const themeCompartment = new Compartment();
	const wordWrapCompartment = new Compartment();

	// Markdown-specific completions
	const markdownCompletions: Completion[] = [
		// Headers
		{ label: '# ', displayLabel: '# Heading 1', type: 'keyword', detail: 'H1 heading', boost: 10 },
		{ label: '## ', displayLabel: '## Heading 2', type: 'keyword', detail: 'H2 heading', boost: 9 },
		{ label: '### ', displayLabel: '### Heading 3', type: 'keyword', detail: 'H3 heading', boost: 8 },
		{ label: '#### ', displayLabel: '#### Heading 4', type: 'keyword', detail: 'H4 heading', boost: 7 },
		{ label: '##### ', displayLabel: '##### Heading 5', type: 'keyword', detail: 'H5 heading', boost: 6 },
		{ label: '###### ', displayLabel: '###### Heading 6', type: 'keyword', detail: 'H6 heading', boost: 5 },
		// Lists
		{ label: '- ', displayLabel: '- List item', type: 'text', detail: 'Unordered list', boost: 4 },
		{ label: '* ', displayLabel: '* List item', type: 'text', detail: 'Unordered list', boost: 4 },
		{ label: '1. ', displayLabel: '1. Numbered item', type: 'text', detail: 'Ordered list', boost: 4 },
		{ label: '- [ ] ', displayLabel: '- [ ] Task', type: 'text', detail: 'Task list item', boost: 3 },
		{ label: '- [x] ', displayLabel: '- [x] Done task', type: 'text', detail: 'Completed task', boost: 3 },
		// Formatting
		{ label: '**bold**', displayLabel: '**bold**', type: 'text', detail: 'Bold text' },
		{ label: '*italic*', displayLabel: '*italic*', type: 'text', detail: 'Italic text' },
		{ label: '~~strikethrough~~', displayLabel: '~~strikethrough~~', type: 'text', detail: 'Strikethrough' },
		{ label: '`code`', displayLabel: '`code`', type: 'text', detail: 'Inline code' },
		// Links and images
		{ label: '[text](url)', displayLabel: '[text](url)', type: 'text', detail: 'Link' },
		{ label: '![alt](url)', displayLabel: '![alt](url)', type: 'text', detail: 'Image' },
		// Blocks
		{ label: '> ', displayLabel: '> Blockquote', type: 'text', detail: 'Blockquote' },
		{ label: '---', displayLabel: '---', type: 'text', detail: 'Horizontal rule' },
		// Code blocks
		{ label: '```\n\n```', displayLabel: '``` Code block', type: 'text', detail: 'Fenced code block', boost: 2 },
		{ label: '```mermaid\n\n```', displayLabel: '```mermaid', type: 'text', detail: 'Mermaid diagram' },
		// Math
		{ label: '$math$', displayLabel: '$math$', type: 'text', detail: 'Inline math' },
		{ label: '$$\n\n$$', displayLabel: '$$ Math block', type: 'text', detail: 'Display math block' },
		// Tables
		{ label: '| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |', displayLabel: 'Table', type: 'text', detail: 'Markdown table' },
	];

	// Completion function that provides markdown completions
	function markdownComplete(context: CompletionContext) {
		// Get the line we're on
		const line = context.state.doc.lineAt(context.pos);
		const textBefore = context.state.sliceDoc(line.from, context.pos);
		
		// Check if we're at line start (for headers, lists, etc.)
		const atLineStart = textBefore.trim() === '' || /^\s*$/.test(textBefore);
		
		// Get word being typed - better word boundary detection
		const word = context.matchBefore(/\w+/) || context.matchBefore(/[#*\-`>$\[!|=]+/);
		
		// Don't complete if no word and not explicitly requested
		if (!word && !context.explicit) return null;
		
		const from = word ? word.from : context.pos;
		const text = word ? word.text.toLowerCase() : '';
		
		// Filter completions based on context
		let options = markdownCompletions.filter(c => {
			// If we have text, filter by prefix match (case-insensitive)
			if (text.length > 0) {
				return c.label.toLowerCase().startsWith(text);
			}
			return true;
		});
		
		// At line start, prioritize structural elements
		if (atLineStart && !word) {
			options = markdownCompletions.filter(c => 
				c.label.startsWith('#') || 
				c.label.startsWith('-') || 
				c.label.startsWith('*') || 
				c.label.startsWith('1') || 
				c.label.startsWith('>') || 
				c.label.startsWith('`') ||
				c.label.startsWith('$') ||
				c.label.startsWith('|') ||
				c.label.startsWith('---')
			);
		}
		
		// Return early if no options
		if (options.length === 0) return null;
		
		return {
			from,
			options,
			validFor: /^\w*[#*\-`>$\[!|]*$/
		};
	}

	// GitHub Dark theme colors
	const githubDarkTheme = EditorView.theme({
		'&': {
			height: '100%',
			fontSize: '14px',
			backgroundColor: '#0d1117',
			color: '#c9d1d9'
		},
		'.cm-content': {
			padding: '10px 0',
			caretColor: '#58a6ff'
		},
		'.cm-cursor, .cm-dropCursor': {
			borderLeftColor: '#58a6ff',
			borderLeftWidth: '2px'
		},
		'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
			backgroundColor: '#1f6feb66',
			outline: '1px solid #1f6feb'
		},
		'.cm-panels': {
			backgroundColor: '#161b22',
			color: '#c9d1d9'
		},
		'.cm-panels.cm-panels-top': {
			borderBottom: '1px solid #30363d'
		},
		'.cm-panels.cm-panels-bottom': {
			borderTop: '1px solid #30363d'
		},
		'.cm-searchMatch': {
			backgroundColor: '#3a3d4180',
			outline: 'none'
		},
		'.cm-searchMatch.cm-searchMatch-selected': {
			backgroundColor: '#ffd33d50',
			outline: '1px solid #ffd33d'
		},
		'.cm-activeLine': {
			backgroundColor: '#161b2280'
		},
		'.cm-selectionMatch': {
			backgroundColor: '#3a3d4180',
			outline: 'none'
		},
		'&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
			backgroundColor: '#58a6ff30',
			outline: '1px solid #58a6ff60'
		},
		'.cm-gutters': {
			backgroundColor: '#0d1117',
			color: '#484f58',
			borderRight: '1px solid #30363d'
		},
		'.cm-activeLineGutter': {
			backgroundColor: '#161b2280',
			color: '#c9d1d9'
		},
		'.cm-foldPlaceholder': {
			backgroundColor: '#21262d',
			color: '#8b949e',
			border: 'none'
		},
		'.cm-tooltip': {
			backgroundColor: '#161b22',
			border: '1px solid #30363d',
			color: '#c9d1d9'
		},
		'.cm-tooltip .cm-tooltip-arrow:before': {
			borderTopColor: '#30363d',
			borderBottomColor: '#30363d'
		},
		'.cm-tooltip .cm-tooltip-arrow:after': {
			borderTopColor: '#161b22',
			borderBottomColor: '#161b22'
		},
		'.cm-tooltip-autocomplete': {
			'& > ul > li[aria-selected]': {
				backgroundColor: '#1f6feb',
				color: '#ffffff'
			}
		},
		// Search panel styling
		'.cm-search': {
			backgroundColor: '#161b22',
			padding: '8px 10px',
			border: 'none',
			borderBottom: '1px solid #30363d'
		},
		'.cm-search label': {
			color: '#c9d1d9',
			fontSize: '12px',
			fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
			display: 'flex',
			alignItems: 'center',
			gap: '6px',
			marginBottom: '6px'
		},
		'.cm-search input, .cm-search button': {
			fontSize: '12px',
			fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
			padding: '4px 8px',
			backgroundColor: '#0d1117',
			color: '#c9d1d9',
			border: '1px solid #30363d',
			borderRadius: '4px',
			height: '24px',
			lineHeight: '1'
		},
		'.cm-search input:focus': {
			backgroundColor: '#0d1117',
			color: '#c9d1d9',
			borderColor: '#1f6feb',
			outline: 'none',
			boxShadow: 'inset 0 0 0 1px #1f6feb'
		},
		'.cm-search button': {
			padding: '2px 8px',
			minWidth: '32px',
			cursor: 'pointer',
			transition: 'background-color 0.1s'
		},
		'.cm-search button:hover': {
			backgroundColor: '#21262d'
		},
		'.cm-search .cm-search-stats': {
			fontSize: '11px',
			color: '#8b949e',
			padding: '4px 8px'
		},
		'.cm-scroller': {
			overflow: 'auto',
			fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
			'&::-webkit-scrollbar': {
				width: '12px',
				height: '12px'
			},
			'&::-webkit-scrollbar-track': {
				background: '#0d1117'
			},
			'&::-webkit-scrollbar-thumb': {
				background: '#30363d',
				borderRadius: '6px',
				border: '3px solid #0d1117'
			},
			'&::-webkit-scrollbar-thumb:hover': {
				background: '#484f58'
			}
		},
		'.cm-line': {
			padding: '0 10px'
		}
	}, { dark: true });

	// GitHub Dark syntax highlighting
	const githubDarkHighlightStyle = HighlightStyle.define([
		{ tag: tags.keyword, color: '#ff7b72' },
		{ tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: '#c9d1d9' },
		{ tag: [tags.function(tags.variableName), tags.labelName], color: '#d2a8ff' },
		{ tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#79c0ff' },
		{ tag: [tags.definition(tags.name), tags.separator], color: '#c9d1d9' },
		{ tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#ffa657' },
		{ tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#79c0ff' },
		{ tag: [tags.meta, tags.comment], color: '#8b949e' },
		{ tag: tags.strong, fontWeight: 'bold', color: '#c9d1d9' },
		{ tag: tags.emphasis, fontStyle: 'italic', color: '#c9d1d9' },
		{ tag: tags.strikethrough, textDecoration: 'line-through' },
		{ tag: tags.link, color: '#58a6ff', textDecoration: 'underline' },
		{ tag: tags.heading, fontWeight: 'bold', color: '#58a6ff' },
		{ tag: [tags.heading1, tags.heading2], fontWeight: 'bold', color: '#58a6ff' },
		{ tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: '#79c0ff' },
		{ tag: [tags.processingInstruction, tags.string, tags.inserted], color: '#a5d6ff' },
		{ tag: tags.invalid, color: '#f85149' },
		{ tag: tags.quote, color: '#7ee787', fontStyle: 'italic' },
		{ tag: tags.contentSeparator, color: '#30363d' },
		{ tag: tags.monospace, color: '#a5d6ff' },
	]);

	// 🧠 STATE MACHINE: Smart Formatting (Bold, Italic, Code)
	// Based on Obsidian/Typora/Notion behavior
	// --- Helper: apakah char itu whitespace?
	function isWhitespaceChar(ch: string | null) {
		return ch === null || /^\s$/.test(ch);
	}

	// --- Helper: apakah perlu separator (spasi) ketika menyisipkan new markers
	function needSeparator(doc: any, pos: number, side: 'left' | 'right') {
		// pos = insertion position in doc (absolute)
		// left: check char immediately before pos
		// right: check char immediately after pos
		if (side === 'left') {
			if (pos <= 0) return false;
			const ch = doc.sliceString(pos - 1, pos);
			// if previous char is whitespace or it's a boundary marker, no extra space needed
			return !isWhitespaceChar(ch);
		} else {
			const len = doc.length;
			if (pos >= len) return false;
			const ch = doc.sliceString(pos, pos + 1);
			return !isWhitespaceChar(ch);
		}
	}

	// --- Core unified function: toggle inline formatting
	function toggleInlineFormat(view: EditorView, before: string, after: string = before) {
		const state = view.state;
		const doc = state.doc;
		const docLen = doc.length;
		let { from, to } = state.selection.main;

		// small mutex to avoid re-entry from toolbar + keyboard at same time
		if (isProcessingShortcut) return false;
		isProcessingShortcut = true;
		try {
			// 1) EMPTY DOCUMENT
			if (docLen === 0) {
				view.dispatch({
					changes: { from: 0, to: 0, insert: before + after },
					selection: { anchor: before.length }
				});
				return true;
			}

			// 2) SELECTION EXISTS -> toggle around selection
			if (from !== to) {
				const selected = doc.sliceString(from, to);

				// Case A: selection already wrapped (selectedText starts/ends with markers)
				if (
					selected.length > before.length + after.length &&
					selected.startsWith(before) &&
					selected.endsWith(after)
				) {
					const inner = selected.slice(before.length, selected.length - after.length);
					view.dispatch({
						changes: { from, to, insert: inner },
						selection: { anchor: from, head: from + inner.length }
					});
					return true;
				}

				// Case B: markers immediately outside the selection (outside selection)
				const checkFrom = Math.max(0, from - before.length);
				const checkTo = Math.min(docLen, to + after.length);
				const textBefore = doc.sliceString(checkFrom, from);
				const textAfter = doc.sliceString(to, checkTo);

				if (textBefore === before && textAfter === after) {
					// unwrap outer markers
					const inner = doc.sliceString(from, to);
					view.dispatch({
						changes: { from: checkFrom, to: checkTo, insert: inner },
						selection: { anchor: checkFrom, head: checkFrom + inner.length }
					});
					return true;
				}

				// Default: wrap selection
				view.dispatch({
					changes: { from, to, insert: before + selected + after },
					selection: { anchor: from + before.length, head: from + before.length + selected.length }
				});
				return true;
			}

			// 3) CURSOR ONLY (no selection): inspect context
			const pos = from;
			const line = doc.lineAt(pos);
			const lineStart = line.from;
			const lineEnd = line.to;

			// -> Check if cursor is inside an existing before/after pair on the same line
			{
				const lineText = doc.sliceString(lineStart, lineEnd);
				const rel = pos - lineStart;

				// find left-most 'before' before cursor and right-most 'after' after cursor,
				// but ensure they are separate and surrounding current pos
				const leftIdx = lineText.lastIndexOf(before, rel - 1);
				const rightIdx = lineText.indexOf(after, rel);
				if (leftIdx !== -1 && rightIdx !== -1 && rightIdx > leftIdx) {
					const absoluteLeft = lineStart + leftIdx;
					const contentStart = absoluteLeft + before.length;
					const absoluteRight = lineStart + rightIdx;
					const content = doc.sliceString(contentStart, absoluteRight);

					// ensure it's same-line content only
					if (!content.includes('\n') && pos >= contentStart && pos <= absoluteRight) {
						// unwrap
						view.dispatch({
							changes: { from: absoluteLeft, to: absoluteRight + after.length, insert: content },
							selection: { anchor: absoluteLeft + (pos - contentStart) }
						});
						return true;
					}
				}
			}

			// -> Check adjacency: cursor directly after a marker (right-side outside bold)
			const beforeLen = before.length;
			const afterLen = after.length;
			const textBeforeMarker = pos >= afterLen ? doc.sliceString(pos - afterLen, pos) : '';
			if (textBeforeMarker === after) {
				// Insert "space + markers" to avoid merging with previous marker unless whitespace exists
				const needSpace = needSeparator(doc, pos, 'left');
				const insertText = (needSpace ? ' ' : '') + before + after;
				const anchor = pos + (needSpace ? 1 : 0) + before.length;
				view.dispatch({
					changes: { from: pos, to: pos, insert: insertText },
					selection: { anchor }
				});
				return true;
			}

			// -> Cursor directly before a marker (left-side outside bold)
			const textAfterMarker = pos + beforeLen <= docLen ? doc.sliceString(pos, pos + beforeLen) : '';
			if (textAfterMarker === before) {
				const needSpace = needSeparator(doc, pos, 'right');
				// Insert markers before cursor, but ensure there's a space after inserted markers if needed
				const insertText = before + after + (needSpace ? ' ' : '');
				const anchor = pos + before.length;
				view.dispatch({
					changes: { from: pos, to: pos, insert: insertText },
					selection: { anchor }
				});
				return true;
			}

			// -> Cursor in a word
			const maybeWord = state.wordAt(pos);
			if (maybeWord && maybeWord.from >= lineStart && maybeWord.to <= lineEnd) {
				const wFrom = maybeWord.from;
				const wTo = maybeWord.to;
				const wText = doc.sliceString(wFrom, wTo);

				const left = wFrom >= beforeLen ? doc.sliceString(wFrom - beforeLen, wFrom) : '';
				const right = wTo + afterLen <= docLen ? doc.sliceString(wTo, wTo + afterLen) : '';

				if (left === before && right === after) {
					// unwrap word
					view.dispatch({
						changes: { from: wFrom - beforeLen, to: wTo + afterLen, insert: wText },
						selection: { anchor: wFrom - beforeLen + (pos - wFrom) }
					});
				} else {
					// wrap word
					view.dispatch({
						changes: { from: wFrom, to: wTo, insert: before + wText + after },
						selection: { anchor: wTo + before.length + after.length }
					});
				}
				return true;
			}

			// -> Default: insert empty markers at cursor (in whitespace)
			{
				// if inserting next to non-space, add a space between to avoid merge
				const needSpace = needSeparator(doc, pos, 'left');
				const insertText = (needSpace ? ' ' : '') + before + after;
				const anchor = pos + (needSpace ? 1 : 0) + before.length;
				view.dispatch({
					changes: { from: pos, to: pos, insert: insertText },
					selection: { anchor }
				});
				return true;
			}
		} finally {
			// release mutex after minimal delay to avoid re-entry from same key event
			setTimeout(() => { isProcessingShortcut = false; }, 20);
		}
	}

	// Legacy wrapper for backward compatibility (optional - can be removed if not used elsewhere)
	function applyFormatting(editorView: EditorView, before: string, after: string): boolean {
		return toggleInlineFormat(editorView, before, after);
	}

	// Create the editor extensions
	function createExtensions() {
		return [
			// ===== CUSTOM KEYMAPS with HIGHEST PRECEDENCE (overrides ALL defaults) =====
			Prec.highest(keymap.of([
				// ===== CUSTOM SHORTCUTS (will override any default keybindings) =====
				
				// Help overlay
				{
					key: 'Ctrl-h',
					run: () => {
						showHelpOverlay = !showHelpOverlay;
						return true;
					}
				},
				
				// Formatting shortcuts - Unified toggle logic
				{
					key: 'Ctrl-b',
					run: (editorView) => {
						if (!editorView) return false;
						return toggleInlineFormat(editorView, '**', '**');
					}
				},
				{
					key: 'Ctrl-i',
					run: (editorView) => {
						if (!editorView) return false;
						return toggleInlineFormat(editorView, '_', '_');
					}
				},
				{
					key: 'Ctrl-`',
					run: (editorView) => {
						if (!editorView) return false;
						view = editorView;
						// Smart code: multiline -> block, single line -> inline
						const { from, to } = editorView.state.selection.main;
						const selectedText = editorView.state.sliceDoc(from, to);
						if (selectedText.includes('\n')) {
							handleCodeBlockSelection();
							return true;
						}
						return toggleInlineFormat(editorView, '`', '`');
					}
				},
				{
					key: 'Ctrl-~',

					run: (editorView) => {
						view = editorView;
						handleStrikethroughSelection();
						return true;
					}
				},
				{
					key: 'Ctrl-q',

					run: (editorView) => {
						view = editorView;
						handleQuoteSelection();
						return true;
					}
				},
				{
					key: 'Ctrl-.',

					run: (editorView) => {
						view = editorView;
						handleBulletListSelection();
						return true;
					}
				},
				{
					key: 'Ctrl-Shift-.',

					run: (editorView) => {
						view = editorView;
						handleNumberedListSelection();
						return true;
					}
				},
				
				// Heading shortcuts
				{
					key: 'Ctrl-Alt-1',

					run: (editorView) => {
						view = editorView;
						handleHeadingSelection(1);
						return true;
					}
				},
				{
					key: 'Ctrl-Alt-2',

					run: (editorView) => {
						view = editorView;
						handleHeadingSelection(2);
						return true;
					}
				},
				{
					key: 'Ctrl-Alt-3',

					run: (editorView) => {
						view = editorView;
						handleHeadingSelection(3);
						return true;
					}
				},
				{
					key: 'Ctrl-Alt-4',

					run: (editorView) => {
						view = editorView;
						handleHeadingSelection(4);
						return true;
					}
				},
				{
					key: 'Ctrl-Alt-5',

					run: (editorView) => {
						view = editorView;
						handleHeadingSelection(5);
						return true;
					}
				},
				{
					key: 'Ctrl-Alt-6',

					run: (editorView) => {
						view = editorView;
						handleHeadingSelection(6);
						return true;
					}
				},
				
				// Link shortcut
				{
					key: 'Ctrl-k',

					run: (editorView) => {
						view = editorView;
						handleLinkSelection();
						return true;
					}
				},
				
				// Multi-select shortcuts
				{
					key: 'Ctrl-d',

					run: (view) => {
						const state = view.state;
						const sel = state.selection.main;
						
						// If nothing selected, select the current word
						if (sel.from === sel.to) {
							const word = state.wordAt(sel.from);
							if (word) {
								view.dispatch({ selection: { anchor: word.from, head: word.to } });
							}
							return true;
						}
						
						// Get the selected text
						const selectedText = state.sliceDoc(sel.from, sel.to);
						
						// Search for the next occurrence after the current selection
						const text = state.doc.toString();
						const startPos = sel.to;
						const nextIndex = text.indexOf(selectedText, startPos);
						
						if (nextIndex !== -1) {
							// Add the new range to the selection
							const newSelection = state.selection.addRange(
								EditorSelection.range(nextIndex, nextIndex + selectedText.length)
							);
							view.dispatch({ selection: newSelection });
							return true;
						}
						
						return false;
					}
				},
				{
					key: 'Ctrl-Shift-l',

					run: (view) => {
						const state = view.state;
						const sel = state.selection.main;
						
						// If nothing selected, select the current word
						if (sel.from === sel.to) {
							const word = state.wordAt(sel.from);
							if (word) {
								view.dispatch({ selection: { anchor: word.from, head: word.to } });
							}
							return true;
						}
						
						// Get the selected text
						const selectedText = state.sliceDoc(sel.from, sel.to);
						const text = state.doc.toString();
						
						// Find all occurrences
						const ranges = [];
						let pos = 0;
						while (pos < text.length) {
							const index = text.indexOf(selectedText, pos);
							if (index === -1) break;
							ranges.push(EditorSelection.range(index, index + selectedText.length));
							pos = index + selectedText.length;
						}
						
						if (ranges.length > 0) {
							view.dispatch({ selection: EditorSelection.create(ranges) });
							return true;
						}
						
						return false;
					}
				},
				
				// ===== DEFAULT KEYMAPS (must come AFTER custom shortcuts) =====
				...closeBracketsKeymap,
				// Filter out conflicting shortcuts from defaultKeymap
				...defaultKeymap.filter(binding => {
					const key = binding.key?.toLowerCase();
					return key !== 'ctrl-b' && key !== 'ctrl-i' && key !== 'ctrl-`' && 
					       key !== 'mod-b' && key !== 'mod-i' && key !== 'mod-`';
				}),
				...searchKeymap,
				...historyKeymap,
				...foldKeymap,
				...completionKeymap,
				...lintKeymap,
				indentWithTab
			])),

			// ===== OTHER EXTENSIONS (after keymaps) =====
			
			// Line numbers and gutters
			lineNumbers(),
			highlightActiveLineGutter(),
			foldGutter(),

			// Basic editing features
			highlightSpecialChars(),
			history(),
			drawSelection(),
			dropCursor(),
			EditorState.allowMultipleSelections.of(true),
			indentOnInput(),
			bracketMatching(),
			closeBrackets(),
			autocompletion({
				override: [markdownComplete],
				defaultKeymap: false,  // CRITICAL: Disable to prevent keymap conflicts
				icons: true
			}),
			rectangularSelection(),
			crosshairCursor(),
			highlightActiveLine(),
			highlightSelectionMatches(),

			// Markdown support
			markdown({
				base: markdownLanguage,
				codeLanguages: languages
			}),

			// Search and replace (CodeMirror native)
			search({
				top: true,
				caseSensitive: false,
				wholeWord: false,
				regexp: false
			}),

			// GitHub Dark theme and highlighting
			themeCompartment.of([
				githubDarkTheme,
				syntaxHighlighting(githubDarkHighlightStyle)
			]),

			// Word wrap (dynamic)
			wordWrapCompartment.of(appState.wordWrap ? EditorView.lineWrapping : []),

			// Update listener for doc changes with text buffering optimization
			EditorView.updateListener.of((update) => {
				if (update.docChanged && !isUpdating) {
					const content = update.state.doc.toString();
					changeBuffer = content;
					
					// Clear existing timeout and set new debounced callback
					if (changeTimeout) clearTimeout(changeTimeout);
					changeTimeout = setTimeout(() => {
						if (changeBuffer !== null) {
							onchange?.(changeBuffer);
						}
						changeBuffer = null;
						changeTimeout = null;
					}, BUFFER_DELAY);
				}
			}),

			// Scroll event listener using DOM scroll handler
			EditorView.domEventHandlers({
				scroll: () => {
					if (isSyncingScroll) return;
					const scroller = view?.scrollDOM;
					if (scroller && onscroll) {
						onscroll({
							scrollTop: scroller.scrollTop,
							scrollHeight: scroller.scrollHeight,
							clientHeight: scroller.clientHeight
						});
					}
				}
			})
		];
	}

	// Common formatting actions (shown directly in context menu)
	const commonFormattingItems = [
		{ label: 'Bold', insert: '**bold**', shortcut: 'Ctrl+B', action: handleBoldSelection, style: 'bold', displayText: 'Bold' },
		{ label: 'Italic', insert: '_italic_', shortcut: 'Ctrl+I', action: handleItalicSelection, style: 'italic', displayText: 'Italic' },
		{ label: 'Strikethrough', insert: '~~strike~~', shortcut: 'Ctrl+~', action: handleStrikethroughSelection, style: 'strikethrough', displayText: 'Strike' },
		{ label: 'Code', insert: '`code`', shortcut: 'Ctrl+`', action: handleSmartCodeSelection, style: 'code', displayText: 'Code' },
	];

	const commonListItems = [
		{ label: 'Bullet List', insert: '- ', shortcut: 'Ctrl+.', action: handleBulletListSelection, style: 'normal', displayText: 'Bullet' },
		{ label: 'Numbered List', insert: '1. ', shortcut: 'Ctrl+Shift+.', action: handleNumberedListSelection, style: 'normal', displayText: 'List' },
	];

	// Icon map for categories using Material Design
	const categoryIcons: Record<string, string> = {
		'Heading': '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M5 4v3h5.5v12h3V7H19V4z"/></svg>',
		'Block': '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M20 13H3c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h17c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zm0-10H3c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h17c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1z"/></svg>',
		'Extra': '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>',
		'Other': '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>',
	};

	// Markdown categories for advanced/niche options
	const markdownCategories = [
		{
			name: 'Heading',
			items: [
				{ label: '# Heading 1', insert: '# ', shortcut: 'Ctrl+Alt+1', action: () => handleHeadingSelection(1), style: 'normal', displayText: 'H1' },
				{ label: '## Heading 2', insert: '## ', shortcut: 'Ctrl+Alt+2', action: () => handleHeadingSelection(2), style: 'normal', displayText: 'H2' },
				{ label: '### Heading 3', insert: '### ', shortcut: 'Ctrl+Alt+3', action: () => handleHeadingSelection(3), style: 'normal', displayText: 'H3' },
				{ label: '#### Heading 4', insert: '#### ', shortcut: 'Ctrl+Alt+4', action: () => handleHeadingSelection(4), style: 'normal', displayText: 'H4' },
				{ label: '##### Heading 5', insert: '##### ', shortcut: 'Ctrl+Alt+5', action: () => handleHeadingSelection(5), style: 'normal', displayText: 'H5' },
				{ label: '###### Heading 6', insert: '###### ', shortcut: 'Ctrl+Alt+6', action: () => handleHeadingSelection(6), style: 'normal', displayText: 'H6' },
			]
		},
		{
			name: 'Block',
			items: [
				{ label: 'Code Block', insert: '```\n\n```', shortcut: 'Ctrl+`', action: handleCodeBlockSelection, style: 'code', displayText: 'Code Block' },
				{ label: 'Task (unchecked)', insert: '- [ ] ', shortcut: '', action: handleTaskListSelection, style: 'normal', displayText: 'Task' },
				{ label: 'Blockquote', insert: '> ', shortcut: 'Ctrl+Q', action: handleQuoteSelection, style: 'normal', displayText: 'Quote' },
				{ label: 'Horizontal Rule', insert: '---', shortcut: '', style: 'normal', displayText: 'HR' },
			]
		},
		{
			name: 'Extra',
			items: [
				{ label: 'Link', insert: '[text](url)', shortcut: 'Ctrl+K', style: 'normal', displayText: 'Link' },
				{ label: 'Image', insert: '![alt](url)', shortcut: '', style: 'normal', displayText: 'Image' },
				{ label: 'Table', insert: '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |', shortcut: '', style: 'normal', displayText: 'Table' },
			]
		},
		{
			name: 'Other',
			items: [
				{ label: 'Inline Math', insert: '$x = y$', shortcut: '', style: 'normal', displayText: 'Math' },
				{ label: 'Mermaid Diagram', insert: '```mermaid\ngraph TD\nA --> B\n```', shortcut: '', style: 'code', displayText: 'Diagram' },
			]
		},
	];

	// Selection analysis state
	let selectionInfo = $state<{
		isMultiline: boolean;
		isSingleWord: boolean;
		isWholeLine: boolean;
		lineCount: number;
	}>({ isMultiline: false, isSingleWord: false, isWholeLine: false, lineCount: 0 });

	// Keyboard event handler for global shortcuts
	function handleKeyDown(event: KeyboardEvent) {
		// ESC key closes help overlay or context menu
		if (event.key === 'Escape') {
			if (showHelpOverlay) {
				showHelpOverlay = false;
				event.preventDefault();
			} else if (contextMenu) {
				closeContextMenu();
				event.preventDefault();
			}
		}
	}

	// Context menu handlers
	function handleEditorContextMenu(event: MouseEvent) {
		event.preventDefault();
		const editor = document.querySelector('.cm-editor');
		if (editor && !editor.contains(event.target as Node)) return;
		
		// Check if text is selected and analyze selection
		if (view) {
			const { from, to } = view.state.selection.main;
			hasSelection = from !== to;
			
			if (hasSelection) {
				const selectedText = view.state.sliceDoc(from, to);
				const lines = selectedText.split('\n');
				const lineCount = lines.length;
				const isMultiline = lineCount > 1;
				const isSingleWord = !isMultiline && !/\s/.test(selectedText);
				
				// Check if selection is whole line(s)
				const lineFrom = view.state.doc.lineAt(from);
				const lineTo = view.state.doc.lineAt(to);
				const isWholeLine = from === lineFrom.from && to === lineTo.to;
				
				selectionInfo = { isMultiline, isSingleWord, isWholeLine, lineCount };
			}
		}
		
		contextMenu = {
			x: event.clientX,
			y: event.clientY,
			subMenu: undefined
		};
	}

	function closeContextMenu() {
		contextMenu = null;
		hoveredCategory = null;
	}

	function insertMarkdown(text: string, action?: () => void) {
		// If action handler exists, always use it (handles both selection and no selection)
		if (action) {
			action();
			return;
		}
		
		// Fallback: insert at cursor (only when no action handler)
		if (!view) return;
		const { from } = view.state.selection.main;
		view.dispatch({
			changes: { from, to: from, insert: text + ' ' },
			selection: { anchor: from + text.length + 1 }
		});
		closeContextMenu();
	}

	function handleCut() {
		document.execCommand('cut');
		closeContextMenu();
	}

	function handleCopy() {
		document.execCommand('copy');
		closeContextMenu();
	}

	function handlePaste() {
		document.execCommand('paste');
		closeContextMenu();
	}

	function handleSelectAll() {
		if (view) {
			view.dispatch({
				selection: { anchor: 0, head: view.state.doc.length }
			});
		}
		closeContextMenu();
	}

	// Text formatting functions for selected text
	function wrapSelectionWithNewlines(before: string, after: string = before) {
		if (!view) return;
		const { from, to } = view.state.selection.main;
		const selectedText = view.state.sliceDoc(from, to);
		view.dispatch({
			changes: { from, to, insert: before + '\n' + selectedText + '\n' + after },
			selection: { anchor: from + before.length + 1, head: from + before.length + 1 + selectedText.length }
		});
		closeContextMenu();
	}

	function handleBoldSelection() {
		wrapSelection('**', '**');
	}

	function handleItalicSelection() {
		wrapSelection('_', '_');
	}

	function handleStrikethroughSelection() {
		wrapSelection('~~', '~~');
	}

	function handleInlineCodeSelection() {
		wrapSelection('`', '`');
	}

	// Smart code selection: inline for single line, block for multiline
	function handleSmartCodeSelection() {
		if (!view) return;
		const { from, to } = view.state.selection.main;
		const selectedText = view.state.sliceDoc(from, to);
		
		// Check if selection contains newlines (multiline)
		const isMultiline = selectedText.includes('\n');
		
		if (isMultiline || (from === to && view.state.doc.lineAt(from).text.trim() === '')) {
			// Use code block for multiline or empty line cursor
			handleCodeBlockSelection();
		} else {
			// Use inline code for single line
			wrapSelection('`', '`');
		}
	}

	function handleQuoteSelection() {
		if (!view) return;
		let { from, to } = view.state.selection.main;
		
		// If nothing selected, use current line
		if (from === to) {
			const line = view.state.doc.lineAt(from);
			from = line.from;
			to = line.to;
		}
		
		const selectedText = view.state.sliceDoc(from, to);
		const lines = selectedText.split('\n');
		const quotedText = lines.map(line => '> ' + line).join('\n');
		view.dispatch({
			changes: { from, to, insert: quotedText }
		});
		closeContextMenu();
	}

	function handleCodeBlockSelection() {
		wrapSelectionWithNewlines('```', '```');
	}

	function handleBulletListSelection() {
		if (!view) return;
		let { from, to } = view.state.selection.main;
		
		// If nothing selected, use current line
		if (from === to) {
			const line = view.state.doc.lineAt(from);
			from = line.from;
			to = line.to;
		}
		
		const selectedText = view.state.sliceDoc(from, to);
		const lines = selectedText.split('\n');
		const listText = lines.map(line => '- ' + line).join('\n');
		view.dispatch({
			changes: { from, to, insert: listText }
		});
		closeContextMenu();
	}

	function handleNumberedListSelection() {
		if (!view) return;
		let { from, to } = view.state.selection.main;
		
		// If nothing selected, use current line
		if (from === to) {
			const line = view.state.doc.lineAt(from);
			from = line.from;
			to = line.to;
		}
		
		const selectedText = view.state.sliceDoc(from, to);
		const lines = selectedText.split('\n');
		const listText = lines.map((line, idx) => `${idx + 1}. ${line}`).join('\n');
		view.dispatch({
			changes: { from, to, insert: listText }
		});
		closeContextMenu();
	}

	function handleHeadingSelection(level: number) {
		if (!view) return;
		const { from, to } = view.state.selection.main;
		const prefix = '#'.repeat(level) + ' ';
		
		// Always work on whole lines
		const lineFrom = view.state.doc.lineAt(from);
		const lineTo = view.state.doc.lineAt(to);
		
		// Get all lines in selection or current line
		const startLine = lineFrom.number;
		const endLine = lineTo.number;
		
		let changes = [];
		for (let i = startLine; i <= endLine; i++) {
			const line = view.state.doc.line(i);
			const lineText = line.text;
			
			// Check if line already has this heading level
			const currentMatch = lineText.match(/^(#{1,6})\s/);
			if (currentMatch && currentMatch[1].length === level) {
				// Remove heading if it's the same level
				const cleaned = lineText.replace(/^#{1,6}\s*/, '');
				changes.push({ from: line.from, to: line.to, insert: cleaned });
			} else {
				// Replace with new heading level or add heading
				const cleaned = lineText.replace(/^#{1,6}\s*/, '');
				changes.push({ from: line.from, to: line.to, insert: prefix + cleaned });
			}
		}
		
		view.dispatch({ changes });
		closeContextMenu();
	}

	function handleLinkSelection() {
		if (!view) return;
		let { from, to } = view.state.selection.main;
		
		// If nothing selected, select word at cursor
		if (from === to) {
			const word = view.state.wordAt(from);
			if (word) {
				from = word.from;
				to = word.to;
			}
		}
		
		const selectedText = view.state.sliceDoc(from, to);
		if (selectedText) {
			// Wrap text in link
			const linkText = `[${selectedText}](url)`;
			view.dispatch({
				changes: { from, to, insert: linkText },
				selection: { anchor: from + selectedText.length + 3, head: from + selectedText.length + 6 }
			});
		} else {
			// Insert link template
			view.dispatch({
				changes: { from, to: from, insert: '[text](url)' },
				selection: { anchor: from + 1, head: from + 5 }
			});
		}
		closeContextMenu();
	}

	function handleTaskListSelection() {
		if (!view) return;
		let { from, to } = view.state.selection.main;
		
		// If nothing selected, use current line
		if (from === to) {
			const line = view.state.doc.lineAt(from);
			from = line.from;
			to = line.to;
		}
		
		const selectedText = view.state.sliceDoc(from, to);
		if (selectedText) {
			const lines = selectedText.split('\n');
			const taskText = lines.map(line => '- [ ] ' + line).join('\n');
			view.dispatch({
				changes: { from, to, insert: taskText }
			});
		} else {
			view.dispatch({
				changes: { from, to: from, insert: '- [ ] ' }
			});
		}
		closeContextMenu();
	}

	function handleFindAndReplace() {
		if (!view) return;
		// Use CodeMirror's native search panel command
		openSearchPanel(view);
		closeContextMenu();
	}

	onMount(() => {
		// Add global keyboard event listener
		window.addEventListener('keydown', handleKeyDown);
		
		// Set up ResizeObserver to detect size changes (word wrap, container resize, etc.)
		let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
		let resizeFrameId: number | null = null;
		const resizeObserver = new ResizeObserver(() => {
			// Cancel pending measurements
			if (resizeTimeout) clearTimeout(resizeTimeout);
			if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
			
			// Debounce re-measurement to batch multiple resize events
			resizeTimeout = setTimeout(() => {
				// Re-measure sections when size changes
				// Use double requestAnimationFrame to ensure layout is complete
				resizeFrameId = requestAnimationFrame(() => {
					resizeFrameId = requestAnimationFrame(() => {
						if (editorSections.length > 0 && view) {
							const sections = editorSections.map(s => ({
								startLine: s.startLine,
								endLine: s.endLine
							}));
							measureSections(sections);
						}
						resizeFrameId = null;
					});
				});
			}, 50);
		});

		if (editorContainer) {
			resizeObserver.observe(editorContainer);
		}

		const state = EditorState.create({
			doc: value,
			extensions: createExtensions()
		});

		view = new EditorView({
			state,
			parent: editorContainer
		});

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			view?.destroy();
			resizeObserver.disconnect();
			if (resizeTimeout) clearTimeout(resizeTimeout);
			if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
		};
	});

	onDestroy(() => {
		// Flush any pending text change before destroying
		if (changeTimeout) {
			clearTimeout(changeTimeout);
			if (changeBuffer !== null) {
				onchange?.(changeBuffer);
			}
		}
		view?.destroy();
	});

	// Update editor content when value prop changes
	$effect(() => {
		if (view && value !== view.state.doc.toString()) {
			isUpdating = true;
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: value
				}
			});
			isUpdating = false;
		}
	});

	// Update word wrap when setting changes
	$effect(() => {
		if (view) {
			view.dispatch({
				effects: wordWrapCompartment.reconfigure(appState.wordWrap ? EditorView.lineWrapping : [])
			});
			// Re-measure sections after word wrap changes (affects line heights)
			// Use multiple animation frames to ensure layout has fully settled
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					if (editorSections.length > 0) {
						const sections = editorSections.map(s => ({
							startLine: s.startLine,
							endLine: s.endLine
						}));
						measureSections(sections);
					}
				});
			});
		}
	});

	// Method to scroll to a specific line
	export function scrollToLine(lineNumber: number) {
		if (!view) return;

		const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines));
		view.dispatch({
			effects: EditorView.scrollIntoView(line.from, { y: 'start' })
		});
	}

	// Measure section dimensions based on line ranges (called by +page.svelte when sections change)
	export function measureSections(sections: Array<{ startLine: number; endLine: number }>): EditorSectionInfo[] {
		if (!view) return [];
		
		const newSections: EditorSectionInfo[] = [];
		const totalLines = view.state.doc.lines;
		const contentDOM = view.contentDOM;
		const scrollDOM = view.scrollDOM;
		
		for (const section of sections) {
			// Get the DOM positions for the start and end lines
			// Clamp to valid line range
			const startLine = Math.max(1, Math.min(section.startLine, totalLines));
			const endLine = Math.max(1, Math.min(section.endLine, totalLines));
			
			const startLineObj = view.state.doc.line(startLine);
			const endLineObj = view.state.doc.line(endLine);
			
			// Use coordsAtPos to get actual DOM coordinates which account for word wrap
			// This gives us the true visual position of wrapped text
			const startPos = startLineObj.from;
			const endPos = endLineObj.to;
			
			// Get the visual coordinates - this accounts for ALL wrapping
			const startCoords = view.coordsAtPos(startPos, 1); // 1 = get top of line
			const endCoords = view.coordsAtPos(endPos, -1); // -1 = get bottom of line
			
			let startOffset: number;
			let endOffset: number;
			
			if (startCoords && endCoords) {
				// Convert viewport coordinates to scroll-relative coordinates
				const scrollTop = scrollDOM.scrollTop;
				const contentRect = contentDOM.getBoundingClientRect();
				const scrollRect = scrollDOM.getBoundingClientRect();
				
				// Calculate offset relative to the scroll container's content
				startOffset = startCoords.top - scrollRect.top + scrollTop;
				endOffset = endCoords.bottom - scrollRect.top + scrollTop;
			} else {
				// Fallback to lineBlockAt if coordsAtPos fails
				const startBlock = view.lineBlockAt(startPos);
				const endBlock = view.lineBlockAt(endPos);
				startOffset = startBlock.top;
				endOffset = endBlock.bottom;
			}
			
			// For multi-line sections with word wrap, we need to check all lines
			// to ensure we capture the full visual extent
			if (startLine < endLine && startCoords && endCoords) {
				let minTop = startOffset;
				let maxBottom = endOffset;
				
				// Check a sample of lines to find true bounds (checking every line is expensive)
				const linesToCheck = Math.min(endLine - startLine + 1, 30);
				const step = Math.max(1, Math.floor((endLine - startLine) / linesToCheck));
				
				for (let lineNum = startLine; lineNum <= endLine; lineNum += step) {
					const lineObj = view.state.doc.line(lineNum);
					const lineStart = view.coordsAtPos(lineObj.from, 1);
					const lineEnd = view.coordsAtPos(lineObj.to, -1);
					
					if (lineStart && lineEnd) {
						const scrollTop = scrollDOM.scrollTop;
						const scrollRect = scrollDOM.getBoundingClientRect();
						
						const lineTop = lineStart.top - scrollRect.top + scrollTop;
						const lineBottom = lineEnd.bottom - scrollRect.top + scrollTop;
						
						minTop = Math.min(minTop, lineTop);
						maxBottom = Math.max(maxBottom, lineBottom);
					}
				}
				
				// Always check the last line
				if (endLine % step !== 0) {
					const lastLineStart = view.coordsAtPos(endLineObj.from, 1);
					const lastLineEnd = view.coordsAtPos(endLineObj.to, -1);
					
					if (lastLineStart && lastLineEnd) {
						const scrollTop = scrollDOM.scrollTop;
						const scrollRect = scrollDOM.getBoundingClientRect();
						
						const lastTop = lastLineStart.top - scrollRect.top + scrollTop;
						const lastBottom = lastLineEnd.bottom - scrollRect.top + scrollTop;
						
						minTop = Math.min(minTop, lastTop);
						maxBottom = Math.max(maxBottom, lastBottom);
					}
				}
				
				startOffset = minTop;
				endOffset = maxBottom;
			}
			
			// Ensure valid dimensions (handle edge cases)
			const height = Math.max(0, endOffset - startOffset);
			
			newSections.push({
				startLine,
				endLine,
				editorDimension: {
					startOffset,
					endOffset,
					height
				}
			});
		}
		
		editorSections = newSections;
		
		// Notify parent that dimensions have been updated
		ondimensionschange?.();
		
		return newSections;
	}

	// Get scroll position as a continuous value across all sections
	// Returns fractional section index for smooth interpolation
	export function getScrollPosition(): { sectionIdx: number; posInSection: number } | null {
		if (!view || editorSections.length === 0) return null;

		const scroller = view.scrollDOM;
		const scrollTop = scroller.scrollTop;
		const maxScroll = scroller.scrollHeight - scroller.clientHeight;
		
		// Handle edge cases
		if (maxScroll <= 0) return { sectionIdx: 0, posInSection: 0 };
		if (scrollTop <= 0) return { sectionIdx: 0, posInSection: 0 };
		if (scrollTop >= maxScroll) {
			return { sectionIdx: editorSections.length - 1, posInSection: 1 };
		}
		
		// Find which section we're in
		for (let i = 0; i < editorSections.length; i++) {
			const section = editorSections[i];
			const dim = section.editorDimension;
			
			// Check if scroll is within this section's range
			if (scrollTop >= dim.startOffset && scrollTop < dim.endOffset) {
				const posInSection = dim.height > 0 
					? (scrollTop - dim.startOffset) / dim.height 
					: 0;
				return {
					sectionIdx: i,
					posInSection: Math.max(0, Math.min(1, posInSection))
				};
			}
			
			// Check if we're in the gap between this section and the next
			if (i < editorSections.length - 1) {
				const nextSection = editorSections[i + 1];
				const gapStart = dim.endOffset;
				const gapEnd = nextSection.editorDimension.startOffset;
				
				if (scrollTop >= gapStart && scrollTop < gapEnd) {
					// Interpolate through the gap - treat it as end of current section
					const gapProgress = gapEnd > gapStart 
						? (scrollTop - gapStart) / (gapEnd - gapStart)
						: 1;
					// Return position at end of current section, blending toward next
					return {
						sectionIdx: i,
						posInSection: 1 // At end of section during gap
					};
				}
			}
		}
		
		// Fallback: use last section
		return { sectionIdx: editorSections.length - 1, posInSection: 1 };
	}

	// Animation state for smooth scrolling
	let animationFrameId: number | null = null;
	let animationStartTime: number = 0;
	let animationStartScroll: number = 0;
	let animationTargetScroll: number = 0;
	let lastTargetScroll: number = 0;
	const ANIMATION_DURATION = 50; // ms - fast for responsive feel
	
	// Dynamic scroll threshold based on viewport size (0.5% of client height, min 2px, max 10px)
	function getScrollThreshold(): number {
		if (!view) return 5;
		const clientHeight = view.scrollDOM.clientHeight;
		return Math.max(2, Math.min(10, clientHeight * 0.005));
	}

	// Smooth easing function (ease-out-quad for natural deceleration)
	function easeOutQuad(t: number): number {
		return t * (2 - t);
	}

	// Animate scroll to target position
	function animateScrollTo(targetScroll: number) {
		if (!view) return;
		const scroller = view.scrollDOM;
		const threshold = getScrollThreshold();

		// Skip if target is very close to current position (prevents micro-jitter)
		const currentScroll = scroller.scrollTop;
		if (Math.abs(targetScroll - currentScroll) < threshold) {
			return;
		}

		// If we're already animating toward a similar target, don't restart
		if (animationFrameId !== null && Math.abs(targetScroll - lastTargetScroll) < threshold) {
			return;
		}

		// Cancel any ongoing animation
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
		}

		animationStartTime = performance.now();
		animationStartScroll = currentScroll;
		animationTargetScroll = targetScroll;
		lastTargetScroll = targetScroll;
		isSyncingScroll = true;

		function animate(currentTime: number) {
			const elapsed = currentTime - animationStartTime;
			const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
			const easedProgress = easeOutQuad(progress);

			const newScroll = animationStartScroll + 
				(animationTargetScroll - animationStartScroll) * easedProgress;
			
			if (view) {
				view.scrollDOM.scrollTop = Math.round(newScroll);
			}

			if (progress < 1) {
				animationFrameId = requestAnimationFrame(animate);
			} else {
				animationFrameId = null;
				// Keep isSyncingScroll true longer to prevent feedback loops
				setTimeout(() => {
					isSyncingScroll = false;
				}, 100);
			}
		}

		animationFrameId = requestAnimationFrame(animate);
	}

	// Scroll to a specific section and position within it (for section-based sync)
	export function scrollToSection(sectionIdx: number, posInSection: number, animate: boolean = true) {
		if (!view || editorSections.length === 0) return;

		const section = editorSections[Math.min(sectionIdx, editorSections.length - 1)];
		if (!section) return;

		const scroller = view.scrollDOM;
		const dim = section.editorDimension;
		const targetScroll = dim.startOffset + (dim.height * posInSection);
		const clampedTarget = Math.max(0, Math.min(targetScroll, 
			scroller.scrollHeight - scroller.clientHeight));
		
		// Direct scroll - feedback prevention handled by scrollSource in parent
		isSyncingScroll = true;
		scroller.scrollTop = clampedTarget;
		isSyncingScroll = false;
	}

	// Method to scroll to a specific pixel offset (for anchor-based sync)
	export function scrollToOffset(offset: number) {
		if (!view) return;
		const scroller = view.scrollDOM;
		const clampedOffset = Math.max(0, Math.min(offset, 
			scroller.scrollHeight - scroller.clientHeight));
		isSyncingScroll = true;
		scroller.scrollTop = clampedOffset;
		isSyncingScroll = false;
	}

	// Get editor sections for scroll mapping
	export function getEditorSections(): EditorSectionInfo[] {
		return editorSections;
	}

	// Get scroll dimensions for viewport-aware sync
	export function getScrollDimensions(): { scrollTop: number; scrollHeight: number; clientHeight: number } | null {
		if (!view) return null;
		const scroller = view.scrollDOM;
		return {
			scrollTop: scroller.scrollTop,
			scrollHeight: scroller.scrollHeight,
			clientHeight: scroller.clientHeight
		};
	}

	// Method to scroll by percentage (fallback for proportional scroll sync)
	export function scrollToPercent(percent: number) {
		if (!view) return;
		const scroller = view.scrollDOM;
		const maxScroll = scroller.scrollHeight - scroller.clientHeight;
		// Direct scroll - feedback prevention handled by scrollSource in parent
		isSyncingScroll = true;
		scroller.scrollTop = maxScroll * percent;
		isSyncingScroll = false;
	}

	// Get current scroll percentage (fallback)
	export function getScrollPercent(): number {
		if (!view) return 0;
		const scroller = view.scrollDOM;
		const maxScroll = scroller.scrollHeight - scroller.clientHeight;
		return maxScroll > 0 ? scroller.scrollTop / maxScroll : 0;
	}

	// Method to insert text at cursor
	export function insertText(text: string) {
		if (!view) return;

		const { from, to } = view.state.selection.main;
		view.dispatch({
			changes: { from, to, insert: text }
		});
	}

	// Method to wrap selection with text (with toggle support)
	export function wrapSelection(before: string, after: string) {
		if (!view) return;
		
		// Use the unified toggle function for consistent behavior
		toggleInlineFormat(view, before, after);
		closeContextMenu();
	}

	// Toolbar commands - now using unified toggleInlineFormat via wrapSelection
	export function toggleBold() {
		wrapSelection('**', '**');
	}

	export function toggleItalic() {
		wrapSelection('_', '_');
	}

	export function toggleCode() {
		wrapSelection('`', '`');
	}

	export function insertLink() {
		const { from, to } = view!.state.selection.main;
		const selectedText = view!.state.sliceDoc(from, to) || 'link text';
		view!.dispatch({
			changes: { from, to, insert: `[${selectedText}](url)` }
		});
	}

	export function insertImage() {
		insertText('![alt text](image-url)');
	}

	export function insertCodeBlock() {
		insertText('\n```\n\n```\n');
	}

	export function insertHeading(level: number) {
		const prefix = '#'.repeat(level) + ' ';
		const { from } = view!.state.selection.main;
		const line = view!.state.doc.lineAt(from);
		view!.dispatch({
			changes: { from: line.from, to: line.from, insert: prefix }
		});
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
	bind:this={editorContainer} 
	class="editor-container {className}"
	oncontextmenu={handleEditorContextMenu}
></div>

<!-- Context Menu -->
{#if contextMenu}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="editor-context-menu"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px"
		onmouseleave={() => {
			contextMenu = null;
			hoveredCategory = null;
		}}
	>
		{#if hasSelection}
			<!-- Selection-specific operations -->
			<button class="context-item" onclick={handleCut}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
					<path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/>
				</svg>
				Cut
			</button>
			<button class="context-item" onclick={handleCopy}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
					<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
				</svg>
				Copy
			</button>
			<button class="context-item" onclick={handleFindAndReplace}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
					<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
				</svg>
				Find
			</button>
			<div class="context-separator"></div>
			<!-- Inline formatting (always available for any selection) -->
			{#each commonFormattingItems as item (item.label)}
				<button 
					class="context-item context-item-formatted"
					class:item-bold={item.style === 'bold'}
					class:item-italic={item.style === 'italic'}
					class:item-strikethrough={item.style === 'strikethrough'}
					class:item-code={item.style === 'code'}
					onclick={() => insertMarkdown(item.insert, item.action)}
					title={item.shortcut}
				>
					<span class="item-label">{item.displayText}</span>
					{#if item.shortcut}
						<span class="item-shortcut">{item.shortcut}</span>
					{/if}
				</button>
			{/each}
			<div class="context-separator"></div>
			<!-- List and block formatting (better for multiline or whole lines) -->
			{#each commonListItems as item (item.label)}
				<button 
					class="context-item context-item-formatted"
					class:item-code={item.style === 'code' && item.displayText !== 'Block'}
					class:item-code-block={item.displayText === 'Block'}
					onclick={() => insertMarkdown(item.insert, item.action)}
					title={item.shortcut}
				>
					<span class="item-label">{item.displayText}</span>
					{#if item.shortcut}
						<span class="item-shortcut">{item.shortcut}</span>
					{/if}
				</button>
			{/each}
		{:else}
			<!-- No selection - common operations -->
			<button class="context-item" onclick={handleCopy}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
					<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
				</svg>
				Copy
			</button>
			<button class="context-item" onclick={handlePaste}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
					<path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>
				</svg>
				Paste
			</button>
			<button class="context-item" onclick={handleSelectAll}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
					<path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2zM7 17h10V7H7v10zm2-8h6v6H9V9z"/>
				</svg>
				Select All
			</button>
			<div class="context-separator"></div>
			<button class="context-item" onclick={handleFindAndReplace}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
					<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
				</svg>
				Find
			</button>
			<div class="context-separator"></div>
		{/if}

		<!-- Categorized advanced options (hidden when text is selected) -->
		{#if !hasSelection}
		{#each markdownCategories as category (category.name)}
			<div class="category-wrapper" onmouseleave={() => hoveredCategory = null}>
				<button 
					class="context-item category-btn"
					onmouseenter={() => hoveredCategory = category.name}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							hoveredCategory = hoveredCategory === category.name ? null : category.name;
						}
					}}
				>
					{@html categoryIcons[category.name] || categoryIcons['Other']}
					<span class="category-label">{category.name}</span>
					<svg class="arrow" viewBox="0 0 24 24" fill="currentColor" width="11" height="11">
						<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
					</svg>
				</button>

				<!-- Category Submenu -->
				{#if hoveredCategory === category.name}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="editor-context-submenu" role="menu">
						{#each category.items.filter(item => {
							// Filter based on selection context
							if (!hasSelection) return true; // Show all when no selection
							
							// Heading: always available (can apply to lines or selection)
							if (category.name === 'Heading') return true;
							
							// Block items: contextual filtering
							if (category.name === 'Block') {
								// Task: always available
								if (item.displayText === 'Task') return true;
								// Quote: available for any selection
								if (item.displayText === 'Quote') return true;
								// HR: only when no selection or whole line
								if (item.displayText === 'HR') return !hasSelection || selectionInfo.isWholeLine;
								return true;
							}
							
							// Extra: Link works with any selection, others need context
							if (category.name === 'Extra') {
								if (item.displayText === 'Link') return true;
								// Image and Table: better without complex multiline selection
								return !selectionInfo.isMultiline || selectionInfo.lineCount <= 1;
							}
							
							// Other: Math for inline/single-line, Diagram for multiline
							if (category.name === 'Other') {
								if (item.displayText === 'Math') return !selectionInfo.isMultiline || selectionInfo.isSingleWord;
								if (item.displayText === 'Diagram') return selectionInfo.isMultiline;
								return true;
							}
							
							return true;
						}) as item (item.label)}
							<button 
								class="context-item context-item-formatted"
								class:item-code={item.style === 'code' && item.displayText !== 'Block' && item.displayText !== 'Diagram'}
								class:item-code-block={item.displayText === 'Block' && category.name !== 'Math'}
								class:item-mermaid={item.displayText === 'Diagram' || item.label === 'Mermaid Diagram'}
								onclick={() => insertMarkdown(item.insert, item.action)}
								title={item.shortcut}
								role="menuitem"
							>
								<span class="item-label">
									{item.displayText || item.label}
								</span>
								{#if item.shortcut}
									<span class="item-shortcut">{item.shortcut}</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
		{/if}
	</div>
{/if}

<!-- Help Overlay (Ctrl+H) -->
{#if showHelpOverlay}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="help-overlay" onclick={() => showHelpOverlay = false}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="help-content" onclick={(e) => e.stopPropagation()}>
			<div class="help-header">
				<div class="help-header-title">
					<svg class="help-header-icon" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
					</svg>
					<h2>Keyboard Shortcuts</h2>
				</div>
				<button class="help-close" onclick={() => showHelpOverlay = false} aria-label="Close help overlay" title="Close help (Ctrl+H or Esc)">
					<svg viewBox="0 0 24 24" fill="currentColor">
						<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
					</svg>
				</button>
			</div>
			
			<div class="help-sections">
				<div class="help-section">
					<div class="help-section-header">
						<svg class="help-section-icon" viewBox="0 0 24 24" fill="currentColor">
							<path d="M9 3C7.9 3 7 3.9 7 5c0 .89.41 1.68 1.05 2.2l1.75 2.05c.35.42.55.95.55 1.5v3.75c0 1.1.9 2 2 2s2-.9 2-2v-3.75c0-.55.2-1.08.55-1.5l1.75-2.05C15.59 6.68 16 5.89 16 5c0-1.1-.9-2-2-2s-2 .9-2 2c0 .55-.45 1-1 1s-1-.45-1-1c0-1.1-.9-2-2-2zm6 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-8 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
						</svg>
						<h3>Formatting</h3>
					</div>
					<div class="help-items">
						<div class="help-item">
							<span class="help-key">Ctrl+B</span>
							<span class="help-desc">Bold</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+I</span>
							<span class="help-desc">Italic</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+~</span>
							<span class="help-desc">Strikethrough</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+`</span>
							<span class="help-desc">Inline Code</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Q</span>
							<span class="help-desc">Blockquote</span>
						</div>
					</div>
				</div>
				
				<div class="help-section">
					<div class="help-section-header">
						<svg class="help-section-icon" viewBox="0 0 24 24" fill="currentColor">
							<path d="M15 5H5v2h10V5zm0 8H5v2h10v-2zM5 19h10v-2H5v2zM3 14h2v-2H3v2zm0-6h2V6H3v2zm0 12h2v-2H3v2z"/>
						</svg>
						<h3>Lists</h3>
					</div>
					<div class="help-items">
						<div class="help-item">
							<span class="help-key">Ctrl+.</span>
							<span class="help-desc">Bullet List</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Shift+.</span>
							<span class="help-desc">Numbered List</span>
						</div>
					</div>
				</div>
				
				<div class="help-section">
					<div class="help-section-header">
						<svg class="help-section-icon" viewBox="0 0 24 24" fill="currentColor">
							<path d="M5 4v3h5.5v12h3V7H19V4z"/>
						</svg>
						<h3>Headings</h3>
					</div>
					<div class="help-items">
						<div class="help-item">
							<span class="help-key">Ctrl+Alt+1</span>
							<span class="help-desc">Heading 1</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Alt+2</span>
							<span class="help-desc">Heading 2</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Alt+3</span>
							<span class="help-desc">Heading 3</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Alt+4</span>
							<span class="help-desc">Heading 4</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Alt+5</span>
							<span class="help-desc">Heading 5</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Alt+6</span>
							<span class="help-desc">Heading 6</span>
						</div>
					</div>
				</div>
				
				<div class="help-section">
					<div class="help-section-header">
						<svg class="help-section-icon" viewBox="0 0 24 24" fill="currentColor">
							<path d="M13 11H9v2h4v-2zm-3-7H8.5C7.12 4 6 5.12 6 6.5v11C6 18.88 7.12 20 8.5 20h7c1.38 0 2.5-1.12 2.5-2.5v-11C18 5.12 16.88 4 15.5 4H15V3h-2v1h-2V3h-2v1zm7 12H8V6h7v12z"/>
						</svg>
						<h3>Insert</h3>
					</div>
					<div class="help-items">
						<div class="help-item">
							<span class="help-key">Ctrl+K</span>
							<span class="help-desc">Link</span>
						</div>
					</div>
				</div>
				
				<div class="help-section">
					<div class="help-section-header">
						<svg class="help-section-icon" viewBox="0 0 24 24" fill="currentColor">
							<path d="M3 5h2V3H3c-1.1 0-2 .9-2 2v2h2V5zm0 8h2v-2H3v2zm0 8h2v-2H3v2zm8-16v2h2V5h-2zm0 16h2v-2h-2v2zm8-16v2h2V5h-2zm-2 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-8 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm8 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-8 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
						</svg>
						<h3>Multi-Select</h3>
					</div>
					<div class="help-items">
						<div class="help-item">
							<span class="help-key">Ctrl+D</span>
							<span class="help-desc">Select Next Occurrence</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Shift+L</span>
							<span class="help-desc">Select All Occurrences</span>
						</div>
					</div>
				</div>
				
				<div class="help-section">
					<div class="help-section-header">
						<svg class="help-section-icon" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
						</svg>
						<h3>Other</h3>
					</div>
					<div class="help-items">
						<div class="help-item">
							<span class="help-key">Ctrl+H</span>
							<span class="help-desc">Toggle Help</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+F</span>
							<span class="help-desc">Find & Replace</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Z</span>
							<span class="help-desc">Undo</span>
						</div>
						<div class="help-item">
							<span class="help-key">Ctrl+Y</span>
							<span class="help-desc">Redo</span>
						</div>
					</div>
				</div>
			</div>
			
			<div class="help-footer">
				<div class="help-footer-content">
					<svg class="help-footer-icon" viewBox="0 0 24 24" fill="currentColor">
						<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
					</svg>
					<span>Press <kbd>Ctrl+H</kbd> or <kbd>Esc</kbd> to close • Click outside to close</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.editor-container {
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.editor-container :global(.cm-editor) {
		height: 100%;
	}

	.editor-context-menu {
		position: fixed;
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 6px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		z-index: 10000;
		min-width: 180px;
		max-width: 300px;
		overflow: visible;
		padding: 4px 0;
	}

	.category-wrapper {
		position: relative;
	}

	.editor-context-submenu {
		position: absolute;
		top: 0;
		left: 100%;
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 6px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		z-index: 10001;
		min-width: 160px;
		max-width: 250px;
		overflow-y: auto;
		max-height: 500px;
		padding: 4px 0;
		margin-left: -1px;
	}

	.context-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 12px;
		background: transparent;
		border: none;
		color: #c9d1d9;
		font-size: 13px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.08s ease;
		white-space: nowrap;
	}

	.context-item:hover {
		background: #1f6feb;
	}

	.context-item svg {
		flex-shrink: 0;
		opacity: 0.85;
	}

	.category-btn {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		white-space: nowrap;
		padding: 6px 12px;
		font-weight: 500;
	}

	.category-label {
		flex: 1;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.3px;
		text-transform: uppercase;
	}

	.arrow {
		flex-shrink: 0;
		opacity: 0.5;
		transition: opacity 0.08s ease;
	}

	.category-btn:hover .arrow {
		opacity: 0.8;
	}

	.item-label {
		flex: 1;
		font-size: 13px;
	}

	.item-shortcut {
		font-size: 11px;
		color: #6a6a6a;
		margin-left: 8px;
		text-align: right;
		white-space: nowrap;
		opacity: 0.7;
	}

	.context-separator {
		height: 1px;
		background: #30363d;
		margin: 4px 0;
	}

	/* Formatted item styles for visual previews */
	.context-item-formatted {
		font-size: 13px;
	}

	.item-bold .item-label {
		font-weight: 600;
		color: #89d185;
	}

	.item-italic .item-label {
		font-style: italic;
		color: #89d185;
	}

	.item-strikethrough .item-label {
		text-decoration: line-through;
		color: #89d185;
	}

	/* Code styling - only style the label text, not the button */
	.item-code .item-label,
	.item-code-block .item-label {
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
		color: #79c0ff;
		font-weight: 500;
	}

	.item-mermaid .item-label {
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
		color: #7ee787;
		font-weight: 500;
	}

	.context-item-formatted:hover {
		background: #404040;
	}

	.context-item-formatted.item-bold:hover .item-label,
	.context-item-formatted.item-italic:hover .item-label,
	.context-item-formatted.item-strikethrough:hover .item-label {
		color: #7dcf78;
	}

	.context-item-formatted.item-code:hover .item-label,
	.context-item-formatted.item-code-block:hover .item-label {
		color: #a5d6ff;
	}

	.context-item-formatted.item-mermaid:hover .item-label {
		color: #9be9a8;
	}

	/* Help Overlay Styles - matching editor theme */
	.help-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
	}

	.help-content {
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 5px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.8);
		max-width: 700px;
		max-height: 80vh;
		overflow-y: auto;
	}

	.help-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		border-bottom: 1px solid #30363d;
		position: sticky;
		top: 0;
		background: #161b22;
		z-index: 1;
	}

	.help-header-title {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.help-header-icon {
		width: 14px;
		height: 14px;
		color: #58a6ff;
		flex-shrink: 0;
	}

	.help-header h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #c9d1d9;
	}

	.help-close {
		background: transparent;
		border: none;
		color: #8b949e;
		cursor: pointer;
		padding: 4px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
	}

	.help-close svg {
		width: 12px;
		height: 12px;
	}

	.help-close:hover {
		background: #30363d;
		color: #c9d1d9;
	}

	.help-sections {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		padding: 4px;
		gap: 0;
	}

	.help-section {
		padding: 8px;
		border-bottom: 1px solid #30363d;
	}

	.help-section:last-child {
		border-bottom: none;
	}

	.help-section:hover {
		background: transparent;
	}

	.help-section-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
		padding-bottom: 4px;
		border-bottom: 1px solid #30363d;
	}

	.help-section-icon {
		width: 12px;
		height: 12px;
		color: #58a6ff;
		flex-shrink: 0;
	}

	.help-section h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: #58a6ff;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.help-items {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.help-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 6px;
		border-radius: 3px;
	}

	.help-item:hover {
		background: #30363d;
	}

	.help-key {
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
		font-size: 13px;
		font-weight: 500;
		color: #79c0ff;
		min-width: fit-content;
		white-space: nowrap;
	}

	.help-desc {
		font-size: 14px;
		color: #c9d1d9;
		margin-left: auto;
		padding-left: 12px;
		text-align: right;
	}

	.help-footer {
		padding: 8px 12px;
		text-align: center;
		border-top: 1px solid #30363d;
		color: #8b949e;
		font-size: 13px;
		background: #161b22;
		position: sticky;
		bottom: 0;
	}

	.help-footer-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.help-footer-icon {
		width: 12px;
		height: 12px;
		color: #8b949e;
		flex-shrink: 0;
	}

	.help-footer kbd {
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
		font-size: 12px;
		font-weight: 500;
		color: #79c0ff;
		margin: 0 2px;
	}

	/* Scrollbar styling for help content */
	.help-content::-webkit-scrollbar {
		width: 8px;
	}

	.help-content::-webkit-scrollbar-track {
		background: #161b22;
	}

	.help-content::-webkit-scrollbar-thumb {
		background: #30363d;
		border-radius: 4px;
	}

	.help-content::-webkit-scrollbar-thumb:hover {
		background: #484f58;
	}

	/* CodeMirror Search Panel Styling */
	:global(.cm-search label) {
		display: inline-flex !important;
		align-items: center !important;
		gap: 6px !important;
		padding: 4px 8px !important;
		margin: 0 4px !important;
		white-space: nowrap !important;
		font-size: 12px !important;
		color: #d4d4d4 !important;
	}

	:global(.cm-search label input[type="checkbox"]) {
		cursor: pointer !important;
	}

	:global(.cm-search label:hover) {
		background: rgba(88, 166, 255, 0.05) !important;
		border-radius: 3px !important;
	}
</style>


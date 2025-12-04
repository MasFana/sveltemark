<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
	import { EditorState, Compartment } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
	import { languages } from '@codemirror/language-data';
	import { HighlightStyle, syntaxHighlighting, bracketMatching, foldGutter, indentOnInput, foldKeymap } from '@codemirror/language';
	import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, type CompletionContext, type Completion } from '@codemirror/autocomplete';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { lintKeymap } from '@codemirror/lint';
	import { tags } from '@lezer/highlight';
	import { appState } from '$lib/appState.svelte';

	interface Props {
		value?: string;
		onchange?: (value: string) => void;
		onscroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
		class?: string;
	}

	let { value = '', onchange, onscroll, class: className = '' }: Props = $props();

	let editorContainer: HTMLDivElement;
	let view: EditorView | null = null;
	let isUpdating = false;
	let isSyncingScroll = false;

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
		{ label: '```javascript\n\n```', displayLabel: '```javascript', type: 'text', detail: 'JavaScript code' },
		{ label: '```typescript\n\n```', displayLabel: '```typescript', type: 'text', detail: 'TypeScript code' },
		{ label: '```python\n\n```', displayLabel: '```python', type: 'text', detail: 'Python code' },
		{ label: '```mermaid\n\n```', displayLabel: '```mermaid', type: 'text', detail: 'Mermaid diagram' },
		// Math
		{ label: '$math$', displayLabel: '$math$', type: 'text', detail: 'Inline math' },
		{ label: '$$\n\n$$', displayLabel: '$$ Math block', type: 'text', detail: 'Display math block' },
		// Tables
		{ label: '| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |', displayLabel: 'Table', type: 'text', detail: 'Markdown table' },
	];

	// Completion function that provides markdown completions
	function markdownComplete(context: CompletionContext) {
		// Only trigger at line start or after whitespace for structural elements
		const line = context.state.doc.lineAt(context.pos);
		const textBefore = context.state.sliceDoc(line.from, context.pos);
		
		// Check if we're at line start (for headers, lists, etc.)
		const atLineStart = textBefore.trim() === '' || /^\s*$/.test(textBefore);
		
		// Get word being typed
		const word = context.matchBefore(/[\w#*\-`>$\[!|]+/);
		
		// Don't complete if no word and not explicitly requested
		if (!word && !context.explicit) return null;
		
		const from = word ? word.from : context.pos;
		const text = word ? word.text : '';
		
		// Filter completions based on context
		let options = markdownCompletions;
		
		// At line start, prioritize structural elements
		if (atLineStart) {
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
		
		return {
			from,
			options,
			validFor: /^[\w#*\-`>$\[!|]*$/
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
			borderLeftColor: '#58a6ff'
		},
		'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
			backgroundColor: '#264f78'
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
			backgroundColor: '#3c8dbc50',
			outline: '1px solid #3c8dbc'
		},
		'.cm-searchMatch.cm-searchMatch-selected': {
			backgroundColor: '#58a6ff40'
		},
		'.cm-activeLine': {
			backgroundColor: '#161b2280'
		},
		'.cm-selectionMatch': {
			backgroundColor: '#3c8dbc40'
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

	// Create the editor extensions
	function createExtensions() {
		return [
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
				defaultKeymap: true,
				icons: true
			}),
			rectangularSelection(),
			crosshairCursor(),
			highlightActiveLine(),
			highlightSelectionMatches(),

			// Keymaps
			keymap.of([
				...closeBracketsKeymap,
				...defaultKeymap,
				...searchKeymap,
				...historyKeymap,
				...foldKeymap,
				...completionKeymap,
				...lintKeymap,
				indentWithTab
			]),

			// Markdown support
			markdown({
				base: markdownLanguage,
				codeLanguages: languages
			}),

			// GitHub Dark theme and highlighting
			themeCompartment.of([
				githubDarkTheme,
				syntaxHighlighting(githubDarkHighlightStyle)
			]),

			// Word wrap (dynamic)
			wordWrapCompartment.of(appState.wordWrap ? EditorView.lineWrapping : []),

			// Update listener for doc changes only
			EditorView.updateListener.of((update) => {
				if (update.docChanged && !isUpdating) {
					const content = update.state.doc.toString();
					onchange?.(content);
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

	onMount(() => {
		const state = EditorState.create({
			doc: value,
			extensions: createExtensions()
		});

		view = new EditorView({
			state,
			parent: editorContainer
		});
	});

	onDestroy(() => {
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
		
		const scroller = view.scrollDOM;
		const newSections: EditorSectionInfo[] = [];
		
		for (const section of sections) {
			// Get the DOM positions for the start and end lines
			const startLine = Math.max(1, Math.min(section.startLine, view.state.doc.lines));
			const endLine = Math.max(1, Math.min(section.endLine, view.state.doc.lines));
			
			const startLineObj = view.state.doc.line(startLine);
			const endLineObj = view.state.doc.line(endLine);
			
			// Get pixel offsets using lineBlockAt
			const startBlock = view.lineBlockAt(startLineObj.from);
			const endBlock = view.lineBlockAt(endLineObj.to);
			
			const startOffset = startBlock.top;
			const endOffset = endBlock.bottom;
			
			newSections.push({
				startLine,
				endLine,
				editorDimension: {
					startOffset,
					endOffset,
					height: endOffset - startOffset
				}
			});
		}
		
		editorSections = newSections;
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
	const SCROLL_THRESHOLD = 5; // Minimum scroll difference to trigger animation

	// Smooth easing function (ease-out-quad for natural deceleration)
	function easeOutQuad(t: number): number {
		return t * (2 - t);
	}

	// Animate scroll to target position
	function animateScrollTo(targetScroll: number) {
		if (!view) return;
		const scroller = view.scrollDOM;

		// Skip if target is very close to current position (prevents micro-jitter)
		const currentScroll = scroller.scrollTop;
		if (Math.abs(targetScroll - currentScroll) < SCROLL_THRESHOLD) {
			return;
		}

		// If we're already animating toward a similar target, don't restart
		if (animationFrameId !== null && Math.abs(targetScroll - lastTargetScroll) < SCROLL_THRESHOLD) {
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

	// Method to wrap selection with text
	export function wrapSelection(before: string, after: string) {
		if (!view) return;

		const { from, to } = view.state.selection.main;
		const selectedText = view.state.sliceDoc(from, to);
		view.dispatch({
			changes: { from, to, insert: `${before}${selectedText}${after}` },
			selection: { anchor: from + before.length, head: to + before.length }
		});
	}

	// Toolbar commands
	export function toggleBold() {
		wrapSelection('**', '**');
	}

	export function toggleItalic() {
		wrapSelection('*', '*');
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

<div bind:this={editorContainer} class="editor-container {className}"></div>

<style>
	.editor-container {
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.editor-container :global(.cm-editor) {
		height: 100%;
	}
</style>

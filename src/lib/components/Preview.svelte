<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { processMarkdownBlocks, diffBlocks, type MarkdownBlock } from '$lib/markdown';
	import mermaid from 'mermaid';

	interface Props {
		content?: string;
		onscroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
		class?: string;
	}

	let { content = '', onscroll, class: className = '' }: Props = $props();

	let previewContainer: HTMLDivElement;
	let blocks = $state<MarkdownBlock[]>([]);
	let isSyncingScroll = false;
	let processingTimeout: ReturnType<typeof setTimeout> | null = null;

	// Initialize mermaid
	onMount(() => {
		mermaid.initialize({
			startOnLoad: false,
			theme: 'dark',
			securityLevel: 'loose',
			fontFamily: 'inherit'
		});
	});

	// Debounced block processing when content changes
	$effect(() => {
		const currentContent = content;
		
		// Clear any pending processing
		if (processingTimeout) {
			clearTimeout(processingTimeout);
		}

		// Debounce processing to avoid excessive updates
		processingTimeout = setTimeout(async () => {
			const newBlocks = await processMarkdownBlocks(currentContent);
			const diffs = diffBlocks(blocks, newBlocks);
			
			// Check if we have actual changes
			const hasChanges = diffs.some(d => d.type !== 'keep');
			
			if (hasChanges) {
				// Apply the new blocks
				blocks = newBlocks;
			}
		}, 16); // ~60fps debounce
	});

	// Render mermaid diagrams for newly added/updated blocks
	$effect(() => {
		if (blocks.length > 0 && previewContainer) {
			// Use tick to ensure DOM is updated, then render mermaid and add copy buttons
			tick().then(() => {
				renderMermaidDiagrams();
				addCopyButtons();
			});
		}
	});

	async function renderMermaidDiagrams() {
		if (!previewContainer) return;
		
		const mermaidDivs = previewContainer.querySelectorAll('.mermaid:not([data-rendered])');
		for (const div of mermaidDivs) {
			const code = div.getAttribute('data-mermaid');
			if (code) {
				try {
					const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
					const { svg } = await mermaid.render(id, code);
					div.innerHTML = svg;
					div.setAttribute('data-rendered', 'true');
				} catch (err) {
					console.error('Mermaid render error:', err);
					div.innerHTML = `<pre class="mermaid-error">Error rendering diagram: ${err}</pre>`;
					div.setAttribute('data-rendered', 'true');
				}
			}
		}
	}

	// Add copy buttons to code blocks
	function addCopyButtons() {
		if (!previewContainer) return;
		
		const codeBlocks = previewContainer.querySelectorAll('pre:not([data-copy-added])');
		for (const pre of codeBlocks) {
			// Skip mermaid blocks
			if (pre.closest('.mermaid')) continue;
			
			pre.setAttribute('data-copy-added', 'true');
			
			// Create wrapper for positioning
			const wrapper = document.createElement('div');
			wrapper.className = 'code-block-wrapper';
			pre.parentNode?.insertBefore(wrapper, pre);
			wrapper.appendChild(pre);
			
			// Create copy button
			const copyBtn = document.createElement('button');
			copyBtn.className = 'copy-code-btn';
			copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
			copyBtn.title = 'Copy code';
			
			copyBtn.addEventListener('click', async () => {
				const code = pre.querySelector('code');
				const text = code?.textContent || pre.textContent || '';
				
				try {
					await navigator.clipboard.writeText(text);
					copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
					copyBtn.classList.add('copied');
					
					setTimeout(() => {
						copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
						copyBtn.classList.remove('copied');
					}, 2000);
				} catch (err) {
					console.error('Failed to copy:', err);
				}
			});
			
			wrapper.appendChild(copyBtn);
		}
	}

	// Handle scroll events for scroll sync (proportional)
	function handleScroll() {
		if (!previewContainer || !onscroll || isSyncingScroll) return;

		onscroll({
			scrollTop: previewContainer.scrollTop,
			scrollHeight: previewContainer.scrollHeight,
			clientHeight: previewContainer.clientHeight
		});
	}

	// Method to scroll to a specific source line
	export function scrollToLine(lineNumber: number) {
		if (!previewContainer) return;

		const elements = previewContainer.querySelectorAll('[data-source-line]');
		let targetElement: Element | null = null;
		let closestLine = 0;

		for (const el of elements) {
			const elLine = parseInt(el.getAttribute('data-source-line') || '0', 10);
			if (elLine <= lineNumber && elLine > closestLine) {
				closestLine = elLine;
				targetElement = el;
			}
		}

		if (targetElement) {
			targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	// Method to scroll by percentage (for proportional scroll sync)
	export function scrollToPercent(percent: number) {
		if (!previewContainer) return;
		const maxScroll = previewContainer.scrollHeight - previewContainer.clientHeight;
		isSyncingScroll = true;
		previewContainer.scrollTop = maxScroll * percent;
		// Reset sync flag after scroll completes
		requestAnimationFrame(() => {
			isSyncingScroll = false;
		});
	}

	// Get current scroll percentage
	export function getScrollPercent(): number {
		if (!previewContainer) return 0;
		const maxScroll = previewContainer.scrollHeight - previewContainer.clientHeight;
		return maxScroll > 0 ? previewContainer.scrollTop / maxScroll : 0;
	}

	// Get rendered HTML content for printing (with light theme mermaid)
	export async function getHTMLForPrint(): Promise<string> {
		if (!previewContainer) return blocks.map(b => b.html).join('\n');
		
		// Clone the content
		const clone = previewContainer.cloneNode(true) as HTMLDivElement;
		
		// Re-render mermaid diagrams with light theme for printing
		const mermaidDivs = clone.querySelectorAll('.mermaid');
		for (const div of mermaidDivs) {
			const code = div.getAttribute('data-mermaid');
			if (code) {
				try {
					// Temporarily switch to light theme
					mermaid.initialize({
						startOnLoad: false,
						theme: 'default',
						securityLevel: 'loose',
						fontFamily: 'inherit'
					});
					const id = `mermaid-print-${Math.random().toString(36).substr(2, 9)}`;
					const { svg } = await mermaid.render(id, code);
					div.innerHTML = svg;
					// Restore dark theme
					mermaid.initialize({
						startOnLoad: false,
						theme: 'dark',
						securityLevel: 'loose',
						fontFamily: 'inherit'
					});
				} catch (err) {
					console.error('Mermaid print render error:', err);
				}
			}
		}
		
		// Extract content from markdown-block wrappers to get clean HTML
		const blockDivs = clone.querySelectorAll('.markdown-block');
		if (blockDivs.length > 0) {
			// Collect innerHTML from each block wrapper
			const htmlParts: string[] = [];
			blockDivs.forEach(blockDiv => {
				htmlParts.push(blockDiv.innerHTML);
			});
			return htmlParts.join('\n');
		}
		
		return clone.innerHTML;
	}

	// Get rendered HTML content (includes rendered mermaid SVGs - dark theme)
	export function getHTML(): string {
		// Return the actual DOM content which includes rendered mermaid diagrams
		return previewContainer?.innerHTML || blocks.map(b => b.html).join('\n');
	}
</script>

<div
	bind:this={previewContainer}
	class="preview-container markdown-body {className}"
	onscroll={handleScroll}
>
	{#each blocks as block (block.id)}
		<div class="markdown-block" data-block-id={block.id} data-start-line={block.startLine}>
			{@html block.html}
		</div>
	{/each}
</div>

<style>
	.preview-container {
		height: 100%;
		width: 100%;
		overflow-y: auto;
		padding: 20px;
		background: #0d1117;
		color: #c9d1d9;
	}

	/* Block wrapper - seamless rendering */
	.markdown-block {
		display: contents;
	}

	/* Dark scrollbar - matches editor */
	.preview-container::-webkit-scrollbar {
		width: 12px;
		height: 12px;
	}

	.preview-container::-webkit-scrollbar-track {
		background: #0d1117;
	}

	.preview-container::-webkit-scrollbar-thumb {
		background: #30363d;
		border-radius: 6px;
		border: 3px solid #0d1117;
	}

	.preview-container::-webkit-scrollbar-thumb:hover {
		background: #484f58;
	}

	/* GitHub markdown dark theme overrides */
	.preview-container :global(h1),
	.preview-container :global(h2),
	.preview-container :global(h3),
	.preview-container :global(h4),
	.preview-container :global(h5),
	.preview-container :global(h6) {
		color: #c9d1d9;
		border-bottom-color: #21262d;
	}

	.preview-container :global(a) {
		color: #58a6ff;
	}

	.preview-container :global(code) {
		background: #161b22;
		color: #c9d1d9;
		padding: 0.2em 0.4em;
		border-radius: 6px;
	}

	.preview-container :global(pre) {
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 6px;
		padding: 16px;
		overflow-x: auto;
	}

	.preview-container :global(pre code) {
		background: transparent;
		padding: 0;
	}

	.preview-container :global(blockquote) {
		color: #8b949e;
		border-left-color: #3b434b;
	}

	.preview-container :global(table) {
		border-collapse: collapse;
		width: 100%;
	}

	.preview-container :global(th),
	.preview-container :global(td) {
		border: 1px solid #30363d;
		padding: 8px 12px;
	}

	.preview-container :global(th) {
		background: #161b22;
	}

	.preview-container :global(tr:nth-child(even)) {
		background: #161b22;
	}

	.preview-container :global(hr) {
		border-color: #21262d;
	}

	/* Mermaid diagram styling */
	.preview-container :global(.mermaid) {
		background: #161b22;
		padding: 16px;
		border-radius: 6px;
		margin: 16px 0;
		text-align: center;
	}

	.preview-container :global(.mermaid-error) {
		color: #f85149;
		background: #161b22;
		padding: 16px;
		border-radius: 6px;
		border: 1px solid #f85149;
	}

	/* KaTeX styling */
	.preview-container :global(.katex-display) {
		overflow-x: auto;
		overflow-y: hidden;
		padding: 8px 0;
	}

	/* Task list styling */
	.preview-container :global(input[type='checkbox']) {
		margin-right: 8px;
	}

	/* Code block copy button */
	.preview-container :global(.code-block-wrapper) {
		position: relative;
		margin: 16px 0;
	}

	.preview-container :global(.code-block-wrapper pre) {
		margin: 0;
	}

	.preview-container :global(.copy-code-btn) {
		position: absolute;
		top: 8px;
		right: 8px;
		padding: 6px 8px;
		background: #30363d;
		border: 1px solid #484f58;
		border-radius: 6px;
		color: #8b949e;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.2s, background 0.2s, color 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
	}

	.preview-container :global(.code-block-wrapper:hover .copy-code-btn) {
		opacity: 1;
	}

	.preview-container :global(.copy-code-btn:hover) {
		background: #484f58;
		color: #c9d1d9;
	}

	.preview-container :global(.copy-code-btn.copied) {
		background: #238636;
		color: #ffffff;
		border-color: #3fb950;
	}

	.preview-container :global(.copy-code-btn svg) {
		width: 16px;
		height: 16px;
	}
</style>

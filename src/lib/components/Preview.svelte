<script lang="ts">
	import { onMount } from 'svelte';
	import { processMarkdown } from '$lib/markdown';
	import mermaid from 'mermaid';

	interface Props {
		content?: string;
		onscroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
		class?: string;
	}

	let { content = '', onscroll, class: className = '' }: Props = $props();

	let previewContainer: HTMLDivElement;
	let htmlContent = $state<string>('');
	let isSyncingScroll = false;

	// Initialize mermaid
	onMount(() => {
		mermaid.initialize({
			startOnLoad: false,
			theme: 'dark',
			securityLevel: 'loose',
			fontFamily: 'inherit'
		});
	});

	// Process markdown when content changes
	$effect(() => {
		processMarkdown(content).then((html) => {
			htmlContent = html;
		});
	});

	// Render mermaid diagrams after HTML is updated
	$effect(() => {
		if (htmlContent && previewContainer) {
			// Use setTimeout to ensure DOM is updated
			setTimeout(async () => {
				const mermaidDivs = previewContainer.querySelectorAll('.mermaid');
				for (const div of mermaidDivs) {
					const code = div.getAttribute('data-mermaid');
					if (code && !div.querySelector('svg')) {
						try {
							const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
							const { svg } = await mermaid.render(id, code);
							div.innerHTML = svg;
						} catch (err) {
							console.error('Mermaid render error:', err);
							div.innerHTML = `<pre class="mermaid-error">Error rendering diagram: ${err}</pre>`;
						}
					}
				}
			}, 0);
		}
	});

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
		if (!previewContainer) return htmlContent;
		
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
		
		return clone.innerHTML;
	}

	// Get rendered HTML content (includes rendered mermaid SVGs - dark theme)
	export function getHTML(): string {
		// Return the actual DOM content which includes rendered mermaid diagrams
		return previewContainer?.innerHTML || htmlContent;
	}
</script>

<div
	bind:this={previewContainer}
	class="preview-container markdown-body {className}"
	onscroll={handleScroll}
>
	{@html htmlContent}
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

	/* Dark scrollbar */
	.preview-container::-webkit-scrollbar {
		width: 12px;
		height: 12px;
	}

	.preview-container::-webkit-scrollbar-track {
		background: #1e1e1e;
	}

	.preview-container::-webkit-scrollbar-thumb {
		background: #424242;
		border-radius: 6px;
		border: 3px solid #1e1e1e;
	}

	.preview-container::-webkit-scrollbar-thumb:hover {
		background: #555555;
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
</style>

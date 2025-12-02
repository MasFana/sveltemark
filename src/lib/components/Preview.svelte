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

	// Section dimensions for smart scroll sync
	interface SectionDimension {
		startOffset: number;  // Pixel offset from top of container
		endOffset: number;    // End pixel offset
		height: number;       // Height in pixels
	}

	interface SectionInfo {
		block: MarkdownBlock;
		previewDimension: SectionDimension;
	}

	let sectionInfoList = $state<SectionInfo[]>([]);

	// Initialize mermaid
	onMount(() => {
		mermaid.initialize({
			startOnLoad: false,
			theme: 'dark',
			securityLevel: 'loose',
			fontFamily: 'inherit',
			htmlLabels: false,
			markdownAutoWrap: true,
			wrap: true,
			
			
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
			tick().then(async () => {
				await renderMermaidDiagrams();
				addCopyButtons();
				// Measure section dimensions after all rendering is complete
				measureSectionDimensions();
			});
		}
	});

	// Measure the dimensions of each section in the preview
	function measureSectionDimensions() {
		if (!previewContainer) return;

		const blockElements = previewContainer.querySelectorAll('.markdown-block');
		const newSectionInfoList: SectionInfo[] = [];

		blocks.forEach((block, index) => {
			const element = blockElements[index] as HTMLElement;
			if (element) {
				// For display:contents elements, we need to measure their children
				const firstChild = element.firstElementChild as HTMLElement;
				const lastChild = element.lastElementChild as HTMLElement;
				
				let startOffset = 0;
				let endOffset = 0;
				
				if (firstChild && lastChild) {
					// Get the actual visual bounds
					startOffset = firstChild.offsetTop;
					// For the end, we need to account for the full height of the last child
					endOffset = lastChild.offsetTop + lastChild.offsetHeight;
				} else if (element.offsetHeight > 0) {
					// Fallback for non-contents elements
					startOffset = element.offsetTop;
					endOffset = element.offsetTop + element.offsetHeight;
				}

				newSectionInfoList.push({
					block,
					previewDimension: {
						startOffset,
						endOffset,
						height: endOffset - startOffset
					}
				});
			}
		});

		sectionInfoList = newSectionInfoList;
	}

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

	// Handle scroll events for scroll sync (section-based)
	function handleScroll() {
		if (!previewContainer || !onscroll || isSyncingScroll) return;

		onscroll({
			scrollTop: previewContainer.scrollTop,
			scrollHeight: previewContainer.scrollHeight,
			clientHeight: previewContainer.clientHeight
		});
	}

	// Get scroll position as a continuous value across all sections
	// Returns fractional section index for smooth interpolation
	export function getScrollPosition(): { sectionIdx: number; posInSection: number } | null {
		if (!previewContainer || sectionInfoList.length === 0) return null;

		const scrollTop = previewContainer.scrollTop;
		const maxScroll = previewContainer.scrollHeight - previewContainer.clientHeight;
		
		// Handle edge cases
		if (maxScroll <= 0) return { sectionIdx: 0, posInSection: 0 };
		if (scrollTop <= 0) return { sectionIdx: 0, posInSection: 0 };
		if (scrollTop >= maxScroll) {
			return { sectionIdx: sectionInfoList.length - 1, posInSection: 1 };
		}
		
		// Find which section we're in
		for (let i = 0; i < sectionInfoList.length; i++) {
			const section = sectionInfoList[i];
			const dim = section.previewDimension;
			
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
			if (i < sectionInfoList.length - 1) {
				const nextSection = sectionInfoList[i + 1];
				const gapStart = dim.endOffset;
				const gapEnd = nextSection.previewDimension.startOffset;
				
				if (scrollTop >= gapStart && scrollTop < gapEnd) {
					// Interpolate through the gap - treat it as end of current section
					return {
						sectionIdx: i,
						posInSection: 1 // At end of section during gap
					};
				}
			}
		}
		
		// Fallback: use last section
		return { sectionIdx: sectionInfoList.length - 1, posInSection: 1 };
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
		if (!previewContainer) return;

		// Skip if target is very close to current position (prevents micro-jitter)
		const currentScroll = previewContainer.scrollTop;
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
			
			if (previewContainer) {
				previewContainer.scrollTop = Math.round(newScroll);
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
		if (!previewContainer || sectionInfoList.length === 0) return;

		const section = sectionInfoList[Math.min(sectionIdx, sectionInfoList.length - 1)];
		if (!section) return;

		const dim = section.previewDimension;
		const targetScroll = dim.startOffset + (dim.height * posInSection);
		const clampedTarget = Math.max(0, Math.min(targetScroll, 
			previewContainer.scrollHeight - previewContainer.clientHeight));
		
		// Direct scroll - feedback prevention handled by scrollSource in parent
		isSyncingScroll = true;
		previewContainer.scrollTop = clampedTarget;
		isSyncingScroll = false;
	}

	// Method to scroll to a specific pixel offset (for anchor-based sync)
	export function scrollToOffset(offset: number) {
		if (!previewContainer) return;
		const clampedOffset = Math.max(0, Math.min(offset, 
			previewContainer.scrollHeight - previewContainer.clientHeight));
		isSyncingScroll = true;
		previewContainer.scrollTop = clampedOffset;
		isSyncingScroll = false;
	}

	// Get section info for scroll sync (blocks with their line ranges)
	export function getSectionInfo(): Array<{ startLine: number; endLine: number; previewDimension: SectionDimension }> {
		return sectionInfoList.map(s => ({
			startLine: s.block.startLine,
			endLine: s.block.endLine,
			previewDimension: s.previewDimension
		}));
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

	// Method to scroll by percentage (fallback for proportional scroll sync)
	export function scrollToPercent(percent: number) {
		if (!previewContainer) return;
		const maxScroll = previewContainer.scrollHeight - previewContainer.clientHeight;
		// Direct scroll - feedback prevention handled by scrollSource in parent
		isSyncingScroll = true;
		previewContainer.scrollTop = maxScroll * percent;
		isSyncingScroll = false;
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
					
					// Normalize the SVG for better print output
					const svgElement = div.querySelector('svg');
					if (svgElement) {
						// Remove fixed height/width, let CSS control sizing
						svgElement.removeAttribute('height');
						svgElement.removeAttribute('width');
						
						// Remove inline max-width style that mermaid sets (often huge values)
						svgElement.style.removeProperty('max-width');
						
						// Set proper responsive sizing
						svgElement.style.maxWidth = '100%';
						svgElement.style.height = 'auto';
						svgElement.style.display = 'block';
						svgElement.style.margin = '0 auto';
						
						// Fix viewBox if it has excessive padding
						// Mermaid sometimes sets viewBox with negative coords or large padding
						const viewBox = svgElement.getAttribute('viewBox');
						if (viewBox) {
							const parts = viewBox.split(' ').map(Number);
							if (parts.length === 4) {
								// If viewBox starts with negative coordinates, it might cause offset
								// Keep the viewBox but ensure the SVG displays properly
								const [minX, minY, width, height] = parts;
								
								// If the viewBox has significant negative offset, adjust
								if (minY < -50) {
									// Adjust viewBox to start from a reasonable position
									const newMinY = Math.max(minY, -20);
									const newHeight = height + (minY - newMinY);
									svgElement.setAttribute('viewBox', `${minX} ${newMinY} ${width} ${newHeight}`);
								}
							}
						}
					}
					
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
	/* Display math ($$...$$) - centered on its own line */
	.preview-container :global(.katex-display) {
		display: block;
		text-align: center;
		margin: 1em 0;
		overflow-x: auto;
		overflow-y: hidden;
		padding: 8px 0;
	}

	.preview-container :global(.katex-display > .katex) {
		display: inline-block;
		text-align: center;
	}

	/* Inline math ($...$) - flows with text */
	.preview-container :global(.katex:not(.katex-display .katex)) {
		font-size: 1.1em;
	}

	/* KaTeX color for dark theme */
	.preview-container :global(.katex) {
		color: #c9d1d9;
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

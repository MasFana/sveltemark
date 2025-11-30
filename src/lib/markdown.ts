import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import type { Root as MdastRoot } from 'mdast';
import type { Root as HastRoot, Element } from 'hast';
import { visit } from 'unist-util-visit';

// Custom plugin to inject source line numbers into HTML elements
function rehypeSourceLines() {
    return (tree: HastRoot) => {
        visit(tree, 'element', (node: Element) => {
            if (node.position?.start?.line) {
                node.properties = node.properties || {};
                node.properties['data-source-line'] = node.position.start.line;
            }
        });
    };
}

// Custom plugin to handle mermaid code blocks
function remarkMermaid() {
    return (tree: MdastRoot) => {
        visit(tree, 'code', (node: { lang?: string | null; meta?: string | null; value: string; type: string; data?: { hName?: string; hProperties?: Record<string, unknown> } }) => {
            if (node.lang === 'mermaid') {
                // Transform to a div that will be processed by mermaid.js client-side
                node.type = 'code';
                node.data = node.data || {};
                node.data.hName = 'div';
                node.data.hProperties = {
                    className: ['mermaid'],
                    'data-mermaid': node.value
                };
            }
        });
    };
}

// Create the unified processor
const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkMermaid)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeSlug)
    .use(rehypeSourceLines)
    .use(rehypeStringify, { allowDangerousHtml: true });

/**
 * Process markdown string to HTML
 */
export async function processMarkdown(markdown: string): Promise<string> {
    const result = await processor.process(markdown);
    return String(result);
}

/**
 * Synchronous version for when async isn't needed
 */
export function processMarkdownSync(markdown: string): string {
    const result = processor.processSync(markdown);
    return String(result);
}

// Export the processor for advanced use cases
export { processor };

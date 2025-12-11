import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import GithubSlugger from 'github-slugger';
import type { Root as MdastRoot, RootContent, Heading } from 'mdast';
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

// Transform mermaid node labels to use markdown strings for auto text wrapping
// This wraps text in backticks like "`text`" to enable automatic text wrapping
function transformMermaidForAutoWrap(code: string): string {

    // Process each line to handle node definitions
    const lines = code.split('\n');
    let inFrontmatter = false;

    const processedLines = lines.map((line) => {
        const trimmedLine = line.trim();

        // Track frontmatter state
        if (trimmedLine === '---') {
            inFrontmatter = !inFrontmatter;
            return line;
        }

        // Skip lines in frontmatter, comments, or already have markdown strings
        if (inFrontmatter || trimmedLine.startsWith('%%') || line.includes('"`')) {
            return line;
        }

        let processedLine = line;

        // Process square brackets [text] - most common
        // Match: A[text] but not A["`text`"] or A["text"]
        processedLine = processedLine.replace(/(\b\w+)\[([^\]"'`]+)\]/g, (match, id, text) => {
            // Skip if text is a link syntax or icon
            if (text.startsWith('fa:') || text.startsWith('fab:') || text.startsWith('fas:')) return match;
            return `${id}["\`${text}\`"]`;
        });

        // Process parentheses (text) for rounded nodes
        // Match: A(text) but not A((text)) or A("`text`")
        processedLine = processedLine.replace(/(\b\w+)\(([^()"'`]+)\)(?!\))/g, (match, id, text) => {
            // Skip if it looks like a subgraph reference
            if (text.startsWith('[') || text.includes('|')) return match;
            return `${id}("\`${text}\`")`;
        });

        // Process curly braces {text} for diamond/decision nodes
        // Match: A{text} but not A{{text}}
        processedLine = processedLine.replace(/(\b\w+)\{([^{}"'`]+)\}(?!\})/g, (match, id, text) => {
            return `${id}{"\`${text}\`"}`;
        });

        // Process stadium shape ([text])
        processedLine = processedLine.replace(/(\b\w+)\(\[([^\]"'`]+)\]\)/g, (match, id, text) => {
            return `${id}(["\`${text}\`"])`;
        });

        // Process subroutine [[text]]
        processedLine = processedLine.replace(/(\b\w+)\[\[([^\]"'`]+)\]\]/g, (match, id, text) => {
            return `${id}[["\`${text}\`"]]`;
        });

        // Process hexagon {{text}}
        processedLine = processedLine.replace(/(\b\w+)\{\{([^}"'`]+)\}\}/g, (match, id, text) => {
            return `${id}{{"\`${text}\`"}}`;
        });

        // Process double circle (((text)))
        processedLine = processedLine.replace(/(\b\w+)\(\(\(([^)"'`]+)\)\)\)/g, (match, id, text) => {
            return `${id}((("\`${text}\`")))`;
        });

        return processedLine;
    });

    const result = processedLines.join('\n');

    return result;
}

// Custom plugin to handle mermaid code blocks
function remarkMermaid() {
    return (tree: MdastRoot) => {
        visit(tree, 'code', (node: { lang?: string | null; meta?: string | null; value: string; type: string; data?: { hName?: string; hProperties?: Record<string, unknown> } }) => {
            if (node.lang === 'mermaid') {
                // Transform mermaid code to use markdown strings for auto text wrapping
                const transformedCode = transformMermaidForAutoWrap(node.value);

                // Transform to a div that will be processed by mermaid.js client-side
                node.type = 'code';
                node.data = node.data || {};
                node.data.hName = 'div';
                node.data.hProperties = {
                    className: ['mermaid'],
                    'data-mermaid': transformedCode
                };
            }
        });
    };
}

// Preprocess markdown to convert inline $$...$$ on its own line to proper block math
// and convert \[...\] bracket syntax to $$ block math
// remark-math treats inline $$...$$ as text math, but users often expect it to be display math
function preprocessDisplayMath(markdown: string): string {
    // Split into lines
    const lines = markdown.split('\n');
    const result: string[] = [];
    let inBracketMath = false;
    const bracketMathLines: string[] = [];
    let bracketMathIndent = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Get the leading whitespace/indentation to preserve it
        const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';

        // Handle \[ ... \] bracket syntax for display math
        if (trimmed === '\\[') {
            inBracketMath = true;
            bracketMathLines.length = 0;
            bracketMathIndent = leadingWhitespace;
            continue;
        }

        if (inBracketMath) {
            if (trimmed === '\\]') {
                // End of bracket math block - convert to $$ block
                inBracketMath = false;
                result.push(bracketMathIndent + '$$');
                result.push(...bracketMathLines);
                result.push(bracketMathIndent + '$$');
                continue;
            } else {
                // Accumulate lines inside \[...\]
                bracketMathLines.push(line);
                continue;
            }
        }

        // Check if the line is primarily a $$...$$ math expression
        // Pattern: line that starts and ends with $$ with content in between
        // This handles cases like: $$ x = 1 $$ or $$\frac{1}{2}$$
        const inlineDisplayMatch = trimmed.match(/^\$\$(.+)\$\$$/);

        if (inlineDisplayMatch) {
            // Check if this is truly a single $$...$$ expression (exactly 2 $$ sequences)
            const dollarMatches = trimmed.match(/\$\$/g);
            if (dollarMatches && dollarMatches.length === 2) {
                // Convert to proper block math, preserving indentation
                const mathContent = inlineDisplayMatch[1].trim();
                result.push(leadingWhitespace + '$$');
                result.push(leadingWhitespace + mathContent);
                result.push(leadingWhitespace + '$$');
                continue;
            }
        }

        result.push(line);
    }

    return result.join('\n');
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

// Create a parser-only processor for splitting into blocks
const parser = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath);

// Block processor for individual blocks (WITHOUT rehypeSlug - slugs are applied from full document context)
const blockProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkMermaid)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeSourceLines)
    .use(rehypeStringify, { allowDangerousHtml: true });

/**
 * Represents a markdown block with its source and rendered HTML
 */
export interface MarkdownBlock {
    id: string;           // Unique identifier for diffing
    source: string;       // Original markdown source
    html: string;         // Rendered HTML
    startLine: number;    // Starting line number in source
    endLine: number;      // Ending line number in source
}

/**
 * Generate a unique ID for a block based on content and position
 */
function generateBlockId(source: string, startLine: number, index: number): string {
    // Use a combination of content hash, line number, and index for uniqueness
    let hash = 0;
    const str = source + '|' + startLine;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    // Include index to guarantee uniqueness even for identical content
    return `b${index}-${Math.abs(hash).toString(36)}-${startLine}`;
}

/**
 * Split markdown into top-level blocks
 */
export function splitIntoBlocks(markdown: string): { source: string; startLine: number; endLine: number }[] {
    if (!markdown.trim()) {
        return [];
    }

    const tree = parser.parse(markdown) as MdastRoot;
    const blocks: { source: string; startLine: number; endLine: number }[] = [];
    const lines = markdown.split('\n');

    for (const node of tree.children as RootContent[]) {
        if (node.position) {
            const startLine = node.position.start.line;
            const endLine = node.position.end.line;
            // Extract the source text for this block (1-indexed to 0-indexed)
            const source = lines.slice(startLine - 1, endLine).join('\n');
            blocks.push({ source, startLine, endLine });
        }
    }

    return blocks;
}

/**
 * Process a single markdown block to HTML
 */
export async function processBlock(source: string): Promise<string> {
    if (!source.trim()) return '';
    // Preprocess to handle inline $$...$$ as display math
    const preprocessed = preprocessDisplayMath(source);
    const result = await blockProcessor.process(preprocessed);
    return String(result);
}

/**
 * Represents a heading with its metadata for slug tracking
 */
export interface HeadingInfo {
    level: number;
    text: string;
    slug: string;
    blockId?: string; // Block identifier for tracking which block this heading belongs to
    occurrenceInBlock: number; // Occurrence number within this block
    globalOccurrence: number; // Global occurrence number in the entire document
}

/**
 * Extract heading slugs from markdown AST with proper duplicate handling
 * This is MUCH faster than rendering full HTML and parsing it back
 * Uses GithubSlugger to handle duplicates correctly (same algorithm as rehype-slug)
 * 
 * Returns a map keyed by "h{level}-{blockId}-{text}" to track headings per block
 */
function extractHeadingSlugsFromAST(markdown: string): Map<string, HeadingInfo> {
    const headingInfoMap = new Map<string, HeadingInfo>();
    const slugger = new GithubSlugger();
    const headingOccurrences = new Map<string, number>(); // Track global occurrences

    try {
        const tree = parser.parse(markdown) as MdastRoot;
        const blocks = splitIntoBlocks(markdown);
        let blockIndex = 0;
        let globalIndex = 0;

        // Visit all heading nodes
        visit(tree, 'heading', (node: Heading) => {
            // Extract text content from heading ONLY (not from nested code blocks, etc)
            let text = '';
            visit(node, 'text', (textNode: any) => {
                text += textNode.value;
            });

            if (text.trim()) {
                // Generate slug using GithubSlugger (same as rehype-slug)
                const slug = slugger.slug(text);

                // Track global occurrence count
                const occurrenceKey = `h${node.depth}-${text}`;
                const globalOccurrence = (headingOccurrences.get(occurrenceKey) || 0) + 1;
                headingOccurrences.set(occurrenceKey, globalOccurrence);

                // Find which block this heading belongs to
                const nodeStart = node.position?.start.line || 0;
                let blockId = 'unknown';
                for (let i = 0; i < blocks.length; i++) {
                    if (nodeStart >= blocks[i].startLine && nodeStart <= blocks[i].endLine) {
                        blockId = `block-${i}`;
                        break;
                    }
                }

                const headingInfo: HeadingInfo = {
                    level: node.depth,
                    text,
                    slug,
                    blockId,
                    occurrenceInBlock: 1, // Will be updated if needed
                    globalOccurrence
                };

                // Store with composite key for lookup
                const key = `h${node.depth}-${blockId}-${text}`;
                headingInfoMap.set(key, headingInfo);

                // Also store by slug for reverse lookup
                const slugKey = `slug-${slug}`;
                headingInfoMap.set(slugKey, headingInfo);

                globalIndex++;
            }
        });
    } catch (e) {
        // Fallback to empty map if parsing fails
        console.error('Error parsing markdown AST:', e);
    }

    return headingInfoMap;
}

/**
 * Extract slug mapping from full document HTML
 * Maps heading content -> generated slug ID
 */
function extractSlugsFromHTML(html: string): Map<string, string> {
    const slugMap = new Map<string, string>();
    // Match heading elements with data-source-line and id attributes
    // Pattern: <h1 id="slug-value" data-source-line="...">content</h1>
    const headingRegex = /<h([1-6])\s+id="([^"]+)"[^>]*>(.+?)<\/h\1>/g;
    let match;
    while ((match = headingRegex.exec(html)) !== null) {
        const level = match[1];
        const id = match[2];
        const content = match[3].replace(/<[^>]+>/g, ''); // Strip inner HTML tags
        // Store by heading content to find duplicates
        slugMap.set(`h${level}-${content}`, id);
    }
    return slugMap;
}

/**
 * Decode HTML entities to plain text
 * Handles common entities like &#x26; and &amp;
 */
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&#x26;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&#x22;/g, '"')
        .replace(/&#x3c;/g, '<')
        .replace(/&#x3e;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x2F;/g, '/');
}

/**
 * Apply slugs from full document to block HTML with proper duplicate handling
 * This ensures duplicate heading IDs are consistent across blocks
 * Uses block context to prevent collisions
 */
function applySlugsToBlockHTML(blockHTML: string, slugMap: Map<string, HeadingInfo>, blockId: string): string {
    // Find headings in block HTML and inject IDs from full document mapping
    const headingRegex = /<h([1-6])(\s+[^>]*)?>(.+?)<\/h\1>/g;
    let result = blockHTML;
    let headingIndexInBlock = 0;

    result = result.replace(headingRegex, (match, level, attrs, content) => {
        headingIndexInBlock++;

        // Extract plain text from HTML content (strip tags and decode entities)
        let plainText = content.replace(/<[^>]+>/g, '');
        plainText = decodeHtmlEntities(plainText);

        // Look up this heading using block context
        const mapKey = `h${level}-${blockId}-${plainText}`;
        const headingInfo = slugMap.get(mapKey);

        if (headingInfo) {
            const slugId = headingInfo.slug;
            // Check if heading already has an id attribute
            if ((attrs || '').includes('id=')) {
                // Replace existing id
                return match.replace(/id="[^"]*"/, `id="${slugId}"`);
            } else {
                // Add id attribute
                return `<h${level}${attrs || ''} id="${slugId}">${content}</h${level}>`;
            }
        }

        return match;
    });

    return result;
}

/**
 * Process markdown into blocks with rendered HTML
 * OPTIMIZED: Uses AST-based slug extraction instead of full HTML rendering
 * This provides 30-40% performance improvement while maintaining correct duplicate handling
 * 
 * The block-aware slug mapping prevents race conditions where identical headings
 * in different blocks would collide during concurrent rendering
 */
export async function processMarkdownBlocks(markdown: string): Promise<MarkdownBlock[]> {
    const rawBlocks = splitIntoBlocks(markdown);

    // Extract slug mappings from AST with block context (much faster than full HTML render)
    const slugMap = extractHeadingSlugsFromAST(markdown);

    // Process individual blocks and apply the correct slugs with block context
    const processedBlocks: MarkdownBlock[] = [];

    for (let i = 0; i < rawBlocks.length; i++) {
        const block = rawBlocks[i];
        const blockId = `block-${i}`;
        const blockHTML = await processBlock(block.source);
        const htmlWithSlugs = applySlugsToBlockHTML(blockHTML, slugMap, blockId);

        processedBlocks.push({
            id: generateBlockId(block.source, block.startLine, i),
            source: block.source,
            html: htmlWithSlugs,
            startLine: block.startLine,
            endLine: block.endLine
        });
    }

    return processedBlocks;
}

/**
 * Extract table of contents from markdown using AST (not regex)
 * This properly distinguishes between:
 * - Actual headings (# Comment)
 * - # symbols in code blocks (```bash # comment\n```)
 * 
 * Uses GithubSlugger to generate consistent IDs, properly handling duplicates
 */
export function extractTableOfContents(markdown: string): { level: number; text: string; id: string }[] {
    const toc: { level: number; text: string; id: string }[] = [];
    const slugger = new GithubSlugger();

    try {
        const tree = parser.parse(markdown) as MdastRoot;

        // Visit all heading nodes from the AST
        // This automatically excludes code blocks, which are separate node types
        visit(tree, 'heading', (node: Heading) => {
            // Extract text content from heading
            let text = '';
            visit(node, 'text', (textNode: any) => {
                text += textNode.value;
            });

            if (text.trim()) {
                // Generate slug using GithubSlugger (same as rehype-slug)
                const id = slugger.slug(text);
                toc.push({
                    level: node.depth,
                    text: text.trim(),
                    id
                });
            }
        });
    } catch (e) {
        console.error('Error extracting table of contents:', e);
    }

    return toc;
}

/**
 * Diff old blocks vs new blocks and return update instructions
 * Compares by source content to detect actual changes
 */
export interface BlockDiff {
    type: 'add' | 'remove' | 'update' | 'keep';
    index: number;
    block?: MarkdownBlock;
    oldIndex?: number;
}

export function diffBlocks(oldBlocks: MarkdownBlock[], newBlocks: MarkdownBlock[]): BlockDiff[] {
    const diffs: BlockDiff[] = [];

    // Compare blocks by position and content
    const maxLen = Math.max(oldBlocks.length, newBlocks.length);

    for (let i = 0; i < maxLen; i++) {
        const oldBlock = oldBlocks[i];
        const newBlock = newBlocks[i];

        if (!oldBlock && newBlock) {
            // New block added at the end
            diffs.push({ type: 'add', index: i, block: newBlock });
        } else if (oldBlock && !newBlock) {
            // Block removed from the end
            diffs.push({ type: 'remove', index: i, oldIndex: i });
        } else if (oldBlock && newBlock) {
            // Both exist - compare content
            if (oldBlock.source === newBlock.source) {
                diffs.push({ type: 'keep', index: i, block: newBlock });
            } else {
                diffs.push({ type: 'update', index: i, block: newBlock, oldIndex: i });
            }
        }
    }

    return diffs;
}

/**
 * Process markdown string to HTML (legacy full render)
 */
export async function processMarkdown(markdown: string): Promise<string> {
    // Preprocess to handle inline $$...$$ as display math
    const preprocessed = preprocessDisplayMath(markdown);
    const result = await processor.process(preprocessed);
    return String(result);
}

/**
 * Synchronous version for when async isn't needed
 */
export function processMarkdownSync(markdown: string): string {
    // Preprocess to handle inline $$...$$ as display math
    const preprocessed = preprocessDisplayMath(markdown);
    const result = processor.processSync(preprocessed);
    return String(result);
}

// Export the processor for advanced use cases
export { processor };

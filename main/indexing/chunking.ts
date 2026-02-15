import * as crypto from "crypto";

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
    maxTokens: number; // Maximum tokens per chunk (500-700 recommended)
    minTokens: number; // Minimum tokens to form a chunk
    overlapTokens: number; // Token overlap between chunks
}

export interface Chunk {
    content: string;
    contentHash: string;
    metadata: {
        startLine?: number;
        endLine?: number;
        heading?: string;
    };
}

const DEFAULT_CONFIG: ChunkingConfig = {
    maxTokens: 600,
    minTokens: 50,
    overlapTokens: 50,
};

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Generate SHA256 hash of content
 */
function generateContentHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Split text by markdown headings
 */
function splitByHeadings(text: string): Array<{ heading: string; content: string; startLine: number }> {
    const lines = text.split("\n");
    const sections: Array<{ heading: string; content: string; startLine: number }> = [];
    
    let currentHeading = "";
    let currentContent: string[] = [];
    let currentStartLine = 0;
    
    lines.forEach((line, index) => {
        // Check if line is a markdown heading (# ## ### etc.)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        
        if (headingMatch) {
            // Save previous section if it has content
            if (currentContent.length > 0) {
                sections.push({
                    heading: currentHeading,
                    content: currentContent.join("\n"),
                    startLine: currentStartLine,
                });
            }
            
            // Start new section
            currentHeading = headingMatch[2];
            currentContent = [line];
            currentStartLine = index;
        } else {
            currentContent.push(line);
        }
    });
    
    // Add final section
    if (currentContent.length > 0) {
        sections.push({
            heading: currentHeading,
            content: currentContent.join("\n"),
            startLine: currentStartLine,
        });
    }
    
    return sections;
}

/**
 * Split text by paragraphs (double newline)
 */
function splitByParagraphs(text: string): string[] {
    return text
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
}

/**
 * Split large text into smaller chunks respecting token limits
 */
function splitByTokenLimit(text: string, maxTokens: number, overlapTokens: number): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;
    
    for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);
        
        if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
            // Save current chunk
            chunks.push(currentChunk.join(" "));
            
            // Start new chunk with overlap
            const overlapSentences: string[] = [];
            let overlapCount = 0;
            
            for (let i = currentChunk.length - 1; i >= 0; i--) {
                const tokens = estimateTokens(currentChunk[i]);
                if (overlapCount + tokens <= overlapTokens) {
                    overlapSentences.unshift(currentChunk[i]);
                    overlapCount += tokens;
                } else {
                    break;
                }
            }
            
            currentChunk = overlapSentences;
            currentTokens = overlapCount;
        }
        
        currentChunk.push(sentence);
        currentTokens += sentenceTokens;
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
    }
    
    return chunks;
}

/**
 * Main chunking function for markdown files
 */
export function chunkMarkdown(text: string, config: ChunkingConfig = DEFAULT_CONFIG): Chunk[] {
    const chunks: Chunk[] = [];
    
    // First, split by headings
    const sections = splitByHeadings(text);
    
    for (const section of sections) {
        const sectionTokens = estimateTokens(section.content);
        
        if (sectionTokens <= config.maxTokens) {
            // Section fits in one chunk
            if (sectionTokens >= config.minTokens || sections.length === 1) {
                chunks.push({
                    content: section.content.trim(),
                    contentHash: generateContentHash(section.content.trim()),
                    metadata: {
                        heading: section.heading,
                        startLine: section.startLine,
                    },
                });
            }
        } else {
            // Section too large, split by paragraphs
            const paragraphs = splitByParagraphs(section.content);
            let currentChunk = "";
            let currentTokens = 0;
            
            for (const paragraph of paragraphs) {
                const paragraphTokens = estimateTokens(paragraph);
                
                if (currentTokens + paragraphTokens > config.maxTokens && currentChunk.length > 0) {
                    // Save current chunk
                    chunks.push({
                        content: currentChunk.trim(),
                        contentHash: generateContentHash(currentChunk.trim()),
                        metadata: {
                            heading: section.heading,
                            startLine: section.startLine,
                        },
                    });
                    
                    currentChunk = "";
                    currentTokens = 0;
                }
                
                if (paragraphTokens > config.maxTokens) {
                    // Paragraph itself is too large, split by token limit
                    const subChunks = splitByTokenLimit(paragraph, config.maxTokens, config.overlapTokens);
                    
                    for (const subChunk of subChunks) {
                        chunks.push({
                            content: subChunk.trim(),
                            contentHash: generateContentHash(subChunk.trim()),
                            metadata: {
                                heading: section.heading,
                                startLine: section.startLine,
                            },
                        });
                    }
                } else {
                    currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
                    currentTokens += paragraphTokens;
                }
            }
            
            // Add remaining chunk
            if (currentChunk.trim().length > 0 && currentTokens >= config.minTokens) {
                chunks.push({
                    content: currentChunk.trim(),
                    contentHash: generateContentHash(currentChunk.trim()),
                    metadata: {
                        heading: section.heading,
                        startLine: section.startLine,
                    },
                });
            }
        }
    }
    
    return chunks;
}

/**
 * Generic text chunking (for non-markdown files)
 */
export function chunkPlainText(text: string, config: ChunkingConfig = DEFAULT_CONFIG): Chunk[] {
    const chunks: Chunk[] = [];
    
    // Split by paragraphs first
    const paragraphs = splitByParagraphs(text);
    let currentChunk = "";
    let currentTokens = 0;
    
    for (const paragraph of paragraphs) {
        const paragraphTokens = estimateTokens(paragraph);
        
        if (currentTokens + paragraphTokens > config.maxTokens && currentChunk.length > 0) {
            // Save current chunk
            chunks.push({
                content: currentChunk.trim(),
                contentHash: generateContentHash(currentChunk.trim()),
                metadata: {},
            });
            
            currentChunk = "";
            currentTokens = 0;
        }
        
        if (paragraphTokens > config.maxTokens) {
            // Paragraph too large, split by token limit
            const subChunks = splitByTokenLimit(paragraph, config.maxTokens, config.overlapTokens);
            
            for (const subChunk of subChunks) {
                chunks.push({
                    content: subChunk.trim(),
                    contentHash: generateContentHash(subChunk.trim()),
                    metadata: {},
                });
            }
        } else {
            currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
            currentTokens += paragraphTokens;
        }
    }
    
    // Add final chunk
    if (currentChunk.trim().length > 0 && currentTokens >= config.minTokens) {
        chunks.push({
            content: currentChunk.trim(),
            contentHash: generateContentHash(currentChunk.trim()),
            metadata: {},
        });
    }
    
    return chunks;
}

/**
 * Smart chunking that detects file type
 */
export function chunkText(text: string, filePath: string, config: ChunkingConfig = DEFAULT_CONFIG): Chunk[] {
    const isMarkdown = filePath.endsWith(".md") || filePath.endsWith(".markdown");
    
    if (isMarkdown) {
        return chunkMarkdown(text, config);
    } else {
        return chunkPlainText(text, config);
    }
}
/**
 * Name of code artifact: renderer/components/MarkdownViewer.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Abdulaziz-Ali123; Malek Kchaou
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";

type Props = {
  content: string;
  baseDir?: string | null;
};

/**
 * Functionality: MarkdownViewer performs the markdown viewer workflow used by renderer/components/MarkdownViewer.tsx.
 * Parameters: { content, baseDir } (Props).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call MarkdownViewer from the owning module or component when this behavior is required.
 */
export default function MarkdownViewer({ content, baseDir }: Props) {
  const [processedContent, setProcessedContent] = useState(content);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
        /**
     * Functionality: processImages performs the process images workflow used by renderer/components/MarkdownViewer.tsx.
     * Parameters: None.
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call processImages from the owning module or component when this behavior is required.
     */
const processImages = async () => {
      if (isProcessing) return;
      setIsProcessing(true);

      try {
        const currentFolder = localStorage.getItem("currentFolderPath");
        const resolvedBaseDir = baseDir || currentFolder;
        if (!resolvedBaseDir) {
          setProcessedContent(content);
          setIsProcessing(false);
          return;
        }

        let newContent = content;

        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const matches = Array.from(content.matchAll(imageRegex));

        for (const match of matches) {
          const [fullMatch, alt, src] = match;

          // Skip external URLs or already data URIs
          if (src.startsWith("http") || src.startsWith("data:")) continue;

          try {
            const imagePath = window.fs.join(resolvedBaseDir, src);
            const result = await window.fs.readFile(imagePath);

            if (result.success && result.type === "binary") {
              let base64Data = "";

              if (typeof result.data === "string") {
                base64Data = result.data;
              } else if (result.data instanceof ArrayBuffer || Array.isArray(result.data)) {
                const bytes = result.data instanceof ArrayBuffer ? new Uint8Array(result.data) : result.data;
                base64Data = btoa(String.fromCharCode(...bytes));
              } else {
                console.warn("Unsupported image data type:", result.data);
                continue;
              }

              const base64Image = `data:${result.mimeType};base64,${base64Data}`;
              newContent = newContent.replace(fullMatch, `![${alt}](${base64Image})`);
            }
          } catch (err) {
            console.error(`Failed to load image: ${src}`, err);
          }
        }

        setProcessedContent(newContent);
      } catch (err) {
        console.error("Error processing images:", err);
        setProcessedContent(content);
      } finally {
        setIsProcessing(false);
      }
    };

    processImages();
  }, [content, baseDir]);

  return (
    <div className="prose prose-sm max-w-full overflow-auto markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mb-4 mt-6" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mb-3 mt-5" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-xl font-bold mb-2 mt-4" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-lg font-bold mb-2 mt-4" {...props} />,
          p: ({ node, ...props }) => <p className="mb-4" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc ml-6 mb-4" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal ml-6 mb-4" {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          code: ({ node, inline, ...props }: any) =>
            inline ? (
              <code className="bg-gray-800 px-1 rounded" {...props} />
            ) : (
              <code className="block bg-gray-900 p-4 rounded mb-4 overflow-x-auto" {...props} />
            ),
          img: ({ node, ...props }) => {
            const srcValue = props.src || node.properties?.src;
            const altValue = props.alt || node.properties?.alt || "";
            const src = typeof srcValue === "string" ? srcValue : String(srcValue ?? "");
            const alt = typeof altValue === "string" ? altValue : String(altValue ?? "");
            return <img className="inline-block max-w-full h-auto my-2" src={src} alt={alt} />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

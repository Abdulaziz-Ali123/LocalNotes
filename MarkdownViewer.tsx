import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

type Props = {
  content: string;
};

export default function MarkdownViewer({ content }: Props) {
    const [processedContent, setProcessedContent] = useState(content);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const processImages = async () => {
            // Prevent re-processing while already processing
            if (isProcessing) return;

            setIsProcessing(true);

            try {
                const currentFolder = localStorage.getItem("currentFolderPath");
                if (!currentFolder) {
                    setProcessedContent(content);
                    setIsProcessing(false);
                    return;
                }

                let newContent = content;

                // Find all image references: ![alt](src)
                const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
                const matches = Array.from(content.matchAll(imageRegex));

                for (const match of matches) {
                    const [fullMatch, alt, src] = match;

                    // Skip if already a data URI or external URL
                    if (src.startsWith('http') || src.startsWith('data:')) {
                        continue;
                    }

                    try {
                        // Resolve relative path
                        const imagePath = window.fs.join(currentFolder, src);
                        const result = await window.fs.readFile(imagePath);

                        if (result.success && result.type === 'binary') {
                            const base64Image = `data:${result.mimeType};base64,${result.data}`;
                            newContent = newContent.replace(fullMatch, `![${alt}](${base64Image})`);
                        }
                    } catch (err) {
                        console.error(`Failed to load image: ${src}`, err);
                        // Keep original markdown if image fails to load
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
    }, [content]); // Remove isProcessing from dependencies

  return (
    <div className="prose prose-sm max-w-full overflow-auto markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
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
              img: ({ node, ...props }) => (
                <img className="max-w-full h-auto my-4" {...props} />
              ),
              a: ({ node, href, children, ...props }: any) => {
                const isExternal = !href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("data:") || href.startsWith("#");
                const currentFolder = localStorage.getItem("currentFolderPath") || "";

                const resolvedPath = isExternal ? href : window.fs.join(currentFolder, href || "");

                const handleDownload = async (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    const result = await window.fs.saveFileAs(resolvedPath);
                    if (!result.success && !result.canceled) {
                      alert(`Save failed: ${result.error}`);
                    }
                  } catch (err: any) {
                    alert(`Save failed: ${err?.message || err}`);
                  }
                };

                return (
                  <span className="inline-flex items-center gap-2">
                    <a
                      href={isExternal ? href : '#'}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noreferrer" : undefined}
                      {...props}
                    >
                      {children}
                    </a>
                    {!isExternal && (
                      <button
                        className="text-sm text-muted-foreground hover:underline"
                        onClick={handleDownload}
                      >
                        Download
                      </button>
                    )}
                  </span>
                );
              },
        }}
      >
                {processedContent}
      </ReactMarkdown>
    </div>
  );
}
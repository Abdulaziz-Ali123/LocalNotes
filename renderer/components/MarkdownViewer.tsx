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
};

export default function MarkdownViewer({ content }: Props) {
  const [processedContent, setProcessedContent] = useState(content);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const processImages = async () => {
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

        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const matches = Array.from(content.matchAll(imageRegex));

        for (const match of matches) {
          const [fullMatch, alt, src] = match;

          // Skip external URLs or already data URIs
          if (src.startsWith("http") || src.startsWith("data:")) continue;

          try {
            const imagePath = window.fs.join(currentFolder, src);
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
  }, [content]);

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
            const src = props.src || node.properties?.src;
            const alt = props.alt || node.properties?.alt || "";
            return <img className="inline-block max-w-full h-auto my-2" src={src} alt={alt} />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

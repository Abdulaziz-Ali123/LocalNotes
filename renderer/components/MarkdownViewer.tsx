import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

type Props = {
  content: string;
};

export default function MarkdownViewer({ content }: Props) {
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
          img: ({ node, ...props }: any) => {
            const src = props.src as string;
            const alt = props.alt as string | undefined;

            const handleDownload = async (e: React.MouseEvent) => {
              e.stopPropagation();
              try {
                // call preload-exposed API
                const res = await window.fs.downloadImage(src);
                if (res && res.success) {
                  alert(`Saved: ${res.data}`);
                } else if (res && res.canceled) {
                  // user cancelled; do nothing
                } else {
                  alert(`Download failed: ${res?.error ?? "Unknown error"}`);
                }
              } catch (err: any) {
                alert(`Download failed: ${String(err)}`);
              }
            };

            return (
              <div className="relative inline-block">
                <img src={src} alt={alt} className="max-w-full rounded" />
                <button
                  onClick={handleDownload}
                  title="Download image"
                  className="absolute top-1 right-1 bg-gray-800 text-white text-xs p-1 rounded opacity-90 hover:opacity-100"
                >
                  ↓
                </button>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

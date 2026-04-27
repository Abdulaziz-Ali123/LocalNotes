/**
 * StatusBarStats (renderer/components/StatusBarStats.tsx)
 *
 * Renders live document statistics (word count, character count, sentence
 * count, estimated reading time) as plain text in the editor status bar.
 * Stats update debounced as the user types via useDocumentStats.
 *
 * Intended to be placed inside the right-hand section of the status bar in
 * editor.tsx, immediately to the left of the file-type button.
 *
 * Revision History:
 *  • Wesley McDougal - 19APR2026 - Initial implementation
 */
import React from "react";
import { useDocumentStats } from "@/renderer/hooks/useDocumentStats";

interface StatusBarStatsProps {
  /** Raw file content — plain text or HTML depending on `isHtml`. */
  content: string;
  /** Pass true when content is HTML (Tiptap .txt files). */
  isHtml?: boolean;
}

export default function StatusBarStats({ content, isHtml = false }: StatusBarStatsProps) {
  const stats = useDocumentStats(content, isHtml);

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground select-none">
      <span>{stats.words.toLocaleString()} {stats.words === 1 ? "word" : "words"}</span>
      <span>{stats.characters.toLocaleString()} {stats.characters === 1 ? "char" : "chars"}</span>
      <span>{stats.sentences.toLocaleString()} {stats.sentences === 1 ? "sentence" : "sentences"}</span>
      <span>{stats.readingTimeText}</span>
    </div>
  );
}

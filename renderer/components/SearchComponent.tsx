import React, { useState } from "react";
import { Search, X, FileText, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";

interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

interface SearchResult {
  path: string;
  matches: number;
  preview?: string;
  highlightedPreview?: React.ReactNode;
}

interface SearchComponentProps {
  onFileSelect?: (filePath: string, searchTerm?: string, matchCase?: boolean, matchWholeWord?: boolean) => void;
}

export default function SearchComponent({ onFileSelect }: SearchComponentProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [matchCase, setMatchCase] = useState<boolean>(false);
  const [matchWholeWord, setMatchWholeWord] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string>("");

  // Highlight matches in text
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query) return text;

    try {
      const flags = matchCase ? "g" : "gi";
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape for regex

      // Build regex for whole word or simple match
      const pattern = matchWholeWord ? `\\b(${escapedQuery})\\b` : `(${escapedQuery})`;

      const regex = new RegExp(pattern, flags);
      const parts = text.split(regex);

      return parts.map((part, index) => {
        const isMatch = matchCase ? part === query : part.toLowerCase() === query.toLowerCase();
        if (matchWholeWord) {
          const wholeWordRegex = new RegExp(`^${pattern}$`, matchCase ? "" : "i");
          if (wholeWordRegex.test(part)) {
            return (
              <mark key={index} className="bg-yellow-300 dark:bg-yellow-600 text-foreground px-0.5 rounded">
                {part}
              </mark>
            );
          }
        } else if (isMatch) {
          return (
            <mark key={index} className="bg-yellow-300 dark:bg-yellow-600 text-foreground px-0.5 rounded">
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      });
    } catch (e) {
      return text;
    }
  };

  // Search through file contents
  const searchFileContents = async (dirPath: string, query: string): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];

    try {
      const dirResult = await window.fs.readDirectory(dirPath);
      if (!dirResult.success || !dirResult.data) return results;

      const items: FileSystemItem[] = dirResult.data;

      for (const item of items) {
        if (item.isDirectory) {
          // Recursively search subdirectories
          const subResults = await searchFileContents(item.path, query);
          results.push(...subResults);
        } else {
          try {
            const fileResult = await window.fs.readFile(item.path);
            if (fileResult.success && fileResult.data) {
              const content = fileResult.data as string;
              let matches = 0;
              let preview = "";

              const flags = matchCase ? "g" : "gi";
              const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const pattern = matchWholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
              const regex = new RegExp(pattern, flags);

              const found = content.match(regex);
              matches = found ? found.length : 0;

              // Get preview of first match
              if (matches > 0) {
                const lines = content.split('\n');
                for (const line of lines) {
                  if (regex.test(line)) {
                    preview = line.trim().substring(0, 100);
                    break;
                  }
                }
              }

              if (matches > 0) {
                results.push({
                  path: item.path,
                  matches,
                  preview,
                  highlightedPreview: highlightText(preview, query),
                });
              }
            }
          } catch {
            continue;
          }
        }
      }
    } catch (e) {
      console.error("Error searching directory:", e);
    }

    return results;
  };

  // Trigger search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError("Please enter a search query");
      return;
    }

    const rootPath = localStorage.getItem("currentFolderPath");
    if (!rootPath) {
      setSearchError("No folder opened. Please open a folder first.");
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSearchError("");

    try {
      const results = await searchFileContents(rootPath, searchQuery);
      setSearchResults(results);

      if (results.length === 0) {
        setSearchError("No matches found");
      }
    } catch {
      setSearchError("An error occurred while searching");
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-sidebar space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search in files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            size="sm"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>

        {/* Options */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="match-case"
              checked={matchCase}
              onCheckedChange={(checked) => setMatchCase(checked as boolean)}
            />
            <Label htmlFor="match-case" className="text-sm cursor-pointer">
              Match Case
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="match-whole-word"
              checked={matchWholeWord}
              onCheckedChange={(checked) => setMatchWholeWord(checked as boolean)}
            />
            <Label htmlFor="match-whole-word" className="text-sm cursor-pointer">
              Match Whole Word
            </Label>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-2">
        {searchError && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchError}
          </div>
        )}

        {!searchError && searchResults.length === 0 && !isSearching && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Enter a search term to find matches across all files
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {searchResults.length} {searchResults.length === 1 ? 'file' : 'files'} found
            </div>
            {searchResults.map((result) => (
              <button
                key={result.path}
                onClick={() => onFileSelect?.(result.path)}
                className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate group-hover:text-accent-foreground">
                        {window.fs?.basename(result.path) || result.path.split('/').pop() || result.path}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {result.matches} {result.matches === 1 ? 'match' : 'matches'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {result.path}
                    </div>
                    {result.highlightedPreview && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {result.highlightedPreview}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

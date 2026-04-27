/**
 * File: renderer/components/quiz/QuizConfigForm.tsx
 * Purpose: Configuration form for AI quiz generation.
 * Allows users to set topic, question count, difficulty, and question types.
 */

import React from "react";
import { Button } from "@/renderer/components/ui/button";
import {
  Brain,
  Loader2,
  Hash,
  BookOpen,
  Gauge,
  ListChecks,
  X,
} from "lucide-react";

export type QuizDifficulty = "easy" | "medium" | "hard";

export type QuestionKind =
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "fill_in_blank"
  | "drag_and_drop"
  | "free_response"
  | "flashcard";

export interface QuizConfig {
  topic: string;
  numItems: number;
  difficulty: QuizDifficulty;
  questionTypes: QuestionKind[];
}

export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  topic: "",
  numItems: 5,
  difficulty: "medium",
  questionTypes: ["multiple_choice", "true_false"],
};

const ALL_QUESTION_TYPES: { value: QuestionKind; label: string; description: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice", description: "4 options, 1 correct" },
  { value: "true_false", label: "True / False", description: "Statement verification" },
  { value: "fill_in_blank", label: "Fill in Blank", description: "Complete the sentence" },
  { value: "matching", label: "Matching", description: "Match pairs together" },
  { value: "drag_and_drop", label: "Ordering", description: "Arrange in correct order" },
  { value: "free_response", label: "Free Response", description: "Open-ended with rubric" },
  { value: "flashcard", label: "Flashcard", description: "Front & back cards" },
];

const DIFFICULTIES: { value: QuizDifficulty; label: string; color: string }[] = [
  { value: "easy", label: "Easy", color: "border-green-500 text-green-600 hover:bg-green-500/10" },
  { value: "medium", label: "Medium", color: "border-yellow-500 text-yellow-600 hover:bg-yellow-500/10" },
  { value: "hard", label: "Hard", color: "border-red-500 text-red-600 hover:bg-red-500/10" },
];

interface QuizConfigFormProps {
  config: QuizConfig;
  onChange: (config: QuizConfig) => void;
  onGenerate: () => void;
  onCancel: () => void;
  isGenerating: boolean;
  mode?: "quiz" | "flashcards";
}

export default function QuizConfigForm({
  config,
  onChange,
  onGenerate,
  onCancel,
  isGenerating,
  mode = "quiz",
}: QuizConfigFormProps) {
  const toggleType = (type: QuestionKind) => {
    const current = config.questionTypes;
    if (current.includes(type)) {
      if (current.length === 1) return; // Must keep at least one
      onChange({ ...config, questionTypes: current.filter((t) => t !== type) });
    } else {
      onChange({ ...config, questionTypes: [...current, type] });
    }
  };

  const availableTypes = mode === "flashcards"
    ? ALL_QUESTION_TYPES.filter((t) => t.value === "flashcard")
    : ALL_QUESTION_TYPES.filter((t) => t.value !== "flashcard");

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-xl bg-purple-500/15">
            <Brain className="h-4 sm:h-5 w-4 sm:w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold">Configure Quiz Generation</h2>
            <p className="text-xs sm:text-xs text-muted-foreground">Customize your AI-generated {mode}</p>
          </div>
        </div>
        <button onClick={onCancel} className="rounded-lg p-2 hover:bg-accent transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Topic */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs sm:text-sm font-medium">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Topic
        </label>
        <input
          type="text"
          placeholder="Leave blank to use notes context, or enter a specific topic..."
          className="w-full rounded-xl border border-border bg-background px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          value={config.topic}
          onChange={(e) => onChange({ ...config, topic: e.target.value })}
        />
      </div>

      {/* Number + Difficulty Row */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        {/* Number of Questions */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <Hash className="h-4 w-4 text-muted-foreground" />
            Number of Questions
          </label>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            {[3, 5, 10, 15].map((n) => (
              <button
                key={n}
                onClick={() => onChange({ ...config, numItems: n })}
                className={`flex h-8 sm:h-10 w-10 sm:w-12 items-center justify-center rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                  config.numItems === n
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-accent/20"
                }`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={20}
              value={config.numItems}
              onChange={(e) =>
                onChange({ ...config, numItems: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })
              }
              className="h-8 sm:h-10 w-14 sm:w-16 rounded-lg border border-border bg-background px-2 text-center text-xs sm:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Difficulty
          </label>
          <div className="flex items-center gap-1 sm:gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                onClick={() => onChange({ ...config, difficulty: d.value })}
                className={`flex h-8 sm:h-10 flex-1 items-center justify-center rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                  config.difficulty === d.value
                    ? `${d.color} bg-opacity-10`
                    : "border-border bg-background hover:bg-accent/20"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Question Types */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs sm:text-sm font-medium">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          Question Types
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {availableTypes.map((qt) => {
            const active = config.questionTypes.includes(qt.value);
            return (
              <button
                key={qt.value}
                onClick={() => toggleType(qt.value)}
                className={`flex items-center gap-2 sm:gap-3 rounded-xl border p-2 sm:p-3 text-left transition-all ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:bg-accent/10"
                }`}
              >
                <div
                  className={`flex h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                    active ? "border-primary bg-primary text-white" : "border-border"
                  }`}
                >
                  {active && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-medium">{qt.label}</div>
                  <div className="text-xs text-muted-foreground">{qt.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10">
          Cancel
        </Button>
        <Button
          onClick={onGenerate}
          disabled={isGenerating || config.questionTypes.length === 0}
          className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm h-8 sm:h-10"
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
          ) : (
            <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          )}
          {isGenerating ? "Generating..." : `Generate ${config.numItems} Questions`}
        </Button>
      </div>
    </div>
  );
}

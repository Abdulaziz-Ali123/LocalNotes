/**
 * File: renderer/pages/quiz.tsx
 * Purpose: Standalone quiz route for LocalNotes using AI generated JSON.
 */

import React, { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/renderer/components/ui/button";
import QuizRenderer from "@/renderer/components/quiz/QuizRenderer";
import QuizConfigForm, { DEFAULT_QUIZ_CONFIG, QuizConfig } from "@/renderer/components/quiz/QuizConfigForm";
import { mockFlashcardsPayload, mockQuizPayload } from "@/renderer/lib/mockQuiz";
import { Brain, NotebookPen, Loader2, Play } from "lucide-react";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { extractJsonFromLLMResponse } from "@/renderer/lib/extractJson";

type PreviewMode = "quiz" | "flashcards";

export default function QuizPage() {
    const router = useRouter();
    const [previewMode, setPreviewMode] = useState<PreviewMode>("quiz");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPayload, setGeneratedPayload] = useState<any>(null);
    const [error, setError] = useState<string>("");
    const [showConfigForm, setShowConfigForm] = useState(false);
    const [config, setConfig] = useState<QuizConfig>(DEFAULT_QUIZ_CONFIG);

    const aiSettings = useBoundStore((s) => s.settings.global?.ai);

    /** Resolve the first available model ID from wherever the user saved it */
    const getFirstModelId = async (): Promise<string | null> => {
        // 1. Check ai.customModels from Zustand (already loaded)
        if (aiSettings?.customModels?.length) {
            return aiSettings.defaultModelId || aiSettings.customModels[0].id;
        }

        // 2. Refresh from main process in case Zustand hasn't synced yet
        try {
            const globalSettings = await (window as any).settings.getGlobal();
            if (globalSettings?.ai?.customModels?.length) {
                return globalSettings.ai.defaultModelId || globalSettings.ai.customModels[0].id;
            }
            // 3. Check llm.models registry
            const llmModels = globalSettings?.llm?.models;
            if (llmModels && Object.keys(llmModels).length > 0) {
                return globalSettings.llm.defaultModelId || null;
            }
        } catch { /* ignore */ }

        return null;
    };

    const handleGenerate = async () => {
        try {
            setIsGenerating(true);
            setError("");

            const modelId = await getFirstModelId();
            if (!modelId) {
                throw new Error("No AI model configured. Please add one in Settings → AI.");
            }

            const currentFolderPath = localStorage.getItem("currentFolderPath");
            if (!currentFolderPath) throw new Error("No folder open.");

            const idRes = await (window as any).db?.getDirectoryIdByPath(currentFolderPath);
            const directoryId = idRes?.success ? idRes.data : null;

            if (!directoryId) {
                throw new Error("Directory ID not found for RAG context.");
            }

            const contextRes = await (window as any).rag?.retrieveContext(directoryId, previewMode, 10);
            const ragChunks = contextRes?.success && contextRes?.contextText ? contextRes.contextText : "No local notes found.";

            const systemPrompt = `You are a quiz generation engine. You output only valid JSON. No prose, no markdown, no explanation.

ALWAYS return this exact root structure:
{
  "type": "quiz" | "flashcards",
  "meta": {
    "topic": string,
    "difficulty": "easy" | "medium" | "hard",
    "total": number
  },
  "items": [ ...question objects ]
}

QUESTION TYPES and their exact schemas:

multiple_choice:
{
  "id": number,
  "kind": "multiple_choice",
  "question": string,
  "options": [string],
  "answer": string
}

true_false:
{
  "id": number,
  "kind": "true_false",
  "question": string,
  "answer": boolean
}

matching:
{
  "id": number,
  "kind": "matching",
  "question": string,
  "pairs": [{ "prompt": string, "match": string }]
}

fill_in_blank:
{
  "id": number,
  "kind": "fill_in_blank",
  "question": string,
  "blanks": [string]
}

drag_and_drop:
{
  "id": number,
  "kind": "drag_and_drop",
  "question": string,
  "items": [string],
  "answer": [string]
}

free_response:
{
  "id": number,
  "kind": "free_response",
  "question": string,
  "rubric": string
}

flashcard:
{
  "id": number,
  "kind": "flashcard",
  "front": string,
  "back": string
}

Rules:
- Output ONLY the JSON object. Nothing else.
- All fields are required. Never omit a field.
- "options" for multiple_choice must have exactly 4 items.
- "answer" for multiple_choice must exactly match one option string.
- "blanks" contains the correct words that fill the blanks in order.
- "items" for drag_and_drop is the shuffled list. "answer" is the correct order.
- "rubric" is a one sentence grading guideline.
- IDs are sequential starting at 1.`;

            const questionTypesStr = config.questionTypes.join(", ");
            const topic = config.topic || "Notes Context";
            const userPrompt = `Context from notes:\n"""\n${ragChunks}\n"""\n\nGenerate a ${previewMode} with the following specifications:\n- Topic: ${topic}\n- Difficulty: ${config.difficulty}\n- Number of items: ${config.numItems}\n- Question types: ${questionTypesStr}\n\nReturn only the JSON.`;

            const chatResult = await (window as any).llm.chat(modelId, [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ], false);

            if (!chatResult.success) {
                throw new Error(chatResult.error || "LLM request failed.");
            }

            const parsedPayload = extractJsonFromLLMResponse(chatResult.content);
            setGeneratedPayload(parsedPayload);

            // Save for the host page to pick up
            if (previewMode === "quiz" && parsedPayload.items) {
                try {
                    const questionsForHost = parsedPayload.items.map((q: any) => ({
                        id: String(q.id),
                        prompt: q.question,
                        options: q.options || ["True", "False"],
                        correctAnswer: q.answer !== undefined ? String(q.answer) : "",
                    }));
                    localStorage.setItem("host_questions_json", JSON.stringify(questionsForHost, null, 2));
                } catch (e) { }
            }

            setShowConfigForm(false);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to generate.");
        } finally {
            setIsGenerating(false);
        }
    };

    const activePayload = useMemo(
        () => generatedPayload || (previewMode === "quiz" ? mockQuizPayload : mockFlashcardsPayload),
        [previewMode, generatedPayload]
    );

    return (
        <>
            <Head>
                <title>LocalNotes | Quiz</title>
            </Head>

            <div className="h-screen overflow-auto bg-background text-foreground">
                <div className="mx-auto flex min-h-screen w-full flex-col gap-4 p-3 sm:gap-6 sm:p-6">
                    <header className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                        <div className="flex flex-col gap-4 items-center text-center">
                            <div>
                                <div className="mb-1 text-xs sm:text-sm text-muted-foreground">
                                    LocalNotes Study Mode
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-semibold">Interactive Quiz Preview</h1>
                                <p className="mt-2 max-w-3xl text-xs sm:text-sm text-muted-foreground">
                                    AI-generated quizzes and flashcards based on your local notes.
                                </p>
                                {error && <p className="mt-2 text-xs sm:text-sm text-red-500">{error}</p>}
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                                <Button
                                    variant="default"
                                    onClick={() => setShowConfigForm(!showConfigForm)}
                                    disabled={isGenerating}
                                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4"
                                >
                                    {isGenerating ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" /> : <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />}
                                    <span className="hidden sm:inline">Generate {previewMode === "quiz" ? "Quiz" : "Flashcards"}</span>
                                    <span className="sm:hidden">Generate</span>
                                </Button>

                                <Button
                                    variant={previewMode === "quiz" ? "default" : "outline"}
                                    onClick={() => { setPreviewMode("quiz"); setGeneratedPayload(null); setShowConfigForm(false); }}
                                    disabled={isGenerating}
                                    className="text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4"
                                >
                                    <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="hidden sm:inline ml-1 sm:ml-2">Quiz</span>
                                </Button>

                                <Button
                                    variant={previewMode === "flashcards" ? "default" : "outline"}
                                    onClick={() => { setPreviewMode("flashcards"); setGeneratedPayload(null); setShowConfigForm(false); }}
                                    disabled={isGenerating}
                                    className="text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4"
                                >
                                    <NotebookPen className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="hidden sm:inline ml-1 sm:ml-2">Cards</span>
                                </Button>

                                <Button
                                    variant="outline"
                                    className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4"
                                    onClick={() => router.push("/quiz/host")}
                                    disabled={isGenerating}
                                >
                                    <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    <span className="hidden sm:inline">Host</span>
                                </Button>

                                <Link href="/editor">
                                    <Button variant="outline" className="text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4">Back</Button>
                                </Link>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 min-h-0">
                        {showConfigForm ? (
                            <QuizConfigForm
                                config={config}
                                onChange={setConfig}
                                onGenerate={handleGenerate}
                                onCancel={() => setShowConfigForm(false)}
                                isGenerating={isGenerating}
                                mode={previewMode}
                            />
                        ) : (
                            <QuizRenderer payload={activePayload} />
                        )}
                    </main>
                </div>
            </div>
        </>
    );
}

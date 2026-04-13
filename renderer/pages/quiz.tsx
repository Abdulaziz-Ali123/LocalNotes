/**
 * File: renderer/pages/quiz.tsx
 * Purpose: Standalone quiz route for LocalNotes using mock LLM JSON during the first implementation pass.
 * Summary of changes:
 * - Added a new /quiz page with a LocalNotes-consistent layout and header.
 * - Wired the page to a local mock quiz payload.
 * - Added a lightweight mode toggle so both quiz and flashcard root payloads can be previewed.
 * Author: Malek Kchaou
 * Date: 2026-04-12
 * Note: This page intentionally avoids main/preload/store changes for the fastest low-overhead delivery.
 */

import React, { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/renderer/components/ui/button";
import QuizRenderer from "@/renderer/components/quiz/QuizRenderer";
import { mockFlashcardsPayload, mockQuizPayload } from "@/renderer/lib/mockQuiz";
import { Brain, NotebookPen } from "lucide-react";

type PreviewMode = "quiz" | "flashcards";

export default function QuizPage() {
    const [previewMode, setPreviewMode] = useState<PreviewMode>("quiz");

    /**
     * For this first pass, the page uses a local mock payload so the UI can be
     * developed and tested without touching the existing AI pipeline yet.
     */
    const activePayload = useMemo(
        () => (previewMode === "quiz" ? mockQuizPayload : mockFlashcardsPayload),
        [previewMode]
    );

    return (
        <>
            <Head>
                <title>LocalNotes | Quiz</title>
            </Head>

            <div className="h-screen overflow-auto bg-background text-foreground">
                <div className="mx-auto flex min-h-screen min-w-[1280px] w-full max-w-7xl flex-col gap-6 p-6">
                    <header className="rounded-2xl border bg-card p-5 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="mb-1 text-sm text-muted-foreground">
                                    LocalNotes Study Mode
                                </div>
                                <h1 className="text-3xl font-semibold">Interactive Quiz Preview</h1>
                                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                                    Standalone route for validating the new quiz experience before wiring it to real AI-generated content.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant={previewMode === "quiz" ? "default" : "outline"}
                                    onClick={() => setPreviewMode("quiz")}
                                >
                                    <Brain className="h-4 w-4" />
                                    Quiz preview
                                </Button>

                                <Button
                                    variant={previewMode === "flashcards" ? "default" : "outline"}
                                    onClick={() => setPreviewMode("flashcards")}
                                >
                                    <NotebookPen className="h-4 w-4" />
                                    Flashcards preview
                                </Button>

                                <Link href="/editor">
                                    <Button variant="outline">Back to editor</Button>
                                </Link>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1">
                        <QuizRenderer payload={activePayload} />
                    </main>
                </div>
            </div>
        </>
    );
}
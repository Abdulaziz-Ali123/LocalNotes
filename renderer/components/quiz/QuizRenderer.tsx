/**
 * File: renderer/components/quiz/QuizRenderer.tsx
 * Purpose: Standalone interactive quiz/flashcards renderer for LocalNotes.
 * Summary of changes:
 * - Added support for multiple choice, true/false, fill in blank, drag and drop,
 *   free response, matching, and flashcards.
 * - Added local session state, immediate answer checking, progress display,
 *   card-based interaction flow, and a results summary.
 * - Uses only existing project UI primitives and native browser drag-and-drop.
 * Author: Malek Kchaou
 * Git-history contributors: Malek Kchaou
 * Date: 2026-04-12
 * Note: This implementation is intentionally self-contained for the first pass.
 */

import React, { useMemo, useState } from "react";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { cn } from "@/renderer/lib/util";
import {
    DragAndDropItem,
    FillInBlankItem,
    FlashcardItem,
    FlashcardsDocument,
    FreeResponseItem,
    MatchingItem,
    QuizDocument,
    QuizItem,
    QuizPayload,
} from "./quizTypes";
import {
    CheckCircle2,
    Circle,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Brain,
    Trophy,
} from "lucide-react";

/**
 * Small utility used to compare strings in a forgiving way for quiz checking.
 * This helps avoid false negatives due to casing or accidental spacing.
 */
/**
 * Functionality: normalizeText performs the normalize text workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: value (string).
 * Returns: Returns string.
 * Usage: Call normalizeText from the owning module or component when this behavior is required.
 */
function normalizeText(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

type ItemStatus = "unanswered" | "correct" | "incorrect";

interface QuizRendererProps {
    payload: QuizPayload;
}

/**
 * Top-level renderer that delegates to either quiz mode or flashcards mode.
 */
/**
 * Functionality: QuizRenderer performs the quiz renderer workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { payload } (QuizRendererProps).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call QuizRenderer from the owning module or component when this behavior is required.
 */
export default function QuizRenderer({ payload }: QuizRendererProps) {
    if (payload.type === "flashcards") {
        return <FlashcardsView payload={payload} />;
    }

    return <QuizView payload={payload} />;
}

/**
 * Flashcards mode.
 * This keeps the page flexible because the LLM contract allows either "quiz" or "flashcards".
 */
/**
 * Functionality: FlashcardsView performs the flashcards view workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { payload } ({ payload: FlashcardsDocument }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call FlashcardsView from the owning module or component when this behavior is required.
 */
function FlashcardsView({ payload }: { payload: FlashcardsDocument }) {
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);

    const current = payload.items[index] as FlashcardItem;
    const progressPercent = Math.round(((index + 1) / payload.items.length) * 100);

    return (
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6">
            <QuizHeader
                title={payload.meta.topic}
                subtitle={`Flashcards | ${payload.meta.difficulty}`}
                progressLabel={`${index + 1} / ${payload.items.length}`}
                progressPercent={progressPercent}
            />

            <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Brain className="h-4 w-4" />
                    <span>Flashcard mode</span>
                </div>

                <button
                    type="button"
                    onClick={() => setRevealed((prev) => !prev)}
                    className="flex min-h-[320px] w-full flex-col items-center justify-center rounded-2xl border border-border bg-background p-8 text-center transition-colors hover:bg-accent/20"
                >
                    <div className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {revealed ? "Back" : "Front"}
                    </div>
                    <div className="max-w-3xl text-xl font-semibold leading-relaxed">
                        {revealed ? current.back : current.front}
                    </div>
                    <div className="mt-8 text-sm text-muted-foreground">
                        Click the card to flip
                    </div>
                </button>

                <div className="mt-6 flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setRevealed(false);
                            setIndex((prev) => Math.max(0, prev - 1));
                        }}
                        disabled={index === 0}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => setRevealed((prev) => !prev)}
                    >
                        Flip card
                    </Button>

                    <Button
                        onClick={() => {
                            setRevealed(false);
                            setIndex((prev) => Math.min(payload.items.length - 1, prev + 1));
                        }}
                        disabled={index === payload.items.length - 1}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

/**
 * Main quiz mode with one-question-at-a-time interaction, immediate feedback,
 * progress tracking, and an end-of-quiz summary.
 */
/**
 * Functionality: QuizView performs the quiz view workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { payload } ({ payload: QuizDocument }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call QuizView from the owning module or component when this behavior is required.
 */
function QuizView({ payload }: { payload: QuizDocument }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [statusMap, setStatusMap] = useState<Record<number, ItemStatus>>({});
    const [lockedMap, setLockedMap] = useState<Record<number, boolean>>({});
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, unknown>>({});
    const [showSummary, setShowSummary] = useState(false);

    const currentItem = payload.items[currentIndex];
    const total = payload.items.length;

    const answeredCount = useMemo(
        () => Object.values(statusMap).filter((status) => status !== "unanswered").length,
        [statusMap]
    );

    const correctCount = useMemo(
        () => Object.values(statusMap).filter((status) => status === "correct").length,
        [statusMap]
    );

    const progressPercent = Math.round(((currentIndex + 1) / total) * 100);

    /**
     * Central answer submission handler.
     * Each question subcomponent computes correctness and passes its answer payload upward.
     */
        /**
     * Functionality: handleSubmit performs the handle submit workflow used by renderer/components/quiz/QuizRenderer.tsx.
     * Parameters: itemId (number); answerValue (unknown); isCorrect (boolean).
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call handleSubmit from the owning module or component when this behavior is required.
     */
const handleSubmit = (itemId: number, answerValue: unknown, isCorrect: boolean) => {
        setSelectedAnswers((prev) => ({ ...prev, [itemId]: answerValue }));
        setStatusMap((prev) => ({
            ...prev,
            [itemId]: isCorrect ? "correct" : "incorrect",
        }));
        setLockedMap((prev) => ({ ...prev, [itemId]: true }));
    };

    /**
     * Allows retrying the current question by clearing only its local state.
     */
        /**
     * Functionality: handleRetryCurrent performs the handle retry current workflow used by renderer/components/quiz/QuizRenderer.tsx.
     * Parameters: None.
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call handleRetryCurrent from the owning module or component when this behavior is required.
     */
const handleRetryCurrent = () => {
        setStatusMap((prev) => ({ ...prev, [currentItem.id]: "unanswered" }));
        setLockedMap((prev) => ({ ...prev, [currentItem.id]: false }));
        setSelectedAnswers((prev) => {
            const next = { ...prev };
            delete next[currentItem.id];
            return next;
        });
    };

    /**
     * Resets the entire quiz session without touching any global app state.
     */
        /**
     * Functionality: handleRestart performs the handle restart workflow used by renderer/components/quiz/QuizRenderer.tsx.
     * Parameters: None.
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call handleRestart from the owning module or component when this behavior is required.
     */
const handleRestart = () => {
        setCurrentIndex(0);
        setStatusMap({});
        setLockedMap({});
        setSelectedAnswers({});
        setShowSummary(false);
    };

    /**
     * Determines whether every question has been checked at least once.
     */
    const allAnswered = total > 0 && answeredCount === total;

    if (showSummary) {
        const scorePercent = total === 0 ? 0 : Math.round((correctCount / total) * 100);

        return (
            <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6">
                <QuizHeader
                    title={payload.meta.topic}
                    subtitle={`Results | ${payload.meta.difficulty}`}
                    progressLabel={`${correctCount} correct out of ${total}`}
                    progressPercent={scorePercent}
                />

                <div className="rounded-2xl border bg-card p-8 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                        <Trophy className="h-6 w-6 text-primary" />
                        <div>
                            <h2 className="text-2xl font-semibold">Session complete</h2>
                            <p className="text-sm text-muted-foreground">
                                Review your score and restart if you want another pass.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <SummaryStat label="Score" value={`${scorePercent}%`} />
                        <SummaryStat label="Correct" value={`${correctCount}`} />
                        <SummaryStat label="Reviewed" value={`${answeredCount}`} />
                    </div>

                    <div className="mt-8 rounded-xl border bg-background p-4">
                        <div className="mb-3 text-sm font-medium">Question status</div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {payload.items.map((item) => {
                                const status = statusMap[item.id] ?? "unanswered";

                                return (
                                    <div
                                        key={item.id}
                                        className="rounded-lg border border-border bg-card p-3"
                                    >
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-sm font-medium">
                                                Q{item.id}
                                            </span>
                                            <StatusPill status={status} />
                                        </div>
                                        <div className="line-clamp-3 text-sm text-muted-foreground">
                                            {"question" in item ? item.question : "Flashcard"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                        <Button onClick={handleRestart}>
                            <RotateCcw className="h-4 w-4" />
                            Restart quiz
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowSummary(false);
                                setCurrentIndex(0);
                            }}
                        >
                            Review questions
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6">
            <QuizHeader
                title={payload.meta.topic}
                subtitle={`Quiz | ${payload.meta.difficulty}`}
                progressLabel={`${currentIndex + 1} / ${total}`}
                progressPercent={progressPercent}
            />

            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="mb-4 text-sm font-medium text-muted-foreground">
                        Progress
                    </div>
                    <div className="grid grid-cols-5 gap-2 lg:grid-cols-4">
                        {payload.items.map((item, idx) => {
                            const status = statusMap[item.id] ?? "unanswered";

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setCurrentIndex(idx)}
                                    className={cn(
                                        "flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                                        idx === currentIndex && "border-primary ring-2 ring-primary/20",
                                        status === "correct" && "bg-primary/15 text-foreground",
                                        status === "incorrect" && "bg-destructive/10 text-foreground",
                                        status === "unanswered" && "bg-background"
                                    )}
                                >
                                    {item.id}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Circle className="h-3.5 w-3.5" />
                            <span>Not checked</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                            <span>Checked / answered</span>
                        </div>
                    </div>
                </aside>

                <div className="rounded-2xl border bg-card p-6 shadow-sm">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Question {currentIndex + 1}
                            </div>
                            <h2 className="text-2xl font-semibold">
                                {"question" in currentItem ? currentItem.question : ""}
                            </h2>
                        </div>
                        <StatusPill status={statusMap[currentItem.id] ?? "unanswered"} />
                    </div>

                    <QuestionBody
                        item={currentItem}
                        locked={lockedMap[currentItem.id] ?? false}
                        savedAnswer={selectedAnswers[currentItem.id]}
                        onSubmit={handleSubmit}
                    />

                    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>

                            <Button
                                variant="outline"
                                onClick={handleRetryCurrent}
                            >
                                Retry
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            {allAnswered && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowSummary(true)}
                                >
                                    Finish
                                </Button>
                            )}

                            <Button
                                onClick={() => setCurrentIndex((prev) => Math.min(total - 1, prev + 1))}
                                disabled={currentIndex === total - 1}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Shared header used by both quiz mode and flashcard mode.
 */
/**
 * Functionality: QuizHeader performs the quiz header workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { title, subtitle, progressLabel, progressPercent, } ({ title: string; subtitle: string; progressLabel: string; progressPercent: number; }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call QuizHeader from the owning module or component when this behavior is required.
 */
function QuizHeader({
    title,
    subtitle,
    progressLabel,
    progressPercent,
}: {
    title: string;
    subtitle: string;
    progressLabel: string;
    progressPercent: number;
}) {
    return (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <div className="text-sm text-muted-foreground">{subtitle}</div>
                    <h1 className="text-3xl font-semibold">{title}</h1>
                </div>

                <div className="min-w-[180px] text-right">
                    <div className="text-sm font-medium">{progressLabel}</div>
                    <div className="text-xs text-muted-foreground">{progressPercent}% complete</div>
                </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                />
            </div>
        </div>
    );
}

/**
 * Compact status badge.
 */
/**
 * Functionality: StatusPill performs the status pill workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { status } ({ status: ItemStatus }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call StatusPill from the owning module or component when this behavior is required.
 */
function StatusPill({ status }: { status: ItemStatus }) {
    const label =
        status === "correct"
            ? "Correct"
            : status === "incorrect"
                ? "Try again"
                : "Pending";

    return (
        <div
            className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                status === "correct" && "border-primary/30 bg-primary/15",
                status === "incorrect" && "border-destructive/30 bg-destructive/10",
                status === "unanswered" && "border-border bg-background"
            )}
        >
            {label}
        </div>
    );
}

/**
 * Generic wrapper that routes each quiz item to the correct interaction component.
 */
/**
 * Functionality: QuestionBody performs the question body workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { item, locked, savedAnswer, onSubmit, } ({ item: QuizItem; locked: boolean; savedAnswer: unknown; onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void; }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call QuestionBody from the owning module or component when this behavior is required.
 */
function QuestionBody({
    item,
    locked,
    savedAnswer,
    onSubmit,
}: {
    item: QuizItem;
    locked: boolean;
    savedAnswer: unknown;
    onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void;
}) {
    switch (item.kind) {
        case "multiple_choice":
            return (
                <MultipleChoiceQuestion
                    item={item}
                    locked={locked}
                    savedAnswer={savedAnswer as string | undefined}
                    onSubmit={onSubmit}
                />
            );
        case "true_false":
            return (
                <TrueFalseQuestion
                    item={item}
                    locked={locked}
                    savedAnswer={savedAnswer as boolean | undefined}
                    onSubmit={onSubmit}
                />
            );
        case "fill_in_blank":
            return (
                <FillInBlankQuestion
                    item={item}
                    locked={locked}
                    savedAnswer={savedAnswer as string[] | undefined}
                    onSubmit={onSubmit}
                />
            );
        case "drag_and_drop":
            return (
                <DragAndDropQuestion
                    item={item}
                    locked={locked}
                    savedAnswer={savedAnswer as string[] | undefined}
                    onSubmit={onSubmit}
                />
            );
        case "matching":
            return (
                <MatchingQuestion
                    item={item}
                    locked={locked}
                    savedAnswer={savedAnswer as Record<string, string> | undefined}
                    onSubmit={onSubmit}
                />
            );
        case "free_response":
            return (
                <FreeResponseQuestion
                    item={item}
                    locked={locked}
                    savedAnswer={savedAnswer as { response: string; selfScore: boolean } | undefined}
                    onSubmit={onSubmit}
                />
            );
        default:
            return null;
    }
}

/**
 * Multiple choice with immediate correctness checking.
 */
/**
 * Functionality: MultipleChoiceQuestion performs the multiple choice question workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { item, locked, savedAnswer, onSubmit, } ({ item: Extract<QuizItem, { kind: "multiple_choice" }>; locked: boolean; savedAnswer?: string; onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void; }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call MultipleChoiceQuestion from the owning module or component when this behavior is required.
 */
function MultipleChoiceQuestion({
    item,
    locked,
    savedAnswer,
    onSubmit,
}: {
    item: Extract<QuizItem, { kind: "multiple_choice" }>;
    locked: boolean;
    savedAnswer?: string;
    onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void;
}) {
    const [selected, setSelected] = useState<string>(savedAnswer ?? "");

    return (
        <div className="space-y-4">
            <div className="grid gap-3">
                {item.options.map((option) => {
                    const isSelected = selected === option;
                    const isCorrectOption = option === item.answer;

                    return (
                        <button
                            key={option}
                            type="button"
                            disabled={locked}
                            onClick={() => setSelected(option)}
                            className={cn(
                                "rounded-xl border p-4 text-left transition-colors",
                                isSelected && "border-primary bg-primary/10",
                                !isSelected && "bg-background hover:bg-accent/20",
                                locked && isCorrectOption && "border-primary bg-primary/15",
                                locked && isSelected && !isCorrectOption && "border-destructive bg-destructive/10"
                            )}
                        >
                            <div className="font-medium">{option}</div>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center gap-3">
                <Button
                    onClick={() => onSubmit(item.id, selected, selected === item.answer)}
                    disabled={!selected || locked}
                >
                    Check answer
                </Button>
                {locked && (
                    <div className="text-sm text-muted-foreground">
                        Correct answer: <span className="font-medium">{item.answer}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * True/false question using the same immediate feedback pattern.
 */
/**
 * Functionality: TrueFalseQuestion performs the true false question workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { item, locked, savedAnswer, onSubmit, } ({ item: Extract<QuizItem, { kind: "true_false" }>; locked: boolean; savedAnswer?: boolean; onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void; }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call TrueFalseQuestion from the owning module or component when this behavior is required.
 */
function TrueFalseQuestion({
    item,
    locked,
    savedAnswer,
    onSubmit,
}: {
    item: Extract<QuizItem, { kind: "true_false" }>;
    locked: boolean;
    savedAnswer?: boolean;
    onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void;
}) {
    const [selected, setSelected] = useState<boolean | null>(
        typeof savedAnswer === "boolean" ? savedAnswer : null
    );

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                {[true, false].map((value) => {
                    const isSelected = selected === value;
                    const label = value ? "True" : "False";

                    return (
                        <button
                            key={label}
                            type="button"
                            disabled={locked}
                            onClick={() => setSelected(value)}
                            className={cn(
                                "rounded-xl border p-5 text-left transition-colors",
                                isSelected ? "border-primary bg-primary/10" : "bg-background hover:bg-accent/20"
                            )}
                        >
                            <div className="text-lg font-semibold">{label}</div>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center gap-3">
                <Button
                    onClick={() => onSubmit(item.id, selected, selected === item.answer)}
                    disabled={selected === null || locked}
                >
                    Check answer
                </Button>
                {locked && (
                    <div className="text-sm text-muted-foreground">
                        Correct answer: <span className="font-medium">{item.answer ? "True" : "False"}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Fill-in-the-blank question.
 * Because the schema provides correct words in order but not explicit placeholder markers,
 * the UI renders one input per expected blank.
 */
/**
 * Functionality: FillInBlankQuestion performs the fill in blank question workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { item, locked, savedAnswer, onSubmit, } ({ item: FillInBlankItem; locked: boolean; savedAnswer?: string[]; onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void; }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call FillInBlankQuestion from the owning module or component when this behavior is required.
 */
function FillInBlankQuestion({
    item,
    locked,
    savedAnswer,
    onSubmit,
}: {
    item: FillInBlankItem;
    locked: boolean;
    savedAnswer?: string[];
    onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void;
}) {
    const [values, setValues] = useState<string[]>(
        savedAnswer ?? item.blanks.map(() => "")
    );

    const isCorrect =
        values.length === item.blanks.length &&
        values.every((value, idx) => normalizeText(value) === normalizeText(item.blanks[idx]));

    return (
        <div className="space-y-5">
            <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
                Fill each blank in order.
            </div>

            <div className="grid gap-3">
                {item.blanks.map((_, idx) => (
                    <div key={idx} className="rounded-xl border bg-background p-4">
                        <div className="mb-2 text-sm font-medium">Blank {idx + 1}</div>
                        <Input
                            value={values[idx] ?? ""}
                            disabled={locked}
                            onChange={(event) => {
                                const next = [...values];
                                next[idx] = event.target.value;
                                setValues(next);
                            }}
                            placeholder={`Enter answer for blank ${idx + 1}`}
                            className="h-10"
                        />
                        {locked && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Expected: <span className="font-medium">{item.blanks[idx]}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Button
                onClick={() => onSubmit(item.id, values, isCorrect)}
                disabled={locked || values.some((value) => !value.trim())}
            >
                Check answer
            </Button>
        </div>
    );
}

/**
 * Native drag-and-drop ordering interaction.
 * Users drag tokens from the bank into ordered slots. They can also move tokens back.
 */
/**
 * Functionality: DragAndDropQuestion performs the drag and drop question workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { item, locked, savedAnswer, onSubmit, } ({ item: DragAndDropItem; locked: boolean; savedAnswer?: string[]; onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void; }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call DragAndDropQuestion from the owning module or component when this behavior is required.
 */
function DragAndDropQuestion({
    item,
    locked,
    savedAnswer,
    onSubmit,
}: {
    item: DragAndDropItem;
    locked: boolean;
    savedAnswer?: string[];
    onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void;
}) {
    const initialOrder = savedAnswer ?? new Array(item.answer.length).fill("");
    const [slots, setSlots] = useState<string[]>(initialOrder);

    const availableBank = item.items.filter((token) => !slots.includes(token));

        /**
     * Functionality: handleDropIntoSlot performs the handle drop into slot workflow used by renderer/components/quiz/QuizRenderer.tsx.
     * Parameters: targetIndex (number); token (string).
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call handleDropIntoSlot from the owning module or component when this behavior is required.
     */
const handleDropIntoSlot = (targetIndex: number, token: string) => {
        if (locked) return;

        setSlots((prev) => {
            const next = [...prev];

            // Remove the token if it already exists in another slot.
            const existingIndex = next.findIndex((value) => value === token);
            if (existingIndex !== -1) {
                next[existingIndex] = "";
            }

            next[targetIndex] = token;
            return next;
        });
    };

        /**
     * Functionality: handleClearSlot performs the handle clear slot workflow used by renderer/components/quiz/QuizRenderer.tsx.
     * Parameters: targetIndex (number).
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call handleClearSlot from the owning module or component when this behavior is required.
     */
const handleClearSlot = (targetIndex: number) => {
        if (locked) return;
        setSlots((prev) => {
            const next = [...prev];
            next[targetIndex] = "";
            return next;
        });
    };

    const isCorrect =
        slots.length === item.answer.length &&
        slots.every((value, idx) => value === item.answer[idx]);

    const readyToCheck = slots.every((value) => value);

    return (
        <div className="space-y-5">
            <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
                Drag the items into the correct order.
            </div>

            <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 text-sm font-medium">Item bank</div>
                <div className="flex flex-wrap gap-2">
                    {availableBank.map((token) => (
                        <DragToken key={token} token={token} disabled={locked} />
                    ))}
                    {availableBank.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                            All items are currently placed in the order slots.
                        </div>
                    )}
                </div>
            </div>

            <div className="grid gap-3">
                {slots.map((value, idx) => (
                    <DropSlot
                        key={idx}
                        index={idx}
                        value={value}
                        locked={locked}
                        expected={locked ? item.answer[idx] : undefined}
                        onDropToken={(token) => handleDropIntoSlot(idx, token)}
                        onClear={() => handleClearSlot(idx)}
                    />
                ))}
            </div>

            <Button
                onClick={() => onSubmit(item.id, slots, isCorrect)}
                disabled={!readyToCheck || locked}
            >
                Check answer
            </Button>
        </div>
    );
}

/**
 * Matching question using lightweight select elements.
 * This is intentionally low-overhead while still being interactive and clear.
 */
/**
 * Functionality: MatchingQuestion performs the matching question workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { item, locked, savedAnswer, onSubmit, } ({ item: MatchingItem; locked: boolean; savedAnswer?: Record<string, string>; onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void; }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call MatchingQuestion from the owning module or component when this behavior is required.
 */
function MatchingQuestion({
    item,
    locked,
    savedAnswer,
    onSubmit,
}: {
    item: MatchingItem;
    locked: boolean;
    savedAnswer?: Record<string, string>;
    onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void;
}) {
    const options = item.pairs.map((pair) => pair.match);
    const [answers, setAnswers] = useState<Record<string, string>>(savedAnswer ?? {});

    const isComplete = item.pairs.every((pair) => Boolean(answers[pair.prompt]));
    const isCorrect = item.pairs.every(
        (pair) => normalizeText(answers[pair.prompt] ?? "") === normalizeText(pair.match)
    );

    return (
        <div className="space-y-4">
            {item.pairs.map((pair) => (
                <div key={pair.prompt} className="rounded-xl border bg-background p-4">
                    <div className="mb-3 font-medium">{pair.prompt}</div>
                    <select
                        value={answers[pair.prompt] ?? ""}
                        disabled={locked}
                        onChange={(event) =>
                            setAnswers((prev) => ({
                                ...prev,
                                [pair.prompt]: event.target.value,
                            }))
                        }
                        className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none"
                    >
                        <option value="">Select a match</option>
                        {options.map((option) => (
                            <option key={`${pair.prompt}-${option}`} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>

                    {locked && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            Expected: <span className="font-medium">{pair.match}</span>
                        </div>
                    )}
                </div>
            ))}

            <Button
                onClick={() => onSubmit(item.id, answers, isCorrect)}
                disabled={!isComplete || locked}
            >
                Check answer
            </Button>
        </div>
    );
}

/**
 * Free-response question with rubric reveal and self-evaluation.
 * The current schema does not provide a canonical answer, so this uses self-check.
 */
/**
 * Functionality: FreeResponseQuestion performs the free response question workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { item, locked, savedAnswer, onSubmit, } ({ item: FreeResponseItem; locked: boolean; savedAnswer?: { response: string; selfScore: boolean }; onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void; }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call FreeResponseQuestion from the owning module or component when this behavior is required.
 */
function FreeResponseQuestion({
    item,
    locked,
    savedAnswer,
    onSubmit,
}: {
    item: FreeResponseItem;
    locked: boolean;
    savedAnswer?: { response: string; selfScore: boolean };
    onSubmit: (itemId: number, answerValue: unknown, isCorrect: boolean) => void;
}) {
    const [response, setResponse] = useState(savedAnswer?.response ?? "");
    const [rubricVisible, setRubricVisible] = useState(Boolean(savedAnswer));
    const [selfScore, setSelfScore] = useState<boolean | null>(
        typeof savedAnswer?.selfScore === "boolean" ? savedAnswer.selfScore : null
    );

    return (
        <div className="space-y-4">
            <textarea
                value={response}
                disabled={locked}
                onChange={(event) => setResponse(event.target.value)}
                placeholder="Write your response here..."
                className="min-h-[180px] w-full rounded-xl border bg-background p-4 text-sm outline-none"
            />

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="outline"
                    onClick={() => setRubricVisible((prev) => !prev)}
                >
                    {rubricVisible ? "Hide rubric" : "Show rubric"}
                </Button>

                {rubricVisible && (
                    <>
                        <Button
                            variant={selfScore === true ? "default" : "outline"}
                            disabled={locked}
                            onClick={() => setSelfScore(true)}
                        >
                            Meets rubric
                        </Button>
                        <Button
                            variant={selfScore === false ? "destructive" : "outline"}
                            disabled={locked}
                            onClick={() => setSelfScore(false)}
                        >
                            Needs work
                        </Button>
                    </>
                )}
            </div>

            {rubricVisible && (
                <div className="rounded-xl border bg-background p-4">
                    <div className="mb-2 text-sm font-medium">Rubric</div>
                    <div className="text-sm text-muted-foreground">{item.rubric}</div>
                </div>
            )}

            <Button
                onClick={() =>
                    onSubmit(
                        item.id,
                        { response, selfScore: Boolean(selfScore) },
                        Boolean(selfScore)
                    )
                }
                disabled={!response.trim() || selfScore === null || locked}
            >
                Save self-check
            </Button>
        </div>
    );
}

/**
 * Small draggable chip used by the drag-and-drop question.
 */
/**
 * Functionality: DragToken performs the drag token workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { token, disabled } ({ token: string; disabled?: boolean }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call DragToken from the owning module or component when this behavior is required.
 */
function DragToken({ token, disabled }: { token: string; disabled?: boolean }) {
    return (
        <div
            draggable={!disabled}
            onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", token);
                event.dataTransfer.effectAllowed = "move";
            }}
            className={cn(
                "cursor-grab rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-sm",
                disabled && "cursor-not-allowed opacity-70"
            )}
        >
            {token}
        </div>
    );
}

/**
 * Drop target for each ordered slot.
 * It accepts native drag-and-drop text payloads and allows quick clearing.
 */
/**
 * Functionality: DropSlot performs the drop slot workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { index, value, expected, locked, onDropToken, onClear, } ({ index: number; value: string; expected?: string; locked: boolean; onDropToken: (token: string) => void; onClear: () => void; }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call DropSlot from the owning module or component when this behavior is required.
 */
function DropSlot({
    index,
    value,
    expected,
    locked,
    onDropToken,
    onClear,
}: {
    index: number;
    value: string;
    expected?: string;
    locked: boolean;
    onDropToken: (token: string) => void;
    onClear: () => void;
}) {
    const [isOver, setIsOver] = useState(false);

    return (
        <div
            onDragOver={(event) => {
                if (locked) return;
                event.preventDefault();
                setIsOver(true);
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={(event) => {
                if (locked) return;
                event.preventDefault();
                const token = event.dataTransfer.getData("text/plain");
                if (token) {
                    onDropToken(token);
                }
                setIsOver(false);
            }}
            className={cn(
                "rounded-xl border p-4 transition-colors",
                isOver ? "border-primary bg-primary/10" : "bg-background"
            )}
        >
            <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">Position {index + 1}</div>
                {value && !locked && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        Clear
                    </button>
                )}
            </div>

            <div className="min-h-[40px] rounded-lg border border-dashed p-3 text-sm">
                {value || <span className="text-muted-foreground">Drop item here</span>}
            </div>

            {locked && expected && (
                <div className="mt-2 text-xs text-muted-foreground">
                    Expected: <span className="font-medium">{expected}</span>
                </div>
            )}
        </div>
    );
}

/**
 * Summary card stat for the end-screen.
 */
/**
 * Functionality: SummaryStat performs the summary stat workflow used by renderer/components/quiz/QuizRenderer.tsx.
 * Parameters: { label, value } ({ label: string; value: string }).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call SummaryStat from the owning module or component when this behavior is required.
 */
function SummaryStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border bg-background p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
    );
}
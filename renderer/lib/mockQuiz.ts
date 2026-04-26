/**
 * File: renderer/lib/mockQuiz.ts
 * Purpose: Local mock payloads for standalone quiz-page development and testing.
 * Summary of changes:
 * - Added one mixed quiz payload covering all supported quiz item types.
 * - Added one flashcard payload so the page can also handle "flashcards" root responses.
 * Author: Malek Kchaou
 * Git-history contributors: Malek Kchaou
 * Date: 2026-04-12
 * Note: This file is intentionally local-only for the first low-overhead implementation pass.
 */

import { QuizPayload } from "@/renderer/components/quiz/quizTypes";

/**
 * Mixed quiz payload that exercises every supported interactive question type.
 * This lets the standalone page be tested end-to-end before wiring it to real AI output.
 */
export const mockQuizPayload: QuizPayload = {
    type: "quiz",
    meta: {
        topic: "Software Engineering Basics",
        difficulty: "medium",
        total: 6,
    },
    items: [
        {
            id: 1,
            kind: "multiple_choice",
            question: "Which principle is most closely associated with keeping modules easy to change?",
            options: [
                "High coupling",
                "Low cohesion",
                "Low coupling",
                "Ignoring abstraction",
            ],
            answer: "Low coupling",
        },
        {
            id: 2,
            kind: "true_false",
            question: "Unit tests are mainly intended to validate small isolated pieces of behavior.",
            answer: true,
        },
        {
            id: 3,
            kind: "fill_in_blank",
            question: "Version control lets teams track _____ and safely _____ on shared codebases.",
            blanks: ["changes", "collaborate"],
        },
        {
            id: 4,
            kind: "drag_and_drop",
            question: "Arrange these SDLC stages in a sensible high-level order.",
            items: ["Testing", "Requirements", "Design", "Implementation"],
            answer: ["Requirements", "Design", "Implementation", "Testing"],
        },
        {
            id: 5,
            kind: "matching",
            question: "Match each concept to its best description.",
            pairs: [
                { prompt: "API", match: "A defined interface for software communication" },
                { prompt: "Refactor", match: "Improve internal code structure without changing behavior" },
                { prompt: "CI", match: "Automated validation on code changes" },
            ],
        },
        {
            id: 6,
            kind: "free_response",
            question: "Briefly explain why code reviews improve software quality.",
            rubric:
                "A strong answer mentions defect detection, shared understanding, maintainability, or consistency.",
        },
    ],
};

/**
 * Optional flashcards payload so the same page can also support flashcard mode
 * if the AI returns a flashcard root object instead of a quiz object.
 */
export const mockFlashcardsPayload: QuizPayload = {
    type: "flashcards",
    meta: {
        topic: "Study Terms",
        difficulty: "easy",
        total: 3,
    },
    items: [
        {
            id: 1,
            kind: "flashcard",
            front: "Encapsulation",
            back: "Bundling data and behavior together while restricting direct access to internals.",
        },
        {
            id: 2,
            kind: "flashcard",
            front: "Scalability",
            back: "A system's ability to handle growing workload effectively.",
        },
        {
            id: 3,
            kind: "flashcard",
            front: "Regression bug",
            back: "A defect where previously working behavior breaks after a change.",
        },
    ],
};
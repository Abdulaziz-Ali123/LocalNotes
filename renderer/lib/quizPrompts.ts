/**
 * File: renderer/lib/quizPrompts.ts
 * Purpose: Builds system and user prompts for LLM-based quiz generation.
 */

export type QuestionKind = "multiple_choice" | "true_false" | "short_answer" | "matching" | "fill_in_blank" | "drag_and_drop" | "free_response" | "flashcard";

export interface QuizUserPromptOptions {
  ragChunks: string;
  mode: "quiz" | "flashcard";
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  numItems?: number;
  questionTypes?: QuestionKind[];
}

/**
 * Builds the system prompt for quiz generation.
 * Instructs the LLM on output format and question type constraints.
 */
export function buildQuizSystemPrompt(questionTypes?: QuestionKind[]): string {
  const types = questionTypes?.length
    ? questionTypes.join(", ")
    : "multiple_choice, true_false";

  return `You are a quiz generator. Given study material, generate quiz questions strictly as a JSON object.

Your response must be valid JSON with no markdown, no code fences, no preamble — just the raw JSON object.

The JSON must follow this structure:
{
  "items": [
    {
      "id": "q1",
      "kind": "multiple_choice" | "true_false" | "short_answer",
      "question": "Question text here",
      "options": ["A", "B", "C", "D"],  // omit for short_answer
      "answer": "Correct answer here"
    }
  ]
}

Allowed question types for this request: ${types}.
For true_false questions, options must be exactly ["True", "False"].
For short_answer questions, omit the options field.
For multiple_choice questions, provide exactly 4 options.`;
}

/**
 * Builds the user prompt for quiz generation using RAG context and config.
 */
export function buildQuizUserPrompt(options: QuizUserPromptOptions): string {
  const {
    ragChunks,
    topic,
    difficulty = "medium",
    numItems = 5,
    questionTypes = ["multiple_choice"],
  } = options;

  const topicLine = topic
    ? `Focus on the topic: "${topic}".`
    : "Cover the main concepts from the notes.";

  const typesLine =
    questionTypes.length === 1
      ? `All questions must be of type: ${questionTypes[0]}.`
      : `Use a mix of these question types: ${questionTypes.join(", ")}.`;

  return `Here are the study notes:

---
${ragChunks}
---

${topicLine}
Generate exactly ${numItems} quiz questions at ${difficulty} difficulty.
${typesLine}

Return only the JSON object described in the system prompt. No extra text.`;
}
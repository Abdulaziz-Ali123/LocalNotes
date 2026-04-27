/**
 * Name of code artifact: main/embeding/embeding.ts
 * Brief description: Provides source code for the LocalNotes Electron and Next.js application.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import {Embedder, EmbeddingModel, cosineSimilarity, findKMostSimilar} from "embrix";


const embeder = new Embedder(EmbeddingModel.BGE);

/**
 * Functionality: embedChunk performs the embed chunk workflow used by main/embeding/embeding.ts.
 * Parameters: text (string).
 * Returns: Returns Promise<Float32Array>.
 * Usage: Call embedChunk from the owning module or component when this behavior is required.
 */
export async function embedChunk(text: string): Promise<Float32Array> {
    return await embeder.embed(text);
}

/**
 * Functionality: calculateSimilarity performs the calculate similarity workflow used by main/embeding/embeding.ts.
 * Parameters: embedding1 (Float32Array); embedding2 (Float32Array).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call calculateSimilarity from the owning module or component when this behavior is required.
 */
export function calculateSimilarity(embedding1: Float32Array, embedding2: Float32Array) {
    return cosineSimilarity(embedding1, embedding2);
}

/**
 * Functionality: findMostSimilar performs the find most similar workflow used by main/embeding/embeding.ts.
 * Parameters: embedding (Float32Array); embeddingList (Float32Array[]); topK (number).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call findMostSimilar from the owning module or component when this behavior is required.
 */
export function findMostSimilar(embedding: Float32Array, embeddingList: Float32Array[], topK: number) {
    return findKMostSimilar(embedding, embeddingList, topK);
}
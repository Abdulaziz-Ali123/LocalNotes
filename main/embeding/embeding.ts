import {Embedder, EmbeddingModel, cosineSimilarity, findKMostSimilar} from "embrix";


const embeder = new Embedder(EmbeddingModel.BGE);

export async function embedChunk(text: string): Promise<Float32Array> {
    return await embeder.embed(text);
}

export function calculateSimilarity(embedding1: Float32Array, embedding2: Float32Array) {
    return cosineSimilarity(embedding1, embedding2);
}

export function findMostSimilar(embedding: Float32Array, embeddingList: Float32Array[], topK: number) {
    return findKMostSimilar(embedding, embeddingList, topK);
}
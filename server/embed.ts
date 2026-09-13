// server/embed.ts
//
// PHASE 4c. Turning text into vectors.
//
// WHY THIS ISN'T ANTHROPIC. Claude is a completion model — there is no
// `client.embeddings.create`, and no amount of looking will find one. Every
// RAG system that uses vectors needs a SECOND model from somewhere else.
// Anthropic's own recommendation is Voyage AI; this uses a small open model
// running locally instead, because it costs nothing, needs no second API key,
// and you can watch the numbers come out.
//
// all-MiniLM-L6-v2: 384 dimensions, ~25MB, downloaded once and cached under
// node_modules/.cache. Modest by modern standards — Voyage's models produce
// 1024+ dimensions and score better — but it is enough to show the thing that
// matters, which is that "laptop" and "computer" land near each other while
// "laptop" and "filing fee" do not:
//
//   laptop vs computer   0.7220
//   laptop vs filing fee -0.1032
//
// That number is the entire argument for embeddings. TF-IDF scores both pairs
// at exactly zero, because it compares spellings.

import { pipeline } from '@huggingface/transformers'
import type { FeatureExtractionPipeline } from '@huggingface/transformers'

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'
export const EMBEDDING_DIMENSIONS = 384

let extractor: Promise<FeatureExtractionPipeline> | null = null

/**
 * Load the model once and reuse it.
 *
 * First call takes ~17 seconds (download plus initialisation); every call
 * after that is milliseconds. Held as the PROMISE rather than the resolved
 * value so two concurrent callers wait on one load instead of starting two.
 */
function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractor ??= pipeline('feature-extraction', EMBEDDING_MODEL)
  return extractor
}

/**
 * Embed one or more texts.
 *
 * `pooling: 'mean'` averages the per-token vectors into one vector for the
 * whole passage — a sentence-level model needs a sentence-level vector.
 *
 * `normalize: true` scales every vector to unit length, which is what makes
 * cosine similarity equal to a plain dot product, and what lets sqlite-vec's
 * L2 distance rank identically to cosine. Skip it and the longest text tends
 * to win regardless of meaning.
 */
export async function embed(texts: string[]): Promise<Float32Array[]> {
  const model = await getExtractor()
  const output = await model(texts, { pooling: 'mean', normalize: true })
  const rows = output.tolist() as number[][]
  return rows.map((row) => Float32Array.from(row))
}

/** Embed a single string. */
export async function embedOne(text: string): Promise<Float32Array> {
  return (await embed([text]))[0]
}

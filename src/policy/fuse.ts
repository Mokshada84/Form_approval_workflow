// policy/fuse.ts
//
// PHASE 4c. Combining keyword and vector results.
//
// THE PROBLEM WITH ADDING THE SCORES. TF-IDF produces unbounded positive
// numbers (ours run 0.9 to 4.5); cosine distance runs 0 to 2 and SMALLER is
// better. They are different units pointing in opposite directions, and any
// attempt to blend them means inventing a normalisation and a weight, then
// re-tuning both whenever either side changes.
//
// RECIPROCAL RANK FUSION sidesteps all of it by throwing the scores away and
// keeping only the ORDER:
//
//     score(clause) = Σ  1 / (k + rank in that list)
//
// A clause ranked 1st by one retriever and 3rd by the other beats one ranked
// 2nd by both — agreement is rewarded, and a single retriever's confidence
// cannot dominate. `k` (conventionally 60) flattens the top: without it, 1st
// place would be worth twice 2nd, which over-rewards whichever retriever
// happened to be certain.
//
// It is also the honest choice for this codebase, because keyword and vector
// scores here are genuinely incomparable and pretending otherwise would be a
// tuning parameter disguised as a decision.

export type RankedList = string[]

export type FusedResult = {
  id: string
  score: number
  /** Where each retriever put it (1-based), or null if it missed. */
  ranks: (number | null)[]
}

/**
 * Fuse ranked lists of ids, best first.
 *
 * `k` damps the advantage of the top position. 60 is the value from the
 * original paper and the usual default; smaller makes the fusion more
 * aggressive about first places.
 */
export function reciprocalRankFusion(lists: RankedList[], k = 60): FusedResult[] {
  const scores = new Map<string, number>()

  for (const list of lists) {
    list.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1))
    })
  }

  return [...scores.entries()]
    .map(([id, score]) => ({
      id,
      score,
      ranks: lists.map((list) => {
        const position = list.indexOf(id)
        return position === -1 ? null : position + 1
      }),
    }))
    .sort((a, b) => b.score - a.score)
}

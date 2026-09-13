// ai/policySchema.ts
//
// PHASE 4. The shape of a policy check, shared by both sides.
//
// An API note that shapes this whole design: the Messages API can attach
// NATIVE citations to `document` blocks — exact character offsets into the
// source, which the model cannot fabricate. But native citations are
// incompatible with `output_config.format` and return a 400 if you ask for
// both. You pick one:
//
//   prose + un-fakeable offsets   OR   structured findings you can act on
//
// For an approval queue the structured findings win: a verdict has to be a
// field, not a sentence, so the UI can count and colour it. The grounding is
// recovered a different way — the model returns a clause ID, and the server
// checks that ID exists in the corpus and attaches the real text itself. A
// made-up "§9.9" is dropped before anyone sees it. That check is pure, so it
// is tested offline (see verifyFindings.test.ts).

import { z } from 'zod'

export const FindingSchema = z.object({
  /**
   * The clause this finding rests on, e.g. "§4.2".
   *
   * The model is told to quote an id from the clauses it was given. It is not
   * trusted to: the server looks the id up and discards the finding if it
   * doesn't resolve.
   */
  clauseId: z.string(),

  /**
   * How the claim sits against that clause.
   *
   * "unclear" exists for the same reason every extraction field is nullable —
   * without a way to say "the form doesn't tell me", a model asked for a
   * verdict will produce one. Most real findings on a two-line expense form
   * are genuinely "unclear", and an approver needs to know that rather than
   * be told "compliant".
   */
  verdict: z.enum(['compliant', 'violation', 'unclear']),

  /** One sentence, in plain language, naming what about the form triggered it. */
  explanation: z.string(),
})

export const PolicyCheckSchema = z.object({
  findings: z.array(FindingSchema),
  /** One line an approver can read without opening the findings. */
  summary: z.string(),
})

export type Finding = z.infer<typeof FindingSchema>
export type PolicyCheck = z.infer<typeof PolicyCheckSchema>

/** A finding with the real clause text attached by the server. */
export type VerifiedFinding = Finding & {
  clauseTitle: string
  clauseText: string
}

export type VerifiedPolicyCheck = {
  findings: VerifiedFinding[]
  summary: string
  /** Clause ids the model cited that do not exist. Surfaced, not hidden. */
  droppedCitations: string[]
}

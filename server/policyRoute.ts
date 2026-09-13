// server/policyRoute.ts
//
// PHASE 4. RAG: retrieve, then generate.
//
// The corpus is a plain markdown file — see policyCorpus.ts. Nothing in this
// route knows the policy's contents; it knows how to search a document and
// what to do with the result.
//
// Given one submitted form, find the policy clauses that bear on it and ask
// Claude whether it complies — citing the clauses it actually used.
//
// THE SHAPE OF A RAG REQUEST, and why the pieces sit where they do:
//
//   system[0]  the frozen instructions          <- cache breakpoint
//   system[1]  the retrieved clauses            varies per form
//   messages   the form itself                  varies per form
//
// Stable content first is not a style preference — the cache key is the bytes
// up to the breakpoint (see extractRoute.ts), so anything varying above the
// breakpoint destroys it. Retrieved chunks vary by definition, which is why
// they go BELOW the frozen block and not into it.
//
// WHY RETRIEVE AT ALL AT THIS SIZE — worth being honest about. The whole
// corpus is ~2,500 tokens. Cached, sending all of it would cost about $0.001
// per check, and retrieval would be pure overhead. Retrieval earns its place
// when the corpus outgrows the context window or the budget: at 500 clauses
// instead of 34, "send everything" stops being an option and this code is
// already the shape you need. Built here small, on purpose, so the mechanism
// is legible.

import { Hono } from 'hono'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { POLICY_CLAUSES, POLICY_MARKDOWN } from './policyCorpus.ts'
import { findClause } from '../src/policy/clauses.ts'
import { INDEX_PATH, sourceHash } from './policyIndex.ts'
import { openVerifiedIndex } from './vectorStore.ts'
import { hybridIds, keywordIds, vectorIds } from './retrieveHybrid.ts'
import type { Strategy } from './retrieveHybrid.ts'
import { PolicyCheckSchema } from '../src/ai/policySchema.ts'
import { verifyFindings } from '../src/ai/verifyFindings.ts'
import { parsePolicyRequest } from '../src/ai/policyRequest.ts'
import { anthropic, MODEL } from './client.ts'

/**
 * How many clauses to put in front of the model.
 *
 * Six is a deliberate middle. Too few and the governing rule may not be
 * there — and a model given only near-misses will reason from them rather
 * than say it lacks the rule. Too many and you have reinvented "send the
 * whole document", slowly and with extra machinery.
 */
const CLAUSE_LIMIT = 6

/**
 * PHASE 5 discipline, applied from the start: this block is byte-identical on
 * every request, so it carries the cache breakpoint. Nothing about a specific
 * form appears in it.
 */
const POLICY_SYSTEM = `You are a compliance assistant for Acme's expense process. You are given an expense claim and a small set of clauses from the company expense policy, and you report how the claim sits against those clauses.

Rules:
- Judge the claim ONLY against the clauses you are given. You are seeing a handful of clauses, not the whole policy. If the relevant rule does not appear to be among them, say so in the summary rather than reasoning from a near-miss.
- Cite clauses by the exact id shown, for example "§4.2". Never invent an id, and never cite an id that is not in the list you were given.
- Use verdict "violation" only when the claim clearly breaks the clause on the information present. Use "unclear" when the clause applies but the form does not carry enough detail to tell — this will be the honest answer for most short claims, and it is more useful to an approver than a guess. Use "compliant" only when the form positively shows the clause is met.
- Never infer facts the form does not state. A name does not tell you someone's relationship to the company; an expense type does not tell you who attended; a missing receipt field does not prove no receipt exists.
- Report at most one finding per clause, and only for clauses that actually bear on this claim. Do not pad the list.
- "summary" is one plain sentence an approver can read at a glance.

You are advising a person who decides. You are not deciding.`

/**
 * The vector index, opened once at startup, or null.
 *
 * NULL IS A NORMAL STATE, not an error. The index is a build artifact (`npm
 * run build:index`) that needs a ~25MB model download, and it is git-ignored —
 * so a fresh clone has no index and the app must still work. Keyword retrieval
 * covers that case, and measures better on recall anyway.
 *
 * It is also refused when the policy document has changed since the index was
 * built, which is the failure worth being strict about: a stale index keeps
 * answering confidently from the previous version of the rules, and nothing
 * looks wrong.
 */
const indexStatus = openVerifiedIndex(INDEX_PATH, sourceHash(POLICY_MARKDOWN))
const vectorIndex = indexStatus.ok ? indexStatus.db : null

/**
 * Which retriever to use. KEYWORD IS THE DEFAULT, and that is a measured
 * decision rather than a lazy one.
 *
 * `npm run eval:retrieval` over 22 labelled cases:
 *
 *   strategy   primary found  ranked 1st   recall    MRR
 *   keyword           95.5%       77.3%     95.5%   0.850
 *   vector            90.9%       63.6%     74.2%   0.746
 *   hybrid            95.5%       81.8%     89.4%   0.861
 *
 * Hybrid ranks the governing clause better; keyword finds MORE of the relevant
 * clauses. For this feature recall wins, because a clause that isn't retrieved
 * can't be reasoned about at all — and it shows up in the output: on the
 * $10,000 client dinner, hybrid ranked §4.2 first but dropped §2.1 Approval
 * thresholds and §2.4 Pre-approval, both of which genuinely bear on a claim
 * that size.
 *
 * Set RETRIEVAL_STRATEGY=hybrid or =vector to compare them live.
 */
const STRATEGY = (process.env.RETRIEVAL_STRATEGY ?? 'keyword') as Strategy
const usingVectors = STRATEGY !== 'keyword' && vectorIndex !== null

console.log(
  `[policy] retrieval: ${usingVectors ? STRATEGY : 'keyword'}` +
    (indexStatus.ok ? ' (vector index available)' : ` — ${indexStatus.reason}`),
)

export const policyRoute = new Hono()

policyRoute.post('/api/policy-check', async (c) => {
  const parsed = parsePolicyRequest(await c.req.json().catch(() => null))
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, parsed.status)
  }
  const { form } = parsed.request

  // ---- RETRIEVE -----------------------------------------------------------
  // Hybrid where the vector index is available and current, keyword otherwise.
  // Nothing in the query is generated: retrieval must not be able to
  // hallucinate its way to a clause.
  const ids = !usingVectors || vectorIndex === null
    ? keywordIds(form, CLAUSE_LIMIT)
    : STRATEGY === 'vector'
      ? await vectorIds(vectorIndex, form, CLAUSE_LIMIT)
      : await hybridIds(vectorIndex, form, CLAUSE_LIMIT)

  const retrieved = ids.flatMap((id) => {
    const clause = findClause(POLICY_CLAUSES, id)
    return clause === undefined ? [] : [{ clause }]
  })

  if (retrieved.length === 0) {
    // Nothing matched. Saying so beats spending a request to be told nothing,
    // and it is an honest signal that retrieval — not the model — came up short.
    return c.json({
      check: {
        findings: [],
        summary: 'No policy clauses matched this claim closely enough to check it.',
        droppedCitations: [],
      },
      retrievedClauseIds: [],
    })
  }

  const clauseBlock = retrieved
    .map(({ clause }) => `${clause.id} ${clause.title}\n${clause.text}`)
    .join('\n\n')

  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: [
        // Frozen — cached across every check, every form, every user.
        { type: 'text', text: POLICY_SYSTEM, cache_control: { type: 'ephemeral' } },
        // Retrieved clauses: different for almost every form, so below the
        // breakpoint where changing them costs nothing but their own tokens.
        { type: 'text', text: `Relevant policy clauses:\n\n${clauseBlock}` },
      ],
      messages: [
        {
          role: 'user',
          content: `Expense claim ${form.number}
Name: ${form.name}
Amount: $${form.amount}
Department: ${form.department}
Expense type: ${form.expenseType}
Submitted by: ${form.submitterName}
Receipt attached: ${form.hasReceipt ? 'yes' : 'no'}`,
        },
      ],
      output_config: {
        // Higher than the extraction route's 'low': this is judgement against
        // rules rather than pulling fields out of a sentence, and the cost of
        // a wrong verdict lands on an approver.
        effort: 'medium',
        format: zodOutputFormat(PolicyCheckSchema),
      },
    })

    if (response.parsed_output === null) {
      return c.json({ error: 'Could not complete the policy check.' }, 422)
    }

    console.log('[policy] usage', {
      strategy: usingVectors ? STRATEGY : 'keyword',
      retrieved: retrieved.length,
      input: response.usage.input_tokens,
      cache_write: response.usage.cache_creation_input_tokens,
      cache_read: response.usage.cache_read_input_tokens,
      output: response.usage.output_tokens,
    })

    // ---- VERIFY -----------------------------------------------------------
    // Every cited id is resolved against the real corpus, and the clause text
    // is attached from there. A citation that doesn't resolve is dropped.
    return c.json({
      check: verifyFindings(response.parsed_output, POLICY_CLAUSES),
      retrievedClauseIds: retrieved.map(({ clause }) => clause.id),
      strategy: usingVectors ? STRATEGY : 'keyword',
    })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('[policy] bad API key')
      return c.json({ error: 'The server’s API key is missing or invalid.' }, 500)
    }
    if (error instanceof Anthropic.RateLimitError) {
      return c.json({ error: 'Rate limited — try again in a moment.' }, 429)
    }
    if (error instanceof Anthropic.APIError) {
      console.error('[policy] API error', error.status, error.message)
      return c.json({ error: 'The compliance check is unavailable right now.' }, 502)
    }
    console.error('[policy] unexpected', error)
    return c.json({ error: 'Something went wrong.' }, 500)
  }
})

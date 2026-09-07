// policy/evalCases.ts
//
// PHASE 4b. THE EVAL SET — labelled claims with the clauses that should be
// found for them.
//
// This exists because "did retrieval get better?" was unanswerable. §4.2 was
// noticed ranking fifth by printing scores by hand once; that is an anecdote,
// and you cannot hill-climb on anecdotes. Every future change to chunking,
// query building or scoring gets judged against this file instead of against
// a hunch.
//
// It costs nothing to run. Retrieval is a pure function, so this needs no API
// call, no key and no network — which is the argument for evaluating the
// deterministic stage separately from the model. When a bad answer comes out
// of the policy check, the first question is whether the governing clause was
// even retrieved, and this answers that on its own.
//
// HONEST LIMITATION: the same person wrote the corpus, the retrieval and these
// labels, so the set can only catch retrieval failing on its own terms — not a
// policy question nobody thought to write down. A real eval set is labelled by
// someone who owns the domain and did not write the code. Treat the numbers as
// a regression guard, not as proof of quality.

import type { RetrievalSubject } from './retrieve'

export type EvalCase = {
  id: string
  subject: RetrievalSubject
  /**
   * The one clause that most directly governs this claim.
   *
   * Tracked separately from the rest because a governing clause ranked sixth
   * is a different problem from one that is missing: it survives at
   * CLAUSE_LIMIT 6 and vanishes the moment anyone tightens the limit.
   */
  primary: string
  /** Other clauses a reviewer would reasonably expect to see. */
  alsoRelevant: string[]
}

/** Shorthand so the cases below read as claims rather than as object literals. */
function claim(
  name: string,
  amount: number,
  department: string,
  expenseType: string,
  hasReceipt: boolean,
): RetrievalSubject {
  return { name, amount, department, expenseType, hasReceipt }
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'client-dinner',
    subject: claim('Dinner in Hawaii with Mr Nitin', 10000, 'Finance', 'Client entertainment', false),
    primary: '§4.2',
    alsoRelevant: ['§1.3', '§2.1', '§2.4'],
  },
  {
    id: 'laptop-replacement',
    subject: claim('Laptop replacement, screen cracked', 1800, 'IT', 'Laptop', true),
    primary: '§5.1',
    alsoRelevant: ['§2.1'],
  },
  {
    id: 'flight',
    subject: claim('Flight to Berlin for the vendor summit', 900, 'Finance', 'Travel', true),
    primary: '§3.1',
    alsoRelevant: [],
  },
  {
    id: 'hotel',
    subject: claim('Four nights hotel in central London', 1300, 'Finance', 'Travel', true),
    primary: '§3.2',
    alsoRelevant: ['§2.1'],
  },
  {
    id: 'mileage',
    subject: claim('Mileage driving to the client site and back', 84, 'Finance', 'Travel', false),
    primary: '§3.4',
    alsoRelevant: [],
  },
  {
    id: 'wine-with-client',
    subject: claim('Wine with the client at dinner', 210, 'Finance', 'Client entertainment', true),
    primary: '§4.3',
    alsoRelevant: ['§4.2'],
  },
  {
    id: 'client-gift',
    subject: claim('Gift hamper for the client at year end', 180, 'Finance', 'Client entertainment', true),
    primary: '§4.5',
    alsoRelevant: [],
  },
  {
    id: 'office-supplies',
    subject: claim('Printer paper and pens for the office', 40, 'Finance', 'Office supplies', true),
    primary: '§7.2',
    alsoRelevant: [],
  },
  {
    id: 'software-subscription',
    subject: claim('Individual Figma subscription', 220, 'IT', 'Software license', true),
    primary: '§5.4',
    alsoRelevant: [],
  },
  {
    id: 'monitor-and-dock',
    subject: claim('Second monitor and docking station', 520, 'IT', 'IT equipment', true),
    primary: '§5.2',
    alsoRelevant: [],
  },
  {
    id: 'standing-desk',
    subject: claim('Standing desk for my home office', 700, 'IT', 'IT equipment', true),
    primary: '§5.5',
    alsoRelevant: [],
  },
  {
    id: 'external-counsel',
    subject: claim('External counsel for the vendor dispute', 6500, 'Legal', 'Legal consultation', true),
    primary: '§6.1',
    alsoRelevant: ['§2.4', '§2.1'],
  },
  {
    id: 'filing-fees',
    subject: claim('Filing fees for the trademark renewal', 615, 'Legal', 'Filing fees', true),
    primary: '§6.2',
    alsoRelevant: [],
  },
  {
    id: 'training-course',
    subject: claim('AWS certification course and exam', 3400, 'Finance', 'Training', true),
    primary: '§7.1',
    alsoRelevant: ['§2.1'],
  },
  {
    id: 'parking-fine',
    subject: claim('Parking fine while visiting the client', 60, 'Finance', 'Travel', true),
    primary: '§7.4',
    alsoRelevant: ['§3.3'],
  },
  {
    id: 'political-donation',
    subject: claim("Donation to a local candidate's campaign", 500, 'Finance', 'Office supplies', true),
    primary: '§7.3',
    alsoRelevant: [],
  },
  {
    id: 'companion-flight',
    subject: claim('Flight for my wife to join me in Berlin', 800, 'Finance', 'Travel', true),
    primary: '§3.6',
    alsoRelevant: ['§3.1'],
  },
  {
    id: 'mobile-handset',
    subject: claim('New work phone handset', 1100, 'IT', 'IT equipment', true),
    primary: '§5.3',
    alsoRelevant: ['§2.1'],
  },
  {
    id: 'conference-meals',
    subject: claim('Meals during three days at the conference', 200, 'Finance', 'Travel', false),
    primary: '§3.5',
    alsoRelevant: ['§1.3'],
  },
  {
    id: 'late-taxi-claim',
    subject: claim("Taxi from last year's offsite, receipt only just found", 45, 'Finance', 'Travel', true),
    primary: '§1.2',
    alsoRelevant: ['§3.3'],
  },
  {
    id: 'contract-review',
    subject: claim('Third-party review of the supplier contract', 2200, 'Legal', 'Contract review', true),
    primary: '§6.4',
    alsoRelevant: ['§6.1'],
  },
  {
    id: 'compliance-certification',
    subject: claim('Mandatory AML certification renewal', 450, 'Legal', 'Compliance expense', true),
    primary: '§6.3',
    alsoRelevant: [],
  },
]

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page expense-approval app: anyone submits a form, and how many signatures
it needs depends on the amount. No server, no database, no network calls — state
lives in `localStorage` only. Vite + React + TypeScript, plain CSS, Vitest + React
Testing Library, oxlint (not ESLint).

The owner is learning React/TypeScript, so files are deliberately small,
single-purpose and comment-heavy, and comments explain *why* rather than restating
the code. Match that density when adding code here.

**The sign-on screen is a demo, not real SSO** — no password, no identity provider,
no server. Don't describe it as authentication; the app takes the picked user's word
for it. Real sign-on would need a backend.

## Commands

| Command | Notes |
| --- | --- |
| `npm run dev` | Runs **both** processes: the Vite dev server and the API server. |
| `npm run dev:web` | Vite alone, with HMR. Prints its port — it will use 5174+ if 5173 is taken. The AI features need `dev:api` too. |
| `npm run dev:api` | The API server alone (`tsx watch server/index.ts`), port 8787. Needs a `.env`. |
| `npm test` | `vitest run` — one pass, non-watching. |
| `npm run test:watch` | Watch mode. |
| `npm run build` | `tsc -b && vite build`. The `tsc -b` step type-checks tests too (see below). |
| `npm run lint` | oxlint. |

Run a single test file or a single test by name:

```bash
npx vitest run src/domain/workflow.test.ts
npx vitest run -t "nobody approves their own form"
```

## Architecture

Three layers, each depending only on the one below: `domain` knows nothing about
React; `state` knows nothing about how things look; `ui` holds no rules.

```
src/data/     the dummy user directory
src/domain/   the rules — pure TypeScript
src/state/    reducer + context + localStorage
src/ui/       components
src/ai/       AI-facing helpers and hooks (browser side)
server/       the API server — Node, holds the Anthropic key
```

## The AI layer

**The Anthropic API key lives in `server/` and nowhere else.** Everything under
`src/` is downloaded by the browser and readable in devtools, so a key put there
— `VITE_`-prefixed or not — is a published key. The browser POSTs to `/api/*`,
Vite proxies that to `localhost:8787` (see `vite.config.ts`), and only that
process talks to Anthropic. `server/env.ts` throws at startup if the key is
missing, so a misconfigured server refuses to boot rather than failing per
request.

- **`server/client.ts` names the model once** (`MODEL`). Routes must not
  hard-code a model string — the prompt cache is per-model, so drift between
  routes silently costs money.
- **One route per file**, mounted in `server/index.ts` with `app.route()`.
- **`server/` may import from `src/data/` and `src/domain/`, never the reverse.**
  Those modules are pure, which is what lets both TypeScript projects compile
  them. `tsconfig.server.json` uses `module: "preserve"` so the server can
  import Vite's extensionless paths; it omits the `DOM` lib, so server code
  reaching for a browser API fails the build.
- **`src/ai/extractionSchema.ts` is the single source of truth for the
  extraction shape** — the server sends it to Claude as a JSON schema, the
  browser gets the type from `z.infer`. Its enums are built from
  `EXPENSE_CATEGORIES` and `DEPARTMENTS`, so the model can only return values
  the dropdowns can display.
- **A required field is a demand for an answer, and a model will always supply
  one.** Every extracted field is nullable for that reason. When `department`
  and `expenseType` were required enums, "Dinner in Hawaii with Mr. Nitin" came
  back as Finance / Client entertainment — the model had no way to say "not
  stated", so it guessed. Nullable fields plus a `question` give it somewhere to
  put uncertainty. **Never add a required field to a model-facing schema unless
  the answer is genuinely always knowable.**
- **A schema constrains shape, not meaning.** It cannot express a relationship
  between fields, so `repairExtraction()` catches an expense type belonging to
  the wrong department. Note it *clears and asks* rather than substituting a
  different value — putting a value there the person never said is the same bug
  in a new place.
- **The department is never asked about.** It defaults to the submitter's own
  and is editable on the form, so it is never genuinely unknown — asking would
  spend a round trip establishing what's already on screen. The model sets
  `department` only when someone explicitly cross-charges ("put this on the
  Legal budget"). `isComplete()` therefore ignores it.
- **`changeDepartment()` in `NewFormPage` is the only way department changes**,
  for the dropdown and the assistant alike. Categories don't overlap between
  departments, so a stale expense type used to survive the change: the
  `<select>` showed one value while another was submitted, and a Legal form was
  saved with "Software license" on it. `coerceExpenseType()` keeps them honest.
- **The system prompt is split into a frozen block and a varying one, in that
  order.** `INVARIANT_RULES` (~1,250 tokens) is byte-identical for every user,
  department and conversation and carries the `cache_control` breakpoint;
  `departmentContext()` sits after it. Phase 1c had the department interpolated
  into the *first* line, which meant one cache entry per department and a full
  invalidation whenever someone cross-charged mid-conversation. **Anything that
  varies goes after the breakpoint** — no timestamps, names or ids in the frozen
  block, and don't filter its department list back down to one.
  Claude Opus 5 won't cache a prefix under **512 tokens** and fails silently, so
  don't trim that block hard. Verify with `cache_read_input_tokens` in the
  `[extract] usage` log line: a write on turn 1 and reads after it.
- **Don't vary `effort` or `MODEL` per request** — both invalidate the cache
  (caches are model-scoped). They're pinned for that reason, not by accident.
- **The Messages API is stateless.** There is no session and no conversation id;
  the browser holds the transcript (`useFormExtraction`) and resends it in full
  every turn. Input tokens therefore grow with the conversation, which is why
  `MAX_TURNS` exists. Only the assistant's *question* is stored as its turn, not
  the whole JSON object.
- **The chat is a chat, not a form control.** `NewFormPage`'s `.chat` section
  uses bubbles, sides and a composer (Enter sends, Shift+Enter newlines). Which
  SIDE a bubble sits on is the primary speaker cue — not colour — with an
  `.sr-only` "You said / Assistant said" label carrying the same information
  aloud. Keep both when changing it.
- **The AI fills fields; a person submits.** Nothing in `src/ai/` dispatches to
  the reducer. Model output lands in ordinary inputs the user reviews — keep it
  that way as later phases add more.
- **User text never goes into a system prompt.** It goes in a `user` message.
  Concatenating it into the system prompt would give a submitter's text operator
  authority.

**Business rules live in `src/domain/workflow.ts`, as pure functions.** Put new
rules there, not in components or the reducer. Three that matter:

- **Routing is `buildStages(amount)`** — one function decides whether a form needs
  Manager only (≤ `SENIOR_APPROVAL_THRESHOLD`, currently 1000) or Manager then
  Senior Manager (above it). Never branch on the amount anywhere else.
- **Status is derived, never stored.** `getStatus()` computes Draft / Under review /
  Approved / Rejected from the form's `submittedAt` and its stages each time it's
  asked. A form has no `status` field, and adding one would create a second source
  of truth. Draft is `submittedAt === null`; stages are built at submission, so a
  draft's `stages` array is empty.
- **`canDecide()` is the single gatekeeper**: the stage must be the first pending
  one (approval is sequential), the user's role must match that stage's role, and
  the user must not be the submitter. `decide()` calls it and returns the form
  *unchanged* if it says no — so the rules hold regardless of what the UI renders.
  Enforce new permission rules there, not by hiding buttons.

**`src/state/formsReducer.ts` is the only place forms change.** It delegates to the
domain layer rather than reimplementing rules. New operations become an entry in the
`Action` union; the `default` case is what makes TypeScript flag a missing branch.

**`src/state/storage.ts` is the only file touching `localStorage`.** Both loaders
swallow errors on purpose — blocked storage (private browsing) or corrupt JSON must
degrade to an empty list, never throw. It also holds `nextSequence`, the form-number
counter: numbers are handed out from it rather than derived from the list, so
deleting a form never causes a number to be reused.

**Two people minimum per approving role.** Because nobody may approve their own
form, a form raised by a Manager needs a *different* Manager. Trimming
`src/data/users.ts` to one person in a role would strand that person's own forms.
`src/data/users.test.ts` guards this, plus unique ids and names.

## Conventions that will bite you

- `verbatimModuleSyntax` is on: type-only imports must use `import type { … }`.
- `noUnusedLocals` / `noUnusedParameters` are on — an unused variable fails the build.
- Tests live under `src/`, which `tsconfig.app.json` includes, so **type errors in
  tests break the production build**. Run `npm run build` after touching tests.
- Vitest is configured inside `vite.config.ts` (the `test` block), not a separate
  file. Globals need both `globals: true` there and `"vitest/globals"` in
  `tsconfig.app.json`'s `types` array.
- **oxlint's `only-export-components` fails a file that exports a component
  alongside a plain function.** This has bitten twice; `src/ui/format.ts` exists
  solely because of it. Put shared helpers in their own module.
- Class names are built from data and must have matching CSS in `styles.css` or the
  element renders unstyled — `status-${status}`, `card-${status}`, `tile-${status}`,
  `role-${role}`, `avatar-${role}`, `stage-${decision}`. **Spaces are replaced with
  dashes** (`"Under review"` → `status-Under-review`, `"Senior Manager"` →
  `role-Senior-Manager`), so a new multi-word status or role needs that same
  `.replace(' ', '-')` and its own rules.
- Tests query by accessible label and role. Status words appear both as stat-tile
  labels and inside badges, so assertions about a form's status must scope to the
  badge: `getByText('Approved', { selector: '.status-label' })`. Unscoped queries
  fail with "Found multiple elements".
- Test helpers pick an account by matching its name, so **no user's name may be a
  substring of another's** — enforced by a test in `src/data/users.test.ts`.

## Colour and accessibility

`src/styles.css` groups variables by the **job** they do (neutrals, brand, status,
identity, sequential), all defined once in `:root`. Use those variables rather than
literal hex values.

**Status is never carried by colour alone.** Approved-green and rejected-red measure
~4 ΔE apart under a deuteranopia simulation — indistinguishable to red/green
colourblind viewers. Every status therefore renders as **icon + label + colour**
(`StatusIcon.tsx`), and the timeline markers in `StageList.tsx` carry glyphs rather
than being plain dots. A new status needs a distinct *shape*, not just a new colour.

The status palette (good/warning/critical) is reserved for state and must not be
reused to tell entities apart; role colours are deliberately clear of those hues.
The progress meter's empty track is a lighter step of the *same* blue as the fill,
not grey. Big standalone numbers use normal figures; `tabular-nums` is only for the
decisions table, where amounts align vertically.

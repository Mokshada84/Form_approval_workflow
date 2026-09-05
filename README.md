# Form Approval Workflow

A single-page app for submitting expense forms and routing them for approval.
Anyone can raise a form; how many signatures it needs depends on the amount.

Everything is saved in your browser's `localStorage`, so it survives a refresh.
There is no server and no database — nothing leaves your machine.

Built with **Vite + React + TypeScript**, tested with **Vitest + React Testing
Library**, styled with **plain CSS** (no UI framework).

> **The sign-on screen is a demo, not real single sign-on.** There is no
> password, no identity provider and no server: you pick an account from the
> dummy directory and the app takes your word for it. None of this would be
> safe as an actual login — real SSO needs a backend.

---

## The rules

**Three roles**

| Role | Can do |
| --- | --- |
| Employee | Submit forms, and track their own |
| Manager | Submit forms, **and** approve or reject others' |
| Senior Manager | Submit forms, **and** approve or reject others' |

**Routing by amount**

| Amount | Needs |
| --- | --- |
| Up to and including $1,000 | Manager only |
| Above $1,000 | Manager, **then** Senior Manager |

**Two rules the code enforces, not just the buttons**

- **Approval is sequential.** A Senior Manager cannot sign off before the
  Manager has. Until then the form isn't in their queue at all.
- **Nobody approves their own form.** A Manager who raises a $400 form needs the
  *other* Manager to approve it. This is why the dummy directory has two people
  in each approving role — with only one Manager, that form could never move.

**Statuses**

| Status | Meaning |
| --- | --- |
| Draft | Saved but not submitted. No approvers can see it. |
| Under review | Submitted, waiting on someone. |
| Approved | Every required approver approved. |
| Rejected | Someone rejected it. The chain stops there. |

---

## About the colours

Colours are grouped in `src/styles.css` by the **job** they do, not by how they
look — neutrals, brand, status, identity, and the progress bar's scale. Each is
defined once at the top of the file, so the whole app can be retinted from one
block.

**Status is never carried by colour alone.** Approved-green and rejected-red
measure only about 4 units apart under a red/green colour-blindness simulation —
effectively the same colour to roughly 1 in 12 men. So every status appears as
**icon + label + colour** at once: a tick for approved, a cross for rejected, a
clock for under review, a dashed ring for draft. The shapes are what carry the
meaning when the colour can't. That's why `StatusIcon.tsx` exists, and why the
stage markers in the approval trail hold glyphs rather than being plain dots.

Two smaller rules the stylesheet follows, both commented where they apply:

- The progress bar's empty track is a **lighter step of the same blue** as the
  fill, not a grey, so the bar reads as one measure instead of two blocks.
- Big standalone numbers (the stat tiles) use normal figures; `tabular-nums` is
  reserved for the decisions table, where amounts have to line up vertically.

---

## Before you start

You need **Node.js** installed. Check in Terminal:

```bash
node --version
```

A version number (v20 or higher) means you're set. "command not found" means
install it from [nodejs.org](https://nodejs.org).

---

## Running the app

```bash
cd ~/Documents/Form_approval_workflow
npm install     # once, and again whenever package.json changes
npm run dev
```

Terminal prints a URL — usually `http://localhost:5173/`. Open it in your
browser (hold **Cmd** and click the link on a Mac). The sign-on page appears
first.

Press **Ctrl + C** in Terminal to stop the server.

### Trying the whole flow

1. Sign in as **Dan Okafor** (Employee) and submit a form for **$5,000**.
2. Check **My forms** — it reads *Under review*, needing Manager then Senior Manager.
3. Sign out, sign in as **Priya Sharma** (Manager). It's in **Approvals**. Approve it.
4. Sign out, sign in as **Mei Tan** (Senior Manager). Only now does it reach her.
5. Approve it, then sign back in as Dan — his form reads *Approved*.

Try a **$400** form too: it needs the Manager only, and is Approved as soon as
Priya approves it.

---

## The test accounts

Fifteen accounts — **five in each role** — defined in `src/data/users.ts`. Add a
row and it appears on the sign-on page automatically, grouped under its role;
nothing else needs changing.

| Employee | Manager | Senior Manager |
| --- | --- | --- |
| Dan Okafor | Priya Sharma | Mei Tan |
| Sam Ellis | Tom Becker | Alex Reid |
| Aisha Khan | Grace Mwangi | Omar Haddad |
| Marco Silva | Ivan Petrov | Hannah Kruger |
| Yuki Tanaka | Laura Estevez | Rajiv Menon |

Everyone's email is `firstname.lastname@example.com`.

Having **more than one person per approving role is not just realism** — it's
required. Nobody may approve their own form, so a form raised by a Manager needs
a *different* Manager to sign it off. With a single Manager in the directory,
that form could never move. `src/data/users.test.ts` guards this, along with
ids and names being unique.

--- | --- |
| Dan Okafor | Employee |
| Sam Ellis | Employee |
| Priya Sharma | Manager |
| Tom Becker | Manager |
| Mei Tan | Senior Manager |
| Alex Reid | Senior Manager |

---

## All the commands

| Command | What it does |
| --- | --- |
| `npm install` | Downloads the libraries into `node_modules/`. |
| `npm run dev` | Development server with live reloading. The one you'll use most. |
| `npm test` | Runs every test once and reports pass/fail. |
| `npm run test:watch` | Re-runs tests as you edit. |
| `npm run build` | Type-checks and writes an optimised copy to `dist/`. |
| `npm run preview` | Serves the built `dist/` folder. |
| `npm run lint` | Checks for common mistakes. |

Run one test file, or one test by name:

```bash
npx vitest run src/domain/workflow.test.ts
npx vitest run -t "nobody approves their own form"
```

---

## How the code is organised

Three layers, and the point of the split is that each only depends on the layer
below it. `domain` knows nothing about React; `state` knows nothing about how
things look.

```
src/
├── data/       the dummy user directory
├── domain/     the rules — pure TypeScript, no React
├── state/      where the data lives, and how it's saved
└── ui/         what you see on screen
```

### `data/`

| File | Purpose |
| --- | --- |
| `users.ts` | The test accounts and their roles. The sign-on page lists these, and the tests sign in as them. |

### `domain/` — the rules

| File | Purpose |
| --- | --- |
| `types.ts` | The vocabulary: `Role`, `User`, `FormRequest`, `ApprovalStage`, `FormStatus`. |
| `workflow.ts` | Every rule: form numbering, routing by amount, who may decide, recording a decision, and each person's queue and history. |
| `workflow.test.ts` | Tests for those rules. Plain function calls — no React, no browser. |

**Pure functions** always give the same answer for the same input and never
modify what they're given, which makes them the easiest code to test and the
hardest to get wrong. Three things worth knowing:

- **Routing lives in `buildStages`** — one function decides whether a form needs
  one signature or two. Change the threshold in one place.
- **Status is worked out, never stored.** `getStatus` derives Draft / Under
  review / Approved / Rejected from the form each time. Storing it too would
  create a second source of truth that could disagree with the first.
- **`canDecide` is the gatekeeper.** Right stage, right role, not your own form.
  `decide` calls it and returns the form unchanged if it says no — so the rule
  holds even if the buttons were bypassed.

### `state/` — the data

| File | Purpose |
| --- | --- |
| `formsReducer.ts` | The reducer: `(current state, action) → next state`. Every possible change is one entry in the `Action` type, and this is the only place state changes. |
| `storage.ts` | The only file that touches `localStorage`. Fails quietly, so blocked or corrupt storage gives an empty list rather than a crash. Also holds the form-number counter, so numbers are never reused. |
| `appContext.ts` | The React Context object. |
| `AppProvider.tsx` | Holds the forms and the signed-in user, and saves both when they change. |
| `useApp.ts` | The hook components call to reach it all. |

**Why a reducer instead of `useState`?** When what's allowed depends on what has
already happened — which is what a workflow is — collecting every change into
one function is far easier to follow than update logic scattered across
components. It's a plain function, so its tests need no React.

**Why Context?** So an Approve button deep inside a list can act without every
component above it passing the function down (known as prop drilling).

### `ui/` — the screen

| File | Purpose |
| --- | --- |
| `App.tsx` | Decides sign-on page vs. app, and holds which tab is showing. |
| `SignInPage.tsx` | The demo sign-on screen listing the dummy accounts. |
| `NewFormPage.tsx` | Raising a form, with a live hint about who it will go to. |
| `MyFormsPage.tsx` | Your own forms and their status; submit or delete drafts. |
| `ApprovalsPage.tsx` | Managers and Senior Managers only: your queue, and every decision you've made. |
| `FormCard.tsx` | One form in a list. Buttons are passed in by the page using it. |
| `StageList.tsx` | The approval trail, as a small vertical timeline. |
| `StatusBadge.tsx` | The coloured status label. |
| `format.ts` | Shared date and currency formatting. |
| `App.test.tsx` | End-to-end tests: sign in, submit, sign in as someone else, approve. |

### Everything else

| File | Purpose |
| --- | --- |
| `src/styles.css` | All the styling. Colours, shadows and radii are defined once as variables at the top. |
| `src/main.tsx` | The entry point. It wraps `App` in `AppProvider` — that's what makes `useApp()` work anywhere inside. |
| `src/setupTests.ts` | Runs before tests; adds checks like `toBeInTheDocument()`. |
| `vite.config.ts` | Settings for Vite *and* Vitest (the `test` block). |
| `.gitignore` | Skips `node_modules`, `dist`, `.env` and `.DS_Store`. |

---

## Things to try next

- **Change the threshold**: edit `SENIOR_APPROVAL_THRESHOLD` in
  `src/domain/workflow.ts`. Routing, the form hint and the sign-on blurb all
  follow.
- **Add a third approval stage** (say Finance above $10,000): add the role to
  `ApproverRole` in `types.ts` and a line to `buildStages`. TypeScript will
  point at everything else that needs updating.
- **Let an approver leave a reason when rejecting**: add a `note` to
  `ApprovalStage`, pass it through `decide`, and show it in `StageList`.

If the data ever gets into a strange state, clear it from the browser console
with `localStorage.clear()` and refresh.

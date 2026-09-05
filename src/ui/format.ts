// ui/format.ts
//
// Small display helpers, shared by several components.
//
// They live in their own file rather than beside a component because Fast
// Refresh — the thing that updates the browser as you save — only works when a
// file exports components alone. Mixing a plain function in breaks it.

/** Format an amount as US dollars, e.g. 1250 -> "$1,250.00". */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** Format an ISO timestamp as a short date, e.g. "6 Sep 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

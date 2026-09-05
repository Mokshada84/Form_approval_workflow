// ui/StatusIcon.tsx
//
// A small shape for each status, shown next to its label.
//
// This is NOT decoration. Approved-green and Rejected-red are very close to
// identical for anyone with red/green colour blindness (the most common kind —
// roughly 1 in 12 men). Measured, the two sit only a few units apart under a
// deuteranopia simulation, which is far below a readable difference.
//
// So status is always carried by three channels at once: this shape, the text
// label beside it, and the colour. Colour is the one that's allowed to fail.

import type { FormStatus } from '../domain/types'

/**
 * `aria-hidden` hides these from screen readers on purpose: the text label
 * next to the icon already says "Approved", and announcing it twice is noise.
 */
export function StatusIcon({ status }: { status: FormStatus }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor', // inherits the colour of the surrounding text
    strokeWidth: 2.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (status) {
    case 'Approved':
      // A tick.
      return (
        <svg {...common}>
          <path d="M3 8.5l3.5 3.5L13 4.5" />
        </svg>
      )

    case 'Rejected':
      // A cross — a completely different outline from the tick, which is the
      // point: the shapes stay distinct when the colours don't.
      return (
        <svg {...common}>
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      )

    case 'Under review':
      // A clock face, for "waiting on someone".
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 5v3.2l2 1.4" />
        </svg>
      )

    case 'Draft':
    default:
      // A dashed outline, for "not sent anywhere yet".
      return (
        <svg {...common} strokeDasharray="2.5 2.5">
          <circle cx="8" cy="8" r="5.5" />
        </svg>
      )
  }
}

// ui/StatTiles.tsx
//
// The row of summary counts at the top of a list — how many forms are in each
// state, at a glance.
//
// A "stat tile" is the right form here precisely because there's no trend to
// plot: four numbers, each standing alone. A chart would be decoration.

import { StatusIcon } from './StatusIcon'
import type { FormStatus } from '../domain/types'

export type Tile = {
  /** Sentence case, no trailing colon. */
  label: string
  value: number
  /** Which status the tile is counting — picks the colour and the icon. */
  status: FormStatus
}

export function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="stat-tiles">
      {tiles.map((tile) => (
        // The tile is dimmed at zero, so the states that actually have
        // something in them are what your eye lands on first.
        <div
          key={tile.label}
          className={`stat-tile tile-${tile.status.replace(' ', '-')}${
            tile.value === 0 ? ' stat-tile-empty' : ''
          }`}
        >
          <span className="stat-tile-icon">
            <StatusIcon status={tile.status} />
          </span>
          {/* Note there is no `tabular-nums` on this value. Tabular figures
              give every digit the width of a zero, which makes a big standalone
              number look loose — they're for columns that must line up, like
              the amounts in the decisions table. */}
          <span className="stat-tile-value">{tile.value}</span>
          <span className="stat-tile-label">{tile.label}</span>
        </div>
      ))}
    </div>
  )
}

import type { CSSProperties } from 'react'
import { PAPER, type PageLine } from '../shared/paginate'
import type { Paper } from '../shared/types'

interface Props {
  lines: PageLine[]
  paper: Paper
  /** On a blank page, a blinking caret where the first scene heading goes. */
  caret?: boolean
}

/**
 * One script page in miniature, laid out like the PDF: 10 characters and 6 lines per inch, 1 inch top margin,
 * each line at its printed column. Sizes come from the sheet's width, so it scales with the card.
 */
export function ScriptPage({ lines, paper, caret = false }: Props): JSX.Element {
  const { width, height } = PAPER[paper]
  const rows: PageLine[][] = []
  for (const l of lines) {
    if (l.sameRow && rows.length > 0) rows[rows.length - 1].push(l)
    else rows.push([l])
  }
  return (
    <span className="mini-page" style={{ '--inches': width, aspectRatio: `${width} / ${height}` } as CSSProperties} aria-hidden="true">
      <span className="mini-page-body">
        {rows.map((r, i) => (
          <span className="mini-page-row" key={i}>
            {r.map((l, j) => (
              <span
                key={j}
                className="mini-page-line"
                style={{ left: `calc(${l.left} * var(--ch))`, width: `calc(${l.width} * var(--ch))`, textAlign: l.align }}
              >
                {l.text}
              </span>
            ))}
          </span>
        ))}
        {caret && rows.length === 0 && (
          <span className="mini-page-row">
            <span className="mini-page-line" style={{ left: 'calc(15 * var(--ch))' }}>
              <span className="mini-page-caret" />
            </span>
          </span>
        )}
      </span>
    </span>
  )
}

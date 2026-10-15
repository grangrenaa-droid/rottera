import type { Block, Kind, Paper } from './types'
import { UPPER } from './elements'

/** Sheet sizes in inches and how many 12 pt lines fit between 1 in margins. */
export const PAPER: Record<Paper, { width: number; height: number; lines: number }> = {
  letter: { width: 8.5, height: 11, lines: 55 },
  a4: { width: 8.27, height: 11.69, lines: 58 }
}

/** Lines per page on letter paper (kept for callers that do not choose a paper). */
export const PAGE_LINES = PAPER.letter.lines

interface Spec {
  /** Left edge, in characters (10 per inch) from the page edge. */
  left: number
  width: number
  /** Blank lines before the block. */
  before: number
  align?: 'right'
}

export const SPEC: Record<Kind, Spec> = {
  scene_heading: { left: 15, width: 60, before: 2 },
  action: { left: 15, width: 60, before: 1 },
  character: { left: 37, width: 38, before: 1 },
  parenthetical: { left: 31, width: 25, before: 0 },
  dialogue: { left: 25, width: 35, before: 0 },
  transition: { left: 55, width: 20, before: 1, align: 'right' },
  shot: { left: 15, width: 60, before: 1 }
}

/** The two columns of a dual dialogue. */
const COLS = [
  { x: 15, w: 29 },
  { x: 46, w: 29 }
]

export interface PageLine {
  text: string
  kind: Kind
  left: number
  width: number
  align?: 'right'
  /** Index of the source block, or -1 for generated lines (MORE, CONT'D, blanks). */
  block: number
  /** Printed on the same row as the previous line (right column of a dual dialogue). */
  sameRow?: boolean
}

export interface Pagination {
  pages: PageLine[][]
  /** Page index (0-based) where each block starts. */
  blockPage: number[]
}

export function wrap(text: string, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      out.push('')
      continue
    }
    let line = ''
    for (const w of words) {
      if (line === '') line = w
      else if (line.length + 1 + w.length <= width) line += ' ' + w
      else {
        out.push(line)
        line = w
      }
      while (line.length > width) {
        out.push(line.slice(0, width))
        line = line.slice(width)
      }
    }
    out.push(line)
  }
  return out
}

const KEEP_WITH_NEXT: ReadonlySet<Kind> = new Set<Kind>(['scene_heading', 'character', 'parenthetical'])

function textFor(b: Block): string {
  return UPPER.has(b.kind) ? b.text.toUpperCase() : b.text
}

function linesOf(b: Block): string[] {
  const l = wrap(textFor(b), SPEC[b.kind].width)
  return l.length ? l : ['']
}

/** End (exclusive) of the speech that starts with the character block at `i`. */
export function groupEnd(blocks: Block[], i: number): number {
  let j = i + 1
  while (j < blocks.length && (blocks[j].kind === 'dialogue' || blocks[j].kind === 'parenthetical')) j++
  return j
}

function columnLines(blocks: Block[], from: number, to: number, col: { x: number; w: number }): PageLine[] {
  const out: PageLine[] = []
  for (let k = from; k < to; k++) {
    const b = blocks[k]
    let left = col.x
    let width = col.w
    if (b.kind === 'character') {
      left = col.x + 7
      width = 15
    } else if (b.kind === 'parenthetical') {
      left = col.x + 4
      width = col.w - 8
    }
    const lines = wrap(textFor(b), width)
    for (const text of lines.length ? lines : ['']) out.push({ text, kind: b.kind, left, width, block: k })
  }
  return out
}

export function paginate(blocks: Block[], paper: Paper = 'letter'): Pagination {
  const PAGE_LINES = PAPER[paper].lines
  const pages: PageLine[][] = [[]]
  const blockPage: number[] = []
  let used = 0
  let lastCharacter = ''

  const push = (text: string, kind: Kind, block: number): void => {
    const s = SPEC[kind]
    pages[pages.length - 1].push({ text, kind, left: s.left, width: s.width, align: s.align, block })
    used += 1
  }
  const blank = (n: number): void => {
    for (let k = 0; k < n; k++) {
      pages[pages.length - 1].push({ text: '', kind: 'action', left: 15, width: 60, block: -1 })
      used += 1
    }
  }
  const newPage = (): void => {
    pages.push([])
    used = 0
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]

    // Dual dialogue: a speech followed by a speech marked `dual` is laid out side by side.
    if (b.kind === 'character' && !b.dual) {
      const aEnd = groupEnd(blocks, i)
      const nb = blocks[aEnd]
      if (nb && nb.kind === 'character' && nb.dual) {
        const bEnd = groupEnd(blocks, aEnd)
        const left = columnLines(blocks, i, aEnd, COLS[0])
        const right = columnLines(blocks, aEnd, bEnd, COLS[1])
        const rows = Math.max(left.length, right.length)
        let from = 0
        let firstChunk = true
        let guard = 0
        while (from < rows && guard++ < 1000) {
          const before = used === 0 ? 0 : firstChunk ? SPEC.character.before : 0
          const room = PAGE_LINES - used - before
          const remaining = rows - from
          if (remaining > room && used > 0) {
            newPage()
            continue
          }
          const take = Math.min(remaining, Math.max(room, 1))
          if (firstChunk) for (let k = i; k < bEnd; k++) blockPage[k] = pages.length - 1
          blank(before)
          for (let r = from; r < from + take; r++) {
            const l = left[r]
            const rt = right[r]
            if (l) pages[pages.length - 1].push(l)
            if (rt) pages[pages.length - 1].push({ ...rt, sameRow: Boolean(l) })
            used += 1
          }
          from += take
          firstChunk = false
          if (from < rows) newPage()
        }
        lastCharacter = blocks[aEnd].text.trim().toUpperCase()
        i = bEnd - 1
        continue
      }
    }

    const spec = SPEC[b.kind]
    let lines = linesOf(b)
    let first = true
    if (b.kind === 'character') lastCharacter = b.text.trim().toUpperCase()

    let guard = 0
    while (lines.length > 0 && guard++ < 1000) {
      const before = used === 0 ? 0 : first ? spec.before : 0
      const room = PAGE_LINES - used - before
      let needed = lines.length
      const next = blocks[i + 1]
      if (first && KEEP_WITH_NEXT.has(b.kind) && next) {
        needed += Math.min(2, linesOf(next).length) + (used === 0 ? 0 : SPEC[next.kind].before)
      }

      if (needed <= room) {
        if (first) blockPage[i] = pages.length - 1
        blank(before)
        for (const l of lines) push(l, b.kind, i)
        lines = []
        break
      }

      const splittable = b.kind === 'action' || b.kind === 'dialogue'
      const take = room - (b.kind === 'dialogue' ? 1 : 0)
      if (splittable && take >= 2 && lines.length - take >= 2) {
        if (first) blockPage[i] = pages.length - 1
        blank(before)
        for (const l of lines.slice(0, take)) push(l, b.kind, i)
        if (b.kind === 'dialogue') push('(MORE)', 'character', -1)
        lines = lines.slice(take)
        newPage()
        if (b.kind === 'dialogue' && lastCharacter) {
          const name = /\(CONT'D\)$/.test(lastCharacter) ? lastCharacter : `${lastCharacter} (CONT'D)`
          push(name, 'character', -1)
        }
        first = false
        continue
      }

      if (used > 0) {
        newPage()
        continue
      }

      // Block taller than a page: split wherever it fits.
      if (first) blockPage[i] = pages.length - 1
      for (const l of lines.slice(0, PAGE_LINES)) push(l, b.kind, i)
      lines = lines.slice(PAGE_LINES)
      newPage()
      first = false
    }
  }
  if (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop()
  return { pages, blockPage }
}

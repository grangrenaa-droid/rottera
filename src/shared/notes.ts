import type { Block, Note, NoteColor } from './types'
import { sceneRanges } from './scenes'

/** Longest note; a note is a reminder, not a second script. */
export const NOTE_MAX = 4000

export const NOTE_COLORS: { id: NoteColor; label: string }[] = [
  { id: 'yellow', label: 'Nota' },
  { id: 'blue', label: 'Pergunta' },
  { id: 'pink', label: 'Reescrever' },
  { id: 'green', label: 'Resolvido' }
]

const COLOR_IDS = NOTE_COLORS.map((c) => c.id) as string[]

/** Reads a note from a file or from the AI bridge; anything malformed is dropped. */
export function cleanNote(raw: unknown): Note | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id || r.id.length > 64) return null
  if (typeof r.anchor !== 'string' || !r.anchor || r.anchor.length > 64) return null
  return {
    id: r.id,
    text: typeof r.text === 'string' ? r.text.slice(0, NOTE_MAX) : '',
    color: COLOR_IDS.includes(r.color as string) ? (r.color as NoteColor) : 'yellow',
    anchor: r.anchor
  }
}

export interface PinnedNote {
  note: Note
  /** Index of the line it is pinned to. */
  block: number
}

export interface NoteGroup {
  /** Position of the scene among the scene headings, or -1 for lines before the first scene. */
  scene: number
  /** Block index of the scene heading, or -1. */
  heading: number
  items: PinnedNote[]
}

/**
 * The notes in script order, grouped by scene. A note whose line is gone is loose.
 * When a line was copied and its anchor appears twice, the first copy keeps the note.
 */
export function groupNotes(blocks: Block[], notes: Note[]): { groups: NoteGroup[]; loose: Note[] } {
  if (notes.length === 0) return { groups: [], loose: [] }
  const where = new Map<string, number>()
  blocks.forEach((b, i) => {
    if (b.nid && !where.has(b.nid)) where.set(b.nid, i)
  })
  const pinned: PinnedNote[] = []
  const loose: Note[] = []
  for (const note of notes) {
    const block = where.get(note.anchor)
    if (block === undefined) loose.push(note)
    else pinned.push({ note, block })
  }
  // stable: notes on the same line keep the order they were made in
  pinned.sort((a, b) => a.block - b.block)
  const ranges = sceneRanges(blocks)
  const groups: NoteGroup[] = []
  let s = -1
  for (const p of pinned) {
    while (s + 1 < ranges.length && ranges[s + 1].start <= p.block) s++
    const last = groups[groups.length - 1]
    if (last && last.scene === s) last.items.push(p)
    else groups.push({ scene: s, heading: s >= 0 ? ranges[s].start : -1, items: [p] })
  }
  return { groups, loose }
}

/** Colour of the first note on each pinned line, for the marks in the text. */
export function noteMarks(blocks: Block[], notes: Note[]): Record<string, NoteColor> {
  const out: Record<string, NoteColor> = {}
  if (notes.length === 0) return out
  const anchors = new Set(blocks.map((b) => b.nid).filter(Boolean))
  for (const n of notes) if (anchors.has(n.anchor) && !(n.anchor in out)) out[n.anchor] = n.color
  return out
}

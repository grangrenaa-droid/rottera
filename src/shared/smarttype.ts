import type { Block, Extras } from './types'

export interface Lists {
  characters: string[]
  locations: string[]
  times: string[]
}

const DEFAULT_TIMES = ['DIA', 'NOITE', 'MANHÃ', 'TARDE', 'ENTARDECER', 'AMANHECER', 'CONTÍNUO', 'MAIS TARDE']
const INTROS = ['INT. ', 'EXT. ', 'INT./EXT. ']

export function parseHeading(text: string): { intro: string; location: string; time: string; hasSep: boolean } {
  const m = /^(INT\/EXT|INT\.\/EXT|INT|EXT|EST|I\/E)\.?\s*(.*)$/i.exec(text.trim())
  if (!m) return { intro: '', location: '', time: '', hasSep: false }
  const rest = m[2]
  const idx = rest.indexOf(' - ')
  if (idx === -1) return { intro: m[1].toUpperCase(), location: rest.trim(), time: '', hasSep: false }
  return {
    intro: m[1].toUpperCase(),
    location: rest.slice(0, idx).trim(),
    time: rest.slice(idx + 3).trim(),
    hasSep: true
  }
}

export function collectLists(blocks: Block[], extras?: Extras): Lists {
  const chars = new Set<string>()
  const locs = new Set<string>()
  const times = new Set<string>(DEFAULT_TIMES)
  for (const b of blocks) {
    const t = b.text.trim()
    if (!t) continue
    if (b.kind === 'character') {
      chars.add(t.toUpperCase().replace(/\s*\(.*\)\s*$/, ''))
    } else if (b.kind === 'scene_heading') {
      const h = parseHeading(t)
      if (h.location) locs.add(h.location.toUpperCase())
      if (h.time) times.add(h.time.toUpperCase())
    }
  }
  for (const c of extras?.characters ?? []) if (c.trim()) chars.add(c.trim().toUpperCase())
  for (const l of extras?.locations ?? []) if (l.trim()) locs.add(l.trim().toUpperCase())
  for (const t of extras?.times ?? []) if (t.trim()) times.add(t.trim().toUpperCase())
  const sort = (s: Set<string>): string[] => [...s].sort((a, b) => a.localeCompare(b))
  return { characters: sort(chars), locations: sort(locs), times: sort(times) }
}

export interface Suggestion {
  /** Character offset in the block text where the replaced part begins. */
  from: number
  items: string[]
}

const starts = (item: string, typed: string): boolean => item.startsWith(typed) && item !== typed

export function suggest(kind: Block['kind'], text: string, lists: Lists): Suggestion | null {
  if (kind === 'character') {
    const typed = text.toUpperCase()
    if (typed.trim() === '') return null
    const items = lists.characters.filter((c) => starts(c, typed))
    return items.length ? { from: 0, items } : null
  }
  if (kind === 'scene_heading') {
    const up = text.toUpperCase()
    if (/^[A-Z/.]{1,9}$/.test(up)) {
      const items = INTROS.filter((i) => i.startsWith(up) && i.trim() !== up)
      return items.length ? { from: 0, items } : null
    }
    const h = parseHeading(text)
    if (!h.intro) return null
    if (h.hasSep) {
      const idx = text.indexOf(' - ') + 3
      const typed = text.slice(idx).toUpperCase()
      const items = lists.times.filter((t) => starts(t, typed))
      return items.length ? { from: idx, items } : null
    }
    const idx = text.search(/\s/) + 1
    if (idx <= 0) return null
    const typed = text.slice(idx).toUpperCase()
    const items = lists.locations.filter((l) => starts(l, typed))
    return items.length ? { from: idx, items } : null
  }
  return null
}

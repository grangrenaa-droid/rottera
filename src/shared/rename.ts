import type { Block } from './types'
import { parseHeading } from './smarttype'

function norm(s: string): string {
  return s.trim().toUpperCase()
}

/** Renames a character in every cue, keeping extensions such as (V.O.). Returns the new blocks and how many changed. */
export function renameCharacter(blocks: Block[], from: string, to: string): { blocks: Block[]; count: number } {
  const f = norm(from)
  const t = to.trim()
  if (!f || !t) return { blocks, count: 0 }
  let count = 0
  const out = blocks.map((b) => {
    if (b.kind !== 'character') return b
    const m = /^(.*?)(\s*\(.*\))?\s*$/.exec(b.text.trim())
    if (!m || norm(m[1]) !== f) return b
    count += 1
    return { ...b, text: t + (m[2] ?? '') }
  })
  return { blocks: out, count }
}

/** Renames a location in every scene heading that uses it. */
export function renameLocation(blocks: Block[], from: string, to: string): { blocks: Block[]; count: number } {
  const f = norm(from)
  const t = to.trim()
  if (!f || !t) return { blocks, count: 0 }
  let count = 0
  const out = blocks.map((b) => {
    if (b.kind !== 'scene_heading') return b
    const h = parseHeading(b.text)
    if (!h.intro || norm(h.location) !== f) return b
    count += 1
    const intro = /^(\S+?)(\.?)\s/.exec(b.text.trim() + ' ')
    const prefix = intro ? `${intro[1]}${intro[2] || '.'}` : `${h.intro}.`
    return { ...b, text: `${prefix} ${t}${h.hasSep ? ` - ${h.time}` : ''}` }
  })
  return { blocks: out, count }
}

export function usageCounts(blocks: Block[]): { characters: Map<string, number>; locations: Map<string, number> } {
  const characters = new Map<string, number>()
  const locations = new Map<string, number>()
  for (const b of blocks) {
    if (b.kind === 'character' && b.text.trim()) {
      const n = norm(b.text.replace(/\s*\(.*\)\s*$/, ''))
      characters.set(n, (characters.get(n) ?? 0) + 1)
    } else if (b.kind === 'scene_heading') {
      const h = parseHeading(b.text)
      if (h.location) {
        const n = norm(h.location)
        locations.set(n, (locations.get(n) ?? 0) + 1)
      }
    }
  }
  return { characters, locations }
}

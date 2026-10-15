import type { Block } from './types'

export interface SceneRange {
  /** Index of the scene heading. */
  start: number
  /** Index after the last block of the scene. */
  end: number
}

export function sceneRanges(blocks: Block[]): SceneRange[] {
  const heads: number[] = []
  blocks.forEach((b, i) => {
    if (b.kind === 'scene_heading') heads.push(i)
  })
  return heads.map((start, n) => ({ start, end: heads[n + 1] ?? blocks.length }))
}

/** Moves scene `n` (0-based, in scene order) to position `to`. Blocks before the first heading stay put. */
export function moveSceneTo(blocks: Block[], n: number, to: number): Block[] | null {
  const ranges = sceneRanges(blocks)
  if (n < 0 || n >= ranges.length || to < 0 || to >= ranges.length || n === to) return null
  const head = blocks.slice(0, ranges[0].start)
  const chunks = ranges.map((r) => blocks.slice(r.start, r.end))
  const [moved] = chunks.splice(n, 1)
  chunks.splice(to, 0, moved)
  return [...head, ...chunks.flat()]
}

export function moveScene(blocks: Block[], n: number, dir: 1 | -1): Block[] | null {
  return moveSceneTo(blocks, n, n + dir)
}

function bumpLetters(prev: string): string {
  const m = /^(\d+|A)(.*)$/.exec(prev)
  if (!m) return `${prev}A`
  const letters = /([A-Z]+)$/.exec(m[2])
  if (!letters) return `${prev}A`
  const next = letters[1].split('')
  let i = next.length - 1
  while (i >= 0) {
    if (next[i] === 'Z') {
      next[i] = 'A'
      i -= 1
    } else {
      next[i] = String.fromCharCode(next[i].charCodeAt(0) + 1)
      break
    }
  }
  if (i < 0) next.unshift('A')
  return prev.slice(0, prev.length - letters[1].length) + next.join('')
}

/**
 * Scene number for every block (null for blocks that are not scene headings).
 * Unlocked: 1, 2, 3... Locked: stored `sn` is kept; headings added later get 3A, 3B...
 */
export function sceneNumbers(blocks: Block[], locked: boolean): (string | null)[] {
  const out: (string | null)[] = []
  let counter = 0
  let prev: string | null = null
  for (const b of blocks) {
    if (b.kind !== 'scene_heading') {
      out.push(null)
      continue
    }
    let n: string
    if (!locked) {
      counter += 1
      n = String(counter)
    } else if (b.sn) {
      n = b.sn
    } else {
      n = prev === null ? 'A1' : bumpLetters(prev)
    }
    out.push(n)
    prev = n
  }
  return out
}

export function lockScenes(blocks: Block[]): Block[] {
  const nums = sceneNumbers(blocks, false)
  return blocks.map((b, i) => (b.kind === 'scene_heading' ? { ...b, sn: nums[i] as string } : b))
}

export function unlockScenes(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.sn === undefined) return b
    const { sn: _sn, ...rest } = b
    return rest
  })
}

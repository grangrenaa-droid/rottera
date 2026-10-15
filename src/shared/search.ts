import type { Block } from './types'

export interface Hit {
  block: number
  from: number
  to: number
}

export function findInBlocks(blocks: Block[], query: string, caseSensitive: boolean): Hit[] {
  if (query === '') return []
  const q = caseSensitive ? query : query.toLowerCase()
  const hits: Hit[] = []
  blocks.forEach((b, block) => {
    const t = caseSensitive ? b.text : b.text.toLowerCase()
    let from = 0
    for (;;) {
      const i = t.indexOf(q, from)
      if (i === -1) break
      hits.push({ block, from: i, to: i + q.length })
      from = i + q.length
    }
  })
  return hits
}

export function replaceAllInBlocks(
  blocks: Block[],
  query: string,
  replacement: string,
  caseSensitive: boolean
): { blocks: Block[]; count: number } {
  const hits = findInBlocks(blocks, query, caseSensitive)
  if (hits.length === 0) return { blocks, count: 0 }
  const byBlock = new Map<number, Hit[]>()
  for (const h of hits) byBlock.set(h.block, [...(byBlock.get(h.block) ?? []), h])
  const out = blocks.map((b, i) => {
    const hs = byBlock.get(i)
    if (!hs) return b
    let text = ''
    let last = 0
    for (const h of hs) {
      text += b.text.slice(last, h.from) + replacement
      last = h.to
    }
    return { ...b, text: text + b.text.slice(last) }
  })
  return { blocks: out, count: hits.length }
}

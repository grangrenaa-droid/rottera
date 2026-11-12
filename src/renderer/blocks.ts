import type { Editor, JSONContent } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Block, Kind } from '../shared/types'

export function blockToJson(b: Block): JSONContent {
  return {
    type: 'block',
    attrs: { kind: b.kind, dual: b.dual === true, rev: b.rev ?? null, sn: b.sn ?? null, bid: b.kind === 'scene_heading' ? b.bid ?? null : null, nid: b.nid ?? null, syn: b.kind === 'scene_heading' ? b.syn ?? null : null },
    content: b.text ? [{ type: 'text', text: b.text }] : undefined
  }
}

export function blocksToDoc(blocks: Block[]): JSONContent {
  return { type: 'doc', content: blocks.map(blockToJson) }
}

export function nodeToBlock(node: PMNode): Block {
  const b: Block = { kind: node.attrs.kind as Kind, text: node.textContent }
  if (node.attrs.dual === true) b.dual = true
  if (typeof node.attrs.rev === 'string') b.rev = node.attrs.rev
  if (typeof node.attrs.sn === 'string') b.sn = node.attrs.sn
  if (node.attrs.kind === 'scene_heading' && typeof node.attrs.bid === 'string') b.bid = node.attrs.bid
  if (typeof node.attrs.nid === 'string') b.nid = node.attrs.nid
  if (node.attrs.kind === 'scene_heading' && typeof node.attrs.syn === 'string' && node.attrs.syn) b.syn = node.attrs.syn
  return b
}

export function docNodeToBlocks(doc: PMNode): Block[] {
  const out: Block[] = []
  doc.forEach((node) => out.push(nodeToBlock(node)))
  return out
}

export function docToBlocks(editor: Editor): Block[] {
  return docNodeToBlocks(editor.state.doc)
}

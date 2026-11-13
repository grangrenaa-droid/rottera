import { cleanSynopsis } from './scriptfile'
import type { Beat, Block, Board } from './types'

/** A beat that has become a scene: the scene heading carries `bid` = the beat id. */
export interface BeatLink {
  beatId: string
  /** index of the scene heading in the block list */
  block: number
  /** 1-based position among the scene headings */
  scene: number
  heading: string
}

export const DEFAULT_HEADING = 'INT. LOCAL - DIA'

/** The first scene heading of each beat wins; a copy of a heading (same bid) is just a scene. */
export function beatLinks(blocks: Block[], board: Board): Map<string, BeatLink> {
  const known = new Set(board.beats.map((b) => b.id))
  const out = new Map<string, BeatLink>()
  let scene = 0
  blocks.forEach((b, i) => {
    if (b.kind !== 'scene_heading') return
    scene++
    if (b.bid && known.has(b.bid) && !out.has(b.bid)) out.set(b.bid, { beatId: b.bid, block: i, scene, heading: b.text.trim() })
  })
  return out
}

/** Beats in story order: lanes in board order, beats in the order they sit in the board. */
export function storyOrder(board: Board): Beat[] {
  const laneIds = board.lanes.map((l) => l.id)
  const rank = (b: Beat): number => {
    const r = laneIds.indexOf(b.lane)
    return r < 0 ? laneIds.length : r
  }
  return board.beats
    .map((b, i) => ({ b, i }))
    .sort((x, y) => rank(x.b) - rank(y.b) || x.i - y.i)
    .map((x) => x.b)
}

function sceneEnd(blocks: Block[], start: number): number {
  let i = start + 1
  while (i < blocks.length && blocks[i].kind !== 'scene_heading') i++
  return i
}

function blocksFor(beat: Beat): Block[] {
  const action = [beat.title, beat.body].filter(Boolean).join(': ')
  const out: Block[] = [{ kind: 'scene_heading', text: DEFAULT_HEADING, bid: beat.id }]
  // the card's description stays with the scene as its synopsis, after the action line is rewritten
  const syn = cleanSynopsis(beat.body || beat.title)
  if (syn) out[0].syn = syn
  if (action) out.push({ kind: 'action', text: action })
  return out
}

/**
 * Turns beats that have no scene yet into scenes, never touching the ones that already have one.
 * Each new scene goes right after the scene of the nearest earlier beat in story order, so the script
 * follows the board; with no earlier scene it goes before the next one, and with none at all, at the end.
 * Running it again changes nothing.
 */
export function sendBeats(board: Board, blocks: Block[], only?: string[]): { blocks: Block[]; created: string[] } {
  const wanted = only ? new Set(only) : null
  let out = blocks.slice()
  // a fresh script is one empty scene heading: new content takes its place
  if (out.length === 1 && out[0].kind === 'scene_heading' && !out[0].text.trim() && !out[0].bid) out = []
  const order = storyOrder(board)
  const created: string[] = []
  for (let k = 0; k < order.length; k++) {
    const beat = order[k]
    if (wanted && !wanted.has(beat.id)) continue
    const links = beatLinks(out, board)
    if (links.has(beat.id)) continue
    let at = out.length
    for (let j = k - 1; j >= 0; j--) {
      const l = links.get(order[j].id)
      if (l) {
        at = sceneEnd(out, l.block)
        break
      }
    }
    if (at === out.length) {
      for (let j = k + 1; j < order.length; j++) {
        const l = links.get(order[j].id)
        if (l) {
          at = l.block
          break
        }
      }
    }
    out.splice(at, 0, ...blocksFor(beat))
    created.push(beat.id)
  }
  return { blocks: out, created }
}

/** Beats that still have no scene, in story order. */
export function unsent(board: Board, blocks: Block[]): Beat[] {
  const links = beatLinks(blocks, board)
  return storyOrder(board).filter((b) => !links.has(b.id))
}

/** One scene in the outline column of the board. */
export interface OutlineScene {
  /** index of the scene heading in the block list */
  block: number
  /** 1-based position among the scene headings */
  scene: number
  heading: string
  synopsis: string
}

/** The scenes of one beat, or of none ("Sem beat") before the first beat. */
export interface OutlineGroup {
  beatId: string | null
  title: string
  scenes: OutlineScene[]
}

/**
 * Scenes in script order, grouped by beat. The first heading carrying a board beat's `bid` opens that beat's group
 * (the same rule as beatLinks); the scenes after it belong to it until the next group opens. Scenes before the
 * first group go to { beatId: null, title: 'Sem beat' }.
 */
export function scenesByBeat(blocks: Block[], board: Board): OutlineGroup[] {
  const links = beatLinks(blocks, board)
  const opens = new Map<number, string>()
  for (const l of links.values()) opens.set(l.block, l.beatId)
  const titles = new Map(board.beats.map((b) => [b.id, b.title]))
  const groups: OutlineGroup[] = []
  let scene = 0
  blocks.forEach((b, i) => {
    if (b.kind !== 'scene_heading') return
    scene++
    const opened = opens.get(i)
    if (opened) groups.push({ beatId: opened, title: titles.get(opened) ?? '', scenes: [] })
    else if (groups.length === 0) groups.push({ beatId: null, title: 'Sem beat', scenes: [] })
    groups[groups.length - 1].scenes.push({ block: i, scene, heading: b.text.trim(), synopsis: b.syn ?? '' })
  })
  return groups
}

/** Block index right after the last scene of the group (where "+ cena neste beat" goes); -1 if there is no such group. */
export function outlineInsertAt(blocks: Block[], board: Board, beatId: string | null): number {
  const g = scenesByBeat(blocks, board).find((x) => x.beatId === beatId)
  if (!g || g.scenes.length === 0) return -1
  return sceneEnd(blocks, g.scenes[g.scenes.length - 1].block)
}

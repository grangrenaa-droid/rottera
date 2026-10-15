import { describe, expect, it } from 'vitest'
import { createBridgeHandler } from '../src/renderer/bridgeHandler'
import type { Block, Script } from '../src/shared/types'
import type { EditorHandle } from '../src/renderer/Editor'

function fake(initial: Block[]): { handler: (m: string, p?: unknown) => Promise<unknown>; blocks: () => Block[] } {
  let blocks = initial.slice()
  const handle = {
    getBlocks: () => blocks,
    replaceRange: (s: number, e: number, list: Block[]) => {
      blocks = [...blocks.slice(0, s), ...list, ...blocks.slice(e)]
    }
  } as unknown as EditorHandle
  const script: Script = { titlePage: { title: '', author: '', contact: '' }, blocks }
  const handler = createBridgeHandler({
    handle: () => handle,
    script: () => ({ ...script, blocks }),
    path: () => null,
    setTitlePage: () => undefined,
    setBoard: () => undefined,
    setStoryboard: () => undefined,
    setLightMaps: () => undefined,
    setCharacters: () => undefined,
    save: async () => undefined,
    touched: () => undefined
  })
  return { handler: (m, p) => handler(m, p ?? {}), blocks: () => blocks }
}

describe('new content replaces the empty placeholder heading of a new script', () => {
  const scene = [{ kind: 'scene_heading', text: 'INT. SALA - DIA' }, { kind: 'action', text: 'Silêncio.' }]

  it('insert_blocks into a script that only has the empty heading', async () => {
    const f = fake([{ kind: 'scene_heading', text: '' }])
    const r = (await f.handler('insert_blocks', { blocks: scene })) as { replacedEmptyPlaceholder?: boolean }
    expect(r.replacedEmptyPlaceholder).toBe(true)
    expect(f.blocks().map((b) => b.text)).toEqual(['INT. SALA - DIA', 'Silêncio.'])
  })

  it('insert_fountain does the same', async () => {
    const f = fake([{ kind: 'scene_heading', text: '' }])
    await f.handler('insert_fountain', { text: 'INT. SALA - DIA\n\nSilêncio.\n' })
    expect(f.blocks()[0].text).toBe('INT. SALA - DIA')
    expect(f.blocks()).toHaveLength(2)
  })

  it('a script that already has text keeps its blocks', async () => {
    const f = fake([{ kind: 'action', text: 'Já existia.' }])
    await f.handler('insert_blocks', { blocks: scene })
    expect(f.blocks().map((b) => b.text)).toEqual(['Já existia.', 'INT. SALA - DIA', 'Silêncio.'])
  })

  it('an empty heading among other blocks is left alone', async () => {
    const f = fake([
      { kind: 'action', text: 'Antes.' },
      { kind: 'scene_heading', text: '' }
    ])
    await f.handler('insert_blocks', { blocks: scene })
    expect(f.blocks()).toHaveLength(4)
  })

  it('an empty list changes nothing', async () => {
    const f = fake([{ kind: 'scene_heading', text: '' }])
    await f.handler('insert_blocks', { blocks: [] })
    expect(f.blocks()).toEqual([{ kind: 'scene_heading', text: '' }])
  })
})

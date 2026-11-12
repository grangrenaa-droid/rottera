import { describe, expect, it } from 'vitest'
import { parseFountain, toFountain } from '../src/shared/fountain'
import { cleanSynopsis, parseScriptFile, serialize, SYNOPSIS_MAX } from '../src/shared/scriptfile'
import { buildReports } from '../src/shared/reports'
import { sendBeats } from '../src/shared/beats'
import { sceneInfo } from '../src/shared/production'
import { createBridgeHandler } from '../src/renderer/bridgeHandler'
import type { EditorHandle } from '../src/renderer/Editor'
import type { Block, Script } from '../src/shared/types'

const blocks: Block[] = [
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA', syn: 'Marina descobre a mentira e não diz nada.' },
  { kind: 'action', text: 'Marina coa o café.' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE' },
  { kind: 'action', text: 'Chove.' }
]
const script: Script = { titlePage: { title: '', author: '', contact: '' }, blocks }

describe('scene synopsis', () => {
  it('is one clean line, cut to its maximum', () => {
    expect(cleanSynopsis('  Ela sai.\r\n\n  Ele fica.  ')).toBe('Ela sai. Ele fica.')
    expect(cleanSynopsis('x'.repeat(1000))).toHaveLength(SYNOPSIS_MAX)
  })

  it('is saved in the file, only on scene headings', () => {
    const back = parseScriptFile(serialize({ ...script, blocks: [...blocks, { kind: 'action', text: 'y', syn: 'não vale' }] }))
    expect(back.blocks[0].syn).toBe('Marina descobre a mentira e não diz nada.')
    expect(back.blocks[2].syn).toBeUndefined()
    expect(back.blocks[4].syn).toBeUndefined()
  })

  it('goes into Fountain as "= synopsis" after the heading and comes back', () => {
    const text = toFountain(script)
    expect(text).toContain('INT. COZINHA - DIA\n\n= Marina descobre a mentira e não diz nada.\n')
    const back = parseFountain(text).blocks
    expect(back.map((b) => [b.kind, b.text, b.syn])).toEqual(blocks.map((b) => [b.kind, b.text, b.syn]))
  })

  it('from another program: lines that follow a heading are joined, section synopses are dropped', () => {
    const s = parseFountain('# Ato 1\n= O começo de tudo\n\nINT. SALA - DIA\n= Ela chega.\n= Ele já sabia.\n\nSilêncio.\n').blocks
    expect(s[0]).toEqual({ kind: 'scene_heading', text: 'INT. SALA - DIA', syn: 'Ela chega. Ele já sabia.' })
    expect(s.map((b) => b.text)).toEqual(['INT. SALA - DIA', 'Silêncio.'])
  })

  it('makes the step outline report, and shows on the call sheet data', () => {
    const r = buildReports(script).find((x) => x.id === 'escaleta')
    expect(r?.rows).toEqual([
      ['1', 'INT. COZINHA - DIA', 1, 'Marina descobre a mentira e não diz nada.'],
      ['2', 'EXT. RUA - NOITE', 1, '—']
    ])
    expect(sceneInfo(script).map((s) => s.synopsis)).toEqual(['Marina descobre a mentira e não diz nada.', ''])
  })

  it('comes from the card when a beat becomes a scene', () => {
    const board = {
      lanes: [{ id: 'l', name: 'Ato 1' }],
      beats: [
        { id: 'b1', lane: 'l', title: 'Catalisador', body: 'Davi volta depois de dez anos.', color: '' },
        { id: 'b2', lane: 'l', title: 'Debate', body: '', color: '' }
      ]
    }
    const out = sendBeats(board, []).blocks.filter((b) => b.kind === 'scene_heading')
    expect(out.map((b) => b.syn)).toEqual(['Davi volta depois de dez anos.', 'Debate'])
  })

  it('can be read and written by the AI, by scene number or heading index', async () => {
    let bs = blocks.slice()
    const handle = {
      getBlocks: () => bs,
      setSynopsis: (i: number, t: string) => {
        bs = bs.map((b, k) => (k === i ? { ...b, syn: t || undefined } : b))
        return true
      }
    } as unknown as EditorHandle
    const call = createBridgeHandler({
      handle: () => handle,
      script: () => ({ ...script, blocks: bs }),
      path: () => null,
      setTitlePage: () => undefined,
      setBoard: () => undefined,
      setStoryboard: () => undefined,
      setLightMaps: () => undefined,
      setCharacters: () => undefined,
      setNotes: () => undefined,
      save: async () => undefined,
      touched: () => undefined
    }) as (m: string, p: unknown) => Promise<any>
    expect(await call('set_synopsis', { scene: '2', text: 'Davi corre\n até o carro.' })).toEqual({ index: 2, synopsis: 'Davi corre até o carro.' })
    const outline = await call('get_outline', {})
    expect(outline.map((s: { synopsis: string | null }) => s.synopsis)).toEqual(['Marina descobre a mentira e não diz nada.', 'Davi corre até o carro.'])
    expect((await call('get_script', {})).blocks[0].synopsis).toBe('Marina descobre a mentira e não diz nada.')
    await call('set_synopsis', { index: 0, text: '' })
    expect(bs[0].syn).toBeUndefined()
    await expect(call('set_synopsis', { index: 1, text: 'x' })).rejects.toThrow(/cabeçalho/)
    await expect(call('set_synopsis', { scene: '9', text: 'x' })).rejects.toThrow(/não encontrada/)
  })
})

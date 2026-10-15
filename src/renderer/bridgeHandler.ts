import type { Beat, Block, Board, CharacterSheet, Kind, LightMap, Script, Storyboard, TitlePage } from '../shared/types'
import { FIELDS, characterKey, listCharacters, newSheet, presentationOf } from '../shared/characters'
import { ITEM_DEFS, ITEM_TYPES, cleanItem, newItem, newLightMap } from '../shared/lightmap'
import type { LightItemType } from '../shared/types'
import { emptyStoryboard } from '../shared/types'
import { isSafeImage } from '../shared/storyboard'
import { KINDS } from '../shared/elements'
import { paginate } from '../shared/paginate'
import { moveSceneTo, sceneNumbers, sceneRanges } from '../shared/scenes'
import { beatLinks, sendBeats } from '../shared/beats'
import { findInBlocks, replaceAllInBlocks } from '../shared/search'
import { buildReports } from '../shared/reports'
import { parseFountain, toFountain } from '../shared/fountain'
import { STRUCTURES, boardFromStructure, newId } from '../shared/structures'
import { parseHeading } from '../shared/smarttype'
import type { EditorHandle } from './Editor'

export interface BridgeContext {
  handle(): EditorHandle | null
  script(): Script
  path(): string | null
  setTitlePage(t: TitlePage): void
  setBoard(b: Board): void
  setStoryboard(sb: Storyboard): void
  setLightMaps(maps: LightMap[]): void
  setCharacters(sheets: CharacterSheet[]): void
  save(): Promise<void>
  /** Called after every edit so the UI can show that the script changed from outside. */
  touched(what: string): void
}

const MAX_BLOCKS = 2000
const MAX_TEXT = 20000

function findMap(maps: LightMap[], ref: unknown): number {
  if (maps.length === 0) fail('Não há mapas de luz. Use create_lightmap primeiro.')
  let i = -1
  if (typeof ref === 'number') i = Number.isInteger(ref) ? ref : -1
  else if (typeof ref === 'string') {
    const q = ref.toLowerCase()
    i = maps.findIndex((m) => m.id === ref || m.name.toLowerCase() === q)
  } else if (ref === undefined) i = 0
  if (i < 0 || i >= maps.length) fail(`Mapa não encontrado (0 a ${maps.length - 1}, ou o nome).`)
  return i
}

function fail(msg: string): never {
  throw new Error(msg)
}

function int(v: unknown, name: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) fail(`${name} deve ser um número inteiro.`)
  return v
}

function cleanBlocks(v: unknown): Block[] {
  if (!Array.isArray(v)) fail('blocks deve ser uma lista.')
  if (v.length > MAX_BLOCKS) fail(`No máximo ${MAX_BLOCKS} blocos por chamada.`)
  return v.map((raw, i) => {
    const b = raw as Partial<Block>
    if (!b || typeof b !== 'object') fail(`Bloco ${i} inválido.`)
    if (!(KINDS as string[]).includes(b.kind as string)) fail(`Bloco ${i}: kind inválido (${String(b.kind)}).`)
    if (typeof b.text !== 'string') fail(`Bloco ${i}: text deve ser texto.`)
    if (b.text.length > MAX_TEXT) fail(`Bloco ${i}: texto longo demais.`)
    const out: Block = { kind: b.kind as Kind, text: b.text.replace(/\r\n?/g, '\n').replace(/\n+/g, ' ') }
    if (b.dual === true) out.dual = true
    return out
  })
}

export function createBridgeHandler(ctx: BridgeContext): (method: string, params: unknown) => Promise<unknown> {
  const editor = (): EditorHandle => ctx.handle() ?? fail('Abra um roteiro no Rottera primeiro.')
  const blocks = (): Block[] => editor().getBlocks()
  const summary = (): { blockCount: number; pages: number } => ({
    blockCount: blocks().length,
    pages: paginate(blocks(), ctx.script().paper).pages.length
  })

  const insertAt = (after: unknown, list: Block[]): unknown => {
    const current = blocks()
    const n = current.length
    const pos = after === undefined || after === null ? n : int(after, 'after') + 1
    if (pos < 0 || pos > n) fail(`after fora do intervalo (0 a ${n - 1}, ou -1).`)
    // a brand-new script holds one empty scene heading as a placeholder: new content takes its place
    const onlyPlaceholder = n === 1 && current[0].kind === 'scene_heading' && current[0].text.trim() === ''
    if (onlyPlaceholder && list.length > 0) {
      editor().replaceRange(0, 1, list)
      ctx.touched('insert')
      return { inserted: list.length, firstIndex: 0, replacedEmptyPlaceholder: true, ...summary() }
    }
    editor().replaceRange(pos, pos, list)
    ctx.touched('insert')
    return { inserted: list.length, firstIndex: pos, ...summary() }
  }

  return async (method, rawParams) => {
    const p = (rawParams ?? {}) as Record<string, unknown>
    switch (method) {
      case 'status': {
        const s = ctx.script()
        return {
          title: s.titlePage.title || null,
          file: ctx.path(),
          ...summary(),
          scenes: blocks().filter((b) => b.kind === 'scene_heading').length,
          revisionMode: s.revision?.mode === true ? s.revision.color : null,
          scenesLocked: s.scenesLocked === true
        }
      }

      case 'get_script': {
        const s = { ...ctx.script(), blocks: blocks() }
        if (p.format === 'fountain') return toFountain(s)
        return {
          titlePage: s.titlePage,
          blocks: s.blocks.map((b, index) => ({
            index,
            kind: b.kind,
            text: b.text,
            ...(b.dual ? { dual: true } : {})
          })),
          ...summary()
        }
      }

      case 'get_outline': {
        const s = ctx.script()
        const bs = blocks()
        const pag = paginate(bs, s.paper)
        const nums = sceneNumbers(bs, s.scenesLocked === true)
        return sceneRanges(bs).map((r) => {
          const speaking = new Set<string>()
          for (let i = r.start; i < r.end; i++) {
            if (bs[i].kind === 'character' && bs[i].text.trim()) {
              speaking.add(bs[i].text.trim().toUpperCase().replace(/\s*\(.*\)\s*$/, ''))
            }
          }
          const h = parseHeading(bs[r.start].text)
          return {
            number: nums[r.start],
            index: r.start,
            heading: bs[r.start].text,
            location: h.location || null,
            time: h.time || null,
            page: (pag.blockPage[r.start] ?? 0) + 1,
            blocks: r.end - r.start,
            characters: [...speaking]
          }
        })
      }

      case 'read_blocks': {
        const start = int(p.start, 'start')
        const count = int(p.count, 'count')
        const bs = blocks()
        if (start < 0 || start >= bs.length) fail(`start fora do intervalo (0 a ${bs.length - 1}).`)
        return bs.slice(start, start + Math.min(count, 500)).map((b, i) => ({ index: start + i, kind: b.kind, text: b.text }))
      }

      case 'get_selection':
        return editor().selection()

      case 'insert_blocks':
        return insertAt(p.after, cleanBlocks(p.blocks))

      case 'insert_fountain': {
        if (typeof p.text !== 'string') fail('text deve ser texto.')
        if (p.text.length > 400000) fail('Texto longo demais.')
        const parsed = parseFountain(p.text).blocks
        const list = parsed.length === 1 && parsed[0].text === '' ? [] : parsed
        if (list.length === 0) fail('O texto não gerou nenhum bloco.')
        return insertAt(p.after, cleanBlocks(list))
      }

      case 'replace_blocks': {
        const start = int(p.start, 'start')
        const end = int(p.end, 'end')
        const n = blocks().length
        if (start < 0 || end < start || end > n) fail(`Intervalo inválido (0 a ${n}).`)
        const list = cleanBlocks(p.blocks)
        editor().replaceRange(start, end, list)
        ctx.touched('replace')
        return { replaced: end - start, inserted: list.length, ...summary() }
      }

      case 'update_block': {
        const index = int(p.index, 'index')
        const bs = blocks()
        if (index < 0 || index >= bs.length) fail(`index fora do intervalo (0 a ${bs.length - 1}).`)
        const next: Block = { ...bs[index] }
        if (p.kind !== undefined) {
          if (!(KINDS as string[]).includes(p.kind as string)) fail('kind inválido.')
          next.kind = p.kind as Kind
        }
        if (p.text !== undefined) {
          if (typeof p.text !== 'string' || p.text.length > MAX_TEXT) fail('text inválido.')
          next.text = p.text.replace(/\s*\n+\s*/g, ' ')
        }
        editor().replaceRange(index, index + 1, [next])
        ctx.touched('update')
        return { index, kind: next.kind, text: next.text }
      }

      case 'delete_blocks': {
        const start = int(p.start, 'start')
        const end = int(p.end, 'end')
        const n = blocks().length
        if (start < 0 || end <= start || end > n) fail(`Intervalo inválido (0 a ${n}).`)
        editor().replaceRange(start, end, [])
        ctx.touched('delete')
        return { deleted: end - start, ...summary() }
      }

      case 'move_scene': {
        const scene = int(p.scene, 'scene') - 1
        const to = int(p.to, 'to') - 1
        const moved = moveSceneTo(blocks(), scene, to)
        if (!moved) fail('Cena ou destino inválido.')
        editor().replaceRange(0, blocks().length, moved, { noRev: true })
        ctx.touched('move')
        return { scene: scene + 1, to: to + 1, ...summary() }
      }

      case 'find': {
        if (typeof p.query !== 'string') fail('query deve ser texto.')
        const hits = findInBlocks(blocks(), p.query, p.caseSensitive === true)
        const bs = blocks()
        return {
          count: hits.length,
          hits: hits.slice(0, 200).map((h) => ({ index: h.block, kind: bs[h.block].kind, text: bs[h.block].text, from: h.from, to: h.to }))
        }
      }

      case 'replace_all': {
        if (typeof p.query !== 'string' || p.query === '') fail('query deve ser texto não vazio.')
        if (typeof p.replacement !== 'string') fail('replacement deve ser texto.')
        const before = blocks()
        const r = replaceAllInBlocks(before, p.query, p.replacement, p.caseSensitive === true)
        for (let i = before.length - 1; i >= 0; i--) {
          if (r.blocks[i] !== before[i]) editor().replaceRange(i, i + 1, [r.blocks[i]])
        }
        if (r.count > 0) ctx.touched('replace')
        return { replaced: r.count }
      }

      case 'set_title_page': {
        const cur = ctx.script().titlePage
        const next: TitlePage = {
          title: typeof p.title === 'string' ? p.title : cur.title,
          author: typeof p.author === 'string' ? p.author : cur.author,
          contact: typeof p.contact === 'string' ? p.contact : cur.contact
        }
        ctx.setTitlePage(next)
        ctx.touched('title')
        return next
      }

      case 'get_reports': {
        const s: Script = { ...ctx.script(), blocks: blocks() }
        const all = buildReports(s)
        if (typeof p.id === 'string') {
          const r = all.find((x) => x.id === p.id)
          if (!r) fail(`Relatório desconhecido: ${p.id}`)
          return r
        }
        return all
      }

      case 'get_beats': {
        const board: Board = ctx.script().board ?? { lanes: [], beats: [] }
        const links = beatLinks(blocks(), board)
        return {
          ...board,
          beats: board.beats.map((b) => {
            const l = links.get(b.id)
            return l ? { ...b, scene: l.scene, sceneHeading: l.heading } : { ...b, scene: null }
          })
        }
      }

      case 'send_beats': {
        const board: Board = ctx.script().board ?? { lanes: [], beats: [] }
        let only: string[] | undefined
        if (p.beats !== undefined) {
          if (!Array.isArray(p.beats) || p.beats.some((x) => typeof x !== 'string')) fail('beats deve ser uma lista de ids.')
          only = p.beats as string[]
          const unknown = only.filter((id) => !board.beats.some((b) => b.id === id))
          if (unknown.length) fail(`Beat não encontrado: ${unknown.join(', ')}`)
        }
        const r = sendBeats(board, blocks(), only)
        if (r.blocks.length > MAX_BLOCKS * 10) fail('O roteiro ficaria grande demais.')
        if (r.created.length > 0) {
          editor().replaceRange(0, blocks().length, r.blocks, { noRev: true })
          ctx.touched('beats')
        }
        return { created: r.created.length, beats: r.created, ...summary() }
      }

      case 'add_beat': {
        if (typeof p.lane !== 'string' || typeof p.title !== 'string') fail('lane e title devem ser texto.')
        const board: Board = ctx.script().board ?? { lanes: [], beats: [] }
        let lane = board.lanes.find((l) => l.name.toLowerCase() === (p.lane as string).toLowerCase())
        const lanes = [...board.lanes]
        if (!lane) {
          lane = { id: newId('lane'), name: p.lane }
          lanes.push(lane)
        }
        const beat: Beat = {
          id: newId('beat'),
          lane: lane.id,
          title: p.title,
          body: typeof p.body === 'string' ? p.body : '',
          color: typeof p.color === 'string' ? p.color : ''
        }
        ctx.setBoard({ lanes, beats: [...board.beats, beat] })
        ctx.touched('board')
        return { added: beat.id, lane: lane.name }
      }

      case 'apply_structure': {
        const s = STRUCTURES.find((x) => x.id === p.id)
        if (!s) fail(`Estrutura desconhecida. Use: ${STRUCTURES.map((x) => x.id).join(', ')}.`)
        const board = ctx.script().board
        if (board && board.lanes.length > 0 && p.replace !== true) {
          fail('O quadro já tem colunas. Passe replace: true para substituir.')
        }
        ctx.setBoard(boardFromStructure(s))
        ctx.touched('board')
        return { applied: s.id }
      }

      case 'get_storyboard': {
        const sb = ctx.script().storyboard ?? emptyStoryboard()
        return {
          aspect: sb.aspect,
          layout: sb.layout,
          includeInPdf: sb.includeInPdf,
          frames: sb.frames.map((f, i) => ({
            index: i,
            caption: f.caption,
            scene: f.scene,
            hasImage: f.image !== ''
          }))
        }
      }

      case 'add_frame': {
        const sb = ctx.script().storyboard ?? emptyStoryboard()
        if (typeof p.caption !== 'string' || p.caption.length > 2000) fail('caption deve ser texto de até 2000 caracteres.')
        const scene = typeof p.scene === 'string' ? p.scene.slice(0, 40) : ''
        const frame = { id: newId('frame'), image: '', caption: p.caption, scene }
        const at = p.after === undefined ? sb.frames.length : int(p.after, 'after') + 1
        if (at < 0 || at > sb.frames.length) fail(`after fora do intervalo (-1 a ${sb.frames.length - 1}).`)
        const frames = sb.frames.slice()
        frames.splice(at, 0, frame)
        ctx.setStoryboard({ ...sb, frames })
        ctx.touched('storyboard')
        return { index: at, frames: frames.length }
      }

      case 'set_frame': {
        const sb = ctx.script().storyboard ?? emptyStoryboard()
        const index = int(p.index, 'index')
        if (index < 0 || index >= sb.frames.length) fail(`index fora do intervalo (0 a ${sb.frames.length - 1}).`)
        const cur = sb.frames[index]
        const next = {
          ...cur,
          caption: typeof p.caption === 'string' ? p.caption.slice(0, 2000) : cur.caption,
          scene: typeof p.scene === 'string' ? p.scene.slice(0, 40) : cur.scene
        }
        ctx.setStoryboard({ ...sb, frames: sb.frames.map((f, i) => (i === index ? next : f)) })
        ctx.touched('storyboard')
        return { index, caption: next.caption, scene: next.scene }
      }

      case 'set_frame_image': {
        const sb = ctx.script().storyboard ?? emptyStoryboard()
        const index = int(p.index, 'index')
        if (index < 0 || index >= sb.frames.length) fail(`index fora do intervalo (0 a ${sb.frames.length - 1}).`)
        const image = typeof p.image === 'string' ? p.image : ''
        if (image === '' || !isSafeImage(image)) fail('A imagem não é PNG, JPEG, WebP ou GIF válida.')
        ctx.setStoryboard({ ...sb, frames: sb.frames.map((f, i) => (i === index ? { ...f, image } : f)) })
        ctx.touched('storyboard')
        return { index, hasImage: true }
      }

      case 'get_lightmaps': {
        const maps = ctx.script().lightMaps ?? []
        return maps.map((m, index) => ({
          index,
          id: m.id,
          name: m.name,
          scene: m.scene,
          width: m.width,
          height: m.height,
          includeInPdf: m.includeInPdf,
          notes: m.notes,
          items: m.items.map((i, k) => ({
            index: k,
            id: i.id,
            type: i.type,
            label: i.label,
            x: Math.round(i.x * 100) / 100,
            y: Math.round(i.y * 100) / 100,
            rotation: i.rotation,
            spread: i.spread,
            range: i.range,
            length: i.length
          }))
        }))
      }

      case 'create_lightmap': {
        const maps = ctx.script().lightMaps ?? []
        if (maps.length >= 50) fail('No máximo 50 mapas.')
        const m = newLightMap(typeof p.name === 'string' && p.name ? p.name.slice(0, 80) : `Mapa ${maps.length + 1}`)
        if (typeof p.scene === 'string') m.scene = p.scene.slice(0, 40)
        if (typeof p.width === 'number') m.width = Math.min(60, Math.max(2, p.width))
        if (typeof p.height === 'number') m.height = Math.min(60, Math.max(2, p.height))
        if (typeof p.notes === 'string') m.notes = p.notes.slice(0, 4000)
        ctx.setLightMaps([...maps, m])
        ctx.touched('lightmap')
        return { index: maps.length, id: m.id, width: m.width, height: m.height }
      }

      case 'add_light_item': {
        const maps = ctx.script().lightMaps ?? []
        const mi = findMap(maps, p.map)
        const m = maps[mi]
        if (!ITEM_TYPES.includes(p.type as LightItemType)) fail(`type inválido. Use: ${ITEM_TYPES.join(', ')}.`)
        if (m.items.length >= 300) fail('No máximo 300 peças por mapa.')
        const type = p.type as LightItemType
        const base = newItem(
          type,
          typeof p.x === 'number' ? p.x : m.width / 2,
          typeof p.y === 'number' ? p.y : m.height / 2,
          typeof p.label === 'string' ? p.label : ''
        )
        if (typeof p.rotation === 'number') base.rotation = p.rotation
        if (typeof p.spread === 'number') base.spread = p.spread
        if (typeof p.range === 'number') base.range = p.range
        if (typeof p.length === 'number') base.length = p.length
        const it = cleanItem(base, m.width, m.height)
        if (!it) fail('Peça inválida.')
        const next = maps.map((x, i) => (i === mi ? { ...x, items: [...x.items, it] } : x))
        ctx.setLightMaps(next)
        ctx.touched('lightmap')
        return { map: mi, item: m.items.length, id: it.id, type: it.type, name: ITEM_DEFS[it.type].name }
      }

      case 'update_light_item': {
        const maps = ctx.script().lightMaps ?? []
        const mi = findMap(maps, p.map)
        const m = maps[mi]
        const ii = typeof p.item === 'number' ? p.item : m.items.findIndex((i) => i.id === p.item)
        if (!Number.isInteger(ii) || ii < 0 || ii >= m.items.length) fail('Peça não encontrada neste mapa.')
        const cur = m.items[ii]
        const patch = { ...cur }
        for (const k of ['x', 'y', 'rotation', 'spread', 'range', 'length'] as const) {
          if (typeof p[k] === 'number') patch[k] = p[k] as number
        }
        if (typeof p.label === 'string') patch.label = p.label
        const it = cleanItem(patch, m.width, m.height)
        if (!it) fail('Peça inválida.')
        const next = maps.map((x, i) => (i === mi ? { ...x, items: x.items.map((y, k) => (k === ii ? it : y)) } : x))
        ctx.setLightMaps(next)
        ctx.touched('lightmap')
        return { map: mi, item: ii, x: it.x, y: it.y, rotation: it.rotation, label: it.label }
      }

      case 'remove_light_item': {
        const maps = ctx.script().lightMaps ?? []
        const mi = findMap(maps, p.map)
        const m = maps[mi]
        const ii = typeof p.item === 'number' ? p.item : m.items.findIndex((i) => i.id === p.item)
        if (!Number.isInteger(ii) || ii < 0 || ii >= m.items.length) fail('Peça não encontrada neste mapa.')
        const next = maps.map((x, i) => (i === mi ? { ...x, items: x.items.filter((_y, k) => k !== ii) } : x))
        ctx.setLightMaps(next)
        ctx.touched('lightmap')
        return { removed: ii, remaining: m.items.length - 1 }
      }

      case 'get_characters': {
        const s: Script = { ...ctx.script(), blocks: blocks() }
        const one = typeof p.name === 'string' ? characterKey(p.name) : null
        return listCharacters(s)
          .filter((e) => one === null || e.key === one)
          .map((e) => {
            const pres = presentationOf(e.sheet, e.name, e.stats)
            return {
              name: e.name,
              inScript: e.inScript,
              sheet: Object.fromEntries(FIELDS.map((f) => [f.key, e.sheet?.[f.key] ?? ''])),
              hasImage: Boolean(e.sheet?.image),
              includeInPdf: e.sheet?.includeInPdf !== false,
              inTheScript: pres.inScript,
              stats: e.stats
            }
          })
      }

      case 'set_character': {
        if (typeof p.name !== 'string' || p.name.trim() === '') fail('name deve ser o nome do personagem.')
        const key = characterKey(p.name)
        const sheets = ctx.script().characters ?? []
        const found = sheets.find((c) => characterKey(c.name) === key)
        const base: CharacterSheet = found ?? newSheet(p.name.trim().toUpperCase())
        const next: CharacterSheet = { ...base }
        for (const f of FIELDS) {
          const v = p[f.key]
          if (v === undefined) continue
          if (typeof v !== 'string') fail(`${f.key} deve ser texto.`)
          if (v.length > 4000) fail(`${f.key}: texto longo demais (máximo 4000).`)
          next[f.key] = v
        }
        if (typeof p.includeInPdf === 'boolean') next.includeInPdf = p.includeInPdf
        const list = found ? sheets.map((c) => (c.id === found.id ? next : c)) : [...sheets, next]
        if (list.length > 200) fail('No máximo 200 fichas.')
        ctx.setCharacters(list)
        ctx.touched('characters')
        return { name: next.name, created: !found, filled: FIELDS.filter((f) => next[f.key].trim() !== '').map((f) => f.key) }
      }

      case 'save_script':
        await ctx.save()
        return { saved: true, file: ctx.path() }

      default:
        fail(`Método desconhecido: ${method}`)
    }
  }
}

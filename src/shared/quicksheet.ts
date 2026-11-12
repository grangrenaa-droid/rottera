import type { LightItem, LightItemType, LightMap, LightRole, SensorId } from './types'
import { DIFFUSIONS, GELS, MOVES, ROLES, SHOTS, SENSORS, isLight, itemHasCone, itemHasDepth, itemHasLength } from './lightmap'

/*
 * The quick lines of the light map: the person writes a piece's sheet the way it is said on set
 * ("principal 2K 5600K 1/2 CTB 216 a 2,4 m 80%", "35mm full frame close travelling", "parede 4 m 90°")
 * or the size of the set ("6 x 4 cena 3"), and it fills the fields.
 */

/** Lower case, no accents, single spaces: "Contra-plongée" and "contra plongee" read the same. */
const plain = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const ROLE_WORDS: [LightRole, string[]][] = [
  ['key', ['principal', 'key', 'chave', 'luz principal']],
  ['fill', ['preenchimento', 'fill', 'enchimento']],
  ['back', ['contra', 'contraluz', 'back', 'backlight', 'contra luz']],
  ['rim', ['recorte', 'rim', 'kicker', 'kick']],
  ['background', ['fundo', 'background', 'bg', 'luz de fundo']],
  ['practical', ['pratica', 'practical', 'luz pratica']],
  ['ambient', ['ambiente', 'ambient', 'ambiencia']],
  ['effect', ['efeito', 'effect', 'fx']]
]

const SENSOR_WORDS: [SensorId, string[]][] = [
  ['ff', ['full frame', 'fullframe', 'ff', 'quadro cheio']],
  ['s35', ['super 35', 's35', 'super35']],
  ['apsc', ['aps c', 'apsc']],
  ['mft', ['micro 4/3', 'micro quatro tercos', 'mft', 'm43']],
  ['s16', ['super 16', 's16', 'super16']]
]

/** Shot names and the short forms used in a shot list. */
const SHOT_WORDS: [string, string[]][] = [
  ['Grande plano geral', ['gpg', 'grande plano geral', 'extreme wide', 'ews']],
  ['Plano geral', ['pg', 'plano geral', 'wide', 'ws']],
  ['Plano conjunto', ['pc', 'plano conjunto']],
  ['Plano americano', ['pa', 'plano americano', 'cowboy']],
  ['Plano médio', ['pm', 'plano medio', 'medium', 'ms']],
  ['Primeiro plano', ['pp', 'primeiro plano', 'medium close', 'mcu']],
  ['Close', ['ppp', 'close', 'close up', 'closeup', 'cu', 'primeirissimo plano']],
  ['Plano detalhe', ['pd', 'detalhe', 'plano detalhe', 'insert detail', 'ecu']],
  ['Ponto de vista (POV)', ['pov', 'ponto de vista']],
  ['Sobre o ombro', ['ots', 'sobre o ombro', 'over the shoulder']],
  ['Inserto', ['inserto', 'insert']]
]

const MOVE_WORDS: [string, string[]][] = [
  ['Fixa', ['fixa', 'fixo', 'parada', 'static']],
  ['Panorâmica', ['panoramica', 'pan']],
  ['Tilt', ['tilt']],
  ['Travelling', ['travelling', 'traveling', 'trilho']],
  ['Dolly in', ['dolly in', 'aproxima']],
  ['Dolly out', ['dolly out', 'afasta']],
  ['Zoom', ['zoom']],
  ['Steadicam / gimbal', ['steadicam', 'steady', 'gimbal', 'estabilizador']],
  ['Câmera na mão', ['camera na mao', 'na mao', 'handheld', 'mao']],
  ['Grua', ['grua', 'jib', 'crane']],
  ['Drone', ['drone']]
]

const NUM = '(\\d+(?:\\.\\d+)?)'
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
/** 2.5 as it is written here: "2,5". */
const dec = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',')
/** Words that carry nothing by themselves. */
const FILLER = ['a', 'de', 'com', 'e', 'em', 'luz', 'altura', 'na', 'no', 'para', 'por', 'graus', 'm', 'metros']

/** The line, cleaned, and the ways of taking things out of it; what is left at the end was not understood. */
function reader(text: string) {
  let rest = ` ${plain(text).replace(/(\d),(\d)/g, '$1.$2')} `
  // takes the first match of a pattern out of the line
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = rest.match(re)
    if (m) rest = rest.replace(m[0], ' ')
    return m
  }
  // the longest name first, so "dolly out" wins over "out" and "plano medio" over "pm"
  const takeWord = <T>(table: [T, string[]][]): T | undefined => {
    const all = table.flatMap(([v, words]) => words.map((w) => [v, w] as [T, string]))
    all.sort((a, b) => b[1].length - a[1].length)
    for (const [v, w] of all) {
      const re = new RegExp(`(^|\\s)${w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?=\\s|$)`)
      if (re.test(rest)) {
        rest = rest.replace(re, ' ')
        return v
      }
    }
    return undefined
  }
  // a number named by a word, before it ("alcance 3 m", "rotação: 90") or after it ("3 m de alcance")
  const field = (words: string, unit: string): number | undefined => {
    const m =
      take(new RegExp(`\\s(?:${words})\\s?(?:(?:de|para|a|em|=|:)\\s?)?${NUM}\\s?(?:${unit})?(?=\\s)`)) ??
      take(new RegExp(`\\s${NUM}\\s?(?:${unit})\\s(?:de\\s)?(?:${words})(?=\\s)`))
    return m ? Number(m[1]) : undefined
  }
  const unknown = (): string[] => rest.split(' ').filter((w) => w && !FILLER.includes(w))
  return { take, takeWord, field, unknown }
}

export interface QuickResult {
  patch: Partial<LightItem>
  /** What was understood, in the order of the sheet, to show back. */
  understood: string[]
  /** Words that were not understood. */
  unknown: string[]
}

/**
 * Reads the quick line of a piece of the map.
 * Every piece: rotation ("90°", "rotação 90") and position ("x 2 y 3,5"); with a beam, its spread ("abertura 40°")
 * and reach ("alcance 3 m"); with a length (flag, wall, window), the length ("4 m"); a table, length by width ("1,6 x 0,9").
 * Light: function, power ("2K" or "2000W" or "2kW"; a small number with K is kilowatts, as on set), colour temperature
 * ("3200K", "tungstênio", "dia"), gel ("1/2 CTO", "ND 0.6"), diffusion ("216", "grid"), intensity ("80%"), height ("2,4 m").
 * Camera: lens ("35mm"), sensor ("full frame"), height ("1,5 m"), shot ("close", "PM"), movement ("travelling").
 */
export function parseQuickSheet(
  text: string,
  type: LightItemType,
  size: { width: number; height: number } = { width: 60, height: 60 }
): QuickResult {
  const { take, takeWord, field, unknown } = reader(text)
  const patch: Partial<LightItem> = {}
  const understood: string[] = []

  // the named numbers first, so "alcance 3 m" is not read as a height nor "abertura 40°" as a rotation
  if (itemHasCone(type)) {
    const spread = field('abertura|angulo|spread|cone', '°|º|graus?')
    if (spread !== undefined) {
      patch.spread = Math.round(clamp(spread, 5, 180))
      understood.push(`abertura ${patch.spread}°`)
    }
    const range = field('alcance|range|distancia', 'm|metros?')
    if (range !== undefined) {
      patch.range = clamp(range, 0.5, 30)
      understood.push(`alcance ${dec(patch.range)} m`)
    }
  }
  // a named rotation and a position written as a pair ("x 2 y 3") come before a table's size,
  // so in "rotação 45 x 2 y 3" the "45 x 2" is not read as a table of 45 by 2
  let rot = field('rotacao|rot|girar|girado|girada|gira|virado|virada|direcao', '°|º|graus?')
  let x: number | undefined
  let y: number | undefined
  const pair = take(new RegExp(`\\sx\\s?${NUM}\\s?(?:m\\s?)?(?:e\\s)?y\\s?${NUM}\\s?m?(?=\\s)`))
  if (pair) {
    x = Number(pair[1])
    y = Number(pair[2])
  }
  if (itemHasDepth(type)) {
    // a table: "1,6 x 0,9" is its length by its width
    const two = take(new RegExp(`\\s${NUM}\\s?m?\\s?(?:x|por)\\s?${NUM}\\s?m?(?=\\s)`))
    if (two) {
      patch.length = clamp(Number(two[1]), 0.2, 30)
      patch.depth = clamp(Number(two[2]), 0.2, 30)
    }
    const dep = field('largura|profundidade', 'm|metros?')
    if (dep !== undefined) patch.depth = clamp(dep, 0.2, 30)
  }
  if (itemHasLength(type)) {
    const len = field(itemHasDepth(type) ? 'comprimento|tamanho' : 'comprimento|largura|tamanho', 'm|metros?')
    if (len !== undefined) patch.length = clamp(len, 0.2, 30)
  }
  if (x === undefined) x = field('x', 'm|metros?')
  if (y === undefined) y = field('y', 'm|metros?')
  if (x !== undefined) {
    patch.x = clamp(x, 0, size.width)
    understood.push(`X ${dec(patch.x)} m`)
  }
  if (y !== undefined) {
    patch.y = clamp(y, 0, size.height)
    understood.push(`Y ${dec(patch.y)} m`)
  }
  // rotation without a name: any number of degrees
  if (rot === undefined) {
    const m = take(/\s(\d{1,3})\s?(?:°|º|graus?)(?=\s)/)
    if (m) rot = Number(m[1])
  }
  if (rot !== undefined) {
    patch.rotation = ((Math.round(rot) % 360) + 360) % 360
    understood.push(`rotação ${patch.rotation}°`)
  }

  if (isLight(type)) {
    const role = takeWord(ROLE_WORDS)
    if (role) {
      patch.role = role
      understood.push(ROLES.find((r) => r.id === role)!.label)
    }
    // colour temperature: a big number with K, or a word
    const k = take(/\s(\d{4,5})\s?k(?=\s)/)
    if (k) patch.kelvin = Number(k[1])
    else if (take(/\s(tungstenio|tungsten|halogena)(?=\s)/)) patch.kelvin = 3200
    else if (take(/\s(luz do dia|daylight|dia)(?=\s)/)) patch.kelvin = 5600
    // power: watts, kilowatts, or a small number with K (2K = 2000 W)
    const w = take(/\s(\d+(?:\.\d+)?)\s?(kw|k|w)(?=\s)/)
    if (w) patch.watts = Math.round(Number(w[1]) * (w[2] === 'w' ? 1 : 1000))
    if (patch.watts !== undefined) understood.push(`${patch.watts.toLocaleString('pt-BR')} W`)
    if (patch.kelvin !== undefined) understood.push(`${patch.kelvin} K`)
    // gel
    const gel = take(/\s(1\/8|1\/4|1\/2|meio|meia|full)?\s?(cto|ctb)(?=\s)/)
    if (gel) {
      const frac = gel[1] === 'meio' || gel[1] === 'meia' ? '1/2' : gel[1] === 'full' ? '' : gel[1] ?? ''
      patch.gel = `${frac ? `${frac} ` : ''}${gel[2].toUpperCase()}`
    } else {
      const nd = take(/\s(nd)\s?0?\.?([369])(?=\s)/)
      if (nd) patch.gel = `ND 0.${nd[2]}`
      else {
        const g = take(/\s(plus|minus)\s?green(?=\s)/)
        if (g) patch.gel = g[1] === 'plus' ? 'Plus Green' : 'Minus Green'
      }
    }
    if (patch.gel) understood.push(GELS.find((x) => x.name.toLowerCase() === patch.gel!.toLowerCase())?.name ?? patch.gel)
    // diffusion
    const diff = take(/\s(216|250|251|opal|grid cloth|grid|seda|silk|frost)(?=\s)/)
    if (diff) {
      const word = diff[1]
      patch.diffusion =
        DIFFUSIONS.find((d) => plain(d).startsWith(word === 'grid' ? 'grid' : word === 'silk' ? 'seda' : word)) ?? word
      understood.push(patch.diffusion)
    }
    const pct = take(/\s(\d{1,3})\s?%(?=\s)/)
    if (pct) {
      patch.intensity = Math.min(100, Number(pct[1]))
      understood.push(`${patch.intensity}%`)
    }
  } else if (type === 'camera') {
    const lens = take(/\s(\d+(?:\.\d+)?)\s?mm(?=\s)/)
    if (lens) {
      patch.lens = Number(lens[1])
      understood.push(`${patch.lens} mm`)
    }
    const sensor = takeWord(SENSOR_WORDS)
    if (sensor) {
      patch.sensor = sensor
      understood.push(SENSORS.find((s) => s.id === sensor)!.label)
    }
    // the movement first: "dolly in" must not be read as anything else
    const move = takeWord(MOVE_WORDS)
    const shot = takeWord(SHOT_WORDS)
    if (shot && SHOTS.includes(shot)) {
      patch.shot = shot
      understood.push(shot)
    }
    if (move && MOVES.includes(move)) {
      patch.move = move
      understood.push(move)
    }
  }
  // a plain "2,4 m" is the height of a light or a camera, and the length of a flag, a wall or a window
  if (isLight(type) || type === 'camera') {
    const h = take(/\s(?:a |altura )?(\d+(?:\.\d+)?)\s?m(?:etros?)?(?=\s)/)
    if (h) {
      patch.height = clamp(Number(h[1]), 0, 30)
      understood.push(`${dec(patch.height)} m de altura`)
    }
  } else if (itemHasLength(type) && patch.length === undefined) {
    const l = take(/\s(\d+(?:\.\d+)?)\s?m(?:etros?)?(?=\s)/)
    if (l) patch.length = clamp(Number(l[1]), 0.2, 30)
  }
  if (patch.length !== undefined) understood.push(`${dec(patch.length)} m de comprimento`)
  if (patch.depth !== undefined) understood.push(`${dec(patch.depth)} m de largura`)
  return { patch, understood, unknown: unknown() }
}

export interface QuickMapResult {
  patch: Partial<Pick<LightMap, 'width' | 'height' | 'scene'>>
  understood: string[]
  unknown: string[]
}

/**
 * Reads the quick line of the map itself: the size of the set as width by depth ("6 x 4", "6 m por 4,5 m",
 * "largura 6 fundo 4") and the scene ("cena 12", "sem cena"). A scene number that is not in the script is not used.
 */
export function parseQuickMap(text: string, scenes: string[]): QuickMapResult {
  const { take, field, unknown } = reader(text)
  const patch: QuickMapResult['patch'] = {}
  const understood: string[] = []
  const bad: string[] = []
  const size = take(/\s(\d+(?:\.\d+)?)\s?m?\s?(?:x|por)\s?(\d+(?:\.\d+)?)\s?m?(?=\s)/)
  const w = size ? Number(size[1]) : field('largura|larg|frente', 'm|metros?')
  const h = size ? Number(size[2]) : field('fundo|profundidade|prof', 'm|metros?')
  if (w !== undefined) {
    patch.width = clamp(w, 2, 60)
    understood.push(`largura ${dec(patch.width)} m`)
  }
  if (h !== undefined) {
    patch.height = clamp(h, 2, 60)
    understood.push(`fundo ${dec(patch.height)} m`)
  }
  if (take(/\ssem cena(?=\s)/)) {
    patch.scene = ''
    understood.push('sem cena')
  } else {
    const sc = take(/\s(?:cena|sc)\s?(\S+)(?=\s)/)
    if (sc) {
      const found = scenes.find((n) => n.toLowerCase() === sc[1])
      if (found !== undefined) {
        patch.scene = found
        understood.push(`cena ${found}`)
      } else bad.push(`cena ${sc[1]} (não existe no roteiro)`)
    }
  }
  return { patch, understood, unknown: [...bad, ...unknown()] }
}

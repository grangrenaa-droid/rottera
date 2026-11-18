import type { LocationPhoto, LocationSheet } from './types'
import type { SceneInfo } from './production'
import { locationKey } from './production'
import type { Report } from './reports'
import { isSafeImage } from './storyboard'

export type TextKey = Exclude<keyof LocationSheet, 'permit' | 'photos'>

/** The written fields of a location's sheet, in the order they are shown and printed. */
export const LOCATION_FIELDS: { key: TextKey; label: string; hint: string; long?: boolean }[] = [
  { key: 'address', label: 'Endereço', hint: 'Rua, número, bairro, cidade' },
  { key: 'contact', label: 'Responsável', hint: 'Quem libera o lugar' },
  { key: 'phone', label: 'Telefone', hint: '(81) 99999-0000' },
  { key: 'cost', label: 'Custo', hint: 'Ex.: R$ 800 por dia' },
  { key: 'hours', label: 'Horários permitidos', hint: 'Ex.: das 8h às 18h, sem filmar no domingo' },
  { key: 'power', label: 'Energia', hint: 'Tomadas, 220 V, onde ligar o gerador', long: true },
  { key: 'parking', label: 'Estacionamento', hint: 'Onde param os carros e o caminhão', long: true },
  { key: 'support', label: 'Apoio', hint: 'Banheiro, camarim, lugar para a equipe comer', long: true },
  { key: 'noise', label: 'Ruídos', hint: 'Trânsito, obra, vizinhos, horários de barulho', long: true },
  { key: 'notes', label: 'Observações', hint: '', long: true }
]

export const PERMITS: Record<NonNullable<LocationSheet['permit']>, string> = { pending: 'Pendente', granted: 'Autorizada', refused: 'Recusada' }

const SHORT = 200
const LONG = 2000
const PHOTOS_MAX = 12

export function emptyLocation(): LocationSheet {
  return { address: '', contact: '', phone: '', cost: '', hours: '', power: '', parking: '', support: '', noise: '', notes: '', photos: [] }
}

const isEmpty = (l: LocationSheet): boolean => !l.permit && l.photos.length === 0 && LOCATION_FIELDS.every((f) => !l[f.key].trim())

function cleanSheet(x: Record<string, unknown>): LocationSheet {
  const l = emptyLocation()
  for (const f of LOCATION_FIELDS) l[f.key] = typeof x[f.key] === 'string' ? (x[f.key] as string).slice(0, f.long ? LONG : SHORT) : ''
  if (x.permit === 'pending' || x.permit === 'granted' || x.permit === 'refused') l.permit = x.permit
  if (Array.isArray(x.photos)) {
    l.photos = x.photos
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .filter((p) => typeof p.id === 'string' && p.id.length > 0 && p.id.length <= 64 && typeof p.image === 'string' && p.image !== '' && isSafeImage(p.image))
      .slice(0, PHOTOS_MAX)
      .map((p): LocationPhoto => ({ id: p.id as string, image: p.image as string, caption: typeof p.caption === 'string' ? p.caption.slice(0, SHORT) : '' }))
  }
  return l
}

/** The locations as the file brings them; nothing when there are none. */
export function cleanLocations(raw: unknown): Record<string, LocationSheet> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, LocationSheet> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 2000)) {
    const key = k.trim().slice(0, SHORT)
    if (!key || !v || typeof v !== 'object' || Array.isArray(v)) continue
    const l = cleanSheet(v as Record<string, unknown>)
    if (!isEmpty(l)) out[key] = l
  }
  return Object.keys(out).length ? out : undefined
}

/** The locations with `patch` made to the sheet of `key`; a sheet left empty is dropped. */
export function setLocation(all: Record<string, LocationSheet>, key: string, patch: Partial<LocationSheet>): Record<string, LocationSheet> {
  const next = { ...(all[key] ?? emptyLocation()), ...patch }
  if (!next.permit) delete next.permit
  const out = { ...all }
  if (isEmpty(next)) delete out[key]
  else out[key] = next
  return out
}

/** The locations of the script, in the order they first appear, then those only the list still has. */
export function locationKeys(scenes: SceneInfo[], all: Record<string, LocationSheet>): { key: string; scenes: SceneInfo[]; gone: boolean }[] {
  const out = new Map<string, SceneInfo[]>()
  for (const s of scenes) {
    const k = locationKey(s)
    out.set(k, [...(out.get(k) ?? []), s])
  }
  const list = [...out.entries()].map(([key, sc]) => ({ key, scenes: sc, gone: false }))
  for (const key of Object.keys(all)) if (!out.has(key)) list.push({ key, scenes: [], gone: true })
  return list
}

/** "Exportar PDF" of the Locações tab: each location with its scenes, address, who to call and whether it is allowed. */
export function locationsReport(scenes: SceneInfo[], all: Record<string, LocationSheet>): Report {
  const dash = (s: string): string => s.trim() || '—'
  return {
    id: 'locacoes',
    title: 'Locações',
    columns: ['Locação', 'Cenas', 'Endereço', 'Responsável', 'Telefone', 'Autorização', 'Custo'],
    rows: locationKeys(scenes, all).map(({ key, scenes: sc }) => {
      const l = all[key] ?? emptyLocation()
      return [key, sc.map((s) => s.number).join(', ') || '—', dash(l.address), dash(l.contact), dash(l.phone), l.permit ? PERMITS[l.permit] : '—', dash(l.cost)]
    })
  }
}

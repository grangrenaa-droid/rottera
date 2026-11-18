import type { Person, Production } from './types'
import type { SceneInfo } from './production'
import type { Report } from './reports'
import { characterKey } from './characters'
import { isSafeImage } from './storyboard'
import { isDate, shortDate } from './sun'

export const GROUPS: Record<Person['group'], string> = { cast: 'Elenco', extra: 'Figuração', crew: 'Equipe' }
export const CONTRACTS: Record<NonNullable<Person['contract']>, string> = {
  negotiating: 'Em negociação',
  sent: 'Proposta enviada',
  signed: 'Assinado',
  refused: 'Recusado'
}
type TextKey = 'phone' | 'email' | 'height' | 'size' | 'shoe' | 'chest' | 'waist' | 'hips'
/** The contacts and the measurements for wardrobe, as the form shows them. */
export const CONTACT_FIELDS: { key: TextKey; label: string; hint: string; type?: string }[] = [
  { key: 'phone', label: 'Telefone', hint: '(81) 99999-0000', type: 'tel' },
  { key: 'email', label: 'E-mail', hint: 'nome@exemplo.com', type: 'email' }
]
export const MEASURE_FIELDS: { key: TextKey; label: string; hint: string }[] = [
  { key: 'height', label: 'Altura', hint: '1,70 m' },
  { key: 'size', label: 'Manequim', hint: 'P, M, 40…' },
  { key: 'shoe', label: 'Calçado', hint: '38' },
  { key: 'chest', label: 'Tórax / busto', hint: '92 cm' },
  { key: 'waist', label: 'Cintura', hint: '74 cm' },
  { key: 'hips', label: 'Quadril', hint: '98 cm' }
]

export function emptyPerson(group: Person['group'] = 'cast'): Person {
  return { id: '', name: '', group, character: '', role: '', photo: '', phone: '', email: '', height: '', size: '', shoe: '', chest: '', waist: '', hips: '', unavailable: [], notes: '' }
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** The people as the file brings them; nothing when there are none. */
export function cleanPeople(raw: unknown): Person[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Person[] = []
  for (const x of raw.slice(0, 2000)) {
    if (!x || typeof x !== 'object') continue
    const r = x as Record<string, unknown>
    if (typeof r.id !== 'string' || !r.id || r.id.length > 64) continue
    const p = emptyPerson()
    p.id = r.id
    p.name = text(r.name, 120)
    p.group = r.group === 'cast' || r.group === 'extra' || r.group === 'crew' ? r.group : 'crew'
    p.character = text(r.character, 120)
    p.role = text(r.role, 120)
    p.photo = typeof r.photo === 'string' && isSafeImage(r.photo) ? r.photo : ''
    for (const f of [...CONTACT_FIELDS, ...MEASURE_FIELDS]) p[f.key] = text(r[f.key], 120)
    if (typeof r.contract === 'string' && r.contract in CONTRACTS) p.contract = r.contract as Person['contract']
    p.unavailable = Array.isArray(r.unavailable) ? [...new Set(r.unavailable.filter(isDate))].sort().slice(0, 400) : []
    p.notes = text(r.notes, 2000)
    out.push(p)
  }
  return out.length ? out : undefined
}

/** The person playing a character ("MARINA (CONT.)" is MARINA). */
export function whoPlays(people: Person[], character: string): Person | undefined {
  const k = characterKey(character)
  return people.find((p) => p.group === 'cast' && p.character && characterKey(p.character) === k)
}

/** The scenes shot on a day an actor of theirs cannot come, by day: "Ana Souza (MARINA) não pode em 21/11/2026 · cena 1". */
export function scheduleConflicts(people: Person[], production: Production, scenes: SceneInfo[]): { dayId: string; text: string }[] {
  const out: { dayId: string; text: string }[] = []
  for (const d of production.days) {
    if (!d.date) continue
    for (const p of people) {
      if (p.group !== 'cast' || !p.character || !p.unavailable.includes(d.date)) continue
      const k = characterKey(p.character)
      const hit = d.scenes.map((id) => scenes.find((s) => s.id === id)).filter((s): s is SceneInfo => !!s && s.cast.some((c) => characterKey(c) === k))
      if (hit.length) out.push({ dayId: d.id, text: `${p.name || 'Sem nome'} (${k}) não pode em ${shortDate(d.date)} · ${hit.length === 1 ? 'cena' : 'cenas'} ${hit.map((s) => s.number).join(', ')}` })
    }
  }
  return out
}

/** The list of people to print: contacts, contract and the measurements for wardrobe. */
export function peopleReport(people: Person[]): Report {
  const dash = (s: string): string => s.trim() || '—'
  return {
    id: 'elenco',
    title: 'Elenco e equipe',
    columns: ['Nome', 'Grupo', 'Personagem ou função', 'Telefone', 'E-mail', 'Contrato', 'Altura', 'Manequim', 'Calçado'],
    rows: people.map((p) => [
      dash(p.name),
      GROUPS[p.group],
      dash(p.group === 'cast' ? p.character || p.role : p.role),
      dash(p.phone),
      dash(p.email),
      p.contract ? CONTRACTS[p.contract] : '—',
      dash(p.height),
      dash(p.size),
      dash(p.shoe)
    ])
  }
}


import type { RevisionState } from './types'

/** Revision sets, in the usual production order. `id` is stored in the script file. */
export const REVISIONS: { id: string; label: string }[] = [
  { id: 'azul', label: 'Azul' },
  { id: 'rosa', label: 'Rosa' },
  { id: 'amarela', label: 'Amarela' },
  { id: 'verde', label: 'Verde' },
  { id: 'dourada', label: 'Dourada' },
  { id: 'bege', label: 'Bege' },
  { id: 'salmao', label: 'Salmão' },
  { id: 'cereja', label: 'Cereja' }
]

export function revisionLabel(id: string): string {
  return REVISIONS.find((r) => r.id === id)?.label ?? id
}

/** A round of changes starts when the mode is on with a set that has no date yet: the set gets today's date. */
export function startRevision(state: RevisionState, today: string): RevisionState {
  if (!state.mode || state.dates?.[state.color]) return state
  return { ...state, dates: { ...state.dates, [state.color]: today } }
}

/** Of the sets changed on a page, the one later in the production order (the page is printed in its colour). */
export function latestRevision(ids: Iterable<string>): string | null {
  let best: string | null = null
  for (const id of ids) {
    if (best === null || REVISIONS.findIndex((r) => r.id === id) > REVISIONS.findIndex((r) => r.id === best)) best = id
  }
  return best
}

/** The heading of a changed page, as in a production script: "REVISÃO ROSA · 12/11/2026". */
export function revisionHeading(id: string, dates?: Record<string, string>): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dates?.[id] ?? '')
  return `REVISÃO ${revisionLabel(id).toUpperCase()}${m ? ` · ${m[3]}/${m[2]}/${m[1]}` : ''}`
}

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

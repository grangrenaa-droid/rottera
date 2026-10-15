const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const two = (n: number): string => String(n).padStart(2, '0')

/** When a recent script was opened, the way a person says it: "hoje às 19:31", "ontem às 08:02", "sábado às 09:00", "em 07/10/2026". */
export function whenOpened(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const day = (x: Date): number => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86400000
  const ago = day(now) - day(d)
  const time = `${two(d.getHours())}:${two(d.getMinutes())}`
  if (ago === 0) return `hoje às ${time}`
  if (ago === 1) return `ontem às ${time}`
  if (ago > 1 && ago < 7) return `${WEEKDAYS[d.getDay()]} às ${time}`
  return `em ${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** The name of the folder a file is in. */
export function folderOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 2] : ''
}

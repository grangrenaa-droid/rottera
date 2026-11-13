import { useId, useState } from 'react'
import type { Place } from '../shared/types'
import { BR_CITIES, findCity, parseCoords } from '../shared/cities'

const ZONES: [number, string][] = [
  [-2, 'UTC−2 (Fernando de Noronha)'],
  [-3, 'UTC−3 (Brasília)'],
  [-4, 'UTC−4 (AM, MT, MS, RO, RR)'],
  [-5, 'UTC−5 (Acre)']
]
const zoneLabel = (tz: number): string => ZONES.find((z) => z[0] === tz)?.[1] ?? `UTC${tz >= 0 ? '+' : '−'}${Math.abs(tz)}`

/** Where the sun is computed: a city of the list, or coordinates typed or pasted from a map link, with the time zone. */
export function PlacePicker(p: { label: string; value: Place | undefined; onChange(place: Place | undefined): void }): JSX.Element {
  const id = useId()
  const [city, setCity] = useState(p.value && findCity(p.value.name) ? p.value.name : '')
  const [coords, setCoords] = useState('')
  const [bad, setBad] = useState(false)
  const v = p.value
  const tz = v?.tz ?? -3

  const pickCity = (text: string): void => {
    setCity(text)
    const c = findCity(text)
    if (c) {
      setBad(false)
      p.onChange(c)
    }
  }
  const useCoords = (): void => {
    if (!coords.trim()) return
    const c = parseCoords(coords)
    setBad(!c)
    if (!c) return
    setCity('')
    p.onChange({ name: `${c.lat}, ${c.lon}`, lat: c.lat, lon: c.lon, tz })
  }

  return (
    <div className="place-picker" role="group" aria-label={p.label}>
      <label htmlFor={`${id}-city`}>Cidade</label>
      <input id={`${id}-city`} list={`${id}-cities`} value={city} placeholder="Comece a escrever: Recife, Paraty…" onChange={(e) => pickCity(e.target.value)} />
      <datalist id={`${id}-cities`}>
        {BR_CITIES.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>
      <label htmlFor={`${id}-coords`}>Ou coordenadas / link do mapa</label>
      <input
        id={`${id}-coords`}
        value={coords}
        placeholder="-23.5505, -46.6333 ou um link do Google Maps"
        aria-invalid={bad}
        onChange={(e) => setCoords(e.target.value)}
        onBlur={useCoords}
        onKeyDown={(e) => e.key === 'Enter' && useCoords()}
      />
      {bad && (
        <p className="place-bad" role="alert">
          Não achei coordenadas nisso. Escreva “latitude, longitude” ou cole um link com “@-23.5,-46.6”.
        </p>
      )}
      <label htmlFor={`${id}-tz`}>Fuso</label>
      <select id={`${id}-tz`} value={tz} disabled={!v} onChange={(e) => v && p.onChange({ ...v, tz: Number(e.target.value) })}>
        {ZONES.some((z) => z[0] === tz) ? null : <option value={tz}>{zoneLabel(tz)}</option>}
        {ZONES.map(([z, label]) => (
          <option key={z} value={z}>
            {label}
          </option>
        ))}
      </select>
      <p className="place-now" aria-live="polite">
        {v ? `${v.name || 'Sem nome'} · ${v.lat.toFixed(3)}, ${v.lon.toFixed(3)} · ${zoneLabel(v.tz)}` : 'Nenhum lugar escolhido.'}
        {v && (
          <button
            className="link"
            onClick={() => {
              setCity('')
              setCoords('')
              p.onChange(undefined)
            }}
          >
            Limpar
          </button>
        )}
      </p>
    </div>
  )
}

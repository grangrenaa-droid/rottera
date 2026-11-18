import { useState } from 'react'
import type { LocationSheet } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import type { Report } from '../shared/reports'
import { reportToCsv } from '../shared/reports'
import { PERMITS, locationKeys, locationsReport, setLocation } from '../shared/locations'
import { LocationForm } from './LocationForm'

interface Props {
  scenes: SceneInfo[]
  locations: Record<string, LocationSheet>
  onChange(l: Record<string, LocationSheet>): void
  onExportPdf(r: Report, landscape: boolean): void
  onExportCsv(name: string, csv: string): void
  flash(text: string): void
}

/** Every location of the script with its technical sheet and scouting photos. */
export function LocationsView(p: Props): JSX.Element {
  const list = locationKeys(p.scenes, p.locations)
  const [sel, setSel] = useState<string | null>(null)
  const current = list.find((x) => x.key === sel) ?? list[0] ?? null
  const report = (): Report => locationsReport(p.scenes, p.locations)

  return (
    <div className="snd-sheets loc-view">
      <nav aria-label="Locações do roteiro" className="prod-scenes">
        <ol>
          {list.map((x) => {
            const l = p.locations[x.key]
            return (
              <li key={x.key}>
                <button className={x === current ? 'on' : ''} aria-current={x === current} onClick={() => setSel(x.key)}>
                  <b>{x.scenes.length || '—'}</b>
                  <span className="scene-text">{x.key}</span>
                  <small>
                    {x.gone ? 'não está mais no roteiro' : `${x.scenes.length} ${x.scenes.length === 1 ? 'cena' : 'cenas'}`}
                    {l?.permit ? ` · ${PERMITS[l.permit]}` : ''}
                    {l?.photos.length ? ` · ${l.photos.length} ${l.photos.length === 1 ? 'foto' : 'fotos'}` : ''}
                  </small>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      {current ? (
        <section className="snd-sheet" aria-labelledby="loc-title">
          <header className="snd-sheet-head">
            <h2 id="loc-title">{current.key}</h2>
            <div className="row">
              <button className="btn secondary" onClick={() => p.onExportPdf(report(), true)}>
                Exportar PDF
              </button>
              <button className="btn secondary" onClick={() => p.onExportCsv('Locações', reportToCsv(report()))}>
                Exportar CSV
              </button>
            </div>
          </header>
          {current.scenes.length > 0 && (
            <p className="muted small">
              Cenas: {current.scenes.map((s) => `${s.number} (${s.intExt} ${s.night ? 'noite' : 'dia'})`).join(', ')}
            </p>
          )}
          <LocationForm
            name={current.key}
            sheet={p.locations[current.key]}
            idPrefix="loc"
            flash={p.flash}
            onChange={(patch) => p.onChange(setLocation(p.locations, current.key, patch))}
          />
        </section>
      ) : (
        <p className="muted">Ainda não há locações.</p>
      )}
    </div>
  )
}

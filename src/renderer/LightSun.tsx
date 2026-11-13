import type { Lighting, Place, Production } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import { dayLabel, updateDay } from '../shared/production'
import type { Report } from '../shared/reports'
import { dayWarnings, daySun, sunReport } from '../shared/lighting'
import { PlacePicker } from './PlacePicker'

interface Props {
  lighting: Lighting
  production: Production
  scenes: SceneInfo[]
  onLighting(l: Lighting): void
  onProduction(p: Production): void
  onExportPdf(r: Report, landscape: boolean): void
}

const span = (r: [string, string]): string => (r[0] && r[1] ? `${r[0]}–${r[1]}` : '—')

/** The sun of each shooting day where it is shot, and the scenes whose light does not fit the time they are shot at. */
export function LightSunView(p: Props): JSX.Element {
  const setPlace = (place: Place | undefined): void => {
    const next = { ...p.lighting }
    if (place) next.place = place
    else delete next.place
    p.onLighting(next)
  }
  const days = p.production.days
  const warnings = days.flatMap((d, n) => dayWarnings(d, p.scenes, p.lighting).map((w) => ({ ...w, day: dayLabel(d, n), id: `${d.id}-${w.scene.id}` })))

  return (
    <div className="light-sun">
      <header className="snd-sheet-head">
        <p className="muted">
          Nascer e pôr do sol, golden hour (sol entre 6° acima e 4° abaixo do horizonte) e blue hour (de 4° a 6° abaixo), calculados sem internet para a data e o lugar de cada dia.
        </p>
        <button className="btn secondary" disabled={days.length === 0} onClick={() => p.onExportPdf(sunReport(p.scenes, p.lighting, p.production), true)}>
          Exportar PDF
        </button>
      </header>

      <section className="light-place" aria-labelledby="light-place-title">
        <h2 id="light-place-title">Lugar do filme</h2>
        <PlacePicker label="Lugar do filme" value={p.lighting.place} onChange={setPlace} />
      </section>

      <section aria-labelledby="light-days-title">
        <h2 id="light-days-title">Dias de filmagem</h2>
        {days.length === 0 ? (
          <p className="muted">Ainda não há dias de filmagem. Crie os dias em Filmagem → Plano de filmagem.</p>
        ) : (
          <div className="light-days-wrap">
            <table className="equipment-table light-days">
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col">Data</th>
                  <th scope="col">Lugar</th>
                  <th scope="col">Blue hour (manhã)</th>
                  <th scope="col">Nascer do sol</th>
                  <th scope="col">Golden hour (manhã)</th>
                  <th scope="col">Golden hour (tarde)</th>
                  <th scope="col">Pôr do sol</th>
                  <th scope="col">Blue hour (tarde)</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, n) => {
                  const label = dayLabel(d, n)
                  const { place, sun } = daySun(d, p.lighting)
                  return (
                    <tr key={d.id}>
                      <th scope="row">{label}</th>
                      <td>
                        <input type="date" aria-label={`Data do ${label}`} value={d.date ?? ''} onChange={(e) => p.onProduction(updateDay(p.production, d.id, { date: e.target.value || undefined }))} />
                      </td>
                      <td className="light-day-place">
                        <details>
                          <summary>{d.place ? d.place.name || 'lugar próprio' : place ? `${place.name} (do filme)` : 'sem lugar'}</summary>
                          <PlacePicker label={`Lugar do ${label}`} value={d.place} onChange={(pl) => p.onProduction(updateDay(p.production, d.id, { place: pl }))} />
                          <p className="muted small">Sem lugar próprio, o dia usa o lugar do filme.</p>
                        </details>
                      </td>
                      {sun ? (
                        <>
                          <td>{span(sun.blueMorning)}</td>
                          <td>{sun.sunrise || '—'}</td>
                          <td>{span(sun.goldenMorning)}</td>
                          <td>{span(sun.goldenEvening)}</td>
                          <td>{sun.sunset || '—'}</td>
                          <td>{span(sun.blueEvening)}</td>
                        </>
                      ) : (
                        <td colSpan={6} className="muted">
                          {!d.date ? 'Dê uma data ao dia.' : 'Escolha o lugar do filme ou do dia.'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="light-warn-title">
        <h2 id="light-warn-title">Avisos</h2>
        <p className="muted small">
          Usam o horário de cada cena no Plano de filmagem. Valem para as cenas externas e para as internas cuja ficha de luz diz que a luz vem do Sol ou da Janela.
        </p>
        {warnings.length === 0 ? (
          <p className="muted">Nenhum aviso.</p>
        ) : (
          <ul className="light-warnings">
            {warnings.map((w) => (
              <li key={w.id}>
                <b>
                  {w.day} · Cena {w.scene.number} · {w.scene.heading}
                </b>
                <span>{w.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

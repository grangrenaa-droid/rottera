import { useRef, useState } from 'react'
import type { Person } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import type { Report } from '../shared/reports'
import { reportToCsv } from '../shared/reports'
import { CONTACT_FIELDS, CONTRACTS, GROUPS, MEASURE_FIELDS, emptyPerson, peopleReport } from '../shared/people'
import { characterKey } from '../shared/characters'
import { shortDate } from '../shared/sun'
import { newId } from '../shared/structures'
import { fileToDataUrl } from './Storyboard'

interface Props {
  scenes: SceneInfo[]
  people: Person[]
  onChange(people: Person[]): void
  onExportPdf(r: Report, landscape: boolean): void
  onExportCsv(name: string, csv: string): void
  flash(text: string): void
}

/** Cast, extras and crew: photo, who they play or what they do, contacts, measurements, contract, days they cannot come. */
export function PeopleView(p: Props): JSX.Element {
  const [sel, setSel] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const current = p.people.find((x) => x.id === sel) ?? p.people[0] ?? null
  const characters = [...new Set(p.scenes.flatMap((s) => s.cast.map(characterKey)))]
  const report = (): Report => peopleReport(p.people)

  const put = (patch: Partial<Person>): void => {
    if (!current) return
    const next = { ...current, ...patch }
    if (!next.contract) delete next.contract
    p.onChange(p.people.map((x) => (x.id === current.id ? next : x)))
  }
  const add = (): void => {
    const person = { ...emptyPerson('cast'), id: newId('pessoa') }
    p.onChange([...p.people, person])
    setSel(person.id)
  }
  const remove = (): void => {
    if (!current) return
    if (current.name.trim() && !window.confirm(`Apagar ${current.name} da lista?`)) return
    p.onChange(p.people.filter((x) => x.id !== current.id))
    setSel(null)
  }
  const label = current?.name.trim() || 'pessoa sem nome'

  return (
    <div className="snd-sheets people-view">
      <nav aria-label="Pessoas do filme" className="prod-scenes">
        {(Object.keys(GROUPS) as Person['group'][]).map((g) => {
          const list = p.people.filter((x) => x.group === g)
          if (!list.length) return null
          return (
            <section key={g}>
              <h3 className="people-group">{GROUPS[g]}</h3>
              <ol>
                {list.map((x) => (
                  <li key={x.id}>
                    <button className={x === current ? 'on' : ''} aria-current={x === current} onClick={() => setSel(x.id)}>
                      <b>{x.photo ? <img src={x.photo} alt="" className="people-thumb" /> : '·'}</b>
                      <span className="scene-text">{x.name.trim() || 'Sem nome'}</span>
                      <small>
                        {g === 'cast' ? x.character || 'sem personagem' : x.role || '—'}
                        {x.contract ? ` · ${CONTRACTS[x.contract]}` : ''}
                      </small>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
        {p.people.length === 0 && <p className="muted">Ninguém na lista ainda.</p>}
        <button className="btn secondary" onClick={add}>
          + Pessoa
        </button>
      </nav>

      {current ? (
        <section className="snd-sheet people-form" aria-label={`Ficha de ${label}`}>
          <header className="snd-sheet-head">
            <h2>{current.name.trim() || 'Sem nome'}</h2>
            <div className="row">
              <button className="btn secondary" onClick={() => p.onExportPdf(report(), true)}>
                Exportar PDF
              </button>
              <button className="btn secondary" onClick={() => p.onExportCsv('Elenco e equipe', reportToCsv(report()))}>
                Exportar CSV
              </button>
            </div>
          </header>

          <div className="people-top">
            <div className="people-photo">
              {current.photo ? <img src={current.photo} alt={`Foto de ${label}`} /> : <span className="muted">Sem foto</span>}
              <input
                ref={picker}
                type="file"
                accept="image/*"
                hidden
                aria-label={`Escolher foto de ${label}`}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    put({ photo: await fileToDataUrl(f, 900) })
                  } catch (err) {
                    p.flash(err instanceof Error ? err.message : 'Não consegui ler a imagem.')
                  }
                }}
              />
              <div className="row">
                <button className="btn secondary small" onClick={() => picker.current?.click()}>
                  {current.photo ? 'Trocar foto' : 'Escolher foto'}
                </button>
                {current.photo && (
                  <button className="btn ghost small" onClick={() => put({ photo: '' })}>
                    Remover foto
                  </button>
                )}
              </div>
            </div>
            <div className="people-main">
              <label htmlFor="pp-name">Nome</label>
              <input id="pp-name" maxLength={120} value={current.name} onChange={(e) => put({ name: e.target.value })} />
              <fieldset>
                <legend>Grupo</legend>
                <div className="snd-choices">
                  {(Object.keys(GROUPS) as Person['group'][]).map((g) => (
                    <label key={g} className="check">
                      <input type="radio" name="pp-group" checked={current.group === g} onChange={() => put({ group: g })} />
                      {GROUPS[g]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {current.group === 'cast' && (
                <>
                  <label htmlFor="pp-char">Personagem</label>
                  <select id="pp-char" value={current.character} onChange={(e) => put({ character: e.target.value })}>
                    <option value="">Nenhum</option>
                    {[...new Set([...characters, ...(current.character ? [current.character] : [])])].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label htmlFor="pp-role">{current.group === 'cast' ? 'Observação do papel' : 'Função'}</label>
              <input id="pp-role" maxLength={120} placeholder={current.group === 'crew' ? 'Ex.: Diretor de fotografia' : ''} value={current.role} onChange={(e) => put({ role: e.target.value })} />
            </div>
          </div>

          <fieldset>
            <legend>Contato</legend>
            <div className="people-grid">
              {CONTACT_FIELDS.map((f) => (
                <div key={f.key} className="loc-field">
                  <label htmlFor={`pp-${f.key}`}>{f.label}</label>
                  <input id={`pp-${f.key}`} type={f.type} maxLength={120} placeholder={f.hint} value={current[f.key]} onChange={(e) => put({ [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Medidas para o figurino</legend>
            <div className="people-grid">
              {MEASURE_FIELDS.map((f) => (
                <div key={f.key} className="loc-field">
                  <label htmlFor={`pp-${f.key}`}>{f.label}</label>
                  <input id={`pp-${f.key}`} maxLength={120} placeholder={f.hint} value={current[f.key]} onChange={(e) => put({ [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Contrato</legend>
            <div className="snd-choices">
              {(Object.keys(CONTRACTS) as NonNullable<Person['contract']>[]).map((c) => (
                <label key={c} className="check">
                  <input type="radio" name="pp-contract" checked={current.contract === c} onChange={() => put({ contract: c })} />
                  {CONTRACTS[c]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Dias em que não pode</legend>
            {current.unavailable.length === 0 && <p className="muted small">Nenhum. O Plano de filmagem avisa quando uma cena do personagem cair num desses dias.</p>}
            <ul className="people-dates">
              {current.unavailable.map((d, i) => (
                <li key={`${d}-${i}`}>
                  <input
                    type="date"
                    aria-label={`Data em que não pode ${i + 1}`}
                    value={d}
                    onChange={(e) => put({ unavailable: current.unavailable.map((x, j) => (j === i ? e.target.value : x)).filter(Boolean) })}
                  />
                  <span className="muted small">{d ? shortDate(d) : ''}</span>
                  <button className="icon" aria-label={`Tirar a data ${i + 1}`} onClick={() => put({ unavailable: current.unavailable.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn ghost small" onClick={() => put({ unavailable: [...current.unavailable, new Date().toISOString().slice(0, 10)] })}>
              + Data
            </button>
          </fieldset>

          <label htmlFor="pp-notes">Observações</label>
          <textarea id="pp-notes" rows={2} maxLength={2000} value={current.notes} onChange={(e) => put({ notes: e.target.value })} />

          <button className="btn ghost small" onClick={remove}>
            Apagar da lista
          </button>
        </section>
      ) : (
        <p className="muted">Acrescente o elenco, a figuração e a equipe em “+ Pessoa”.</p>
      )}
    </div>
  )
}

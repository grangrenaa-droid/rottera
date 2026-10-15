import { useEffect, useMemo, useState } from 'react'
import type { CharacterSheet, Script } from '../shared/types'
import { CharactersView } from './Characters'
import { buildReports, reportToCsv } from '../shared/reports'

interface Props {
  script: Script
  onExport(name: string, csv: string): void
  onCharacters(sheets: CharacterSheet[]): void
  onExportCharacters(): void
  onExportPdf(report: { title: string; columns: string[]; rows: (string | number)[][] }, landscape: boolean): void
  flash(text: string): void
}

const CHARACTERS_ID = '__characters'

export function ReportsView({ script, onExport, onCharacters, onExportCharacters, onExportPdf, flash }: Props): JSX.Element {
  const reports = useMemo(() => buildReports(script), [script])
  const [id, setId] = useState(reports[0].id)
  const report = reports.find((r) => r.id === id) ?? reports[0]
  const showCharacters = id === CHARACTERS_ID
  // wide tables read better on a landscape page: suggest it, and let the writer decide
  const [landscape, setLandscape] = useState(report.columns.length > 5)
  useEffect(() => {
    setLandscape(report.columns.length > 5)
  }, [report.id, report.columns.length])

  return (
    <div className="reports">
      <nav aria-label="Relatórios">
        <ul>
          <li>
            <button className={showCharacters ? 'on' : ''} aria-current={showCharacters} onClick={() => setId(CHARACTERS_ID)}>
              Fichas de personagem
            </button>
          </li>
          {reports.map((r) => (
            <li key={r.id}>
              <button
                className={!showCharacters && r.id === report.id ? 'on' : ''}
                aria-current={!showCharacters && r.id === report.id}
                onClick={() => setId(r.id)}
              >
                {r.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {showCharacters && (
        <section className="report-body">
          <CharactersView script={script} onChange={onCharacters} onExport={onExportCharacters} flash={flash} />
        </section>
      )}
      <section className="report-body" hidden={showCharacters}>
        <header>
          <h2>{report.title}</h2>
          <div className="row">
            <label htmlFor="report-orientation" className="sr-only">
              Orientação da página
            </label>
            <select id="report-orientation" value={landscape ? 'l' : 'p'} onChange={(e) => setLandscape(e.target.value === 'l')}>
              <option value="p">Retrato</option>
              <option value="l">Paisagem</option>
            </select>
            <button
              className="btn secondary"
              disabled={report.rows.length === 0}
              onClick={() => onExportPdf({ title: report.title, columns: report.columns, rows: report.rows }, landscape)}
            >
              Exportar relatório (PDF)
            </button>
            <button className="btn secondary" onClick={() => onExport(report.title, reportToCsv(report))}>
              Exportar CSV
            </button>
          </div>
        </header>
        {report.rows.length === 0 ? (
          <p className="muted">Sem dados ainda neste relatório.</p>
        ) : (
          <table>
            <thead>
              <tr>
                {report.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

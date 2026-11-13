import { useState } from 'react'
import type { LightMap, Lighting, LightSheet } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import type { Report } from '../shared/reports'
import { LIGHT_EFFECTS, LIGHT_SOURCES, emptyLightSheet, lightSheetRows, lightSheetsReport } from '../shared/lighting'
import { isLight, loadText, mapWatts } from '../shared/lightmap'
import { NumberField } from './LightMap'

interface Props {
  lighting: Lighting
  maps: LightMap[]
  scenes: SceneInfo[]
  /** The scene's id, given to its heading first if it has none. */
  sceneId(s: SceneInfo): string | null
  onChange(l: Lighting): void
  onOpenMap(mapId: string): void
  onExportPdf(r: Report, landscape: boolean): void
}

/** The why of a scene's light. It belongs to the scene (its id), not to the scene's number. */
export function LightSheetView(p: Props): JSX.Element {
  const [sel, setSel] = useState(0)
  if (p.scenes.length === 0) return <p className="muted">Ainda não há cenas no roteiro. Escreva um cabeçalho (INT. ou EXT.) para começar.</p>
  const scene = p.scenes[Math.min(sel, p.scenes.length - 1)]
  const sheet: LightSheet = (scene.id ? p.lighting.sheets[scene.id] : undefined) ?? emptyLightSheet()
  const maps = scene.id ? p.maps.filter((m) => m.sid === scene.id) : []
  const filled = (s: SceneInfo): boolean => !!s.id && lightSheetRows(p.lighting.sheets[s.id]).length > 0

  const put = (patch: Partial<LightSheet>): void => {
    const id = p.sceneId(scene)
    if (!id) return
    const cur = p.lighting.sheets[id] ?? emptyLightSheet()
    const next = { ...cur, ...patch }
    if (next.setupMinutes === undefined) delete next.setupMinutes
    p.onChange({ ...p.lighting, sheets: { ...p.lighting.sheets, [id]: next } })
  }
  const toggle = (key: 'sources' | 'effects', all: string[], v: string, on: boolean): void =>
    put({ [key]: on ? all.filter((x) => x === v || sheet[key].includes(x)) : sheet[key].filter((x) => x !== v) })
  const radios = (name: string, legend: string, value: string | undefined, options: [string, string][], set: (v: string) => void): JSX.Element => (
    <fieldset>
      <legend>{legend}</legend>
      <div className="snd-choices">
        {options.map(([v, label]) => (
          <label key={v} className="check">
            <input type="radio" name={name} checked={value === v} onChange={() => set(v)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
  const text = (key: 'color' | 'story' | 'power' | 'notes', label: string, hint: string, long = true): JSX.Element => (
    <>
      <label className="stack" htmlFor={`light-${key}`}>
        {label}
      </label>
      {long ? (
        <textarea id={`light-${key}`} rows={2} maxLength={2000} placeholder={hint} value={sheet[key]} onChange={(e) => put({ [key]: e.target.value })} />
      ) : (
        <input id={`light-${key}`} maxLength={200} placeholder={hint} value={sheet[key]} onChange={(e) => put({ [key]: e.target.value })} />
      )}
    </>
  )

  return (
    <div className="snd-sheets">
      <nav aria-label="Cenas da ficha de luz" className="prod-scenes">
        <ol>
          {p.scenes.map((s) => (
            <li key={s.index}>
              <button className={s === scene ? 'on' : ''} aria-current={s === scene} onClick={() => setSel(s.n)}>
                <b>{s.number}</b>
                <span className="scene-text">{s.heading || '(cabeçalho vazio)'}</span>
                {filled(s) && <small className="light-mark">com ficha de luz</small>}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <section className="snd-sheet" aria-labelledby="light-sheet-title">
        <header className="snd-sheet-head">
          <h2 id="light-sheet-title">
            Cena {scene.number} · {scene.heading || '(cabeçalho vazio)'}
          </h2>
          <button className="btn secondary" onClick={() => p.onExportPdf(lightSheetsReport(p.scenes, p.lighting), false)}>
            Exportar fichas (PDF)
          </button>
        </header>

        <div className="light-maps">
          <span className="muted small">Mapas de luz desta cena:</span>
          {maps.length === 0 ? (
            <span className="muted small"> nenhum.</span>
          ) : (
            <ul>
              {maps.map((m) => {
                const n = m.items.filter((i) => isLight(i.type)).length
                return (
                  <li key={m.id}>
                    <button className="link" onClick={() => p.onOpenMap(m.id)}>
                      {m.name || 'Sem nome'}
                    </button>{' '}
                    · {n} {n === 1 ? 'luz' : 'luzes'}
                    {mapWatts(m) > 0 ? ` · ${loadText(mapWatts(m))}` : ''}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="light-pair">
          {radios('light-quality', 'Luz', sheet.quality, [['hard', 'Dura'], ['soft', 'Suave']], (v) => put({ quality: v as LightSheet['quality'] }))}
          {radios('light-contrast', 'Contraste', sheet.contrast, [['high', 'Alto'], ['low', 'Baixo']], (v) => put({ contrast: v as LightSheet['contrast'] }))}
        </div>

        <fieldset>
          <legend>Cor</legend>
          {text('color', 'Cor geral da luz', 'Ex.: quente, âmbar; frio azulado', false)}
        </fieldset>

        <fieldset>
          <legend>De onde vem a luz da história</legend>
          <div className="snd-choices">
            {LIGHT_SOURCES.map((s) => (
              <label key={s} className="check">
                <input type="checkbox" checked={sheet.sources.includes(s)} onChange={(e) => toggle('sources', LIGHT_SOURCES, s, e.target.checked)} />
                {s}
              </label>
            ))}
          </div>
          <label className="stack" htmlFor="light-other-source">
            Outra fonte
          </label>
          <input id="light-other-source" maxLength={200} value={sheet.otherSource} onChange={(e) => put({ otherSource: e.target.value })} />
          <p className="muted small">Sol e Janela fazem a cena depender da luz do dia, mesmo sendo interna (Sol e horários avisa).</p>
        </fieldset>

        <fieldset>
          <legend>Horário e continuidade</legend>
          {text('story', 'Horário na história e continuidade', 'Ex.: fim de tarde; continua da cena 4, a luz cai')}
        </fieldset>

        <fieldset>
          <legend>Efeitos</legend>
          <div className="snd-choices">
            {LIGHT_EFFECTS.map((s) => (
              <label key={s} className="check">
                <input type="checkbox" checked={sheet.effects.includes(s)} onChange={(e) => toggle('effects', LIGHT_EFFECTS, s, e.target.checked)} />
                {s}
              </label>
            ))}
          </div>
          <label className="stack" htmlFor="light-other-effect">
            Outro efeito
          </label>
          <input id="light-other-effect" maxLength={200} value={sheet.otherEffect} onChange={(e) => put({ otherEffect: e.target.value })} />
        </fieldset>

        <fieldset>
          <legend>Energia e montagem</legend>
          {text('power', 'Energia e gerador', 'Ex.: gerador de 60 kVA na rua; tomada 220 V na cozinha')}
          <div className="row">
            <label className="inline" htmlFor="light-setup">
              Montagem (min)
            </label>
            <NumberField id="light-setup" value={sheet.setupMinutes} min={1} max={9999} optional onValue={(v) => put({ setupMinutes: v === undefined ? undefined : Math.round(v) })} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Observações</legend>
          {text('notes', 'Observações', '')}
        </fieldset>
      </section>
    </div>
  )
}

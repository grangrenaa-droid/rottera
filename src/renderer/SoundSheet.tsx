import { useState } from 'react'
import type { Capture, LightMap, Sound, SoundSheet } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import type { Report } from '../shared/reports'
import { CAPTURES, RISKS, TEXT_MAX, emptySheet, micLine, micsOfScene, sheetRows, sheetsReport } from '../shared/sound'
import { NumberField } from './LightMap'

interface Props {
  sound: Sound
  maps: LightMap[]
  scenes: SceneInfo[]
  /** The scene's id, given to its heading first if it has none. */
  sceneId(s: SceneInfo): string | null
  onChange(s: Sound): void
  onExportPdf(r: Report, landscape: boolean): void
}

type Voice = 'lapela' | 'vara' | 'ambos'

/** A sound sheet for each scene: it belongs to the scene (its id), not to the scene's number. */
export function SoundSheetView(p: Props): JSX.Element {
  const [sel, setSel] = useState(0)
  if (p.scenes.length === 0) return <p className="muted">Ainda não há cenas no roteiro. Escreva um cabeçalho (INT. ou EXT.) para começar.</p>
  const scene = p.scenes[Math.min(sel, p.scenes.length - 1)]
  const sheet: SoundSheet = (scene.id ? p.sound.sheets[scene.id] : undefined) ?? emptySheet()
  const mics = scene.id ? micsOfScene(p.sound, p.maps, scene.id) : []
  const filled = (s: SceneInfo): boolean => !!s.id && !!p.sound.sheets[s.id] && sheetRows(p.sound.sheets[s.id], [], s.cast).length > 0

  const put = (patch: Partial<SoundSheet>): void => {
    const id = p.sceneId(scene)
    if (!id) return
    const cur = p.sound.sheets[id] ?? emptySheet()
    p.onChange({ ...p.sound, sheets: { ...p.sound.sheets, [id]: { ...cur, ...patch } } })
  }
  const setVoice = (who: string, how: Voice | ''): void => {
    const voices = { ...sheet.voices }
    if (how) voices[who] = how
    else delete voices[who]
    put({ voices })
  }
  const toggleRisk = (r: string, on: boolean): void => put({ risks: on ? RISKS.filter((x) => x === r || sheet.risks.includes(x)) : sheet.risks.filter((x) => x !== r) })
  const text = (key: 'requests' | 'effects' | 'playback' | 'notes', label: string, hint: string): JSX.Element => (
    <>
      <label className="stack" htmlFor={`sheet-${key}`}>
        {label}
      </label>
      <textarea id={`sheet-${key}`} rows={2} maxLength={TEXT_MAX} placeholder={hint} value={sheet[key]} onChange={(e) => put({ [key]: e.target.value })} />
    </>
  )

  return (
    <div className="snd-sheets">
      <nav aria-label="Cenas da ficha de som" className="prod-scenes">
        <ol>
          {p.scenes.map((s) => (
            <li key={s.index}>
              <button className={s === scene ? 'on' : ''} aria-current={s === scene} onClick={() => setSel(s.n)}>
                <b>{s.number}</b>
                <span className="scene-text">{s.heading || '(cabeçalho vazio)'}</span>
                {filled(s) && <small>com ficha de som</small>}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <section className="snd-sheet" aria-labelledby="snd-sheet-title">
        <header className="snd-sheet-head">
          <h2 id="snd-sheet-title">
            Cena {scene.number} · {scene.heading || '(cabeçalho vazio)'}
          </h2>
          <button className="btn secondary" onClick={() => p.onExportPdf(sheetsReport(p.scenes, p.sound, p.maps), false)}>
            Exportar fichas (PDF)
          </button>
        </header>

        <fieldset>
          <legend>Captação</legend>
          <div className="snd-choices">
            {CAPTURES.map((c) => (
              <label key={c.id} className="check">
                <input type="radio" name="snd-capture" checked={sheet.capture === c.id} onChange={() => put({ capture: c.id as Capture })} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Quem fala</legend>
          {scene.cast.length === 0 ? (
            <p className="muted">Ninguém fala nesta cena.</p>
          ) : (
            <ul className="snd-voices">
              {scene.cast.map((who) => (
                <li key={who}>
                  <span>{who}</span>
                  <select aria-label={`Microfone de ${who}`} value={sheet.voices[who] ?? ''} onChange={(e) => setVoice(who, e.target.value as Voice | '')}>
                    <option value="">Nada</option>
                    <option value="lapela">Lapela</option>
                    <option value="vara">Vara</option>
                    <option value="ambos">Os dois</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
          <div className="snd-scene-mics">
            <span className="muted small">Na planta desta cena:</span>
            {mics.length === 0 ? (
              <span className="muted small"> nenhum microfone.</span>
            ) : (
              <ul>
                {mics.map((m) => (
                  <li key={m.mic.id}>{micLine(m.mic, m.actor)}</li>
                ))}
              </ul>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Riscos do local</legend>
          <div className="snd-choices">
            {RISKS.map((r) => (
              <label key={r} className="check">
                <input type="checkbox" checked={sheet.risks.includes(r)} onChange={(e) => toggleRisk(r, e.target.checked)} />
                {r}
              </label>
            ))}
          </div>
          <label className="stack" htmlFor="sheet-other-risk">
            Outros riscos
          </label>
          <input id="sheet-other-risk" maxLength={200} value={sheet.otherRisk} onChange={(e) => put({ otherRisk: e.target.value })} />
        </fieldset>

        <fieldset>
          <legend>No set</legend>
          {text('requests', 'O que pedir no set', 'Ex.: desligar a geladeira, parar o elevador')}
        </fieldset>

        <fieldset>
          <legend>Sons a gravar na cena</legend>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={sheet.roomTone} onChange={(e) => put({ roomTone: e.target.checked })} />
              Room tone
            </label>
            <label className="inline" htmlFor="sheet-roomtone">
              Duração (s)
            </label>
            <NumberField id="sheet-roomtone" value={sheet.roomToneSeconds} min={1} max={3600} disabled={!sheet.roomTone} onValue={(v) => v !== undefined && put({ roomToneSeconds: Math.round(v) })} />
          </div>
          {text('effects', 'Efeitos do próprio set', 'Ex.: porta batendo, passos no corredor')}
        </fieldset>

        <fieldset>
          <legend>Playback</legend>
          {text('playback', 'Qual música ou arquivo, e de onde parte', 'Ex.: "Valsa", da caixa ao lado do piano')}
        </fieldset>

        <fieldset>
          <legend>Observações</legend>
          {text('notes', 'Observações', '')}
        </fieldset>
      </section>
    </div>
  )
}

import type { Ambience, Song, Sound } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import { locationKey } from '../shared/production'
import type { Report } from '../shared/reports'
import { reportToCsv } from '../shared/reports'
import { SONG_KIND, SONG_RIGHTS, TEXT_MAX, ambiencesReport, musicReport } from '../shared/sound'
import { newId } from '../shared/structures'

interface Props {
  sound: Sound
  scenes: SceneInfo[]
  /** The scene's id, given to its heading first if it has none. */
  sceneId(s: SceneInfo): string | null
  onChange(s: Sound): void
  onExportPdf(r: Report, landscape: boolean): void
  onExportCsv(name: string, csv: string): void
}

/** What to record at each location besides the dialogue, and the music of the film. */
export function AmbiencesView(p: Props): JSX.Element {
  // the locations of the script, in order of first appearance; then those only the list still has
  const fromScript = [...new Set(p.scenes.map(locationKey))]
  const locations = [...fromScript, ...[...new Set(p.sound.ambiences.map((a) => a.location))].filter((l) => !fromScript.includes(l))]

  const setAmb = (list: Ambience[]): void => p.onChange({ ...p.sound, ambiences: list })
  const patchAmb = (id: string, patch: Partial<Ambience>): void => setAmb(p.sound.ambiences.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const addAmb = (location: string): void => setAmb([...p.sound.ambiences, { id: newId('amb'), location, what: '', duration: '', notes: '', recorded: false }])
  const setMusic = (list: Song[]): void => p.onChange({ ...p.sound, music: list })
  const patchSong = (id: string, patch: Partial<Song>): void => setMusic(p.sound.music.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const addSong = (): void =>
    setMusic([...p.sound.music, { id: newId('mus'), title: '', author: '', scenes: [], kind: 'diegetic', duration: '', rights: 'pending', notes: '' }])
  const toggleScene = (song: Song, s: SceneInfo, on: boolean): void => {
    const id = p.sceneId(s)
    if (!id) return
    patchSong(song.id, { scenes: on ? [...song.scenes.filter((x) => x !== id), id] : song.scenes.filter((x) => x !== id) })
  }

  const exportPdf = (): void => {
    const a = ambiencesReport(p.sound)
    const m = musicReport(p.scenes, p.sound)
    p.onExportPdf(
      {
        id: 'ambientes-musicas',
        title: 'Ambientes e músicas',
        columns: [],
        rows: [],
        printed: { columns: [], sections: [], tables: [a, m].map((r) => ({ title: r.title, columns: r.columns, rows: r.rows })) }
      },
      true
    )
  }

  return (
    <div className="snd-library">
      <header className="snd-sheet-head">
        <p className="muted">As locações vêm dos cabeçalhos do roteiro. As músicas seguem as cenas mesmo quando elas mudam de número.</p>
        <div className="row">
          <button className="btn secondary" onClick={exportPdf}>
            Exportar PDF
          </button>
          <button className="btn secondary" onClick={() => p.onExportCsv('Músicas', reportToCsv(musicReport(p.scenes, p.sound)))}>
            Músicas (CSV)
          </button>
        </div>
      </header>

      <section aria-labelledby="snd-amb-title">
        <h2 id="snd-amb-title">Ambientes e sons-guia, por locação</h2>
        {locations.length === 0 && <p className="muted">Ainda não há cenas no roteiro.</p>}
        {locations.map((loc) => {
          const items = p.sound.ambiences.filter((a) => a.location === loc)
          const gone = !fromScript.includes(loc)
          return (
            <section key={loc} className="snd-loc" aria-label={`Locação ${loc}`}>
              <h3>
                {loc}
                {gone && <span className="muted small"> · não está mais no roteiro</span>}
              </h3>
              {items.length > 0 && (
                <table className="equipment-table">
                  <thead>
                    <tr>
                      <th scope="col">O que gravar</th>
                      <th scope="col">Duração</th>
                      <th scope="col">Observações</th>
                      <th scope="col">Gravado</th>
                      <th scope="col">
                        <span className="sr-only">Apagar</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a, n) => {
                      const name = a.what.trim() || `ambiente ${n + 1} de ${loc}`
                      return (
                        <tr key={a.id}>
                          <td>
                            <input value={a.what} maxLength={200} placeholder="Ex.: room tone, ruído do projetor" aria-label={`O que gravar em ${loc}${n ? ` (${n + 1})` : ''}`} onChange={(e) => patchAmb(a.id, { what: e.target.value })} />
                          </td>
                          <td>
                            <input value={a.duration} maxLength={40} placeholder="Ex.: 1 min" aria-label={`Duração de ${name}`} onChange={(e) => patchAmb(a.id, { duration: e.target.value })} />
                          </td>
                          <td>
                            <input value={a.notes} maxLength={TEXT_MAX} aria-label={`Observações de ${name}`} onChange={(e) => patchAmb(a.id, { notes: e.target.value })} />
                          </td>
                          <td className="eq-check">
                            <input type="checkbox" checked={a.recorded} aria-label={`${name} gravado`} onChange={(e) => patchAmb(a.id, { recorded: e.target.checked })} />
                          </td>
                          <td>
                            <button className="icon" aria-label={`Apagar ${name}`} onClick={() => setAmb(p.sound.ambiences.filter((x) => x.id !== a.id))}>
                              ×
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              <button className="btn ghost" onClick={() => addAmb(loc)}>
                + Ambiente em {loc}
              </button>
            </section>
          )
        })}
      </section>

      <section aria-labelledby="snd-music-title">
        <h2 id="snd-music-title">Músicas</h2>
        {p.sound.music.length === 0 && <p className="muted">Nenhuma música ainda.</p>}
        <ul className="snd-songs">
          {p.sound.music.map((m, n) => {
            const name = m.title.trim() || `música ${n + 1}`
            const chosen = p.scenes.filter((s) => s.id && m.scenes.includes(s.id))
            return (
              <li key={m.id} className="snd-song" aria-label={`Música ${name}`}>
                <div className="snd-song-row">
                  <label>
                    Título
                    <input value={m.title} maxLength={200} onChange={(e) => patchSong(m.id, { title: e.target.value })} />
                  </label>
                  <label>
                    Artista ou autor
                    <input value={m.author} maxLength={200} onChange={(e) => patchSong(m.id, { author: e.target.value })} />
                  </label>
                  <label>
                    Tipo
                    <select value={m.kind} onChange={(e) => patchSong(m.id, { kind: e.target.value as Song['kind'] })}>
                      {(Object.keys(SONG_KIND) as Song['kind'][]).map((k) => (
                        <option key={k} value={k}>
                          {SONG_KIND[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Duração
                    <input value={m.duration} maxLength={8} placeholder="mm:ss" onChange={(e) => patchSong(m.id, { duration: e.target.value })} />
                  </label>
                  <label>
                    Direitos
                    <select value={m.rights} onChange={(e) => patchSong(m.id, { rights: e.target.value as Song['rights'] })}>
                      {(Object.keys(SONG_RIGHTS) as Song['rights'][]).map((k) => (
                        <option key={k} value={k}>
                          {SONG_RIGHTS[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="icon" aria-label={`Apagar ${name}`} onClick={() => setMusic(p.sound.music.filter((x) => x.id !== m.id))}>
                    ×
                  </button>
                </div>
                <details className="snd-song-scenes">
                  <summary>Cenas: {chosen.length ? chosen.map((s) => s.number).join(', ') : 'nenhuma'}</summary>
                  <div className="snd-choices">
                    {p.scenes.map((s) => (
                      <label key={s.index} className="check">
                        <input type="checkbox" checked={!!s.id && m.scenes.includes(s.id)} onChange={(e) => toggleScene(m, s, e.target.checked)} />
                        {s.number} · {s.heading || '(cabeçalho vazio)'}
                      </label>
                    ))}
                  </div>
                </details>
                <label className="snd-song-notes">
                  Observações
                  <input value={m.notes} maxLength={TEXT_MAX} onChange={(e) => patchSong(m.id, { notes: e.target.value })} />
                </label>
              </li>
            )
          })}
        </ul>
        <button className="btn secondary" onClick={addSong}>
          + Música
        </button>
      </section>
    </div>
  )
}

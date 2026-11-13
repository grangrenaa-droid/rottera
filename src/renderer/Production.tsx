import { useMemo, useState, type DragEvent } from 'react'
import type { BreakdownCategory, Frame, Production, ShootDay } from '../shared/types'
import type { Report } from '../shared/reports'
import type { DaySound } from '../shared/production'
import { reportToCsv } from '../shared/reports'
import {
  CATEGORIES,
  ITEM_MAX,
  DAY_LABEL_MAX,
  DAY_NOTES_MAX,
  addDay,
  addItem,
  dayLabel,
  dayReport,
  dayScenes,
  entryOf,
  formatEighths,
  itemsOfScene,
  looseParts,
  moveDay,
  moveShot,
  removeDay,
  removeItem,
  scheduleReport,
  scheduleByLocation,
  sceneTime,
  scheduleScene,
  sceneShots,
  setSceneTime,
  setShotTime,
  shotsByTime,
  splitDay,
  unscheduled,
  updateDay,
  type SceneInfo,
  type ShotInfo
} from '../shared/production'

/** What the storyboard and the light maps hold for a scene (see the scene links in App). */
export interface SceneLinks {
  frames: number
  maps: { id: string; name: string }[]
}

interface Props {
  scenes: SceneInfo[]
  production: Production
  /** The storyboard frames: each scene's shots, to plan and to list on the day sheets. */
  frames: Frame[]
  onChange(p: Production): void
  /** The scene's id, given to its heading first if it has none. */
  sceneId(s: SceneInfo): string | null
  /** The same for many scenes at once (one step in the editor). */
  sceneIds(list: SceneInfo[]): (string | null)[]
  /** The scene the caret is in, to open the breakdown on. */
  current: number
  links(sceneId: string | null): SceneLinks
  onGoToScene(blockIndex: number): void
  onOpenStoryboard(sceneNumber: string): void
  onOpenMap(mapId: string): void
  onExportPdf(report: Report, landscape: boolean): void
  onExportCsv(name: string, csv: string): void
  /** The Som window's line per scene and ambiences per day, for the day sheets. */
  daySound?: DaySound
  /** The Luz window's sun of a day, on one line, for its day sheet ('' when the day has no date or place). */
  daySunLine?(day: ShootDay): string
}

type Tab = 'breakdown' | 'plan'

export function ProductionView(p: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('breakdown')
  return (
    <div className="prod">
      <div className="seg prod-tabs" role="group" aria-label="Filmagem">
        <button className="btn ghost" aria-pressed={tab === 'breakdown'} onClick={() => setTab('breakdown')}>
          Decupagem
        </button>
        <button className="btn ghost" aria-pressed={tab === 'plan'} onClick={() => setTab('plan')}>
          Plano de filmagem
        </button>
      </div>
      {p.scenes.length === 0 ? (
        <p className="muted">Ainda não há cenas no roteiro. Escreva um cabeçalho (INT. ou EXT.) para começar.</p>
      ) : tab === 'breakdown' ? (
        <Breakdown {...p} />
      ) : (
        <Plan {...p} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- breakdown

function Breakdown(p: Props): JSX.Element {
  const [sel, setSel] = useState(() => Math.max(0, Math.min(p.current, p.scenes.length - 1)))
  const scene = p.scenes[Math.min(sel, p.scenes.length - 1)]
  const mine = scene.id ? itemsOfScene(p.production, scene.id) : []
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of p.production.items) for (const s of i.scenes) m.set(s, (m.get(s) ?? 0) + 1)
    return m
  }, [p.production.items])
  const links = p.links(scene.id)

  const add = (category: BreakdownCategory, name: string): void => {
    if (!name.trim()) return
    const id = p.sceneId(scene)
    if (id) p.onChange(addItem(p.production, id, category, name))
  }

  return (
    <div className="prod-breakdown">
      <nav aria-label="Cenas da decupagem" className="prod-scenes">
        <ol>
          {p.scenes.map((s) => {
            const n = s.id ? counts.get(s.id) ?? 0 : 0
            return (
              <li key={s.index}>
                <button className={s === scene ? 'on' : ''} aria-current={s === scene} onClick={() => setSel(s.n)}>
                  <b>{s.number}</b>
                  <span className="scene-text">{s.heading || '(cabeçalho vazio)'}</span>
                  <small>
                    {formatEighths(s.eighths)} pág. · {n} {n === 1 ? 'elemento' : 'elementos'}
                  </small>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <section className="prod-sheet" aria-labelledby="prod-scene-title">
        <header>
          <h2 id="prod-scene-title">
            Cena {scene.number} · {scene.heading || '(cabeçalho vazio)'}
          </h2>
          <p className="muted">
            {[scene.intExt, scene.location || 'sem local', scene.night ? 'Noite' : 'Dia', `${formatEighths(scene.eighths)} pág.`, `começa na p. ${scene.page}`].join(' · ')}
          </p>
          {scene.synopsis && <p className="prod-syn">{scene.synopsis}</p>}
          <div className="row">
            <button className="btn ghost" onClick={() => p.onGoToScene(scene.index)}>
              Ir para a cena no roteiro
            </button>
            {links.frames > 0 && (
              <button className="btn ghost" onClick={() => p.onOpenStoryboard(scene.number)}>
                Storyboard: {links.frames} {links.frames === 1 ? 'quadro' : 'quadros'}
              </button>
            )}
            {links.maps.map((m) => (
              <button key={m.id} className="btn ghost" onClick={() => p.onOpenMap(m.id)}>
                Mapa de luz: {m.name || 'sem nome'}
              </button>
            ))}
          </div>
        </header>
        <section className="prod-cat prod-cast" aria-labelledby="prod-cast">
          <h3 id="prod-cast">Elenco</h3>
          {scene.cast.length === 0 ? (
            <p className="muted">Ninguém fala nesta cena.</p>
          ) : (
            <ul className="chips">
              {scene.cast.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          <p className="muted small">Vem do roteiro: quem tem fala na cena.</p>
        </section>
        <div className="prod-cats">
          {CATEGORIES.map((c) => {
            const here = mine.filter((i) => i.category === c.id)
            const known = p.production.items.filter((i) => i.category === c.id && !here.includes(i))
            return (
              <section key={c.id} className="prod-cat" aria-labelledby={`cat-${c.id}`}>
                <h3 id={`cat-${c.id}`}>{c.label}</h3>
                {here.length > 0 && (
                  <ul className="chips">
                    {here.map((i) => (
                      <li key={i.id}>
                        {i.name}
                        <button
                          className="icon"
                          aria-label={`Tirar ${i.name} desta cena`}
                          title="Tirar desta cena"
                          onClick={() => scene.id && p.onChange(removeItem(p.production, i.id, scene.id))}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const input = e.currentTarget.elements.namedItem('item') as HTMLInputElement
                    add(c.id, input.value)
                    input.value = ''
                  }}
                >
                  <input
                    name="item"
                    list={`known-${c.id}`}
                    maxLength={ITEM_MAX}
                    placeholder="Acrescentar e Enter…"
                    aria-label={`Acrescentar em ${c.label}`}
                    autoComplete="off"
                  />
                  <datalist id={`known-${c.id}`}>
                    {known.map((i) => (
                      <option key={i.id} value={i.name} />
                    ))}
                  </datalist>
                </form>
              </section>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- shooting plan

type Sort = 'script' | 'location' | 'daynight'

const stripKind = (s: SceneInfo): string => `${s.intExt === 'INT.' ? 'int' : 'ext'}-${s.night ? 'night' : 'day'}`

function Plan(p: Props): JSX.Element {
  const [sort, setSort] = useState<Sort>('script')
  // the strip being dragged: its scene, and the day it comes from (null = no day), for a scene in parts
  const [dragging, setDragging] = useState<{ id: string; from: string | null } | null>(null)
  const [said, setSaid] = useState('')
  const prod = p.production
  const shots = useMemo(() => sceneShots(p.frames, p.scenes), [p.frames, p.scenes])
  const shotIds = (s: SceneInfo): string[] => ((s.id && shots.get(s.id)) || []).map((x) => x.id)
  const pool = useMemo(() => {
    // the scenes with no day, and the parts of scenes whose other shots are on a day
    const list = [...unscheduled(p.scenes, prod), ...looseParts(p.scenes, prod, shots)].sort((a, b) => a.n - b.n)
    if (sort === 'location') return [...list].sort((a, b) => a.location.localeCompare(b.location, 'pt-BR') || a.n - b.n)
    if (sort === 'daynight') return [...list].sort((a, b) => Number(a.night) - Number(b.night) || a.location.localeCompare(b.location, 'pt-BR') || a.n - b.n)
    return list
  }, [p.scenes, prod, sort, shots])
  const total = p.scenes.reduce((t, s) => t + s.eighths, 0)
  const planned = p.scenes.length - unscheduled(p.scenes, prod).length

  /** Moves a strip: a whole scene, or (for a scene in parts) only the part that is on day `from`. */
  const move = (s: SceneInfo, from: string | null, dayId: string | null, at?: number): void => {
    const id = p.sceneId(s)
    if (id) p.onChange(scheduleScene(prod, id, dayId, at, { from, all: shotIds(s) }))
  }
  const sendShot = (s: SceneInfo, shot: ShotInfo, dayId: string | null): void => {
    if (s.id) p.onChange(moveShot(prod, s.id, shotIds(s), shot.id, dayId))
  }
  const byId = (id: string | null): SceneInfo | undefined => p.scenes.find((s) => s.id === id)
  const drop = (e: DragEvent, dayId: string | null, at?: number): void => {
    e.preventDefault()
    e.stopPropagation()
    const d = dragging
    setDragging(null)
    const s = d && byId(d.id)
    if (d && s) move(s, d.from, dayId, at)
  }
  const exportPlan = (): void => p.onExportPdf(scheduleReport(p.scenes, prod, shots), true)
  const byLocation = (): void => {
    const r = scheduleByLocation(p.scenes, prod, p.sceneIds)
    if (r.scenes === 0) return
    p.onChange(r.production)
    const days = r.days === 0 ? 'nos dias que já existiam' : `em ${r.days} ${r.days === 1 ? 'dia novo' : 'dias novos'}`
    setSaid(`${r.scenes} ${r.scenes === 1 ? 'cena colocada' : 'cenas colocadas'} ${days}, um por locação.`)
  }
  const split = (s: SceneInfo, dayId: string): void => {
    const id = p.sceneId(s)
    if (id) p.onChange(splitDay(prod, dayId, id))
  }

  const strip = (s: SceneInfo, where: { dayId: string | null; pos: number; count: number }): JSX.Element => {
    const day = where.dayId === null ? null : prod.days.find((x) => x.id === where.dayId) ?? null
    const entry = entryOf(s, prod, shots, day)
    const all = (s.id && shots.get(s.id)) || []
    return (
      <li
        key={s.index}
        className={[
          'strip',
          where.dayId !== null ? 'timed' : '',
          entry.part ? 'part' : '',
          dragging !== null && dragging.id === s.id && dragging.from === where.dayId ? 'dragging' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        data-strip={stripKind(s)}
        draggable
        onDragStart={(e) => {
          const id = p.sceneId(s)
          setDragging(id ? { id, from: where.dayId } : null)
          if (id) e.dataTransfer.setData('text/plain', id)
        }}
        onDragEnd={() => setDragging(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => drop(e, where.dayId, where.dayId === null ? undefined : where.pos)}
      >
        <b className="strip-n">
          {s.number}
          {entry.part && <span className="strip-part"> parte</span>}
        </b>
        {where.dayId !== null && (
          <input
            type="time"
            className="strip-time"
            aria-label={`Horário da cena ${s.number}`}
            title="Horário em que a cena será filmada"
            value={(() => {
              const d = prod.days.find((x) => x.id === where.dayId)
              return d && s.id ? sceneTime(d, s.id) : ''
            })()}
            onChange={(e) => s.id && where.dayId && p.onChange(setSceneTime(prod, where.dayId, s.id, e.target.value))}
            // a time field must not start a drag of the strip
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
        )}
        <span className="strip-ie">{s.intExt}</span>
        <span className="strip-loc" title={s.synopsis ? `${s.heading}\n${s.synopsis}` : s.heading}>
          {s.location || s.heading || '—'}
        </span>
        <span className="strip-dn">{s.night ? 'N' : 'D'}</span>
        <span className="strip-pg">{formatEighths(entry.eighths)}</span>
        <span className="strip-cast" title={s.cast.join(', ')}>
          {s.cast.length ? s.cast.join(', ') : '—'}
        </span>
        <span className="strip-ctl">
          {where.dayId !== null && (
            <>
              <button className="icon" aria-label={`Subir cena ${s.number} no dia`} disabled={where.pos === 0} onClick={() => move(s, where.dayId, where.dayId, where.pos - 1)}>
                ↑
              </button>
              <button className="icon" aria-label={`Descer cena ${s.number} no dia`} disabled={where.pos === where.count - 1} onClick={() => move(s, where.dayId, where.dayId, where.pos + 1)}>
                ↓
              </button>
              <button
                className="icon"
                aria-label={`Partir o dia antes da cena ${s.number}`}
                title="Partir o dia aqui: esta cena e as de baixo vão para um dia novo"
                disabled={where.pos === 0}
                onClick={() => where.dayId && split(s, where.dayId)}
              >
                ✂
              </button>
            </>
          )}
          <label className="sr-only" htmlFor={`day-of-${s.index}-${where.dayId ?? 'none'}`}>
            Dia da cena {s.number}
          </label>
          <select id={`day-of-${s.index}-${where.dayId ?? 'none'}`} value={where.dayId ?? ''} onChange={(e) => move(s, where.dayId, e.target.value || null)}>
            <option value="">Sem dia</option>
            {prod.days.map((d, n) => (
              <option key={d.id} value={d.id}>
                {dayLabel(d, n)}
              </option>
            ))}
          </select>
        </span>
        {entry.shots.length > 0 && (
          // the scene's shots from the storyboard, in the order they are filmed; with more than one, each can go to another day
          <ul className="strip-shots" aria-label={`Planos da cena ${s.number}`}>
            {shotsByTime(entry.shots).map((sh) => (
              <li key={sh.id} title={sh.text}>
                <span className="shot-code">{sh.code}</span> <span className="shot-text">{sh.text}</span>
                {where.dayId !== null && s.id !== null && (
                  <input
                    type="time"
                    className="shot-time"
                    aria-label={`Horário do plano ${sh.code}`}
                    title="Horário em que o plano será filmado"
                    value={sh.time}
                    onChange={(e) => where.dayId && s.id && p.onChange(setShotTime(prod, where.dayId, s.id, sh.id, e.target.value))}
                    // a time field must not start a drag of the strip
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  />
                )}
                {all.length > 1 && (
                  <select
                    aria-label={`Dia do plano ${sh.code}`}
                    value={where.dayId ?? ''}
                    onChange={(e) => sendShot(s, sh, e.target.value || null)}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    <option value="">Sem dia</option>
                    {prod.days.map((d, n) => (
                      <option key={d.id} value={d.id}>
                        {dayLabel(d, n)}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="plan">
      <header className="plan-head">
        <p>
          {planned} de {p.scenes.length} cenas em {prod.days.length} {prod.days.length === 1 ? 'dia' : 'dias'} · roteiro com {formatEighths(total)} págs.
        </p>
        <div className="row">
          <button
            className="btn primary"
            disabled={pool.length === 0}
            title="Junta num dia todas as cenas sem dia que acontecem na mesma locação. Os dias já montados não mudam."
            onClick={byLocation}
          >
            Montar por locação
          </button>
          <button className="btn secondary" onClick={() => p.onChange(addDay(prod))}>
            Novo dia
          </button>
          <button className="btn secondary" onClick={exportPlan}>
            Exportar plano (PDF)
          </button>
          <button className="btn secondary" onClick={() => p.onExportCsv('Plano de filmagem', reportToCsv(scheduleReport(p.scenes, prod, shots)))}>
            Exportar CSV
          </button>
        </div>
      </header>
      <p className="plan-said" role="status">
        {said}
      </p>
      <ul className="strip-legend" aria-label="Cores das faixas">
        <li data-strip="int-day">INT. dia</li>
        <li data-strip="ext-day">EXT. dia</li>
        <li data-strip="int-night">INT. noite</li>
        <li data-strip="ext-night">EXT. noite</li>
      </ul>
      <div className="plan-cols">
        <section className="plan-pool" aria-labelledby="pool-title" onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, null)}>
          <div className="plan-day-head">
            <h3 id="pool-title">Sem dia ({pool.length})</h3>
            <label className="sr-only" htmlFor="pool-sort">
              Ordenar cenas sem dia
            </label>
            <select id="pool-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="script">Ordem do roteiro</option>
              <option value="location">Por local</option>
              <option value="daynight">Dia primeiro, depois noite</option>
            </select>
          </div>
          {pool.length === 0 ? (
            <p className="muted">Todas as cenas têm dia.</p>
          ) : (
            <ol className="strips">{pool.map((s, i) => strip(s, { dayId: null, pos: i, count: pool.length }))}</ol>
          )}
        </section>
        <div className="plan-days">
          {prod.days.length === 0 && <p className="muted">Crie um dia com “Novo dia” e leve cenas para ele, arrastando ou escolhendo o dia na faixa.</p>}
          {prod.days.map((d, n) => {
            const list = dayScenes(d, p.scenes)
            const e = list.reduce((t, s) => t + entryOf(s, prod, shots, d).eighths, 0)
            return (
              <section
                key={d.id}
                className="plan-day"
                aria-label={dayLabel(d, n)}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={(ev) => drop(ev, d.id)}
              >
                <div className="plan-day-head">
                  <input
                    value={d.label}
                    maxLength={DAY_LABEL_MAX}
                    placeholder={`Dia ${n + 1}`}
                    aria-label={`Nome do dia ${n + 1}`}
                    onChange={(ev) => p.onChange(updateDay(prod, d.id, { label: ev.target.value }))}
                  />
                  <span className="muted">
                    {list.length} {list.length === 1 ? 'cena' : 'cenas'} · {e ? formatEighths(e) : '0'} págs.
                  </span>
                  <span className="plan-day-ctl">
                    <button className="icon" aria-label={`Subir ${dayLabel(d, n)}`} disabled={n === 0} onClick={() => p.onChange(moveDay(prod, d.id, -1))}>
                      ↑
                    </button>
                    <button
                      className="icon"
                      aria-label={`Descer ${dayLabel(d, n)}`}
                      disabled={n === prod.days.length - 1}
                      onClick={() => p.onChange(moveDay(prod, d.id, 1))}
                    >
                      ↓
                    </button>
                    <button className="btn ghost" onClick={() => p.onExportPdf(dayReport(d, n, p.scenes, prod, shots, p.daySound, p.daySunLine?.(d) || undefined), false)}>
                      Ordem do dia (PDF)
                    </button>
                    <button className="btn ghost" onClick={() => p.onChange(removeDay(prod, d.id))}>
                      Apagar dia
                    </button>
                  </span>
                </div>
                {list.length === 0 ? (
                  <p className="muted">Nenhuma cena neste dia.</p>
                ) : (
                  <ol className="strips">{list.map((s, i) => strip(s, { dayId: d.id, pos: i, count: list.length }))}</ol>
                )}
                <textarea
                  value={d.notes}
                  maxLength={DAY_NOTES_MAX}
                  rows={2}
                  placeholder="Notas do dia (horários, locação, avisos)…"
                  aria-label={`Notas de ${dayLabel(d, n)}`}
                  onChange={(ev) => p.onChange(updateDay(prod, d.id, { notes: ev.target.value }))}
                />
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

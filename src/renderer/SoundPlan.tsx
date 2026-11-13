import { useCallback, useMemo, useRef, useState } from 'react'
import type { LightMap, Mic, MicType, Sound, SoundPlan } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import { MIC_DEFS, MIC_TYPES, newMic } from '../shared/sound'
import { soundPlanSvg } from '../shared/soundsvg'
import { parseMicLine } from '../shared/quicksheet'
import { S } from '../shared/lightmap'
import { newId } from '../shared/structures'
import { NumberField } from './LightMap'

interface Props {
  sound: Sound
  maps: LightMap[]
  scenes: SceneInfo[]
  /** The scene's id, given to its heading first if it has none. */
  sceneId(s: SceneInfo): string | null
  onChange(s: Sound): void
}

/** What the list on the left points at: a light map (its plan is made on first use) or a scene with no light map. */
type Pick = { kind: 'map'; id: string } | { kind: 'scene'; index: number } | { kind: 'plan'; id: string } | null

interface Drag {
  id: string
  kind: 'move' | 'rotate'
  from: { x: number; y: number }
  start: { x: number; y: number }
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const round = (n: number, step: number): number => Math.round(n / step) * step
const BOOMED: MicType[] = ['shotgun', 'supercardioid']

/** The name a new microphone gets: Mic 3, Lapela 4, Gravador. */
function autoLabel(type: MicType, mics: Mic[]): string {
  if (type === 'recorder') return 'Gravador'
  return `${type === 'lavalier' ? 'Lapela' : 'Mic'} ${mics.length + 1}`
}

export function SoundPlanView(p: Props): JSX.Element {
  const [pick, setPick] = useState<Pick>(() => (p.maps[0] ? { kind: 'map', id: p.maps[0].id } : p.scenes[0] ? { kind: 'scene', index: 0 } : null))
  const [selId, setSelId] = useState<string | null>(null)
  const [past, setPast] = useState<Sound[]>([])
  const [future, setFuture] = useState<Sound[]>([])
  const [quick, setQuick] = useState('')
  const [said, setSaid] = useState<{ understood: string[]; unknown: string[] } | null>(null)
  const [size, setSize] = useState({ width: 6, height: 4 })
  const drag = useRef<Drag | null>(null)
  const surface = useRef<HTMLDivElement>(null)
  const soundRef = useRef(p.sound)
  soundRef.current = p.sound

  const mapSids = new Set(p.maps.map((m) => m.sid).filter(Boolean))
  const loose = p.scenes.filter((s) => !s.id || !mapSids.has(s.id))
  // plans with no light map whose scene is gone (or never had one): kept in the file, so they are listed to be seen or deleted
  const sceneIds = new Set(p.scenes.map((s) => s.id).filter(Boolean))
  const orphans = p.sound.plans.filter((x) => !x.mapId && (!x.sid || !sceneIds.has(x.sid)))
  const map = pick?.kind === 'map' ? p.maps.find((m) => m.id === pick.id) ?? null : null
  const scene = pick?.kind === 'scene' ? p.scenes[pick.index] ?? null : null
  const plan: SoundPlan | null = map
    ? p.sound.plans.find((x) => x.mapId === map.id) ?? null
    : scene && scene.id
      ? p.sound.plans.find((x) => !x.mapId && x.sid === scene.id) ?? null
      : pick?.kind === 'plan'
        ? p.sound.plans.find((x) => x.id === pick.id) ?? null
        : null
  // a sound-only plan whose scene got a light map since, with no plan of its own yet
  const lightNow = plan && !plan.mapId && plan.sid ? p.maps.find((m) => m.sid === plan.sid && !p.sound.plans.some((x) => x.mapId === m.id)) : undefined
  const selected = plan?.mics.find((m) => m.id === selId) ?? null

  // ---- changes, with undo
  const commit = useCallback(
    (next: Sound): void => {
      setPast((h) => [...h.slice(-49), soundRef.current])
      setFuture([])
      p.onChange(next)
    },
    [p]
  )
  const undo = (): void => {
    const prev = past[past.length - 1]
    if (!prev) return
    setFuture((f) => [soundRef.current, ...f])
    setPast((h) => h.slice(0, -1))
    p.onChange(prev)
  }
  const redo = (): void => {
    const next = future[0]
    if (!next) return
    setPast((h) => [...h, soundRef.current])
    setFuture((f) => f.slice(1))
    p.onChange(next)
  }
  /** The plan being edited, made now for a light map that has none yet. */
  const ensurePlan = (): { sound: Sound; plan: SoundPlan } | null => {
    if (plan) return { sound: soundRef.current, plan }
    if (!map) return null
    const made: SoundPlan = { id: newId('snd'), mapId: map.id, scene: map.scene, width: map.width, height: map.height, mics: [], notes: '' }
    if (map.sid) made.sid = map.sid
    return { sound: { ...soundRef.current, plans: [...soundRef.current.plans, made] }, plan: made }
  }
  const putPlan = (s: Sound, next: SoundPlan, record = true): void => {
    const out = { ...s, plans: s.plans.map((x) => (x.id === next.id ? next : x)) }
    if (record) commit(out)
    else p.onChange(out)
  }
  const patchMic = (id: string, patch: Partial<Mic>, record = true): void => {
    const cur = plan
    if (!cur) return
    putPlan(soundRef.current, { ...cur, mics: cur.mics.map((m) => (m.id === id ? { ...m, ...patch } : m)) }, record)
  }
  const add = (type: MicType): void => {
    const got = ensurePlan()
    if (!got) return
    const m: Mic = { ...newMic(type, round(got.plan.width / 2, 0.1), round(got.plan.height / 2, 0.1)), label: autoLabel(type, got.plan.mics) }
    putPlan(got.sound, { ...got.plan, mics: [...got.plan.mics, m] })
    setSelId(m.id)
    setSaid(null)
    setQuick('')
  }
  const remove = (id: string): void => {
    if (!plan) return
    putPlan(soundRef.current, { ...plan, mics: plan.mics.filter((m) => m.id !== id) })
    setSelId(null)
  }
  const removePlan = (): void => {
    if (!plan) return
    if (plan.mics.length > 0 && !window.confirm('Apagar esta planta de som e os microfones dela? O mapa de luz não muda.')) return
    commit({ ...soundRef.current, plans: soundRef.current.plans.filter((x) => x.id !== plan.id) })
    setSelId(null)
    if (pick?.kind === 'plan') setPick(null)
  }
  const createStandalone = (): void => {
    if (!scene) return
    const sid = p.sceneId(scene)
    if (!sid) return
    const made: SoundPlan = { id: newId('snd'), sid, scene: scene.number, width: size.width, height: size.height, mics: [], notes: '' }
    commit({ ...soundRef.current, plans: [...soundRef.current.plans, made] })
  }
  const useLightPlan = (): void => {
    if (!plan || !lightNow) return
    putPlan(soundRef.current, { ...plan, mapId: lightNow.id, width: lightNow.width, height: lightNow.height })
  }
  const applyQuick = (): void => {
    if (!selected) return
    const r = parseMicLine(quick)
    if (Object.keys(r.patch).length) patchMic(selected.id, r.patch)
    setSaid({ understood: r.understood, unknown: r.unknown })
  }

  // ---- drawing and pointer
  const svg = useMemo(() => (plan || map ? soundPlanSvg(plan ?? { id: '', scene: '', width: map!.width, height: map!.height, mics: [], notes: '' }, map, { interactive: true, selectedId: selId }) : ''), [plan, map, selId])
  const toMeters = (e: React.PointerEvent): { x: number; y: number } | null => {
    const el = surface.current?.querySelector('svg')
    if (!el || !plan) return null
    const r = el.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * plan.width, y: ((e.clientY - r.top) / r.height) * plan.height }
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const t = e.target as Element
    surface.current?.focus()
    const rot = t.closest('[data-mic-rotate]')
    const mic = t.closest('[data-mic]')
    const id = (rot ?? mic)?.getAttribute(rot ? 'data-mic-rotate' : 'data-mic')
    const m = id ? plan?.mics.find((x) => x.id === id) : undefined
    const at = toMeters(e)
    if (!m || !at || !plan) {
      setSelId(null)
      return
    }
    setSelId(m.id)
    setPast((h) => [...h.slice(-49), soundRef.current])
    setFuture([])
    drag.current = { id: m.id, kind: rot ? 'rotate' : 'move', from: at, start: { x: m.x, y: m.y } }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    const at = toMeters(e)
    if (!d || !at || !plan) return
    const m = plan.mics.find((x) => x.id === d.id)
    if (!m) return
    if (d.kind === 'rotate') {
      let a = (Math.atan2(at.x - m.x, -(at.y - m.y)) * 180) / Math.PI
      if (!e.shiftKey) a = Math.round(a / 15) * 15
      patchMic(m.id, { rotation: ((Math.round(a) % 360) + 360) % 360 }, false)
      return
    }
    // a lavalier clipped to an actor goes where the actor goes
    if (m.type === 'lavalier' && m.actorId && map?.items.some((i) => i.id === m.actorId)) return
    let x = d.start.x + (at.x - d.from.x)
    let y = d.start.y + (at.y - d.from.y)
    if (!e.shiftKey) {
      x = round(x, 0.1)
      y = round(y, 0.1)
    }
    patchMic(m.id, { x: Math.round(clamp(x, 0, plan.width) * 100) / 100, y: Math.round(clamp(y, 0, plan.height) * 100) / 100 }, false)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return
    drag.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
      return
    }
    if (!selected || !plan) return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(selected.id)
      return
    }
    const step = e.shiftKey ? 1 : 0.1
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
    if (!dx && !dy) return
    e.preventDefault()
    patchMic(selected.id, { x: Math.round(clamp(selected.x + dx, 0, plan.width) * 100) / 100, y: Math.round(clamp(selected.y + dy, 0, plan.height) * 100) / 100 })
  }

  const actors = map ? map.items.filter((i) => i.type === 'actor') : []
  const micCount = (mapId: string): number => p.sound.plans.find((x) => x.mapId === mapId)?.mics.length ?? 0

  return (
    <div className="snd-plan">
      <nav className="snd-plans" aria-label="Plantas">
        <h3>Plantas de luz</h3>
        {p.maps.length === 0 && <p className="muted">Nenhum mapa de luz ainda.</p>}
        <ul>
          {p.maps.map((m) => (
            <li key={m.id}>
              <button aria-current={map?.id === m.id} className={map?.id === m.id ? 'on' : ''} onClick={() => (setPick({ kind: 'map', id: m.id }), setSelId(null))}>
                <span>{m.name}</span>
                <span className="muted">
                  Cena {m.scene || '—'} · {micCount(m.id)} {micCount(m.id) === 1 ? 'microfone' : 'microfones'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <h3>Cenas sem mapa de luz</h3>
        <ul>
          {loose.map((s) => {
            const own = s.id ? p.sound.plans.some((x) => !x.mapId && x.sid === s.id) : false
            const on = scene?.index === s.index
            return (
              <li key={s.index}>
                <button aria-current={on} className={on ? 'on' : ''} onClick={() => (setPick({ kind: 'scene', index: p.scenes.indexOf(s) }), setSelId(null))}>
                  <span>
                    {s.number} · {s.location || s.heading}
                  </span>
                  {own && <span className="muted">planta de som</span>}
                </button>
              </li>
            )
          })}
        </ul>
        {orphans.length > 0 && (
          <>
            <h3>Plantas sem cena</h3>
            <ul>
              {orphans.map((x) => {
                const on = pick?.kind === 'plan' && pick.id === x.id
                return (
                  <li key={x.id}>
                    <button aria-current={on} className={on ? 'on' : ''} onClick={() => (setPick({ kind: 'plan', id: x.id }), setSelId(null))}>
                      <span>Planta sem cena{x.scene ? ` (era a cena ${x.scene})` : ''}</span>
                      <span className="muted">
                        {x.mics.length} {x.mics.length === 1 ? 'microfone' : 'microfones'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </nav>

      <section className="snd-main" aria-label="Planta de som">
        {scene && !plan ? (
          <div className="snd-create">
            <p>Esta cena não tem mapa de luz. Crie uma planta só de som (ela não aparece no Mapa de Luz).</p>
            <div className="row">
              <label>
                Largura (m)
                <NumberField value={size.width} min={1} max={60} onValue={(v) => v !== undefined && setSize((z) => ({ ...z, width: v }))} />
              </label>
              <label>
                Fundo (m)
                <NumberField value={size.height} min={1} max={60} onValue={(v) => v !== undefined && setSize((z) => ({ ...z, height: v }))} />
              </label>
              <button className="btn primary" onClick={createStandalone}>
                Criar planta de som
              </button>
            </div>
          </div>
        ) : !plan && !map ? (
          <p className="muted">Escolha uma planta na lista.</p>
        ) : (
          <>
            <div className="snd-palette" role="group" aria-label="Microfones">
              {(['Unidirecionais', 'Outros'] as const).map((g) => (
                <div key={g} className="snd-group">
                  <span className="snd-group-name">{g}</span>
                  {MIC_TYPES.filter((t) => MIC_DEFS[t].group === g).map((t) => (
                    <button key={t} className="btn ghost" aria-label={`Pôr ${MIC_DEFS[t].label}`} onClick={() => add(t)}>
                      {MIC_DEFS[t].label}
                    </button>
                  ))}
                </div>
              ))}
              <span className="snd-history">
                <button className="btn ghost" disabled={past.length === 0} onClick={undo}>
                  Desfazer
                </button>
                <button className="btn ghost" disabled={future.length === 0} onClick={redo}>
                  Refazer
                </button>
              </span>
            </div>
            {lightNow && (
              <p className="snd-note">
                A cena ganhou um mapa de luz ({lightNow.name}).{' '}
                <button className="btn ghost" onClick={useLightPlan}>
                  Usar a planta de luz desta cena
                </button>
              </p>
            )}
            <div
              ref={surface}
              className="snd-surface"
              tabIndex={0}
              aria-label="Desenho da planta de som. Arraste um microfone para mover; a bolinha azul gira; setas movem 10 cm."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="muted snd-scale">Cada quadrado da grade tem 1 m ({S} px).</p>
          </>
        )}
      </section>

      <aside className="snd-panel" aria-label="Microfone selecionado">
        {!selected ? (
          <p className="muted">Clique num microfone do desenho para editar, ou ponha um pela paleta.</p>
        ) : (
          <>
            <h3>Microfone selecionado</h3>
            <label className="stack" htmlFor="mic-quick">
              Escrever o microfone
            </label>
            <input
              id="mic-quick"
              value={quick}
              placeholder="shotgun canal 1 a 2,1 m"
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyQuick()}
            />
            {said && (
              <p className="snd-said" role="status">
                {said.understood.length ? `Entendi: ${said.understood.join(' · ')}.` : ''}
                {said.unknown.length ? ` Não entendi: ${said.unknown.join(' ')}.` : ''}
              </p>
            )}
            <label className="stack" htmlFor="mic-name">
              Nome
            </label>
            <input id="mic-name" value={selected.label} maxLength={80} onChange={(e) => patchMic(selected.id, { label: e.target.value })} />
            <label className="stack" htmlFor="mic-type">
              Tipo
            </label>
            <select id="mic-type" value={selected.type} onChange={(e) => patchMic(selected.id, { type: e.target.value as MicType })}>
              {MIC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MIC_DEFS[t].label}
                </option>
              ))}
            </select>
            <label className="stack" htmlFor="mic-model">
              Modelo
            </label>
            <input id="mic-model" value={selected.model ?? ''} maxLength={80} placeholder="Ex.: MKH 416" onChange={(e) => patchMic(selected.id, { model: e.target.value || undefined })} />
            <label className="stack" htmlFor="mic-channel">
              Canal
            </label>
            <NumberField id="mic-channel" value={selected.channel} min={1} max={16} optional onValue={(v) => patchMic(selected.id, { channel: v === undefined ? undefined : Math.round(v) })} />
            <label className="check">
              <input type="checkbox" checked={selected.wireless === true} onChange={(e) => patchMic(selected.id, { wireless: e.target.checked || undefined })} />
              Sem fio
            </label>
            <label className="stack" htmlFor="mic-height">
              Altura (m)
            </label>
            <NumberField id="mic-height" value={selected.height} min={0} max={20} optional onValue={(v) => patchMic(selected.id, { height: v })} />
            {selected.type !== 'recorder' && (
              <>
                <label className="stack" htmlFor="mic-range">
                  Alcance (m)
                </label>
                <NumberField id="mic-range" value={selected.range} min={0.1} max={30} optional onValue={(v) => patchMic(selected.id, { range: v })} />
              </>
            )}
            <label className="stack" htmlFor="mic-rotation">
              Rotação (°)
            </label>
            <NumberField id="mic-rotation" value={selected.rotation} min={0} max={359} onValue={(v) => v !== undefined && patchMic(selected.id, { rotation: Math.round(v) })} />
            {BOOMED.includes(selected.type) && (
              <>
                <label className="stack" htmlFor="mic-operator">
                  Na vara de
                </label>
                <input id="mic-operator" value={selected.operator ?? ''} maxLength={80} placeholder="Quem segura a vara" onChange={(e) => patchMic(selected.id, { operator: e.target.value || undefined })} />
              </>
            )}
            {selected.type === 'lavalier' && (
              <>
                <label className="stack" htmlFor="mic-actor">
                  Preso em
                </label>
                <select id="mic-actor" value={selected.actorId ?? ''} onChange={(e) => patchMic(selected.id, { actorId: e.target.value || undefined })}>
                  <option value="">Ninguém (fica onde está)</option>
                  {actors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label || 'Ator sem nome'}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button className="btn ghost" onClick={() => remove(selected.id)}>
              Apagar microfone
            </button>
          </>
        )}
        {plan && (
          <>
            <label className="stack" htmlFor="snd-notes">
              Notas da planta
            </label>
            <textarea id="snd-notes" rows={3} maxLength={2000} value={plan.notes} onChange={(e) => putPlan(soundRef.current, { ...plan, notes: e.target.value })} />
            <button className="btn ghost" onClick={removePlan}>
              Apagar planta de som
            </button>
          </>
        )}
      </aside>
    </div>
  )
}

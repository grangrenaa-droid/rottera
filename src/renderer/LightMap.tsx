import { useCallback, useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react'
import type { LightItem, LightItemType, LightMap, LightRole, MoveStop, SensorId } from '../shared/types'
import {
  DIFFUSIONS,
  GELS,
  GROUPS,
  ITEM_DEFS,
  PALETTE_TYPES,
  KELVINS,
  LENSES,
  MOVES,
  ROLES,
  S,
  SENSORS,
  SHOTS,
  describeItem,
  effectiveKelvin,
  fieldOfView,
  isLight,
  isPathMove,
  itemHasCone,
  endViewOf,
  isTrackMove,
  hasPath,
  segRadius,
  segStart,
  segVia,
  stopName,
  stopRot,
  stopsOf,
  trackVia,
  panAngleOf,
  itemHasDepth,
  itemHasLength,
  lightMapSvg,
  lightNumbers,
  loadText,
  mapWatts,
  newItem,
  newLightMap,
  symbolPreview
} from '../shared/lightmap'

/**
 * The piece with point k of its movement or blocking changed. The points become its own list (movePoints), and the
 * single end of the older way (moveTo, moveVia, and the end turn of a path) goes. `undefined` in the patch clears a field.
 */
export function withStop(it: LightItem, k: number, patch: Partial<MoveStop>): LightItem {
  const stops = stopsOf(it).map((s) => ({ ...s }))
  if (!stops[k]) return it
  stops[k] = { ...stops[k], ...patch }
  for (const key of Object.keys(patch) as (keyof MoveStop)[]) if (patch[key] === undefined) delete stops[k][key]
  return { ...it, movePoints: stops, moveTo: undefined, moveVia: undefined, moveRot: it.move === 'Panorâmica' ? it.moveRot : undefined }
}

/**
 * A new point after the last one, 1.5 m further the way the piece was going (or the way it points).
 * When that leaves the set, it turns a quarter (right, then left) or goes back, so points never pile up on the edge.
 */
export function addStop(it: LightItem, width: number, height: number): LightItem {
  const stops = stopsOf(it).map((s) => ({ ...s }))
  const last = stops[stops.length - 1]
  const from = stops.length > 1 ? stops[stops.length - 2] : { x: it.x, y: it.y }
  let dx = last ? last.x - from.x : Math.sin((it.rotation * Math.PI) / 180)
  let dy = last ? last.y - from.y : -Math.cos((it.rotation * Math.PI) / 180)
  const l = Math.hypot(dx, dy) || 1
  dx /= l
  dy /= l
  const base = last ?? { x: it.x, y: it.y }
  const inside = (x: number, y: number): boolean => x >= 0.3 && y >= 0.3 && x <= width - 0.3 && y <= height - 0.3
  const ways: [number, number][] = [
    [dx, dy],
    [-dy, dx],
    [dy, -dx],
    [-dx, -dy]
  ]
  const [wx, wy] = ways.find(([a, b]) => inside(base.x + a * 1.5, base.y + b * 1.5)) ?? [dx, dy]
  const at = { x: Math.round(clamp(base.x + wx * 1.5, 0, width) * 100) / 100, y: Math.round(clamp(base.y + wy * 1.5, 0, height) * 100) / 100 }
  return { ...it, movePoints: [...stops, at], moveTo: undefined, moveVia: undefined, moveRot: it.move === 'Panorâmica' ? it.moveRot : undefined }
}

function removeStop(it: LightItem, k: number): LightItem {
  const stops = stopsOf(it).filter((_s, i) => i !== k)
  return { ...it, movePoints: stops.length ? stops : undefined, moveTo: undefined, moveVia: undefined }
}

/** The points of a camera movement or of an actor's blocking: where each is, where it points, its curve; add and remove. */
function StopsEditor(props: {
  it: LightItem
  width: number
  height: number
  /** A camera with a path keeps at least one point; an actor can have none. */
  keepOne: boolean
  noun: string
  onChange(next: LightItem): void
}): JSX.Element {
  const { it } = props
  const stops = stopsOf(it)
  const set = (k: number, patch: Partial<MoveStop>): void => props.onChange(withStop(it, k, patch))
  return (
    <div className="lm-stops">
      {stops.map((s, k) => {
        const r = segRadius(it, k)
        const name = stopName(it, k)
        return (
          <div key={k} className="lm-stop" role="group" aria-label={`${props.noun} ${name}`}>
            <b>{name}</b>
            <label>
              X
              <input type="number" step={0.1} value={Number(s.x.toFixed(2))} onChange={(e) => set(k, { x: clamp(Number(e.target.value) || 0, 0, props.width) })} />
            </label>
            <label>
              Y
              <input type="number" step={0.1} value={Number(s.y.toFixed(2))} onChange={(e) => set(k, { y: clamp(Number(e.target.value) || 0, 0, props.height) })} />
            </label>
            <label>
              Rot.
              <input type="number" min={0} max={359} value={stopRot(it, k)} onChange={(e) => set(k, { rot: ((Math.round(Number(e.target.value) || 0) % 360) + 360) % 360 })} />
            </label>
            <button className="icon" aria-label={`Tirar ${props.noun.toLowerCase()} ${name}`} title="Tirar" disabled={props.keepOne && stops.length === 1} onClick={() => props.onChange(removeStop(it, k))}>
              ×
            </button>
            {s.via && (
              <button className="btn ghost small" onClick={() => set(k, { via: undefined })}>
                {r !== null ? `Reto (raio ${String(r).replace('.', ',')} m)` : 'Reto'}
              </button>
            )}
          </div>
        )
      })}
      <button className="btn secondary small" onClick={() => props.onChange(addStop(it, props.width, props.height))}>
        + {props.noun}
      </button>
    </div>
  )
}

/** What the quick line of each kind of piece shows as an example. */
function quickExample(t: LightItemType): string {
  if (t === 'camera') return '35mm full frame close travelling 1,5 m'
  if (isLight(t)) return 'principal 2K 5600K 1/2 CTB 216 a 2,4 m 80%'
  if (itemHasDepth(t)) return '1,6 x 0,9 m 90°'
  if (itemHasLength(t)) return '4 m 90° x 2 y 1'
  return '90° x 3 y 2,5'
}

/**
 * One line to write a sheet the way it is said on set ("principal 2K 5600K 1/2 CTB 216 a 2,4 m"), then Enter.
 * It fills what it understood, says it back, and names the words it did not.
 */
function QuickLine(props: {
  id: string
  label: string
  example: string
  className?: string
  /** Reads the line, applies what it understood, and says what that was. */
  read(text: string): { understood: string[]; unknown: string[] }
}): JSX.Element {
  const [text, setText] = useState('')
  const [said, setSaid] = useState<{ ok: string[]; bad: string[] } | null>(null)
  const apply = (): void => {
    if (!text.trim()) return
    const r = props.read(text)
    setSaid({ ok: r.understood, bad: r.unknown })
    if (r.unknown.length === 0) setText('')
  }
  const example = props.example
  return (
    <div className={`lm-quick ${props.className ?? ''}`}>
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        value={text}
        placeholder={`ex.: ${example}`}
        title="Escreva como fala no set e tecle Enter"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // the map's own keys (arrows, R, Delete) must not act while typing here
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            apply()
          }
        }}
      />
      {said && (
        <p className="muted small" role="status">
          {said.ok.length ? `Entendi: ${said.ok.join(' · ')}.` : 'Não entendi nada desta linha.'}
          {said.bad.length > 0 && ` Não entendi: ${said.bad.join(', ')}.`}
        </p>
      )}
    </div>
  )
}

/** A number field that can be left empty (undefined). */
function optNumber(v: string, lo: number, hi: number): number | undefined {
  if (v.trim() === '') return undefined
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined
}

/**
 * A number field that can be typed freely. Pulling each key inside the limits broke typing: in a field whose
 * minimum is 2 the "1" of "12" became 2 and the result 22, and "5600" K could not be typed at all.
 * What is typed stays as typed; a value inside the limits is used as soon as it is typed; leaving the field or
 * Enter settles it inside the limits (or, when optional, empty). The field's arrows apply at once.
 */
function NumberField(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'type'> & {
    value: number | undefined
    min: number
    max: number
    /** Empty means "not set" (undefined) rather than "keep the old value". */
    optional?: boolean
    /** Whether a value may be used while it is still being typed (the set only grows as it is typed). */
    liveIf?(v: number): boolean
    onValue(v: number | undefined): void
  }
): JSX.Element {
  const { value, min, max, optional, liveIf, onValue, onBlur, onKeyDown, ...rest } = props
  const [draft, setDraft] = useState<string | null>(null)
  const read = (t: string): number | null => (t.trim() === '' ? null : Number(t.replace(',', '.')))
  const settle = (t: string | null): void => {
    setDraft(null)
    if (t === null) return
    const n = read(t)
    if (n === null) {
      if (optional && value !== undefined) onValue(undefined)
      return
    }
    if (!Number.isFinite(n)) return
    const v = clamp(n, min, max)
    if (v !== value) onValue(v)
  }
  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={draft ?? value ?? ''}
      onChange={(e) => {
        const t = e.target.value
        // the field's arrows (and up and down on the keyboard) are not typing: they apply at once
        if (!(e.nativeEvent as InputEvent).inputType) return settle(t)
        setDraft(t)
        const n = read(t)
        if (n === null) {
          if (optional && value !== undefined) onValue(undefined)
          return
        }
        if (Number.isFinite(n) && n >= min && n <= max && n !== value && (liveIf?.(n) ?? true)) onValue(n)
      }}
      onBlur={(e) => {
        settle(draft)
        onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') settle(draft)
        onKeyDown?.(e)
      }}
    />
  )
}
import { newId } from '../shared/structures'
import { parseQuickMap, parseQuickSheet } from '../shared/quicksheet'

interface Props {
  maps: LightMap[]
  scenes: { number: string; text: string }[]
  onChange(maps: LightMap[]): void
  onExport(): void
  /** Opens this map (from the navigator or the breakdown). */
  focusMap?: string
}

interface Drag {
  id: string
  /** What is dragged: the piece, its rotation knob, or, for a moving camera, the camera at the end, its knob, or the middle of the path. */
  kind: 'item' | 'rotate' | 'end' | 'rotate-end' | 'via' | 'zoom'
  /** Which point of a movement or of a blocking (end, rotate-end, via). */
  k: number
  startPointer: { x: number; y: number }
  startItem: { x: number; y: number }
}

const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5]
const round = (n: number, step: number): number => Math.round(n / step) * step
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export function LightMapView({ maps, scenes, onChange, onExport, focusMap }: Props): JSX.Element {
  const [mapId, setMapId] = useState<string | null>(focusMap && maps.some((m) => m.id === focusMap) ? focusMap : maps[0]?.id ?? null)
  const [selId, setSelId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [snap, setSnap] = useState(true)
  const [past, setPast] = useState<LightMap[][]>([])
  const [future, setFuture] = useState<LightMap[][]>([])
  const drag = useRef<Drag | null>(null)
  const surface = useRef<HTMLDivElement>(null)
  const mapsRef = useRef(maps)
  mapsRef.current = maps

  const map = maps.find((m) => m.id === mapId) ?? maps[0] ?? null
  useEffect(() => {
    if (map && map.id !== mapId) setMapId(map.id)
    if (!map && mapId !== null) setMapId(null)
  }, [map, mapId])
  const selected = map?.items.find((i) => i.id === selId) ?? null
  const numbers = useMemo(() => (map ? lightNumbers(map) : new Map<string, number>()), [map])

  const svg = useMemo(
    () => (map ? lightMapSvg(map, { interactive: true, selectedId: selId }) : ''),
    [map, selId]
  )

  // ---- history
  const record = useCallback((): void => {
    setPast((p) => [...p.slice(-49), mapsRef.current])
    setFuture([])
  }, [])
  const undo = useCallback((): void => {
    setPast((p) => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      setFuture((f) => [mapsRef.current, ...f])
      onChange(prev)
      return p.slice(0, -1)
    })
  }, [onChange])
  const redo = useCallback((): void => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setPast((p) => [...p, mapsRef.current])
      onChange(next)
      return f.slice(1)
    })
  }, [onChange])

  const updateMap = (patch: Partial<LightMap>, rec = true): void => {
    if (!map) return
    if (rec) record()
    onChange(maps.map((m) => (m.id === map.id ? { ...m, ...patch } : m)))
  }
  /** Changes the size of the set and pulls every piece back inside it (and, from the quick line, the scene too). */
  const resize = (width: number, height: number, extra: Partial<LightMap> = {}): void => {
    if (!map) return
    record()
    onChange(
      maps.map((m) =>
        m.id === map.id
          ? { ...m, ...extra, width, height, items: m.items.map((i) => ({ ...i, x: clamp(i.x, 0, width), y: clamp(i.y, 0, height) })) }
          : m
      )
    )
  }
  const updateItem = (id: string, patch: Partial<LightItem>, rec = true): void => {
    if (!map) return
    if (rec) record()
    updateMapNoRecord(map.items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }
  const updateMapNoRecord = (items: LightItem[]): void => {
    if (!map) return
    onChange(mapsRef.current.map((m) => (m.id === map.id ? { ...m, items } : m)))
  }

  const addItem = (type: LightItemType): void => {
    if (!map) return
    const n = map.items.length
    const it = newItem(type, clamp(map.width / 2 + ((n % 5) - 2) * 0.4, 0, map.width), clamp(map.height / 2 + (Math.floor(n / 5) % 4) * 0.4, 0, map.height))
    record()
    updateMapNoRecord([...map.items, it])
    setSelId(it.id)
    surface.current?.focus()
  }

  const removeSelected = (): void => {
    if (!map || !selected) return
    record()
    updateMapNoRecord(map.items.filter((i) => i.id !== selected.id))
    setSelId(null)
  }

  const duplicateSelected = (): void => {
    if (!map || !selected) return
    const copy: LightItem = {
      ...selected,
      id: newId('item'),
      x: clamp(selected.x + 0.4, 0, map.width),
      y: clamp(selected.y + 0.4, 0, map.height)
    }
    record()
    updateMapNoRecord([...map.items, copy])
    setSelId(copy.id)
  }

  const newMap = (copyOf?: LightMap): void => {
    const m = copyOf
      ? {
          ...copyOf,
          id: newId('map'),
          name: `${copyOf.name} (cópia)`,
          items: copyOf.items.map((i) => ({ ...i, id: newId('item') }))
        }
      : newLightMap(`Mapa ${maps.length + 1}`)
    record()
    onChange([...maps, m])
    setMapId(m.id)
    setSelId(null)
  }

  // ---- pointer handling
  const toMeters = (e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const el = surface.current?.querySelector('svg')
    if (!el || !map) return null
    const r = el.getBoundingClientRect()
    // the SVG may be taller than the map (legend); here it is not, but keep the width ratio.
    const k = map.width / r.width
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const target = e.target as Element
    // the innermost handle wins: the knob of the camera at the end sits inside that camera
    const handles: [Drag['kind'], string][] = [
      ['rotate-end', 'data-rotate-end'],
      ['via', 'data-move-via'],
      ['zoom', 'data-zoom-end'],
      ['end', 'data-move-end'],
      ['rotate', 'data-rotate'],
      ['item', 'data-item']
    ]
    let kind: Drag['kind'] | null = null
    let id = ''
    let point = 0
    for (const [k, attr] of handles) {
      const el = target.closest(`[${attr}]`)
      if (el) {
        kind = k
        // the handles of a point say which one: "id|2"
        const [ref, n] = (el.getAttribute(attr) as string).split('|')
        id = ref
        point = Number(n) || 0
        break
      }
    }
    surface.current?.focus()
    if (!kind || !map) {
      setSelId(null)
      return
    }
    const it = map.items.find((i) => i.id === id)
    const p = toMeters(e)
    if (!it || !p) return
    setSelId(id)
    record()
    // where the drag starts from: the piece, one of its points, or the middle of a stretch
    const stop = stopsOf(it)[point]
    const from =
      (kind === 'end' || kind === 'rotate-end') && stop && hasPath(it) ? { x: stop.x, y: stop.y } : kind === 'via' && stop ? segVia(it, point) : { x: it.x, y: it.y }
    drag.current = { id, kind, k: point, startPointer: p, startItem: from }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (!d || !map) return
    const p = toMeters(e)
    if (!p) return
    const items = mapsRef.current.find((m) => m.id === map.id)!.items
    if (d.kind === 'rotate' || d.kind === 'rotate-end') {
      // the camera (or the camera at the end) turns to face the pointer: 0° is the top of the drawing, clockwise
      let a = (Math.atan2(p.x - d.startItem.x, -(p.y - d.startItem.y)) * 180) / Math.PI
      if (snap && !e.shiftKey) a = Math.round(a / 15) * 15
      const turn = ((Math.round(a) % 360) + 360) % 360
      updateMapNoRecord(
        items.map((i) => {
          if (i.id !== d.id) return i
          if (d.kind === 'rotate') return { ...i, rotation: turn }
          // a pan turns its one faint camera; a path turns its point
          return hasPath(i) ? withStop(i, d.k, { rot: turn }) : { ...i, moveRot: turn }
        })
      )
      return
    }
    let x = d.startItem.x + (p.x - d.startPointer.x)
    let y = d.startItem.y + (p.y - d.startPointer.y)
    if (snap && !e.shiftKey) {
      x = round(x, 0.1)
      y = round(y, 0.1)
    }
    x = clamp(x, 0, map.width)
    y = clamp(y, 0, map.height)
    const at = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }
    const cur = items.find((i) => i.id === d.id)
    if (d.kind === 'end') updateMapNoRecord(items.map((i) => (i.id === d.id ? withStop(i, d.k, { x: at.x, y: at.y }) : i)))
    // a track (travelling, dolly) only curves as an arc of a circle: the middle of a stretch slides across it
    else if (d.kind === 'via')
      updateMapNoRecord(
        items.map((i) =>
          i.id === d.id ? withStop(i, d.k, { via: isTrackMove(i.move) ? trackVia(segStart(i, d.k), stopsOf(i)[d.k], at) : at }) : i
        )
      )
    else if (d.kind === 'zoom' && cur) {
      // how far along the camera's axis the pointer is: the reach of the zoomed view
      const rad = (cur.rotation * Math.PI) / 180
      let reach = (p.x - cur.x) * Math.sin(rad) - (p.y - cur.y) * Math.cos(rad)
      reach = clamp(snap && !e.shiftKey ? round(reach, 0.1) : reach, 0.3, 30)
      updateMapNoRecord(items.map((i) => (i.id === d.id ? { ...i, endRange: Math.round(reach * 100) / 100 } : i)))
    }
    else updateMapNoRecord(items.map((i) => (i.id === d.id ? { ...i, x, y } : i)))
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (drag.current) {
      drag.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      redo()
      return
    }
    if (!selected || !map) return
    const step = e.shiftKey ? 0.5 : 0.1
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        removeSelected()
        break
      case 'ArrowLeft':
        e.preventDefault()
        updateItem(selected.id, { x: clamp(selected.x - step, 0, map.width) })
        break
      case 'ArrowRight':
        e.preventDefault()
        updateItem(selected.id, { x: clamp(selected.x + step, 0, map.width) })
        break
      case 'ArrowUp':
        e.preventDefault()
        updateItem(selected.id, { y: clamp(selected.y - step, 0, map.height) })
        break
      case 'ArrowDown':
        e.preventDefault()
        updateItem(selected.id, { y: clamp(selected.y + step, 0, map.height) })
        break
      case 'r':
      case 'R':
        e.preventDefault()
        updateItem(selected.id, { rotation: (selected.rotation + (e.shiftKey ? -15 : 15) + 360) % 360 })
        break
      case 'd':
      case 'D':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          duplicateSelected()
        }
        break
      case 'Escape':
        setSelId(null)
        break
    }
  }

  if (!map) {
    return (
      <div className="lm-empty">
        <h2>Mapa de Luz</h2>
        <p className="muted">
          Desenhe o set visto de cima: posição de câmeras, atores, refletores, difusores e acessórios. Cada mapa pode
          ser ligado a uma cena e sai no PDF do roteiro.
        </p>
        <button className="btn primary" onClick={() => newMap()}>
          Criar o primeiro mapa
        </button>
      </div>
    )
  }

  return (
    <div className="lm-view">
      <aside className="lm-side" aria-label="Mapas e peças">
        <h2>Mapas</h2>
        <ul className="lm-maps">
          {maps.map((m) => (
            <li key={m.id}>
              <button
                className={m.id === map.id ? 'on' : ''}
                aria-current={m.id === map.id}
                onClick={() => {
                  setMapId(m.id)
                  setSelId(null)
                }}
              >
                <b>{m.name || 'Sem nome'}</b>
                {m.scene && <span className="muted">Cena {m.scene}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="row">
          <button className="btn secondary small" onClick={() => newMap()}>
            Novo mapa
          </button>
          <button className="btn ghost small" onClick={() => newMap(map)}>
            Duplicar
          </button>
          <button
            className="btn ghost small"
            onClick={() => {
              if (map.items.length > 0 && !window.confirm(`Apagar o mapa “${map.name}”?`)) return
              record()
              onChange(maps.filter((m) => m.id !== map.id))
              setSelId(null)
            }}
          >
            Apagar
          </button>
        </div>

        <h2>Peças</h2>
        {GROUPS.map((g) => (
          <div key={g} className="lm-group">
            <h3>{g}</h3>
            <div className="lm-palette">
              {PALETTE_TYPES.filter((t) => ITEM_DEFS[t].group === g).map((t) => (
                <button key={t} className="lm-piece" title={ITEM_DEFS[t].hint} onClick={() => addItem(t)}>
                  <span className="lm-icon" dangerouslySetInnerHTML={{ __html: symbolPreview(t) }} />
                  {ITEM_DEFS[t].name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <section className="lm-main">
        <div className="board-bar">
          <label className="sr-only" htmlFor="lm-name">
            Nome do mapa
          </label>
          <input id="lm-name" className="lm-name" value={map.name} onChange={(e) => updateMap({ name: e.target.value }, false)} />
          <label htmlFor="lm-scene">Cena</label>
          <select id="lm-scene" value={map.scene} onChange={(e) => updateMap({ scene: e.target.value })}>
            <option value="">Sem cena</option>
            {scenes.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number} · {s.text.slice(0, 28)}
              </option>
            ))}
            {map.scene && !scenes.some((s) => s.number === map.scene) && <option value={map.scene}>{map.scene}</option>}
          </select>
          <label htmlFor="lm-w">Largura (m)</label>
          {/* a smaller set pulls the pieces inside it, so it shrinks only when the typing is done (Enter or leaving) */}
          <NumberField
            id="lm-w"
            min={2}
            max={60}
            step={0.5}
            value={map.width}
            liveIf={(v) => v >= map.width}
            onValue={(v) => v !== undefined && resize(v, map.height)}
          />
          <label htmlFor="lm-h">Fundo (m)</label>
          <NumberField
            id="lm-h"
            min={2}
            max={60}
            step={0.5}
            value={map.height}
            liveIf={(v) => v >= map.height}
            onValue={(v) => v !== undefined && resize(map.width, v)}
          />
          <label htmlFor="lm-zoom">Zoom</label>
          <select id="lm-zoom" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            {ZOOMS.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
          <label className="check">
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
            Ajustar à grade
          </label>
          <button className="btn ghost small" disabled={past.length === 0} onClick={undo}>
            Desfazer
          </button>
          <button className="btn ghost small" disabled={future.length === 0} onClick={redo}>
            Refazer
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={map.includeInPdf}
              onChange={(e) => updateMap({ includeInPdf: e.target.checked })}
            />
            Incluir no PDF
          </label>
          <button className="btn secondary" onClick={onExport}>
            Exportar mapas (PDF)
          </button>
        </div>
        {/* the size of the set and its scene, written in one line */}
        <QuickLine
          key={map.id}
          id="lm-quick"
          label="Escrever o mapa"
          className="map"
          example="6 x 4 cena 3"
          read={(text) => {
            const r = parseQuickMap(
              text,
              scenes.map((s) => s.number)
            )
            const { width, height, ...rest } = r.patch
            if (width !== undefined || height !== undefined) resize(width ?? map.width, height ?? map.height, rest)
            else if (rest.scene !== undefined) updateMap(rest)
            return r
          }}
        />

        <div className="lm-scroll">
          <div
            ref={surface}
            className="lm-surface"
            tabIndex={0}
            role="application"
            aria-label={`Desenho do mapa ${map.name}. Setas movem a peça selecionada, R gira, Delete apaga.`}
            style={{ width: map.width * S * zoom }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </section>

      <aside className="lm-props" aria-label="Propriedades">
        <h2>Peça selecionada</h2>
        {selected ? (
          <div className="lm-form">
            <p>
              <b>{ITEM_DEFS[selected.type].name}</b>
            </p>
            <QuickLine
              key={selected.id}
              id="it-quick"
              label="Escrever a ficha"
              example={quickExample(selected.type)}
              read={(text) => {
                const r = parseQuickSheet(text, selected.type, map)
                // a new movement starts from its own defaults, as when it is picked in the list
                const patch =
                  r.patch.move !== undefined && r.patch.move !== selected.move
                    ? { ...r.patch, movePoints: undefined, moveTo: undefined, moveVia: undefined, moveRot: undefined, endRange: undefined, panAngle: undefined }
                    : r.patch
                if (Object.keys(r.patch).length) updateItem(selected.id, patch)
                return r
              }}
            />
            <label htmlFor="it-label">Legenda</label>
            <input
              id="it-label"
              value={selected.label}
              placeholder="Ex.: Key 1K, Marina"
              onChange={(e) => updateItem(selected.id, { label: e.target.value.slice(0, 60) }, false)}
            />
            <label htmlFor="it-rot">Rotação (°)</label>
            <div className="row">
              <button className="icon" aria-label="Girar 15 graus para a esquerda" onClick={() => updateItem(selected.id, { rotation: (selected.rotation + 345) % 360 })}>
                ⟲
              </button>
              <input
                id="it-rot"
                type="number"
                min={0}
                max={359}
                value={selected.rotation}
                onChange={(e) => updateItem(selected.id, { rotation: ((Math.round(Number(e.target.value)) % 360) + 360) % 360 }, false)}
              />
              <button className="icon" aria-label="Girar 15 graus para a direita" onClick={() => updateItem(selected.id, { rotation: (selected.rotation + 15) % 360 })}>
                ⟳
              </button>
            </div>
            {selected.type === 'camera' && (
              <fieldset className="lm-tech">
                <legend>Câmera</legend>
                <label htmlFor="it-lens">Lente (mm)</label>
                <NumberField
                  id="it-lens"
                  list="lm-lenses"
                  min={4}
                  max={1200}
                  optional
                  placeholder="sem lente: abertura à mão"
                  value={selected.lens}
                  onValue={(v) => updateItem(selected.id, { lens: v }, false)}
                />
                <datalist id="lm-lenses">
                  {LENSES.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
                <label htmlFor="it-sensor">Sensor</label>
                <select id="it-sensor" value={selected.sensor ?? 's35'} onChange={(e) => updateItem(selected.id, { sensor: e.target.value as SensorId })}>
                  {SENSORS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <label htmlFor="it-shot">Plano</label>
                <select id="it-shot" value={selected.shot ?? ''} onChange={(e) => updateItem(selected.id, { shot: e.target.value || undefined })}>
                  <option value="">—</option>
                  {SHOTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <label htmlFor="it-move">Movimento</label>
                <select
                  id="it-move"
                  value={selected.move ?? ''}
                  // a new movement starts from its own defaults: what was set for the previous one goes
                  onChange={(e) =>
                    updateItem(selected.id, { move: e.target.value || undefined, movePoints: undefined, moveTo: undefined, moveVia: undefined, moveRot: undefined, endRange: undefined, panAngle: undefined })
                  }
                >
                  <option value="">—</option>
                  {MOVES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {isPathMove(selected.move) && (
                  <>
                    <p className="muted small">
                      Cada ponto é uma câmera clara: arraste para mudar o lugar, gire pela bolinha dela. O losango no meio de cada trecho curva o caminho
                      {isTrackMove(selected.move) ? ' (no trilho, só em arco de círculo)' : ''}.
                    </p>
                    <StopsEditor it={selected} width={map.width} height={map.height} keepOne noun="Ponto" onChange={(next) => updateItem(selected.id, next)} />
                  </>
                )}
                {selected.move === 'Panorâmica' && (
                  <>
                    <label htmlFor="it-pan">Giro (°, negativo para a esquerda)</label>
                    <NumberField
                      id="it-pan"
                      min={-180}
                      max={180}
                      step={15}
                      value={panAngleOf(selected)}
                      onValue={(v) =>
                        updateItem(selected.id, { moveRot: (((selected.rotation + Math.round(v ?? 0)) % 360) + 360) % 360, panAngle: undefined }, false)
                      }
                    />
                    <p className="muted small">Ou gire a câmera clara pela bolinha dela até onde a panorâmica termina.</p>
                  </>
                )}
                {selected.move === 'Zoom' && (
                  <>
                    <label htmlFor="it-zoom">Alcance no fim (m)</label>
                    <NumberField
                      id="it-zoom"
                      min={0.3}
                      max={30}
                      step={0.1}
                      optional
                      value={endViewOf(selected)?.range}
                      onValue={(v) => updateItem(selected.id, { endRange: v }, false)}
                    />
                    <p className="muted small">Ou puxe o quadradinho na ponta do campo de visão claro: mais longe, lente mais longa.</p>
                  </>
                )}
                {(() => {
                  const v = endViewOf(selected)
                  return v ? (
                    <p className="lm-endview" role="status">
                      No fim: {v.lens ? `lente ${v.lens} mm · ` : ''}
                      {v.spread}° · alcance {String(v.range).replace('.', ',')} m
                    </p>
                  ) : null
                })()}
                <label htmlFor="it-height">Altura (m)</label>
                <input id="it-height" type="number" min={0} max={30} step={0.1} value={selected.height ?? ''} onChange={(e) => updateItem(selected.id, { height: optNumber(e.target.value, 0, 30) }, false)} />
              </fieldset>
            )}
            {selected.type === 'actor' && (
              <fieldset className="lm-tech">
                <legend>Marcação</legend>
                <p className="muted small">
                  As marcas por onde o ator passa, em ordem. Cada marca é o ator clarinho: arraste para mudar o lugar, gire pela bolinha para dizer para onde ele olha, curve o caminho pelo losango.
                </p>
                <StopsEditor it={selected} width={map.width} height={map.height} keepOne={false} noun="Marca" onChange={(next) => updateItem(selected.id, next)} />
              </fieldset>
            )}
            {isLight(selected.type) && (
              <fieldset className="lm-tech">
                <legend>Ficha técnica · luz nº {lightNumbers(map).get(selected.id)}</legend>
                <label htmlFor="it-role">Função</label>
                <select id="it-role" value={selected.role ?? ''} onChange={(e) => updateItem(selected.id, { role: (e.target.value || undefined) as LightRole | undefined })}>
                  <option value="">—</option>
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <label htmlFor="it-watts">Potência (W)</label>
                <input
                  id="it-watts"
                  type="number"
                  min={0}
                  max={24000}
                  step={50}
                  placeholder={String(ITEM_DEFS[selected.type].watts ?? '')}
                  value={selected.watts ?? ''}
                  onChange={(e) => updateItem(selected.id, { watts: optNumber(e.target.value, 0, 24000) }, false)}
                />
                <label htmlFor="it-kelvin">Temperatura de cor (K)</label>
                <NumberField
                  id="it-kelvin"
                  list="lm-kelvins"
                  min={1000}
                  max={20000}
                  step={100}
                  optional
                  placeholder={String(ITEM_DEFS[selected.type].kelvin ?? '')}
                  value={selected.kelvin}
                  onValue={(v) => updateItem(selected.id, { kelvin: v }, false)}
                />
                <datalist id="lm-kelvins">
                  {KELVINS.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
                <label htmlFor="it-gel">Gelatina</label>
                <input id="it-gel" list="lm-gels" maxLength={40} placeholder="Nenhuma" value={selected.gel ?? ''} onChange={(e) => updateItem(selected.id, { gel: e.target.value || undefined }, false)} />
                <datalist id="lm-gels">
                  {GELS.map((g) => (
                    <option key={g.name} value={g.name} />
                  ))}
                </datalist>
                {(() => {
                  const eff = effectiveKelvin(selected)
                  const k = selected.kelvin ?? ITEM_DEFS[selected.type].kelvin
                  return eff !== null && eff !== k ? <p className="muted small">Com a gelatina: cerca de {eff} K.</p> : null
                })()}
                <label htmlFor="it-diff">Difusão</label>
                <input id="it-diff" list="lm-diffs" maxLength={40} placeholder="Nenhuma" value={selected.diffusion ?? ''} onChange={(e) => updateItem(selected.id, { diffusion: e.target.value || undefined }, false)} />
                <datalist id="lm-diffs">
                  {DIFFUSIONS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                <div className="row">
                  <div>
                    <label htmlFor="it-int">Intensidade (%)</label>
                    <input id="it-int" type="number" min={0} max={100} step={5} placeholder="100" value={selected.intensity ?? ''} onChange={(e) => updateItem(selected.id, { intensity: optNumber(e.target.value, 0, 100) }, false)} />
                  </div>
                  <div>
                    <label htmlFor="it-lheight">Altura (m)</label>
                    <input id="it-lheight" type="number" min={0} max={30} step={0.1} value={selected.height ?? ''} onChange={(e) => updateItem(selected.id, { height: optNumber(e.target.value, 0, 30) }, false)} />
                  </div>
                </div>
              </fieldset>
            )}
            {itemHasCone(selected.type) && (
              <>
                <label htmlFor="it-spread">Abertura (°)</label>
                <NumberField
                  id="it-spread"
                  min={5}
                  max={180}
                  disabled={selected.type === 'camera' && !!selected.lens}
                  title={selected.type === 'camera' && selected.lens ? 'Calculada pela lente e pelo sensor' : undefined}
                  value={selected.type === 'camera' && selected.lens ? fieldOfView(selected.lens, selected.sensor) : selected.spread ?? 40}
                  onValue={(v) => v !== undefined && updateItem(selected.id, { spread: v }, false)}
                />
                <label htmlFor="it-range">Alcance (m)</label>
                <NumberField
                  id="it-range"
                  min={0.5}
                  max={30}
                  step={0.5}
                  value={selected.range ?? 3}
                  onValue={(v) => v !== undefined && updateItem(selected.id, { range: v }, false)}
                />
              </>
            )}
            {itemHasLength(selected.type) && (
              <>
                <label htmlFor="it-len">Comprimento (m)</label>
                <NumberField
                  id="it-len"
                  min={0.2}
                  max={30}
                  step={0.1}
                  value={selected.length ?? 1}
                  onValue={(v) => v !== undefined && updateItem(selected.id, { length: v }, false)}
                />
              </>
            )}
            {itemHasDepth(selected.type) && (
              <>
                <label htmlFor="it-depth">Largura (m)</label>
                <NumberField
                  id="it-depth"
                  min={0.2}
                  max={30}
                  step={0.1}
                  value={selected.depth ?? ITEM_DEFS[selected.type].depth ?? 0.8}
                  onValue={(v) => v !== undefined && updateItem(selected.id, { depth: v }, false)}
                />
              </>
            )}
            <div className="row">
              <div>
                <label htmlFor="it-x">X (m)</label>
                <input
                  id="it-x"
                  type="number"
                  step={0.1}
                  value={Number(selected.x.toFixed(2))}
                  onChange={(e) => updateItem(selected.id, { x: clamp(Number(e.target.value) || 0, 0, map.width) }, false)}
                />
              </div>
              <div>
                <label htmlFor="it-y">Y (m)</label>
                <input
                  id="it-y"
                  type="number"
                  step={0.1}
                  value={Number(selected.y.toFixed(2))}
                  onChange={(e) => updateItem(selected.id, { y: clamp(Number(e.target.value) || 0, 0, map.height) }, false)}
                />
              </div>
            </div>
            <div className="row">
              <button className="btn secondary small" onClick={duplicateSelected}>
                Duplicar
              </button>
              <button className="btn ghost small" onClick={removeSelected}>
                Apagar
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">Clique numa peça do desenho para editar. Arraste para mover.</p>
        )}

        <h2>Peças no mapa ({map.items.length})</h2>
        {map.items.length === 0 ? (
          <p className="muted">Nenhuma peça ainda. Escolha uma na lista à esquerda.</p>
        ) : (
          <ul className="lm-items">
            {map.items.map((i) => (
              <li key={i.id}>
                <button className={i.id === selId ? 'on' : ''} onClick={() => setSelId(i.id)}>
                  {numbers.has(i.id) ? `nº ${numbers.get(i.id)} · ` : ''}
                  {describeItem(i)}
                </button>
              </li>
            ))}
          </ul>
        )}

        {mapWatts(map) > 0 && (
          <p className="lm-load" role="status">
            <b>Carga deste mapa:</b> {loadText(mapWatts(map))}
          </p>
        )}

        <h2>Notas do mapa</h2>
        <label className="sr-only" htmlFor="lm-notes">
          Notas
        </label>
        <textarea
          id="lm-notes"
          rows={5}
          placeholder="Temperatura de cor, filtros, alturas, observações para a equipe…"
          value={map.notes}
          onChange={(e) => updateMap({ notes: e.target.value }, false)}
        />
      </aside>
    </div>
  )
}

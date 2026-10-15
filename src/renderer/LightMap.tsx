import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LightItem, LightItemType, LightMap } from '../shared/types'
import {
  GROUPS,
  ITEM_DEFS,
  ITEM_TYPES,
  S,
  describeItem,
  itemHasCone,
  itemHasLength,
  lightMapSvg,
  newItem,
  newLightMap,
  symbolPreview
} from '../shared/lightmap'
import { newId } from '../shared/structures'

interface Props {
  maps: LightMap[]
  scenes: { number: string; text: string }[]
  onChange(maps: LightMap[]): void
  onExport(): void
}

interface Drag {
  id: string
  startPointer: { x: number; y: number }
  startItem: { x: number; y: number }
}

const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5]
const round = (n: number, step: number): number => Math.round(n / step) * step
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export function LightMapView({ maps, scenes, onChange, onExport }: Props): JSX.Element {
  const [mapId, setMapId] = useState<string | null>(maps[0]?.id ?? null)
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
  /** Changes the size of the set and pulls every piece back inside it. */
  const resize = (width: number, height: number): void => {
    if (!map) return
    record()
    onChange(
      maps.map((m) =>
        m.id === map.id
          ? { ...m, width, height, items: m.items.map((i) => ({ ...i, x: clamp(i.x, 0, width), y: clamp(i.y, 0, height) })) }
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
    const hit = (e.target as Element).closest('[data-item]')
    surface.current?.focus()
    if (!hit || !map) {
      setSelId(null)
      return
    }
    const id = hit.getAttribute('data-item') as string
    const it = map.items.find((i) => i.id === id)
    const p = toMeters(e)
    if (!it || !p) return
    setSelId(id)
    record()
    drag.current = { id, startPointer: p, startItem: { x: it.x, y: it.y } }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (!d || !map) return
    const p = toMeters(e)
    if (!p) return
    let x = d.startItem.x + (p.x - d.startPointer.x)
    let y = d.startItem.y + (p.y - d.startPointer.y)
    if (snap && !e.shiftKey) {
      x = round(x, 0.1)
      y = round(y, 0.1)
    }
    x = clamp(x, 0, map.width)
    y = clamp(y, 0, map.height)
    updateMapNoRecord(mapsRef.current.find((m) => m.id === map.id)!.items.map((i) => (i.id === d.id ? { ...i, x, y } : i)))
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
              {ITEM_TYPES.filter((t) => ITEM_DEFS[t].group === g).map((t) => (
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
          <input
            id="lm-w"
            type="number"
            min={2}
            max={60}
            step={0.5}
            value={map.width}
            onChange={(e) => resize(clamp(Number(e.target.value) || map.width, 2, 60), map.height)}
          />
          <label htmlFor="lm-h">Fundo (m)</label>
          <input
            id="lm-h"
            type="number"
            min={2}
            max={60}
            step={0.5}
            value={map.height}
            onChange={(e) => resize(map.width, clamp(Number(e.target.value) || map.height, 2, 60))}
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
            {itemHasCone(selected.type) && (
              <>
                <label htmlFor="it-spread">Abertura (°)</label>
                <input
                  id="it-spread"
                  type="number"
                  min={5}
                  max={180}
                  value={selected.spread ?? 40}
                  onChange={(e) => updateItem(selected.id, { spread: clamp(Number(e.target.value) || 40, 5, 180) }, false)}
                />
                <label htmlFor="it-range">Alcance (m)</label>
                <input
                  id="it-range"
                  type="number"
                  min={0.5}
                  max={30}
                  step={0.5}
                  value={selected.range ?? 3}
                  onChange={(e) => updateItem(selected.id, { range: clamp(Number(e.target.value) || 3, 0.5, 30) }, false)}
                />
              </>
            )}
            {itemHasLength(selected.type) && (
              <>
                <label htmlFor="it-len">Comprimento (m)</label>
                <input
                  id="it-len"
                  type="number"
                  min={0.2}
                  max={30}
                  step={0.1}
                  value={selected.length ?? 1}
                  onChange={(e) => updateItem(selected.id, { length: clamp(Number(e.target.value) || 1, 0.2, 30) }, false)}
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
                  {describeItem(i)}
                </button>
              </li>
            ))}
          </ul>
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

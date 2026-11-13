import { useState } from 'react'
import type { LightMap, Lighting, Production } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import type { Report } from '../shared/reports'
import { LightMapView } from './LightMap'
import { LightSheetView } from './LightSheet'
import { LightSunView } from './LightSun'
import { EquipmentView } from './Equipment'
import { heaviestLoad, lightAutoLines, renameLightModel } from '../shared/equipment'
import { loadText } from '../shared/lightmap'

interface Props {
  maps: LightMap[]
  /** The scenes as the light map's scene picker lists them. */
  mapScenes: { number: string; text: string }[]
  scenes: SceneInfo[]
  lighting: Lighting
  production: Production
  /** The scene's id, given to its heading first if it has none. */
  sceneId(s: SceneInfo): string | null
  onMaps(maps: LightMap[]): void
  onLighting(l: Lighting): void
  onProduction(p: Production): void
  onExportMaps(): void
  onExportPdf(r: Report, landscape: boolean): void
  onExportCsv(name: string, csv: string): void
  /** Opens this map (from the navigator or the breakdown). */
  focusMap?: string
}

type Tab = 'plan' | 'sheets' | 'sun' | 'equipment'

/** The lighting department's window: the light maps, a sheet per scene, the sun of each shooting day, equipment. */
export function LightView(p: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('plan')
  const [focus, setFocus] = useState(p.focusMap)
  const tabBtn = (t: Tab, label: string): JSX.Element => (
    <button className="btn ghost" aria-pressed={tab === t} onClick={() => setTab(t)}>
      {label}
    </button>
  )
  return (
    <div className="light-window">
      <div className="snd-head">
        <div className="seg snd-tabs" role="group" aria-label="Luz">
          {tabBtn('plan', 'Planta')}
          {tabBtn('sheets', 'Ficha por cena')}
          {tabBtn('sun', 'Sol e horários')}
          {tabBtn('equipment', 'Equipamento')}
        </div>
      </div>
      {tab === 'plan' && <LightMapView key={focus ?? ''} maps={p.maps} scenes={p.mapScenes} onChange={p.onMaps} onExport={p.onExportMaps} focusMap={focus} />}
      {tab === 'sheets' && (
        <LightSheetView
          lighting={p.lighting}
          maps={p.maps}
          scenes={p.scenes}
          sceneId={p.sceneId}
          onChange={p.onLighting}
          onOpenMap={(id) => {
            setFocus(id)
            setTab('plan')
          }}
          onExportPdf={p.onExportPdf}
        />
      )}
      {tab === 'sun' && (
        <LightSunView lighting={p.lighting} production={p.production} scenes={p.scenes} onLighting={p.onLighting} onProduction={p.onProduction} onExportPdf={p.onExportPdf} />
      )}
      {tab === 'equipment' && (
        <EquipmentView
          title="Equipamento de luz"
          reportId="equipamento-luz"
          auto={lightAutoLines(p.maps)}
          items={p.lighting.equipment}
          state={p.lighting.equipState}
          note={heaviestLoad(p.maps).watts > 0 ? `Carga do mapa mais pesado: ${loadText(heaviestLoad(p.maps).watts)}.` : undefined}
          onChange={(equipment, equipState) => p.onLighting({ ...p.lighting, equipment, equipState })}
          onExportPdf={(r) => p.onExportPdf(r, false)}
          onExportCsv={p.onExportCsv}
          onRename={(key, model) => {
            const r = renameLightModel(p.maps, p.lighting, key, model)
            p.onMaps(r.maps)
            p.onLighting(r.lighting)
          }}
        />
      )}
    </div>
  )
}

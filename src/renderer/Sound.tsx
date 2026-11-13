import { useState } from 'react'
import type { LightMap, Sound } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import type { Report } from '../shared/reports'
import { SoundPlanView } from './SoundPlan'
import { SoundSheetView } from './SoundSheet'
import { AmbiencesView } from './Ambiences'
import { EquipmentView } from './Equipment'
import { renameSoundModel, soundAutoLines } from '../shared/equipment'

interface Props {
  sound: Sound
  maps: LightMap[]
  scenes: SceneInfo[]
  /** The scene's id, given to its heading first if it has none. */
  sceneId(s: SceneInfo): string | null
  onChange(s: Sound): void
  onExportPlans(): void
  onExportPdf(r: Report, landscape: boolean): void
  onExportCsv(name: string, csv: string): void
}

type Tab = 'plan' | 'sheets' | 'library' | 'equipment'

/** The sound department's window: the microphones on the set, a sheet per scene, ambiences and music, equipment. */
export function SoundView(p: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('plan')
  const tabBtn = (t: Tab, label: string): JSX.Element => (
    <button className="btn ghost" aria-pressed={tab === t} onClick={() => setTab(t)}>
      {label}
    </button>
  )
  return (
    <div className="snd">
      <div className="snd-head">
        <div className="seg snd-tabs" role="group" aria-label="Som">
          {tabBtn('plan', 'Planta')}
          {tabBtn('sheets', 'Ficha por cena')}
          {tabBtn('library', 'Ambientes e músicas')}
          {tabBtn('equipment', 'Equipamento')}
        </div>
        {tab === 'plan' && p.sound.plans.length > 0 && (
          <button className="btn secondary" onClick={p.onExportPlans}>
            Exportar plantas (PDF)
          </button>
        )}
      </div>
      {tab === 'plan' && <SoundPlanView sound={p.sound} maps={p.maps} scenes={p.scenes} sceneId={p.sceneId} onChange={p.onChange} />}
      {tab === 'sheets' && (
        <SoundSheetView sound={p.sound} maps={p.maps} scenes={p.scenes} sceneId={p.sceneId} onChange={p.onChange} onExportPdf={p.onExportPdf} />
      )}
      {tab === 'library' && (
        <AmbiencesView sound={p.sound} scenes={p.scenes} sceneId={p.sceneId} onChange={p.onChange} onExportPdf={p.onExportPdf} onExportCsv={p.onExportCsv} />
      )}
      {tab === 'equipment' && (
        <EquipmentView
          title="Equipamento de som"
          reportId="equipamento-som"
          auto={soundAutoLines(p.sound)}
          items={p.sound.equipment}
          state={p.sound.equipState}
          onChange={(equipment, equipState) => p.onChange({ ...p.sound, equipment, equipState })}
          onExportPdf={(r) => p.onExportPdf(r, false)}
          onExportCsv={p.onExportCsv}
          onRename={(key, model) => p.onChange(renameSoundModel(p.sound, key, model))}
        />
      )}
    </div>
  )
}

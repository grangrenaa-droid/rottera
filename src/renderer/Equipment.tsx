import type { EquipItem, EquipState } from '../shared/types'
import type { Report } from '../shared/reports'
import { reportToCsv } from '../shared/reports'
import { equipmentReport, type AutoLine } from '../shared/equipment'
import { newId } from '../shared/structures'

interface Props {
  /** "Equipamento de som" (and, later, "Equipamento de luz"): the report's title and the file names. */
  title: string
  reportId: string
  /** What comes by itself from the drawings: the name and quantity are fixed, the rest is written here. */
  auto: AutoLine[]
  items: EquipItem[]
  state: Record<string, EquipState>
  onChange(items: EquipItem[], state: Record<string, EquipState>): void
  onExportPdf(r: Report): void
  onExportCsv(name: string, csv: string): void
  /** A line above the table (the light window: the load of the heaviest map). */
  note?: string
}

const NO_STATE: EquipState = { rental: '', out: false, back: false, notes: '' }

/** A working list for the rental house: what to take, from where, and whether it went out and came back. */
export function EquipmentView(p: Props): JSX.Element {
  const report = (): Report => equipmentReport(p.title, p.auto, p.items, p.state, p.reportId)
  const setState = (key: string, patch: Partial<EquipState>): void =>
    p.onChange(p.items, { ...p.state, [key]: { ...NO_STATE, ...p.state[key], ...patch } })
  const setItem = (id: string, patch: Partial<EquipItem>): void => p.onChange(p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)), p.state)
  const add = (): void => p.onChange([...p.items, { id: newId('eq'), name: '', qty: 1, rental: '', out: false, back: false, notes: '' }], p.state)

  const common = (name: string, v: { rental: string; out: boolean; back: boolean; notes: string }, set: (patch: Partial<EquipState>) => void): JSX.Element => (
    <>
      <td>
        <input value={v.rental} maxLength={200} aria-label={`Locadora de ${name}`} onChange={(e) => set({ rental: e.target.value })} />
      </td>
      <td className="eq-check">
        <input type="checkbox" checked={v.out} aria-label={`${name} retirado`} onChange={(e) => set({ out: e.target.checked })} />
      </td>
      <td className="eq-check">
        <input type="checkbox" checked={v.back} aria-label={`${name} devolvido`} onChange={(e) => set({ back: e.target.checked })} />
      </td>
      <td>
        <input value={v.notes} maxLength={2000} aria-label={`Observações de ${name}`} onChange={(e) => set({ notes: e.target.value })} />
      </td>
    </>
  )

  return (
    <div className="equipment">
      <header className="equipment-head">
        <p className="muted">
          {p.note && (
            <>
              <b className="eq-note">{p.note}</b>{' '}
            </>
          )}
          {p.auto.length > 0 ? 'As linhas marcadas “da planta” vêm sozinhas dos desenhos; o resto você acrescenta.' : 'Acrescente o que vai ser alugado ou levado para o set.'}
        </p>
        <div className="row">
          <button className="btn secondary" onClick={add}>
            + Item
          </button>
          <button className="btn secondary" onClick={() => p.onExportPdf(report())}>
            Exportar PDF
          </button>
          <button className="btn secondary" onClick={() => p.onExportCsv(p.title, reportToCsv(report()))}>
            Exportar CSV
          </button>
        </div>
      </header>
      <table className="equipment-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Qtd.</th>
            <th scope="col">Locadora</th>
            <th scope="col">Retirado</th>
            <th scope="col">Devolvido</th>
            <th scope="col">Observações</th>
            <th scope="col">
              <span className="sr-only">Apagar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {p.auto.map((l) => (
            <tr key={l.key} className="eq-auto">
              <td>
                {l.name} <span className="eq-tag">da planta</span>
              </td>
              <td className="eq-qty">{l.qty}</td>
              {common(l.name, { ...NO_STATE, ...p.state[l.key] }, (patch) => setState(l.key, patch))}
              <td />
            </tr>
          ))}
          {p.items.map((i, n) => {
            const name = i.name.trim() || `item ${n + 1}`
            return (
              <tr key={i.id}>
                <td>
                  <input value={i.name} maxLength={200} placeholder="Ex.: fone, bateria, cabo XLR" aria-label={`Nome do ${name}`} onChange={(e) => setItem(i.id, { name: e.target.value })} />
                </td>
                <td className="eq-qty">
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={i.qty}
                    aria-label={`Quantidade de ${name}`}
                    onChange={(e) => setItem(i.id, { qty: Math.max(0, Math.min(9999, Math.round(Number(e.target.value) || 0))) })}
                  />
                </td>
                {common(name, i, (patch) => setItem(i.id, patch))}
                <td>
                  <button className="icon" aria-label={`Apagar ${name}`} onClick={() => p.onChange(p.items.filter((x) => x.id !== i.id), p.state)}>
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
          {p.auto.length === 0 && p.items.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                Nada na lista ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

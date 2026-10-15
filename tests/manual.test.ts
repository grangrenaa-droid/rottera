import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MANUAL, fold, searchManual } from '../src/shared/manual'
import { KINDS, LABELS, ENTER_NEXT, tabResult } from '../src/shared/elements'
import { formatDiagnostics, scrub, type DiagnosticsInput } from '../src/shared/diagnostics'

const src = (p: string): string => readFileSync(join(__dirname, '..', p), 'utf8')
const ui = [src('src/renderer/App.tsx'), src('src/renderer/Dialogs.tsx'), src('src/renderer/Board.tsx'), src('src/renderer/Characters.tsx'), src('src/renderer/Reports.tsx'), src('src/renderer/Storyboard.tsx'), src('src/main/index.ts')].join('\n')

describe('manual search', () => {
  it('has unique ids and every topic has text', () => {
    const ids = MANUAL.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of MANUAL) {
      expect(t.title.length).toBeGreaterThan(3)
      expect(t.body.length).toBeGreaterThan(0)
    }
  })

  it('finds a topic without accents or capitals', () => {
    expect(fold('Ação')).toBe('acao')
    expect(searchManual('acao')[0]).toBeDefined()
    expect(searchManual('DIALOGO duplo')[0].topic.id).toBe('duplo')
    expect(searchManual('versoes anteriores')[0].topic.id).toBe('salvar')
  })

  it('needs every word, ranks the title first, and says nothing when nothing matches', () => {
    expect(searchManual('storyboard')[0].topic.id).toBe('storyboard')
    expect(searchManual('storyboard zzzxqj')).toEqual([])
    expect(searchManual('').length).toBe(MANUAL.length)
  })
})

describe('what the manual says is true', () => {
  it('the shortcut list matches the editor element order', () => {
    const t = MANUAL.find((x) => x.id === 'elementos')!
    const list = t.body.find((p) => p.t === 'ul') as { t: 'ul'; items: string[] }
    expect(list.items).toHaveLength(KINDS.length)
    KINDS.forEach((k, i) => {
      expect(list.items[i].startsWith(`Ctrl+${i + 1} `)).toBe(true)
      expect(fold(list.items[i])).toContain(fold(LABELS[k]))
    })
  })

  it('Enter and Tab follow the tables in elements.ts', () => {
    expect(ENTER_NEXT.scene_heading).toBe('action')
    expect(ENTER_NEXT.character).toBe('dialogue')
    expect(ENTER_NEXT.dialogue).toBe('action')
    expect(ENTER_NEXT.transition).toBe('scene_heading')
    expect(tabResult('action', 'x')).toEqual({ type: 'new', kind: 'character' })
    expect(tabResult('character', 'x')).toEqual({ type: 'new', kind: 'parenthetical' })
    expect(tabResult('parenthetical', 'x')).toEqual({ type: 'new', kind: 'dialogue' })
    expect(tabResult('dialogue', 'x')).toEqual({ type: 'new', kind: 'character' })
  })

  it('every menu or button name the manual quotes exists in the app', () => {
    const quoted = [
      'Versões anteriores',
      'Gerenciar SmartType',
      'Modo de revisão',
      'Limpar marcas de revisão',
      'Mostrar números de cena',
      'Travar numeração',
      'Papel do PDF',
      'Virar cena',
      'Criar cenas para',
      'Escolher imagens',
      'Incluir no PDF do roteiro',
      'Exportar fichas',
      'Exportar CSV',
      'Exportar relatório (PDF)',
      'Importar FDX ou Fountain',
      'Conectar ao Claude',
      'Copiar diagnóstico',
      'Recuperar rascunho',
      'Fichas de personagem',
      'Diálogo duplo'
    ]
    for (const q of quoted) expect(ui, q).toContain(q)
    // and the manual really uses them
    const all = MANUAL.map((t) => JSON.stringify(t.body)).join(' ')
    for (const q of ['Versões anteriores', 'Virar cena', 'Copiar diagnóstico']) expect(all).toContain(q)
  })

  it('the numbers in the text match the code', () => {
    const backups = src('src/main/backups.ts')
    expect(backups).toContain('KEEP = 40')
    expect(backups).toContain('AUTO_GAP_MS = 5 * 60 * 1000')
    expect(src('src/renderer/Storyboard.tsx')).toContain('1600')
  })
})

describe('diagnostics text', () => {
  const base: DiagnosticsInput = {
    app: '0.1.0',
    electron: '33.4.11',
    chrome: '130',
    node: '20',
    platform: 'win32',
    osRelease: '10.0.26300',
    arch: 'x64',
    locale: 'pt-BR',
    memoryGb: 16,
    uptimeMin: 12,
    packaged: true,
    bridgeOn: true,
    script: { open: true, saved: 'Salvo', blocks: 40, scenes: 5, pages: 3, paper: 'a4', beats: 2, frames: 0, lightMaps: 1, characters: 3, versions: 4 },
    view: { panel: 'script', theme: 'night', width: 1200, height: 800, zoom: 1 },
    startedAfterCrash: false,
    events: []
  }

  it('removes drive paths, UNC paths, file URLs and e-mail addresses', () => {
    const s = scrub('ENOENT C:\\Users\\Maria\\Documents\\Roteiro Final.rotera e \\\\servidor\\pasta\\x.fdx em file:///C:/Users/Maria/a.js por maria@exemplo.com')
    expect(s).not.toMatch(/Maria|servidor|exemplo\.com|Roteiro/)
    expect(s).toContain('<caminho>')
  })

  it('limits one message to a short line', () => {
    expect(scrub('x'.repeat(5000)).length).toBe(300)
    expect(scrub('a\nb\n\nc')).toBe('a b c')
  })

  it('is plain numbers and versions, and says it holds no script text', () => {
    const t = formatDiagnostics(base, new Date('2026-10-12T10:00:00Z'))
    expect(t).toContain('Rottera 0.1.0')
    expect(t).toContain('40 blocos, 5 cenas, 3 páginas')
    expect(t).toContain('não inclui o roteiro')
    expect(t).toContain('(nenhum)')
  })

  it('without an open script it says so, and keeps only the last 30 events', () => {
    const events = Array.from({ length: 50 }, (_, i) => `evento ${i}`)
    const t = formatDiagnostics({ ...base, script: null, events })
    expect(t).toContain('Nenhum roteiro aberto.')
    expect(t).toContain('evento 49')
    expect(t).not.toContain('evento 19')
  })
})

describe('page text', () => {
  it('names the marks the paginator really writes', () => {
    const pag = src('src/shared/paginate.ts')
    expect(pag).toContain("'(MORE)'")
    expect(pag).toContain("(CONT'D)")
    const t = MANUAL.find((x) => x.id === 'paginas')!
    expect(JSON.stringify(t.body)).toContain('(MORE)')
  })
})

import type { ElectronApplication, Page } from '@playwright/test'
import { expect, newScript, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

/** Window content size in DIPs and the zoom the user (or Windows display scaling) applies. */
async function setView(app: ElectronApplication, page: Page, width: number, height: number, zoom: number): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, a) => {
      const w = BrowserWindow.getAllWindows()[0]
      if (w.isMaximized()) w.unmaximize()
      w.setContentSize(a.width, a.height)
      w.webContents.setZoomFactor(a.zoom)
    },
    { width, height, zoom }
  )
  await page.waitForTimeout(250)
}

interface Problem {
  kind: string
  what: string
}

/** Everything that would make the screen hard to use at the current size. */
async function layoutProblems(page: Page): Promise<Problem[]> {
  return page.evaluate(() => {
    const out: { kind: string; what: string }[] = []
    const vw = window.innerWidth
    const vh = window.innerHeight
    const name = (el: Element): string =>
      `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String((el as HTMLElement).className || '').split(' ')[0]} "${(el.textContent ?? '').trim().slice(0, 24)}"`
    const visible = (el: Element): boolean => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
    }
    // regions that are meant to scroll sideways
    const scrollers = ['.lanes', '.lm-scroll', '.canvas', '.sheet-wrap', '.st-list', 'table', '.reports', '.recent', 'dialog']
    const inScroller = (el: Element): boolean => scrollers.some((s) => el.closest(s) !== null)

    if (document.documentElement.scrollWidth > vw + 1) {
      out.push({ kind: 'page-overflow', what: `document is ${document.documentElement.scrollWidth}px wide in a ${vw}px window` })
    }
    for (const el of document.querySelectorAll('button, select, input:not([type=file]):not([hidden]), textarea')) {
      if (!visible(el) || inScroller(el)) continue
      const r = el.getBoundingClientRect()
      if (r.right > vw + 1 || r.left < -1) out.push({ kind: 'off-screen', what: `${name(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} in a ${vw}px window` })
    }

    const vScrollers = ['.home', '.canvas', '.lm-scroll', '.lm-side', '.lm-props', '.nav', 'dialog', '.popover-panel', '.reports', '.lanes']
    for (const el of document.querySelectorAll('button, select, input:not([type=file]):not([hidden]), textarea')) {
      if (!visible(el) || vScrollers.some((q) => el.closest(q) !== null)) continue
      const r = el.getBoundingClientRect()
      if (r.bottom > vh + 1) out.push({ kind: 'below-screen', what: `${name(el)} ends at ${Math.round(r.bottom)} in a ${vh}px window` })
    }

    // controls that sit side by side must not overlap
    const bars = document.querySelectorAll('.toolbar, .findbar, .board-bar, .status')
    for (const bar of bars) {
      const kids = [...bar.children].filter(visible)
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect()
          const b = kids[j].getBoundingClientRect()
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (w > 3 && h > 3) out.push({ kind: 'overlap', what: `${name(kids[i])} and ${name(kids[j])} overlap by ${Math.round(w)}x${Math.round(h)}` })
        }
      }
    }

    // text that does not fit its button
    for (const el of document.querySelectorAll('.btn, .seg button, .lm-piece, .scene')) {
      if (!visible(el)) continue
      const h = el as HTMLElement
      // scrollWidth counts text that spills out even when overflow is visible
      const r = h.getBoundingClientRect()
      const spills = [...h.childNodes].some((n) => {
        if (n.nodeType !== 3) return false
        const range = document.createRange()
        range.selectNodeContents(n)
        const tr = range.getBoundingClientRect()
        return tr.right > r.right + 1 || tr.left < r.left - 1
      })
      if ((h.scrollWidth > h.clientWidth + 1 || spills) && !h.classList.contains('scene')) {
        out.push({ kind: 'clipped-text', what: `${name(el)} needs ${h.scrollWidth}px, has ${h.clientWidth}px` })
      }
    }

    // the status bar and the work area must still be on screen and usable
    const status = document.querySelector('.status')
    if (status) {
      const r = status.getBoundingClientRect()
      if (r.bottom > vh + 1) out.push({ kind: 'status-off-screen', what: `status bar bottom at ${Math.round(r.bottom)} in a ${vh}px window` })
    }
    const work = document.querySelector('.canvas')
    if (work) {
      const r = work.getBoundingClientRect()
      if (r.height < 120) out.push({ kind: 'work-area-squeezed', what: `work area is only ${Math.round(r.height)}px tall` })
    }
    return out
  })
}

const SIZES: { w: number; h: number; zoom: number; label: string }[] = [
  { w: 1280, h: 800, zoom: 1, label: '100%' },
  { w: 1280, h: 800, zoom: 1.25, label: 'zoom 125%' },
  { w: 1280, h: 800, zoom: 1.5, label: 'zoom 150% (Windows scale 150% on 1920x1080)' },
  { w: 1280, h: 800, zoom: 2, label: 'zoom 200%' },
  { w: 1280, h: 800, zoom: 2.5, label: 'zoom 250%' },
  { w: 760, h: 520, zoom: 1, label: 'smallest window, 100%' },
  { w: 760, h: 520, zoom: 1.5, label: 'smallest window, 150%' }
]

test.describe('F11 narrow windows and display scaling', () => {
  test('F11-W1 the window cannot be made smaller than the minimum', async ({ app, page }) => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(300, 200))
    await page.waitForTimeout(200)
    const size = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentSize())
    expect(size[0]).toBeGreaterThanOrEqual(740) // 760 outer, minus the window frame
    expect(size[1]).toBeGreaterThanOrEqual(440) // 520 outer, minus title bar and menu
  })

  for (const s of SIZES) {
    test(`F11-L1 home screen at ${s.label} (${s.w}x${s.h})`, async ({ app, page }) => {
      await setView(app, page, s.w, s.h, s.zoom)
      expect(await layoutProblems(page)).toEqual([])
    })

    test(`F11-L2 editor, navigator and toolbar at ${s.label} (${s.w}x${s.h})`, async ({ app, page, editor }) => {
      await newScript(page)
      await page.keyboard.press('Control+2')
      await editor.pressSequentially('Texto para ocupar a página e ver como ela cabe na janela.')
      await setView(app, page, s.w, s.h, s.zoom)
      expect(await layoutProblems(page)).toEqual([])
      // the page can be scrolled sideways when it is wider than the window, so no text is out of reach
      const reachable = await page.evaluate(() => {
        const c = document.querySelector('.canvas') as HTMLElement
        const sheet = document.querySelector('.sheet') as HTMLElement
        return c.scrollWidth >= sheet.getBoundingClientRect().width - 1 || c.clientWidth >= sheet.getBoundingClientRect().width
      })
      expect(reachable).toBe(true)
    })

    test(`F11-L3 other panels at ${s.label} (${s.w}x${s.h})`, async ({ app, page }) => {
      test.setTimeout(120_000)
      await newScript(page)
      await page.getByRole('button', { name: 'Beat Board', exact: true }).click()
      await page.getByRole('button', { name: 'Aplicar estrutura' }).click()
      await page.getByRole('button', { name: 'Storyboard', exact: true }).click()
      await page.getByRole('button', { name: 'Quadro vazio' }).click()
      await page.getByRole('button', { name: 'Quadro vazio' }).click()
      await page.getByRole('button', { name: 'Mapa de Luz', exact: true }).click()
      await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
      for (const t of ['Câmera', 'Ator ou atriz', 'Fresnel']) await page.locator('.lm-piece', { hasText: t }).click()
      await setView(app, page, s.w, s.h, s.zoom)
      const found: string[] = []
      for (const tab of ['Beat Board', 'Storyboard', 'Mapa de Luz', 'Relatórios']) {
        await page.getByRole('button', { name: tab, exact: true }).click()
        await page.waitForTimeout(150)
        for (const p of await layoutProblems(page)) found.push(`${tab}: ${p.kind}: ${p.what}`)
      }
      expect(found).toEqual([])
    })

    test(`F11-L4 dialogs fit and can be closed at ${s.label} (${s.w}x${s.h})`, async ({ app, page }) => {
      await newScript(page)
      await setView(app, page, s.w, s.h, s.zoom)
      const found: string[] = []
      for (const item of ['Conectar ao Claude…', 'Gerenciar SmartType…', 'Página de título…']) {
        await page.getByRole('button', { name: 'Mais' }).click()
        await page.getByRole('button', { name: item }).click()
        const dlg = page.getByRole('dialog')
        await expect(dlg).toBeVisible()
        const fit = await page.evaluate(() => {
          const d = document.querySelector('dialog') as HTMLElement
          const r = d.getBoundingClientRect()
          // the last button must be reachable: either on screen or inside a scrollable dialog
          const buttons = [...d.querySelectorAll('button')]
          const last = buttons[buttons.length - 1]
          last.scrollIntoView({ block: 'nearest' })
          const lr = last.getBoundingClientRect()
          return {
            inside: r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1,
            lastReachable: lr.bottom <= window.innerHeight + 1 && lr.top >= -1 && lr.right <= window.innerWidth + 1
          }
        })
        if (!fit.inside) found.push(`${item}: dialog is bigger than the window`)
        if (!fit.lastReachable) found.push(`${item}: last button cannot be reached`)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      expect(found).toEqual([])
    })
  }
})

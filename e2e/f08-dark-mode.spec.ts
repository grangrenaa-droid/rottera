import { axeViolations, expect, newScript, test } from './fixtures'
import type { Page } from '@playwright/test'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const bg = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const luminance = (rgb: string): number => {
  const [r, g, b] = (/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb) ?? []).slice(1).map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

test.describe('F08 dark mode', () => {
  test('F08-H1 the theme selector is on the home screen and in the editor', async ({ page }) => {
    await expect(page.getByLabel('Tema')).toBeVisible()
    await newScript(page)
    await expect(page.getByLabel('Tema')).toBeVisible()
  })

  test('F08-H2 Noite and Meia-noite make the whole window dark, Claro makes it light', async ({ page }) => {
    await newScript(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.getByLabel('Tema').selectOption('night')
    expect(luminance(await bg(page))).toBeLessThan(0.3)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark')
    // the script page itself is dark too
    const paper = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet') as Element).backgroundColor)
    expect(luminance(paper)).toBeLessThan(0.3)
    await page.getByLabel('Tema').selectOption('midnight')
    expect(luminance(await bg(page))).toBeLessThan(0.15)
    await page.getByLabel('Tema').selectOption('light')
    expect(luminance(await bg(page))).toBeGreaterThan(0.8)
  })

  test('F08-H3 Automático follows the Windows setting, Claro does not', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.getByLabel('Tema').selectOption('auto')
    expect(luminance(await bg(page))).toBeLessThan(0.3)
    await page.getByLabel('Tema').selectOption('light')
    expect(luminance(await bg(page))).toBeGreaterThan(0.8)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.getByLabel('Tema').selectOption('auto')
    expect(luminance(await bg(page))).toBeGreaterThan(0.8)
  })

  test('F08-E1 the choice survives a reload', async ({ page }) => {
    await page.getByLabel('Tema').selectOption('midnight')
    await page.reload()
    await expect(page.getByLabel('Tema')).toHaveValue('midnight')
    expect(luminance(await bg(page))).toBeLessThan(0.15)
  })

  test('F08-E2 every panel stays readable in the dark themes (contrast scan)', async ({ page }) => {
    await newScript(page)
    page.on('dialog', (d) => void d.accept())
    const found: string[] = []
    const fill: Record<string, string> = {
      'Beat Board': 'Aplicar estrutura',
      Storyboard: 'Quadro vazio',
      'Mapa de Luz': 'Criar o primeiro mapa'
    }
    for (const theme of ['night', 'midnight']) {
      await page.getByLabel('Tema').selectOption(theme)
      for (const tab of ['Roteiro', 'Beat Board', 'Storyboard', 'Mapa de Luz', 'Relatórios']) {
        await page.getByRole('button', { name: tab, exact: true }).click()
        const extra = fill[tab]
        if (extra && theme === 'night') await page.getByRole('button', { name: extra }).click()
        await page.waitForTimeout(250)
        for (const v of await axeViolations(page)) found.push(`${theme}/${tab}: ${v}`)
      }
    }
    expect(found).toEqual([])
  })

  test('F08-E3 text is never dark on dark: no element has the same text and background colour', async ({ page }) => {
    await newScript(page)
    await page.getByLabel('Tema').selectOption('night')
    await page.waitForTimeout(400) // buttons fade between themes
    const bad = await page.evaluate(() => {
      const out: string[] = []
      const parse = (c: string): number[] | null => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c)
        return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null
      }
      const bgOf = (el: Element | null): number[] => {
        for (let e = el; e; e = e.parentElement) {
          const c = parse(getComputedStyle(e).backgroundColor)
          if (c && c[3] > 0.5) return c
        }
        return [0, 0, 0, 1]
      }
      for (const el of document.querySelectorAll('button, select, input, textarea, label, h1, h2, h3, p, span, li')) {
        const t = (el.textContent ?? '').trim()
        if (!t && !(el as HTMLInputElement).value) continue
        const fg = parse(getComputedStyle(el).color)
        const b = bgOf(el)
        if (!fg) continue
        const d = Math.abs(fg[0] - b[0]) + Math.abs(fg[1] - b[1]) + Math.abs(fg[2] - b[2])
        if (d < 120) out.push(`${el.tagName.toLowerCase()} "${t.slice(0, 30)}" fg=${fg.slice(0, 3)} bg=${b.slice(0, 3)}`)
      }
      return out
    })
    expect(bad).toEqual([])
  })
})

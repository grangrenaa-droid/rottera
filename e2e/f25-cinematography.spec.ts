import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { axeViolations, expect, newScript, setTheme, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

async function lightMapTab(page: Page): Promise<void> {
  await page.locator('.seg button', { hasText: /^Luz$/ }).click()
  await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
}
// by the accessible name: some icons draw a letter (the H of the HMI) that would join the button's text
const piece = (page: Page, name: string) => page.locator('.lm-side').getByRole('button', { name, exact: true })
const beamOfSelected = (page: Page) =>
  page.evaluate(() => {
    const sel = [...document.querySelectorAll('.lm-main svg g[data-item]')].find((g) => g.querySelector('circle[stroke-dasharray="6 4"]'))
    return sel?.querySelector('polygon[fill-opacity="0.16"]')?.getAttribute('fill') ?? null
  })

test.describe('F25 for the director of photography', () => {
  test('F25-H1 a light has a technical sheet: number on the drawing, colour of the beam, load of the map', async ({ page }) => {
    await newScript(page)
    await lightMapTab(page)
    // the new equipment is in the palette
    for (const name of ['PAR', 'Elipsoidal (Leko)', 'Tubo de LED', 'Kino Flo', 'Balão chinês', 'Dedolight', 'Painel LED grande', 'Luz de lua', 'Butterfly / overhead', 'Cucoloris', 'Máquina de fumaça', 'Gerador']) {
      await expect(piece(page, name)).toHaveCount(1)
    }
    // C-stand and track are not offered any more; fumaça, monitor and gerador are under Set e energia
    await expect(piece(page, 'C-stand')).toHaveCount(0)
    await expect(piece(page, 'Trilho / dolly')).toHaveCount(0)
    await expect(page.locator('.lm-side h3', { hasText: 'Set e energia' })).toHaveCount(1)
    await expect(page.locator('.lm-side h3', { hasText: 'Acessórios' })).toHaveCount(0)
    await piece(page, 'Fresnel').click()
    const sheet = page.getByRole('group', { name: /Ficha técnica · luz nº 1/ })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByLabel('Potência (W)')).toHaveAttribute('placeholder', '1000')
    await sheet.getByLabel('Função').selectOption({ label: 'Principal' })
    await sheet.getByLabel('Potência (W)').fill('2000')
    const warm = await beamOfSelected(page)
    await sheet.getByLabel('Gelatina').fill('CTB')
    await expect(sheet).toContainText('Com a gelatina: cerca de 5500 K')
    await expect.poll(() => beamOfSelected(page)).not.toBe(warm)
    await sheet.getByLabel('Difusão').fill('216 (Full White)')
    await sheet.getByLabel('Altura (m)').fill('2.4')
    // the number is drawn by the light
    await expect(page.locator('.lm-main svg text', { hasText: /^1$/ })).toHaveCount(1)
    await piece(page, 'Painel LED grande').click()
    await expect(page.locator('.lm-main svg text', { hasText: /^2$/ })).toHaveCount(1)
    await expect(page.locator('.lm-load')).toContainText('2.450 W · 19,3 A em 127 V · 11,1 A em 220 V')
    await expect(page.locator('.lm-items')).toContainText('nº 1 · Fresnel (Principal · 2000 W · 3200 K · CTB · 216 (Full White))')
  })

  test('F25-H2 the camera angle comes from the lens and the sensor', async ({ page }) => {
    await newScript(page)
    await lightMapTab(page)
    await piece(page, 'Câmera').click()
    const cam = page.getByRole('group', { name: 'Câmera' })
    await expect(page.getByLabel('Abertura (°)')).toBeEnabled()
    await cam.getByLabel('Lente (mm)').fill('35')
    await expect(page.getByLabel('Abertura (°)')).toBeDisabled()
    await expect(page.getByLabel('Abertura (°)')).toHaveValue('39')
    await cam.getByLabel('Sensor').selectOption({ label: 'Full Frame' })
    await expect(page.getByLabel('Abertura (°)')).toHaveValue('54')
    await cam.getByLabel('Plano').selectOption({ label: 'Plano médio' })
    await cam.getByLabel('Movimento').selectOption({ label: 'Travelling' })
    await expect(page.locator('.lm-items')).toContainText('35 mm (Full Frame, 54°) · Plano médio · Travelling · 2 m')
    // the movement is drawn from the camera: a path to a faint camera at the end, 2 m to the right until it is dragged
    await expect(page.locator('.lm-main svg g[data-item] g[opacity="0.4"]') /* the faint cameras, not their fields of view */).toHaveCount(1)
    const startX = Number(await cam.getByRole('group', { name: 'Ponto 2' }).getByLabel('X', { exact: true }).inputValue())
    // drag the faint camera further right and down
    const end = await page.locator('.lm-main [data-move-end] > circle').boundingBox()
    await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2)
    await page.mouse.down()
    await page.mouse.move(end!.x + end!.width / 2 + 90, end!.y + end!.height / 2 + 45, { steps: 6 })
    await page.mouse.up()
    await expect.poll(async () => Number(await cam.getByRole('group', { name: 'Ponto 2' }).getByLabel('X', { exact: true }).inputValue())).toBeGreaterThan(startX + 0.5)
    await expect(page.locator('.lm-items')).not.toContainText('Travelling · 2 m')
    // or type where it ends
    await cam.getByRole('group', { name: 'Ponto 2' }).getByLabel('X', { exact: true }).fill('1')
    await expect(cam.getByRole('group', { name: 'Ponto 2' }).getByLabel('X', { exact: true })).toHaveValue('1')

    // the rotation handle: drag the knob to the right of the camera and it points right
    const knob = await page.locator('.lm-main [data-rotate]').boundingBox()
    const center = await page.evaluate(() => {
      const g = [...document.querySelectorAll('.lm-main svg g[data-item]')].find((x) => x.querySelector('[data-rotate]'))!
      const c = (g.lastElementChild as Element).getBoundingClientRect()
      return { x: c.x + c.width / 2, y: c.y + c.height / 2 }
    })
    await page.mouse.move(knob!.x + knob!.width / 2, knob!.y + knob!.height / 2)
    await page.mouse.down()
    await page.mouse.move(center.x + 160, center.y + 3, { steps: 8 })
    await page.mouse.up()
    await expect(page.locator('#it-rot')).toHaveValue('90')

    await cam.getByLabel('Movimento').selectOption({ label: 'Panorâmica' })
    await expect(cam.getByRole('group', { name: 'Ponto 2' })).toHaveCount(0)
    await cam.getByLabel(/^Giro/).fill('-45')
    await expect(page.locator('.lm-items')).toContainText('Panorâmica · -45°')
    // a pan has its faint camera too, in the same place, turned to where it ends
    await expect(page.locator('.lm-main svg g[data-item] g[opacity="0.4"]') /* the faint cameras, not their fields of view */).toHaveCount(1)
    // the old camera-support pieces are not in the palette any more
    for (const name of ['Grua / jib', 'Gimbal / steadicam', 'Slider']) await expect(piece(page, name)).toHaveCount(0)
    // no lens: the angle is set by hand again
    await cam.getByLabel('Lente (mm)').fill('')
    await expect(page.getByLabel('Abertura (°)')).toBeEnabled()
  })

  test('F25-E1 the faint camera of a dolly in can be dragged even inside the field of view of its camera, and moves only the end', async ({ page }) => {
    await newScript(page)
    await lightMapTab(page)
    await piece(page, 'Fresnel').click() // a light whose beam crosses the set
    await piece(page, 'Câmera').click()
    const cam = page.getByRole('group', { name: 'Câmera' })
    await cam.getByLabel('Movimento').selectOption({ label: 'Dolly in' })
    const y0 = Number(await cam.getByRole('group', { name: 'Ponto 2' }).getByLabel('Y', { exact: true }).inputValue())
    const x0 = await page.locator('#it-x').inputValue()
    const end = await page.locator('.lm-main [data-move-end] > circle').boundingBox()
    await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2)
    await page.mouse.down()
    await page.mouse.move(end!.x + end!.width / 2 + 60, end!.y + end!.height / 2 - 40, { steps: 6 })
    await page.mouse.up()
    await expect(page.locator('#it-x')).toHaveValue(x0) // the camera itself did not move
    await expect.poll(async () => Number(await cam.getByRole('group', { name: 'Ponto 2' }).getByLabel('Y', { exact: true }).inputValue())).toBeLessThan(y0)
    expect(await cam.getByRole('group', { name: 'Ponto 2' }).getByLabel('Y', { exact: true }).inputValue()).toMatch(/^-?\d+(\.\d{1,2})?$/) // no 0.30000000000000004
  })

  test('F25-E2 the camera at the end turns on its own knob, and the path bends from its middle', async ({ page }) => {
    await newScript(page)
    await lightMapTab(page)
    await piece(page, 'Câmera').click()
    const cam = page.getByRole('group', { name: 'Câmera' })
    await cam.getByLabel('Movimento').selectOption({ label: 'Travelling' })
    await expect(cam.getByRole('group', { name: 'Ponto 2' }).getByLabel('Rot.', { exact: true })).toHaveValue('0')
    // turn the camera at the end: pull its knob below it
    const knob = await page.locator('.lm-main [data-rotate-end]').boundingBox()
    const end = await page.evaluate(() => {
      const c = document.querySelector('.lm-main [data-move-end] > circle[fill=transparent]')!.getBoundingClientRect()
      return { x: c.x + c.width / 2, y: c.y + c.height / 2 }
    })
    await page.mouse.move(knob!.x + knob!.width / 2, knob!.y + knob!.height / 2)
    await page.mouse.down()
    await page.mouse.move(end.x + 2, end.y + 150, { steps: 8 })
    await page.mouse.up()
    await expect(cam.getByRole('group', { name: 'Ponto 2' }).getByLabel('Rot.', { exact: true })).toHaveValue('180')
    await expect(page.locator('#it-rot')).toHaveValue('0') // the camera at the start did not turn

    // bend the path: pull its middle up
    await expect(cam.getByRole('group', { name: 'Ponto 2' }).getByRole('button', { name: /^Reto/ })).toHaveCount(0)
    const via = await page.locator('.lm-main [data-move-via]').boundingBox()
    await page.mouse.move(via!.x + via!.width / 2, via!.y + via!.height / 2)
    await page.mouse.down()
    await page.mouse.move(via!.x + via!.width / 2, via!.y + via!.height / 2 - 70, { steps: 6 })
    await page.mouse.up()
    await expect(page.locator('.lm-items')).not.toContainText('Travelling · 2 m')
    await cam.getByRole('group', { name: 'Ponto 2' }).getByRole('button', { name: /^Reto/ }).click()
    await expect(page.locator('.lm-items')).toContainText('Travelling · 2 m')
  })

  test('F25-E3 pan ends where its faint camera is turned, a track curves only as an arc, a zoom pulled out is a longer lens', async ({ page }) => {
    await newScript(page)
    await lightMapTab(page)
    await piece(page, 'Câmera').click()
    const cam = page.getByRole('group', { name: 'Câmera' })
    await cam.getByLabel('Lente (mm)').fill('35')
    // at the front of the set, looking in, as a camera usually is
    await page.locator('#it-y').fill('5.5')
    const center = async (): Promise<{ x: number; y: number }> =>
      page.evaluate(() => {
        const g = document.querySelector('.lm-main svg g[data-item]')!
        const c = (g.lastElementChild as Element).getBoundingClientRect()
        return { x: c.x + c.width / 2, y: c.y + c.height / 2 }
      })
    const drag = async (from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> => {
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(to.x, to.y, { steps: 8 })
      await page.mouse.up()
    }
    const mid = (b: { x: number; y: number; width: number; height: number } | null): { x: number; y: number } => ({ x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 })

    // pan: turn the faint camera to the left of the camera
    await cam.getByLabel('Movimento').selectOption({ label: 'Panorâmica' })
    await expect(cam.getByLabel(/^Giro/)).toHaveValue('60')
    const c = await center()
    await drag(mid(await page.locator('.lm-main [data-rotate-end]').boundingBox()), { x: c.x - 160, y: c.y + 2 })
    await expect(cam.getByLabel(/^Giro/)).toHaveValue('-90')
    await expect(page.locator('#it-rot')).toHaveValue('0') // the camera itself did not turn

    // travelling: pulled diagonally, the middle only goes across the track, which stays an arc of a circle
    await cam.getByLabel('Movimento').selectOption({ label: 'Travelling' })
    const via = mid(await page.locator('.lm-main [data-move-via]').boundingBox())
    await drag(via, { x: via.x + 40, y: via.y - 60 })
    await expect(cam.getByRole('group', { name: 'Ponto 2' }).getByRole('button', { name: /^Reto/ })).toContainText(/raio [\d,]+ m/)
    const box = await page.locator('.lm-main [data-move-via]').boundingBox()
    expect(Math.abs(mid(box).x - via.x)).toBeLessThan(4) // it did not follow the pointer sideways
    await cam.getByRole('group', { name: 'Ponto 2' }).getByRole('button', { name: /^Reto/ }).click()
    await expect(cam.getByRole('group', { name: 'Ponto 2' }).getByRole('button', { name: /^Reto/ })).toHaveCount(0)

    // dolly out: the camera at the end keeps the framing with a longer lens
    await cam.getByLabel('Movimento').selectOption({ label: 'Dolly out' })
    await expect(page.locator('.lm-endview')).toContainText('lente 55 mm')

    // zoom: pull the handle at the tip of the faint view further out
    await cam.getByLabel('Movimento').selectOption({ label: 'Zoom' })
    const before = Number(/lente (\d+) mm/.exec(await page.locator('.lm-endview').innerText())![1])
    const handle = mid(await page.locator('.lm-main [data-zoom-end]').boundingBox())
    await drag(handle, { x: handle.x, y: handle.y - 30 })
    await expect.poll(async () => Number(/lente (\d+) mm/.exec(await page.locator('.lm-endview').innerText())?.[1] ?? 0)).toBeGreaterThan(before)
    await expect(page.locator('.lm-items')).toContainText(/Zoom · lente 35 → \d+ mm/)
  })

  test('F25-E4 a camera goes through several points, and an actor has a blocking with marks', async ({ page }) => {
    await newScript(page)
    await lightMapTab(page)
    await piece(page, 'Câmera').click()
    const cam = page.getByRole('group', { name: 'Câmera' })
    await page.getByLabel('Legenda').fill('A')
    await cam.getByLabel('Movimento').selectOption({ label: 'Steadicam / gimbal' })
    await expect(cam.getByRole('group', { name: 'Ponto A2' })).toBeVisible()
    // one point cannot be taken away: a moving camera goes somewhere
    await expect(cam.getByRole('button', { name: 'Tirar ponto A2' })).toBeDisabled()
    await cam.getByRole('button', { name: '+ Ponto' }).click()
    await cam.getByRole('button', { name: '+ Ponto' }).click()
    await expect(cam.getByRole('group', { name: /^Ponto A\d$/ })).toHaveCount(3)
    await expect(page.locator('.lm-main svg g[data-item] g[opacity="0.4"]') /* the faint cameras, not their fields of view */).toHaveCount(3)
    await expect(page.locator('.lm-main svg text', { hasText: /^A4$/ })).toHaveCount(1)
    // each point turns on its own
    await cam.getByRole('group', { name: 'Ponto A3' }).getByLabel('Rot.', { exact: true }).fill('90')
    await expect(cam.getByRole('group', { name: 'Ponto A4' }).getByLabel('Rot.', { exact: true })).toHaveValue('90') // follows the one before
    await expect(cam.getByRole('group', { name: 'Ponto A2' }).getByLabel('Rot.', { exact: true })).toHaveValue('0')
    // drag the last one with the mouse
    const x0 = Number(await cam.getByRole('group', { name: 'Ponto A4' }).getByLabel('X', { exact: true }).inputValue())
    const end = await page.locator('.lm-main [data-move-end="' + (await page.locator('.lm-main [data-move-end]').last().getAttribute('data-move-end')) + '"] > circle').boundingBox()
    await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2)
    await page.mouse.down()
    await page.mouse.move(end!.x + end!.width / 2 - 60, end!.y + end!.height / 2, { steps: 6 })
    await page.mouse.up()
    await expect.poll(async () => Number(await cam.getByRole('group', { name: 'Ponto A4' }).getByLabel('X', { exact: true }).inputValue())).toBeLessThan(x0 - 0.5)
    await cam.getByRole('button', { name: 'Tirar ponto A3' }).click()
    await expect(cam.getByRole('group', { name: /^Ponto A\d$/ })).toHaveCount(2)
    await expect(page.locator('.lm-items')).toContainText('3 pontos')

    // the actor's blocking
    await piece(page, 'Ator ou atriz').click()
    await page.getByLabel('Legenda').fill('Marina')
    const marks = page.getByRole('group', { name: 'Marcação' })
    await marks.getByRole('button', { name: '+ Marca' }).click()
    await marks.getByRole('button', { name: '+ Marca' }).click()
    await expect(marks.getByRole('group', { name: /^Marca Marina \d$/ })).toHaveCount(2)
    await expect(page.locator('.lm-main svg text', { hasText: /^Marina 3$/ })).toHaveCount(1)
    await expect(page.locator('.lm-items')).toContainText('Marcação · 3 marcas')
    // the marks can all go
    await marks.getByRole('button', { name: 'Tirar marca Marina 3' }).click()
    await marks.getByRole('button', { name: 'Tirar marca Marina 2' }).click()
    await expect(marks.getByRole('group', { name: /^Marca/ })).toHaveCount(0)
    await expect(page.locator('.lm-items')).not.toContainText('Marcação')
  })

  test('F25-E5 the sheet can be written in one line, the way it is said on set', async ({ page }) => {
    await newScript(page)
    await lightMapTab(page)
    await piece(page, 'Fresnel').click()
    const sheet = page.getByRole('group', { name: /Ficha técnica · luz nº 1/ })
    // one line at the top of the panel, for any piece
    const props = page.getByRole('complementary', { name: 'Propriedades' })
    const quick = props.getByLabel('Escrever a ficha')
    const said = props.locator('.lm-quick [role=status]')
    await quick.fill('principal 2K 5600K 1/2 CTB 216 a 2,4 m 80%')
    await quick.press('Enter')
    await expect(sheet.getByLabel('Função')).toHaveValue('key')
    await expect(sheet.getByLabel('Potência (W)')).toHaveValue('2000')
    await expect(sheet.getByLabel('Temperatura de cor (K)')).toHaveValue('5600')
    await expect(sheet.getByLabel('Gelatina')).toHaveValue('1/2 CTB')
    await expect(sheet.getByLabel('Difusão')).toHaveValue('216 (Full White)')
    await expect(sheet.getByLabel('Intensidade (%)')).toHaveValue('80')
    await expect(sheet.getByLabel('Altura (m)')).toHaveValue('2.4')
    await expect(said).toContainText('Entendi: Principal · 2.000 W · 5600 K')
    await expect(quick).toHaveValue('') // all understood: the line empties
    // a word it does not know is named, and the rest still goes in
    await quick.fill('contra azulado 650W')
    await quick.press('Enter')
    await expect(said).toContainText('Não entendi: azulado')
    await expect(sheet.getByLabel('Função')).toHaveValue('back')
    await expect(sheet.getByLabel('Potência (W)')).toHaveValue('650')

    // the camera
    await piece(page, 'Câmera').click()
    const cam = page.getByRole('group', { name: 'Câmera' })
    await quick.fill('35mm full frame close travelling')
    await quick.press('Enter')
    await expect(cam.getByLabel('Lente (mm)')).toHaveValue('35')
    await expect(page.getByLabel('Abertura (°)')).toHaveValue('54')
    await expect(cam.getByLabel('Plano')).toHaveValue('Close')
    await expect(cam.getByLabel('Movimento')).toHaveValue('Travelling')
    await expect(cam.getByRole('group', { name: 'Ponto 2' })).toBeVisible()
    await expect(page.getByLabel('Rotação (°)')).toHaveValue('0')
    await quick.fill('alcance 5 m 90°')
    await quick.press('Enter')
    await expect(page.getByLabel('Alcance (m)')).toHaveValue('5')
    await expect(page.getByLabel('Rotação (°)')).toHaveValue('90')

    // a wall: a plain "4 m" is its length
    await piece(page, 'Parede').click()
    await quick.fill('2,5 m x 1 y 1 45°')
    await quick.press('Enter')
    await expect(page.getByLabel('Comprimento (m)')).toHaveValue('2.5')
    await expect(page.getByLabel('X (m)')).toHaveValue('1')
    await expect(page.getByLabel('Rotação (°)')).toHaveValue('45')
    await expect(said).toContainText('Entendi: X 1 m · Y 1 m · rotação 45° · 2,5 m de comprimento')

    // a table has a length and a width, drawn to scale
    await piece(page, 'Mesa').click()
    await expect(props.locator('#it-len')).toHaveValue('1.2')
    await expect(props.locator('#it-depth')).toHaveValue('0.8')
    await quick.fill('1,6 x 0,9')
    await quick.press('Enter')
    await expect(props.locator('#it-len')).toHaveValue('1.6')
    await expect(props.locator('#it-depth')).toHaveValue('0.9')
    await props.getByLabel('Largura (m)').fill('1.1')
    await expect
      .poll(() => page.evaluate(() => document.querySelector('.lm-main svg rect[fill="#efe3d0"]')?.getAttribute('height')))
      .toBe('66') // 1.1 m at 60 px per metre

    // the map itself: width by depth, and a scene that is not in the script is said, not used
    const mapLine = page.getByLabel('Escrever o mapa')
    await mapLine.fill('12 x 9,5 cena 40')
    await mapLine.press('Enter')
    await expect(page.locator('#lm-w')).toHaveValue('12')
    await expect(page.getByLabel('Fundo (m)')).toHaveValue('9.5')
    await expect(page.locator('.lm-quick.map [role=status]')).toContainText('Não entendi: cena 40 (não existe no roteiro)')
    await expect(page.locator('#lm-scene')).toHaveValue('')
  })

  test('F25-E6 sizes, lens and colour temperature can be typed key by key', async ({ page }) => {
    await newScript(page)
    await lightMapTab(page)
    // key by key, as a person types: a field must not pull the first digit inside its limits
    const typeIn = async (sel: string, text: string): Promise<void> => {
      await page.locator(sel).click()
      await page.keyboard.press('Control+A')
      await page.keyboard.type(text)
    }
    await typeIn('#lm-w', '12')
    await expect(page.locator('#lm-w')).toHaveValue('12')
    await typeIn('#lm-h', '9,5')
    await page.keyboard.press('Enter')
    await expect(page.locator('#lm-h')).toHaveValue('9.5')
    // shrinking waits until the typing is done, so a passing "4" of "40" does not squeeze the pieces
    await piece(page, 'Mesa').click()
    await page.getByLabel('X (m)').fill('11')
    await typeIn('#lm-w', '1')
    await expect(page.locator('#lm-w')).toHaveValue('1')
    await page.keyboard.type('0')
    await page.keyboard.press('Tab') // leaving the field settles it
    await expect(page.locator('#lm-w')).toHaveValue('10')
    await expect(page.getByLabel('X (m)')).toHaveValue('10')
    // below the limit it settles on the limit when the field is left
    await typeIn('#lm-h', '1')
    await page.keyboard.press('Enter')
    await expect(page.locator('#lm-h')).toHaveValue('2')

    await typeIn('#it-depth', '0,9')
    await expect(page.locator('#it-depth')).toHaveValue('0.9')
    await piece(page, 'Fresnel').click()
    await typeIn('#it-spread', '25')
    await expect(page.locator('#it-spread')).toHaveValue('25')
    await typeIn('#it-kelvin', '5600')
    await expect(page.locator('#it-kelvin')).toHaveValue('5600')
    await piece(page, 'Câmera').click()
    await typeIn('#it-lens', '35')
    await expect(page.locator('#it-lens')).toHaveValue('35')
    await expect(page.locator('#it-spread')).toBeDisabled() // worked out from the lens
    // emptying an optional field leaves it unset
    await page.locator('#it-lens').click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Tab')
    await expect(page.locator('#it-lens')).toHaveValue('')
    await expect(page.locator('#it-spread')).toBeEnabled()
  })

  test('F25-H3 storyboard frames carry the shot, and the shot list and the gear list are reports', async ({ page, dialogs }) => {
    await newScript(page)
    await lightMapTab(page)
    await piece(page, 'HMI').click()
    await piece(page, 'HMI').click()
    await piece(page, 'Luz de lua').click() // natural light: not on the gear list
    await page.locator('.seg button', { hasText: /^Storyboard$/ }).click()
    await page.getByRole('button', { name: 'Quadro vazio' }).click()
    await page.getByLabel('Legenda do quadro 1').fill('Marina na janela')
    await page.getByLabel('Plano do quadro 1').selectOption({ label: 'Close' })
    await page.getByLabel('Ângulo do quadro 1').selectOption({ label: 'Contra-plongée' })
    await page.getByLabel('Movimento do quadro 1').selectOption({ label: 'Dolly in' })
    await page.getByLabel('Lente do quadro 1 (mm)').fill('85')

    await page.locator('.seg button', { hasText: /^Relatórios$/ }).click()
    await page.locator('.reports nav button', { hasText: 'Lista de planos' }).click()
    await expect(page.locator('.report-body tbody tr').first()).toContainText('Close')
    await expect(page.locator('.report-body tbody tr').first()).toContainText('85 mm')
    await page.locator('.reports nav button', { hasText: 'Equipamento de luz' }).click()
    const rows = page.locator('.report-body tbody tr')
    await expect(rows.first()).toContainText('HMI')
    await expect(rows.first()).toContainText('1800')
    await expect(rows.nth(1)).toContainText('3600')
    await expect(rows.nth(2)).toContainText('28,3 A')
    await expect(page.locator('.report-body')).not.toContainText('Luz de lua')

    const dir = mkdtempSync(join(tmpdir(), 'rotera-f25-'))
    const f = join(dir, 'foto.rottera')
    await dialogs.save(f)
    await page.locator('.toolbar button[aria-label="Salvar como…"]').click()
    await expect(page.locator('.status')).toContainText('Salvo')
    const saved = JSON.parse(readFileSync(f, 'utf8'))
    expect(saved.script.storyboard.frames[0]).toEqual(expect.objectContaining({ shot: 'Close', angle: 'Contra-plongée', move: 'Dolly in', lens: 85 }))
    expect(saved.script.lightMaps[0].items[0]).toEqual(expect.objectContaining({ type: 'hmi', watts: 1800, kelvin: 5600 }))
  })

  test('F25-A1 the light map panel and the storyboard shot fields have no serious accessibility violations', async ({ app, page }) => {
    await newScript(page)
    await lightMapTab(page)
    await piece(page, 'Fresnel').click()
    const found: string[] = []
    for (const theme of ['light', 'night'] as const) {
      await setTheme(app, page, theme)
      for (const v of await axeViolations(page)) found.push(`${theme}/mapa: ${v}`)
    }
    await piece(page, 'Câmera').click()
    for (const v of await axeViolations(page)) found.push(`camera: ${v}`)
    await page.locator('.seg button', { hasText: /^Storyboard$/ }).click()
    await page.getByRole('button', { name: 'Quadro vazio' }).click()
    for (const v of await axeViolations(page)) found.push(`storyboard: ${v}`)
    expect(found).toEqual([])
  })
})

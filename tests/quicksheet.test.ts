import { describe, expect, it } from 'vitest'
import { parseQuickMap, parseQuickSheet } from '../src/shared/quicksheet'

describe('quick line of the technical sheet', () => {
  it('reads a light the way it is said on set', () => {
    const r = parseQuickSheet('principal 2K 5600K 1/2 CTB 216 a 2,4 m 80%', 'fresnel')
    expect(r.patch).toEqual({ role: 'key', watts: 2000, kelvin: 5600, gel: '1/2 CTB', diffusion: '216 (Full White)', intensity: 80, height: 2.4 })
    expect(r.understood).toEqual(['Principal', '2.000 W', '5600 K', '1/2 CTB', '216 (Full White)', '80%', '2,4 m de altura'])
    expect(r.unknown).toEqual([])
  })

  it('tells power from colour temperature: a small number with K is kilowatts, a big one is kelvin', () => {
    expect(parseQuickSheet('1K', 'fresnel').patch).toEqual({ watts: 1000 })
    expect(parseQuickSheet('18K', 'fresnel').patch).toEqual({ watts: 18000 })
    expect(parseQuickSheet('3200K', 'fresnel').patch).toEqual({ kelvin: 3200 })
    expect(parseQuickSheet('650W tungstênio', 'fresnel').patch).toEqual({ watts: 650, kelvin: 3200 })
    expect(parseQuickSheet('2,5kW dia', 'fresnel').patch).toEqual({ watts: 2500, kelvin: 5600 })
  })

  it('knows the usual words, with or without accents, in Portuguese or English', () => {
    expect(parseQuickSheet('contraluz meio CTO grid', 'fresnel').patch).toEqual({ role: 'back', gel: '1/2 CTO', diffusion: 'Grid Cloth' })
    expect(parseQuickSheet('fill ND .6 seda 50%', 'fresnel').patch).toEqual({ role: 'fill', gel: 'ND 0.6', diffusion: 'Seda', intensity: 50 })
    expect(parseQuickSheet('Prática plus green', 'fresnel').patch).toEqual({ role: 'practical', gel: 'Plus Green' })
  })

  it('reads a camera: lens, sensor, shot, movement and height', () => {
    const r = parseQuickSheet('35mm full frame close travelling 1,5 m', 'camera')
    expect(r.patch).toEqual({ lens: 35, sensor: 'ff', shot: 'Close', move: 'Travelling', height: 1.5 })
    expect(parseQuickSheet('PM dolly in s35 50mm', 'camera').patch).toEqual({ lens: 50, sensor: 's35', shot: 'Plano médio', move: 'Dolly in' })
    expect(parseQuickSheet('plano americano câmera na mão', 'camera').patch).toEqual({ shot: 'Plano americano', move: 'Câmera na mão' })
  })

  it('says what it did not understand, and changes nothing for it', () => {
    const r = parseQuickSheet('principal azulado 1K', 'fresnel')
    expect(r.patch).toEqual({ role: 'key', watts: 1000 })
    expect(r.unknown).toEqual(['azulado'])
  })
  it('reads what every piece has: rotation, position, spread, reach and length', () => {
    expect(parseQuickSheet('90°', 'actor').patch).toEqual({ rotation: 90 })
    expect(parseQuickSheet('rotação 45 x 2 y 3,5', 'table').patch).toEqual({ rotation: 45, x: 2, y: 3.5 })
    expect(parseQuickSheet('x 20', 'chair', { width: 8, height: 6 }).patch).toEqual({ x: 8 }) // kept inside the set
    expect(parseQuickSheet('principal abertura 40° alcance 4 m a 2 m 180º', 'fresnel').patch).toEqual({
      role: 'key',
      spread: 40,
      range: 4,
      height: 2,
      rotation: 180
    })
    expect(parseQuickSheet('3 m de alcance 50mm', 'camera').patch).toEqual({ range: 3, lens: 50 })
    // a plain "4 m" is the length of a wall, not a height
    const wall = parseQuickSheet('4 m 90°', 'wall')
    expect(wall.patch).toEqual({ length: 4, rotation: 90 })
    expect(wall.understood).toEqual(['rotação 90°', '4 m de comprimento'])
    expect(parseQuickSheet('comprimento 1,2', 'flag').patch).toEqual({ length: 1.2 })
  })

  it('reads a table as length by width', () => {
    const r = parseQuickSheet('1,6 x 0,9 m 90°', 'table')
    expect(r.patch).toEqual({ length: 1.6, depth: 0.9, rotation: 90 })
    expect(r.understood).toEqual(['rotação 90°', '1,6 m de comprimento', '0,9 m de largura'])
    expect(parseQuickSheet('comprimento 2 largura 1', 'table').patch).toEqual({ length: 2, depth: 1 })
    expect(parseQuickSheet('2 m x 3 y 2', 'table').patch).toEqual({ length: 2, x: 3, y: 2 }) // "x 3" is still the position
  })

  it('reads the size of the set and its scene', () => {
    const r = parseQuickMap('6 x 4,5 cena 3', ['1', '2', '3'])
    expect(r.patch).toEqual({ width: 6, height: 4.5, scene: '3' })
    expect(r.understood).toEqual(['largura 6 m', 'fundo 4,5 m', 'cena 3'])
    expect(r.unknown).toEqual([])
    expect(parseQuickMap('6m por 4m', []).patch).toEqual({ width: 6, height: 4 })
    expect(parseQuickMap('largura 10 fundo 7', []).patch).toEqual({ width: 10, height: 7 })
    expect(parseQuickMap('fundo 5', []).patch).toEqual({ height: 5 })
    expect(parseQuickMap('100 x 1', []).patch).toEqual({ width: 60, height: 2 }) // the limits of the map
    expect(parseQuickMap('Cena 12A', ['12A']).patch).toEqual({ scene: '12A' })
    expect(parseQuickMap('sem cena', ['1']).patch).toEqual({ scene: '' })
    const missing = parseQuickMap('8 x 6 cena 99', ['1'])
    expect(missing.patch).toEqual({ width: 8, height: 6 })
    expect(missing.unknown).toEqual(['cena 99 (não existe no roteiro)'])
  })
})

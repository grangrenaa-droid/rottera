import { describe, expect, it } from 'vitest'
import { sceneLight, sunTimes, sunWarning } from '../src/shared/sun'
import { BR_CITIES, findCity, parseCoords } from '../src/shared/cities'
import type { SceneInfo } from '../src/shared/production'

const min = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const near = (t: string, want: string, tol: number): void => {
  expect(t, `${t} ≈ ${want}`).not.toBe('')
  expect(Math.abs(min(t) - min(want)), `${t} ≈ ${want}`).toBeLessThanOrEqual(tol)
}

describe('the sun of a day at a place', () => {
  it('London at midsummer: sunrise 04:43, sunset 21:21 (British Summer Time)', () => {
    const s = sunTimes('2026-06-21', { name: 'Londres', lat: 51.5074, lon: -0.1278, tz: 1 })!
    near(s.sunrise, '04:43', 2)
    near(s.sunset, '21:21', 2)
  })

  it('São Paulo in winter: sunrise about 06:47, sunset about 17:28', () => {
    const s = sunTimes('2026-06-21', findCity('São Paulo - SP')!)!
    near(s.sunrise, '06:47', 3)
    near(s.sunset, '17:28', 3)
    near(s.noon, '12:07', 3)
  })

  it('golden and blue hours come in order around sunrise and sunset', () => {
    const s = sunTimes('2026-11-13', findCity('Rio de Janeiro - RJ')!)!
    const order = [s.blueMorning[0], s.blueMorning[1], s.goldenMorning[0], s.sunrise, s.goldenMorning[1], s.noon, s.goldenEvening[0], s.sunset, s.goldenEvening[1], s.blueEvening[1]]
    const m = order.map(min)
    expect([...m].sort((a, b) => a - b)).toEqual(m)
    expect(s.blueMorning[1]).toBe(s.goldenMorning[0])
    expect(s.goldenEvening[1]).toBe(s.blueEvening[0])
  })

  it('where the sun does not set, there is no sunrise or sunset', () => {
    const s = sunTimes('2026-06-21', { name: 'Tromsø', lat: 69.65, lon: 18.96, tz: 2 })!
    expect(s.sunrise).toBe('')
    expect(s.sunset).toBe('')
  })

  it('a date that is not a date gives nothing', () => {
    expect(sunTimes('amanhã', findCity('Recife - PE')!)).toBeNull()
  })
})

describe('whether the light of a scene fits its time', () => {
  const scene = (heading: string, time: string, intExt = 'EXT.'): SceneInfo => ({
    n: 0, index: 0, end: 1, id: 's1', number: '1', heading, intExt, location: 'RUA', time, night: /NOITE/.test(time),
    eighths: 8, page: 1, cast: [], synopsis: ''
  })
  const sun = sunTimes('2026-06-21', findCity('São Paulo - SP')!)!

  it('reads the time of day of a heading', () => {
    expect(sceneLight('NOITE')).toBe('night')
    expect(sceneLight('DIA')).toBe('day')
    expect(sceneLight('AMANHECER')).toBe('dawn')
    expect(sceneLight('PÔR DO SOL')).toBe('dusk')
    expect(sceneLight('CONTINUOUS')).toBeNull()
  })

  it('a night scene in the sun, a dawn in the afternoon: warnings; a day scene in daylight: none', () => {
    expect(sunWarning(scene('EXT. RUA - NOITE', 'NOITE'), '14:00', sun, false)).toMatch(/noite.*14:00/i)
    expect(sunWarning(scene('EXT. RUA - DIA', 'DIA'), '10:00', sun, false)).toBe('')
    expect(sunWarning(scene('EXT. RUA - DIA', 'DIA'), '19:00', sun, false)).toMatch(/depois do pôr do sol/)
    expect(sunWarning(scene('EXT. PRAIA - AMANHECER', 'AMANHECER'), '14:00', sun, false)).toMatch(/amanhecer/i)
  })

  it('an interior counts only when its light comes from the sun or a window', () => {
    expect(sunWarning(scene('INT. SALA - NOITE', 'NOITE', 'INT.'), '14:00', sun, false)).toBe('')
    expect(sunWarning(scene('INT. SALA - NOITE', 'NOITE', 'INT.'), '14:00', sun, true)).not.toBe('')
  })
})

describe('places', () => {
  it('has the capitals with their time zones', () => {
    expect(BR_CITIES.length).toBeGreaterThan(100)
    expect(findCity('manaus - am')?.tz).toBe(-4)
    expect(findCity('Rio Branco - AC')?.tz).toBe(-5)
    expect(new Set(BR_CITIES.map((c) => c.name)).size).toBe(BR_CITIES.length)
  })

  it('reads coordinates typed or pasted from a map link', () => {
    expect(parseCoords('-23.5505, -46.6333')).toEqual({ lat: -23.5505, lon: -46.6333 })
    expect(parseCoords('https://www.google.com/maps/place/Ibirapuera/@-23.5874,-46.6576,15z')).toEqual({ lat: -23.5874, lon: -46.6576 })
    expect(parseCoords('https://maps.google.com/?q=-22.9519,-43.2105')).toEqual({ lat: -22.9519, lon: -43.2105 })
    expect(parseCoords('Copacabana')).toBeNull()
    expect(parseCoords('123, 456')).toBeNull()
  })
})

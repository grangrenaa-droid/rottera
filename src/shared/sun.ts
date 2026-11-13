import type { Place } from './types'
import type { SceneInfo } from './production'

/**
 * The sun of one day at one place, in local clock time ("HH:MM"; '' when it does not happen that day, as near the
 * poles). Golden hour: the sun between 6° above and 4° below the horizon; blue hour: between 4° and 6° below.
 */
export interface SunTimes {
  blueMorning: [string, string]
  goldenMorning: [string, string]
  sunrise: string
  noon: string
  sunset: string
  goldenEvening: [string, string]
  blueEvening: [string, string]
}

export const isDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** A place as the file brings it, or nothing when it makes no sense. */
export function cleanPlace(raw: unknown): Place | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const x = raw as Record<string, unknown>
  const ok = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
  if (!ok(x.lat, -90, 90) || !ok(x.lon, -180, 180) || !ok(x.tz, -12, 14)) return undefined
  const name = typeof x.name === 'string' ? x.name.trim().slice(0, 120) : ''
  return { name, lat: x.lat, lon: x.lon, tz: x.tz }
}

const rad = (d: number): number => (d * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI

function julianDay(date: string): number {
  let [y, m] = date.split('-').map(Number)
  const d = Number(date.slice(8, 10))
  if (m <= 2) {
    y -= 1
    m += 12
  }
  const a = Math.floor(y / 100)
  const b = 2 - a + Math.floor(a / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5
}

/** The sun's declination (degrees) and the equation of time (minutes) at a Julian day (NOAA's solar calculator). */
function solar(jd: number): { dec: number; eqTime: number } {
  const t = (jd - 2451545) / 36525
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t)
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
  const c = Math.sin(rad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(rad(2 * m)) * (0.019993 - 0.000101 * t) + Math.sin(rad(3 * m)) * 0.000289
  const omega = 125.04 - 1934.136 * t
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(rad(omega))
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const eps = eps0 + 0.00256 * Math.cos(rad(omega))
  const dec = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))))
  const y = Math.tan(rad(eps / 2)) ** 2
  const eqTime =
    4 *
    deg(
      y * Math.sin(2 * rad(l0)) -
        2 * e * Math.sin(rad(m)) +
        4 * e * y * Math.sin(rad(m)) * Math.cos(2 * rad(l0)) -
        0.5 * y * y * Math.sin(4 * rad(l0)) -
        1.25 * e * e * Math.sin(2 * rad(m))
    )
  return { dec, eqTime }
}

const clock = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function sunTimes(date: string, place: Place): SunTimes | null {
  if (!isDate(date)) return null
  const jd0 = julianDay(date)
  const at = (localMinutes: number): number => jd0 + (localMinutes - place.tz * 60) / 1440
  const noonAt = (localMinutes: number): number => 720 - 4 * place.lon - solar(at(localMinutes)).eqTime + place.tz * 60
  const noon = noonAt(noonAt(720))
  /** When the sun's centre is `altitude` degrees above the horizon, in the morning (-1) or the evening (+1). */
  const cross = (altitude: number, side: -1 | 1): number | null => {
    let t = noon
    for (let i = 0; i < 3; i++) {
      const { dec } = solar(at(t))
      const cosH = (Math.sin(rad(altitude)) - Math.sin(rad(place.lat)) * Math.sin(rad(dec))) / (Math.cos(rad(place.lat)) * Math.cos(rad(dec)))
      if (cosH < -1 || cosH > 1) return null
      t = noonAt(t) + side * 4 * deg(Math.acos(cosH))
    }
    return t
  }
  const time = (altitude: number, side: -1 | 1): string => {
    const t = cross(altitude, side)
    return t === null ? '' : clock(t)
  }
  const m6 = time(-6, -1)
  const m4 = time(-4, -1)
  const mUp = time(6, -1)
  const e6 = time(6, 1)
  const e4 = time(-4, 1)
  const eDown = time(-6, 1)
  return {
    blueMorning: [m6, m4],
    goldenMorning: [m4, mUp],
    sunrise: time(-0.833, -1),
    noon: clock(noon),
    sunset: time(-0.833, 1),
    goldenEvening: [e6, e4],
    blueEvening: [e4, eDown]
  }
}

export type SceneLight = 'day' | 'night' | 'dawn' | 'dusk'

/** The time of day a heading asks for, read from its time ("NOITE", "AMANHECER"...); null when it does not say. */
export function sceneLight(time: string): SceneLight | null {
  const t = time
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
  if (/AMANHECER|ALVORADA|AURORA|NASCER DO SOL|DAWN|SUNRISE/.test(t)) return 'dawn'
  if (/ENTARDECER|POR DO SOL|CREPUSCULO|ANOITECER|FIM DE TARDE|DUSK|SUNSET|MAGIC HOUR/.test(t)) return 'dusk'
  if (/NOITE|MADRUGADA|NIGHT/.test(t)) return 'night'
  if (/\bDIA\b|MANHA|TARDE|MEIO.DIA|\bDAY\b|MORNING|AFTERNOON/.test(t)) return 'day'
  return null
}

const minutes = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const isClock = (t: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

/**
 * What is wrong with shooting a scene at `at` under this sun ('' when nothing is). Only scenes lit by the sun count:
 * exteriors, and interiors whose light sheet says the light comes from the sun or a window (`daylight`).
 */
export function sunWarning(scene: SceneInfo, at: string, sun: SunTimes, daylight: boolean): string {
  if (!/EXT/i.test(scene.intExt) && !daylight) return ''
  const kind = sceneLight(scene.time)
  if (!kind || !isClock(at)) return ''
  const a = minutes(at)
  const inside = (from: string, to: string): boolean | null => (from && to ? a >= minutes(from) && a <= minutes(to) : null)
  if (kind === 'day' && sun.sunrise && sun.sunset) {
    if (a < minutes(sun.sunrise)) return `Cena de dia marcada às ${at}, antes do nascer do sol (${sun.sunrise}).`
    if (a >= minutes(sun.sunset)) return `Cena de dia marcada às ${at}, depois do pôr do sol (${sun.sunset}).`
  }
  if (kind === 'night' && sun.sunrise && sun.sunset && a >= minutes(sun.sunrise) && a < minutes(sun.sunset)) {
    return `Cena de noite marcada às ${at}, com sol (o sol se põe às ${sun.sunset}).`
  }
  if (kind === 'dawn' && inside(sun.blueMorning[0], sun.goldenMorning[1]) === false) {
    return `Amanhecer marcado às ${at}; a luz do amanhecer vai de ${sun.blueMorning[0]} a ${sun.goldenMorning[1]}.`
  }
  if (kind === 'dusk' && inside(sun.goldenEvening[0], sun.blueEvening[1]) === false) {
    return `Entardecer marcado às ${at}; a luz do entardecer vai de ${sun.goldenEvening[0]} a ${sun.blueEvening[1]}.`
  }
  return ''
}

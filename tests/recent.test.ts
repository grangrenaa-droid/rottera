import { describe, expect, it } from 'vitest'
import { folderOf, whenOpened } from '../src/shared/recent'

describe('recent list labels', () => {
  // 14 Oct 2026, 19:40 local time
  const now = new Date(2026, 9, 14, 19, 40)
  const at = (d: number, h: number, m: number): string => new Date(2026, 9, d, h, m).toISOString()

  it('says today and yesterday in words, with the time and no seconds', () => {
    expect(whenOpened(at(14, 19, 31), now)).toBe('hoje às 19:31')
    expect(whenOpened(at(14, 0, 5), now)).toBe('hoje às 00:05')
    expect(whenOpened(at(13, 23, 59), now)).toBe('ontem às 23:59')
  })

  it('uses the weekday within the last week, then the date', () => {
    expect(whenOpened(at(10, 9, 0), now)).toBe('sábado às 09:00')
    expect(whenOpened(at(7, 9, 0), now)).toBe('em 07/10/2026')
    expect(whenOpened(new Date(2025, 11, 31, 8, 0).toISOString(), now)).toBe('em 31/12/2025')
  })

  it('names the folder a script is in', () => {
    expect(folderOf('C:\\Users\\ana\\Documents\\Roteiros TG\\chuva.rotera')).toBe('Roteiros TG')
    expect(folderOf('/home/ana/curtas/chuva.rottera')).toBe('curtas')
    expect(folderOf('C:\\chuva.rottera')).toBe('C:')
  })
})

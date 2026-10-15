import { describe, expect, it } from 'vitest'
import { isDark, toggleTheme } from '../src/shared/theme'

describe('sun and moon theme button', () => {
  it('knows whether the screen is dark, following Windows in automatic mode', () => {
    expect(isDark('light', true)).toBe(false)
    expect(isDark('night', false)).toBe(true)
    expect(isDark('midnight', false)).toBe(true)
    expect(isDark('auto', true)).toBe(true)
    expect(isDark('auto', false)).toBe(false)
  })

  it('switches to the opposite of what is on screen', () => {
    expect(toggleTheme('light', false)).toBe('night')
    expect(toggleTheme('light', true)).toBe('night')
    expect(toggleTheme('night', false)).toBe('light')
    expect(toggleTheme('midnight', false)).toBe('light')
    expect(toggleTheme('auto', true)).toBe('light')
    expect(toggleTheme('auto', false)).toBe('night')
  })
})

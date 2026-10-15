export type Theme = 'auto' | 'light' | 'night' | 'midnight'

/** Whether the screen is dark; in automatic mode that is whatever Windows uses. */
export function isDark(theme: Theme, systemDark: boolean): boolean {
  return theme === 'auto' ? systemDark : theme !== 'light'
}

/** The sun and moon button flips between light and night, starting from what is on screen. */
export function toggleTheme(theme: Theme, systemDark: boolean): Theme {
  return isDark(theme, systemDark) ? 'light' : 'night'
}

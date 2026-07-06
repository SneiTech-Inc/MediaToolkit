'use client'

import { useTheme } from 'next-themes'

/**
 * Thin wrapper around next-themes' useTheme for consistent dark mode access.
 * Returns { isDark, toggle, setDark, setLight }.
 */
export function useDarkMode() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  return {
    isDark,
    theme: theme as string | undefined,
    resolvedTheme: resolvedTheme as string | undefined,
    toggle: () => setTheme(isDark ? 'light' : 'dark'),
    setDark: () => setTheme('dark'),
    setLight: () => setTheme('light'),
  }
}

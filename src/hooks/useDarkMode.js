// src/hooks/useDarkMode.js
// Detects and tracks system dark mode preference.
// Respects user override if they've manually set a preference in the app.
//
// Usage:
//   const { isDark, toggle, reset } = useDarkMode()
//
// The hook:
//   1. Reads system preference via prefers-color-scheme
//   2. Allows user override stored in localStorage
//   3. Applies 'dark' class to document.documentElement
//   4. Listens for system preference changes in real time

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'perin_dark_mode'

function getSystemPreference() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getSavedPreference() {
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    if (val === null) return null          // no override — follow system
    return val === 'true'
  } catch {
    return null
  }
}

function applyDarkMode(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const saved = getSavedPreference()
    const effective = saved !== null ? saved : getSystemPreference()
    applyDarkMode(effective)
    return effective
  })

  const [isOverridden, setIsOverridden] = useState(() => {
    return getSavedPreference() !== null
  })

  // Listen for system preference changes (only applies when not overridden)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    const handler = (e) => {
      if (getSavedPreference() === null) {
        // No user override — follow system
        applyDarkMode(e.matches)
        setIsDark(e.matches)
      }
    }

    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Apply whenever isDark changes
  useEffect(() => {
    applyDarkMode(isDark)
  }, [isDark])

  // Toggle and save user override
  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      setIsOverridden(true)
      return next
    })
  }, [])

  // Reset to system preference (remove user override)
  const reset = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setIsOverridden(false)
    const systemPref = getSystemPreference()
    setIsDark(systemPref)
  }, [])

  return { isDark, isOverridden, toggle, reset }
}

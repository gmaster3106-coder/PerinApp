// src/hooks/useDarkMode.js
// Detects and tracks system dark mode preference.
// Applies 'dark' class to document.body (matching existing CSS selectors).

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'perin_dark_mode'

function getSystemPreference() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getSavedPreference() {
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    if (val === null) return null
    return val === 'true'
  } catch {
    return null
  }
}

function applyDarkMode(isDark) {
  if (isDark) {
    document.body.classList.add('dark')
  } else {
    document.body.classList.remove('dark')
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

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      if (getSavedPreference() === null) {
        applyDarkMode(e.matches)
        setIsDark(e.matches)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    applyDarkMode(isDark)
  }, [isDark])

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      setIsOverridden(true)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setIsOverridden(false)
    const systemPref = getSystemPreference()
    setIsDark(systemPref)
  }, [])

  return { isDark, isOverridden, toggle, reset }
}

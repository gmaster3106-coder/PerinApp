// src/hooks/useStreak.js
// Streak tracking with recovery mechanics.
//
// Recovery rules:
//   - If user missed exactly 1 day: offer a "streak recovery" (costs 1 recovery token)
//   - If user missed 2+ days: streak resets to 0, no recovery offered
//   - Recovery tokens are earned by hitting daily goals (1 token per 7-day streak milestone)
//
// Storage: localStorage (syncs to Supabase when account system is ready)
//
// Usage:
//   const { streak, longestStreak, recoveryTokens, canRecover, recoverStreak, recordActivity } = useStreak()

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'perin_streak'

function getTodayStr() {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

function getYesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(b) - new Date(a)) / msPerDay)
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function defaultState() {
  return {
    streak: 0,
    longestStreak: 0,
    lastActiveDate: null,   // 'YYYY-MM-DD'
    recoveryTokens: 0,
    recoveryUsedOn: null,   // 'YYYY-MM-DD' — prevent double recovery
  }
}

export function useStreak() {
  const [state, setState] = useState(() => {
    const saved = loadState()
    return saved || defaultState()
  })

  // Derived values
  const today = getTodayStr()
  const yesterday = getYesterdayStr()

  const missedDays = state.lastActiveDate
    ? daysBetween(state.lastActiveDate, today)
    : null

  // Can recover if: missed exactly 1 day, have tokens, haven't already recovered today
  const canRecover =
    missedDays === 1 &&
    state.recoveryTokens > 0 &&
    state.recoveryUsedOn !== today

  // Streak is considered active if last activity was today or yesterday
  const isStreakAlive =
    state.lastActiveDate === today || state.lastActiveDate === yesterday

  // Computed current streak accounting for missed days
  const currentStreak = isStreakAlive ? state.streak : 0

  // ── Record activity (call this whenever user completes a session) ──────────

  const recordActivity = useCallback(() => {
    setState(prev => {
      const newState = { ...prev }
      const today = getTodayStr()

      if (prev.lastActiveDate === today) {
        // Already active today — no change needed
        return prev
      }

      const days = prev.lastActiveDate ? daysBetween(prev.lastActiveDate, today) : null

      if (days === null || days > 2) {
        // First ever activity or missed 2+ days — reset streak
        newState.streak = 1
      } else if (days === 1) {
        // Consecutive day — extend streak
        newState.streak = prev.streak + 1
      } else if (days === 2 && prev.recoveryUsedOn === yesterday) {
        // User recovered yesterday — treat as consecutive
        newState.streak = prev.streak + 1
      } else {
        // Missed days with no recovery — reset
        newState.streak = 1
      }

      newState.lastActiveDate = today
      newState.longestStreak = Math.max(newState.streak, prev.longestStreak)

      // Award a recovery token at every 7-day streak milestone
      if (newState.streak > 0 && newState.streak % 7 === 0) {
        newState.recoveryTokens = Math.min((prev.recoveryTokens || 0) + 1, 5) // cap at 5
      }

      saveState(newState)
      return newState
    })
  }, [yesterday])

  // ── Use a recovery token to restore a broken streak ───────────────────────

  const recoverStreak = useCallback(() => {
    setState(prev => {
      if (
        prev.recoveryTokens <= 0 ||
        prev.recoveryUsedOn === getTodayStr()
      ) return prev

      const newState = {
        ...prev,
        recoveryTokens: prev.recoveryTokens - 1,
        recoveryUsedOn: getTodayStr(),
        // Keep streak as-is — recovery just bridges the gap
        // The streak will extend when recordActivity() is called today
      }
      saveState(newState)
      return newState
    })
  }, [])

  return {
    streak: currentStreak,
    longestStreak: state.longestStreak,
    recoveryTokens: state.recoveryTokens,
    canRecover,
    missedDays,
    recoverStreak,
    recordActivity,
  }
}

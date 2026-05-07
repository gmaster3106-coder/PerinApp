// src/hooks/usePlan.js
// Central source of truth for the user's subscription plan.
//
// RIGHT NOW: Always returns free tier (Stripe not yet wired).
// WHEN STRIPE LANDS: Flip STUB_MODE to false — the hook will start
// reading from the Supabase `subscriptions` table automatically.
//
// Usage:
//   const { isPro, isTrialing, daysLeft, plan, loading } = usePlan()

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Stub switch ────────────────────────────────────────────────────────────
// Set to false once Stripe webhooks are writing to the subscriptions table.
const STUB_MODE = true

const STUB_PLAN = {
  isPro: false,
  isTrialing: false,
  daysLeft: 0,
  plan: 'free',       // 'free' | 'trialing' | 'active' | 'past_due' | 'canceled'
  loading: false,
  error: null,
}
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  isPro: false,
  isTrialing: false,
  daysLeft: 0,
  plan: 'free',
  loading: true,
  error: null,
}

export function usePlan() {
  const [state, setState] = useState(DEFAULT_STATE)

  useEffect(() => {
    if (STUB_MODE) {
      setState(STUB_PLAN)
      return
    }

    let cancelled = false

    async function fetchPlan() {
      setState((s) => ({ ...s, loading: true, error: null }))

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          if (!cancelled) setState({ ...DEFAULT_STATE, loading: false })
          return
        }

        const { data, error: dbError } = await supabase
          .from('subscriptions')
          .select('plan, current_period_end')
          .eq('user_id', user.id)
          .maybeSingle()

        if (dbError) throw dbError

        if (!data) {
          // No subscription row = free user
          if (!cancelled) setState({ ...DEFAULT_STATE, loading: false })
          return
        }

        const { plan, current_period_end } = data
        const periodEnd = current_period_end ? new Date(current_period_end) : null
        const daysLeft = periodEnd
          ? Math.max(0, Math.ceil((periodEnd - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0

        if (!cancelled) {
          setState({
            isPro: plan === 'active',
            isTrialing: plan === 'trialing',
            daysLeft,
            plan,
            loading: false,
            error: null,
          })
        }
      } catch (err) {
        console.error('[usePlan] Failed to fetch subscription:', err)
        if (!cancelled) {
          setState({ ...DEFAULT_STATE, loading: false, error: err.message })
        }
      }
    }

    fetchPlan()

    // Re-fetch whenever auth state changes (login, logout, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchPlan()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return state
}

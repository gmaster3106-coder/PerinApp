// src/utils/drillGate.js
// Defines what's available on each plan tier.
// All feature checks in the app should go through these functions —
// never hardcode plan logic in components.
//
// This file is pure logic (no React). Components call usePlan() and
// pass the result here.
//
// Usage:
//   const plan = usePlan()
//   const allowed = canAccessDialect(plan, 'dominican_republic')

// ─── Free tier limits ────────────────────────────────────────────────────────

// Dialects available on the free tier.
// NOTE: Argentine Spanish is never included in any tier.
const FREE_DIALECTS = new Set([
  'spanish',          // Generic / Castilian
  'mexican_spanish',
  'french_parisian',
  'italian',
  'portuguese_brazilian',
])

// Max daily AI-powered missions on free tier.
export const FREE_DAILY_MISSION_LIMIT = 3

// Max scenarios unlocked on free tier.
export const FREE_SCENARIO_LIMIT = 5

// ─── Dialect access ──────────────────────────────────────────────────────────

/**
 * Returns true if the user can access the given dialect.
 * Argentine Spanish is always blocked regardless of plan.
 *
 * @param {{ isPro: boolean, isTrialing: boolean }} plan - from usePlan()
 * @param {string} dialectKey - e.g. 'dominican_republic', 'haitian_creole'
 */
export function canAccessDialect(plan, dialectKey) {
  // Hard block — never available.
  if (dialectKey === 'argentine_spanish') return false

  if (plan.isPro || plan.isTrialing) return true
  return FREE_DIALECTS.has(dialectKey)
}

// ─── Mission limits ───────────────────────────────────────────────────────────

/**
 * Returns true if the user can start another mission today.
 *
 * @param {{ isPro: boolean, isTrialing: boolean }} plan
 * @param {number} missionsUsedToday
 */
export function canStartMission(plan, missionsUsedToday) {
  if (plan.isPro || plan.isTrialing) return true
  return missionsUsedToday < FREE_DAILY_MISSION_LIMIT
}

// ─── Scenario access ──────────────────────────────────────────────────────────

/**
 * Returns true if the user can access the scenario at the given index.
 * Free users get the first FREE_SCENARIO_LIMIT scenarios only.
 *
 * @param {{ isPro: boolean, isTrialing: boolean }} plan
 * @param {number} scenarioIndex - 0-based
 */
export function canAccessScenario(plan, scenarioIndex) {
  if (plan.isPro || plan.isTrialing) return true
  return scenarioIndex < FREE_SCENARIO_LIMIT
}

// ─── Culture cards ────────────────────────────────────────────────────────────

/**
 * Free users get a preview (first card only); pro gets all.
 *
 * @param {{ isPro: boolean, isTrialing: boolean }} plan
 * @param {Array} cards
 */
export function getAccessibleCultureCards(plan, cards = []) {
  if (plan.isPro || plan.isTrialing) return cards
  return cards.slice(0, 1)
}

// ─── Generic gate ─────────────────────────────────────────────────────────────

/**
 * Simple boolean gate for any pro-only feature.
 *
 * @param {{ isPro: boolean, isTrialing: boolean }} plan
 */
export function isProFeature(plan) {
  return plan.isPro || plan.isTrialing
}

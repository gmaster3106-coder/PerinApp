// src/utils/crashReporter.js
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://perin-proxy.gmaster3106.workers.dev'
const MAX_QUEUE = 10
const DEBOUNCE_MS = 2000

let lastReported = {}
let queue = []
let flushing = false

export async function reportCrash(type = 'unknown', message = '', detail = null) {
  const key = `${type}:${message}`
  const now = Date.now()
  if (lastReported[key] && now - lastReported[key] < DEBOUNCE_MS) return
  lastReported[key] = now
  const payload = {
    t: now,
    type: String(type).slice(0, 20),
    msg: String(message).slice(0, 300),
    detail: detail ? String(JSON.stringify(detail)).slice(0, 300) : null,
    url: window.location.href.slice(0, 100),
  }
  queue.push(payload)
  if (queue.length > MAX_QUEUE) queue.shift()
  flushQueue()
}

async function flushQueue() {
  if (flushing || queue.length === 0) return
  flushing = true
  while (queue.length > 0) {
    const payload = queue.shift()
    try {
      await fetch(`${WORKER_URL}/crash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000),
      })
    } catch {}
  }
  flushing = false
}

export function initCrashReporting() {
  window.addEventListener('error', (event) => {
    reportCrash('uncaught_error', event.message || 'Unknown error', {
      file: event.filename, line: event.lineno, col: event.colno
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection')
    reportCrash('unhandled_rejection', message)
  })
  window.__perinReportError = (error, info) => {
    reportCrash('react_error', error?.message || 'React error', {
      componentStack: info?.componentStack?.slice(0, 200),
    })
  }
}

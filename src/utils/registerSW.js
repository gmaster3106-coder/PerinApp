// src/utils/registerSW.js
// Call this once in main.jsx to register the service worker.
//
// Usage in main.jsx:
//   import { registerSW } from './utils/registerSW'
//   registerSW()

export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        // Check for updates every time the app loads
        registration.update()

        // When a new SW is waiting, prompt user to reload (optional)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New version available — you can show a toast here if you want
              console.log('[SW] New version available. Reload to update.')
              // To force immediate update without user prompt:
              // newWorker.postMessage({ type: 'SKIP_WAITING' })
              // window.location.reload()
            }
          })
        })
      } catch (err) {
        console.warn('[SW] Registration failed:', err)
      }
    })
  }
}

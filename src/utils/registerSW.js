// src/utils/registerSW.js
export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/PerinApp/sw.js', {
          scope: '/PerinApp/',
        })

        registration.update()

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              console.log('[SW] New version available. Reload to update.')
            }
          })
        })
      } catch (err) {
        console.warn('[SW] Registration failed:', err)
      }
    })
  }
}

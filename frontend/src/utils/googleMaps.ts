declare global {
  interface Window {
    google?: typeof google
  }
}

let loadPromise: Promise<typeof google> | null = null

/** Carga el script de Google Maps JS (Places) una sola vez, sin importar cuántos componentes lo pidan. */
export function loadGoogleMapsPlaces(apiKey: string): Promise<typeof google> {
  if (window.google?.maps?.places) return Promise.resolve(window.google)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__kineqGoogleMapsCallback'
    ;(window as unknown as Record<string, () => void>)[callbackName] = () => {
      if (window.google) resolve(window.google)
      else reject(new Error('Google Maps no se pudo cargar.'))
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=${callbackName}`
    script.async = true
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps.'))
    document.head.appendChild(script)
  })

  return loadPromise
}

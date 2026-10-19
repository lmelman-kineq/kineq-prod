declare global {
  interface Window {
    google?: typeof google
  }
}

let loadPromise: Promise<google.maps.PlacesLibrary> | null = null

/**
 * Carga Google Maps JS una sola vez y devuelve la librería de Places (API
 * nueva: `AutocompleteSuggestion`). La versión clásica (`places.Autocomplete`)
 * no se puede habilitar en proyectos de Google Cloud nuevos — con ella el
 * campo mostraba los íconos de error de Google en vez de sugerencias.
 */
export function loadGoogleMapsPlaces(apiKey: string): Promise<google.maps.PlacesLibrary> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window.google?.maps?.importLibrary === 'function') {
      resolve()
      return
    }
    const callbackName = '__kineqGoogleMapsCallback'
    ;(window as unknown as Record<string, () => void>)[callbackName] = () => resolve()

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=${callbackName}`
    script.async = true
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps.'))
    document.head.appendChild(script)
  })
    .then(() => google.maps.importLibrary('places') as Promise<google.maps.PlacesLibrary>)
    .catch((error) => {
      loadPromise = null // reintenta la próxima vez que se pida
      throw error
    })

  return loadPromise
}

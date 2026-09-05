import { useEffect, useState } from 'react'

// Mismo breakpoint que ya usa `App.css` para el layout "CELULARES" (820px)
// — no se inventa un segundo breakpoint mobile.
export const MOBILE_BREAKPOINT_QUERY = '(max-width: 820px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY)
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}

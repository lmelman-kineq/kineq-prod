import { useRef } from 'react'
import type { TouchEvent } from 'react'

const SWIPE_THRESHOLD_PX = 50
// Si el desplazamiento vertical supera esto, es un scroll, no un swipe
// horizontal — no dispara navegación aunque el eje X también se haya movido.
const SWIPE_MAX_VERTICAL_PX = 60
// Iniciar el gesto muy cerca del borde izquierdo compite con el swipe-back
// nativo de iOS Safari — se ignora esa franja.
const EDGE_SAFE_ZONE_PX = 24
// Elementos donde un swipe no debe interpretarse como navegación de período
// (scroll horizontal propio, controles, turnos, sheets/dropdowns ya
// atrapan sus propios eventos por vivir fuera de este contenedor).
const IGNORE_SELECTOR = 'input, select, textarea, button, a, .turno-card, .week-day-strip, .week-view, .month-view-cell'

/**
 * Swipe horizontal para navegar entre períodos del calendario (Día/Semana/
 * Mes/Año) — alternativo a las flechas existentes, nunca las reemplaza.
 * Se adjunta únicamente al contenedor del calendario (nunca global), así
 * que no compite con bottom sheets/dropdowns/scroll de formularios, que
 * viven fuera de ese contenedor.
 */
export function useSwipeNavigation(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest(IGNORE_SELECTOR)) {
      startRef.current = null
      return
    }
    const touch = event.touches[0]
    if (touch.clientX < EDGE_SAFE_ZONE_PX) {
      startRef.current = null
      return
    }
    startRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = startRef.current
    startRef.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dy) > SWIPE_MAX_VERTICAL_PX) return
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    if (dx < 0) onSwipeLeft()
    else onSwipeRight()
  }

  return { onTouchStart, onTouchEnd }
}

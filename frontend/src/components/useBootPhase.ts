import { useEffect, useState } from 'react'

// 1400ms originalmente; +500ms a pedido para que la animación de entrada
// respire un poco más antes de dar paso al dashboard.
const MIN_VISIBLE_MS = 1900
const FADE_OUT_MS = 400

export type BootPhase = 'visible' | 'fading' | 'hidden'

/**
 * showBootScreen = isRestoringSession || (nuevo ciclo de login) || !minimumElapsed
 *
 * `isRestoringSession` (AuthContext.loading) solo cubre la restauración de
 * sesión al arrancar la app — pasa de true a false una vez y nunca vuelve.
 * `loginBootTrigger` es un valor que cambia en cada login/registro exitoso;
 * cada cambio arranca un ciclo nuevo e independiente, con el mismo mínimo
 * de MIN_VISIBLE_MS, sin depender de `isRestoringSession` (que para ese
 * momento ya es `false` desde hace rato).
 */
export function useBootPhase(isRestoringSession: boolean, loginBootTrigger: number): BootPhase {
  const [prevTrigger, setPrevTrigger] = useState(loginBootTrigger)
  const [cycleId, setCycleId] = useState(0)
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const [hidden, setHidden] = useState(false)

  // Patrón "ajustar estado durante el render" (recomendado por React en vez
  // de un efecto + setState): arranca un ciclo nuevo apenas cambia el
  // trigger, sin esperar un tick extra.
  if (loginBootTrigger !== prevTrigger) {
    setPrevTrigger(loginBootTrigger)
    setCycleId((id) => id + 1)
    setMinimumElapsed(false)
    setHidden(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumElapsed(true), MIN_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [cycleId])

  const fading = !isRestoringSession && minimumElapsed

  useEffect(() => {
    if (!fading) return
    const timer = window.setTimeout(() => setHidden(true), FADE_OUT_MS)
    return () => window.clearTimeout(timer)
  }, [fading, cycleId])

  if (hidden) return 'hidden'
  if (fading) return 'fading'
  return 'visible'
}

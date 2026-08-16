// Umbral a partir del cual la espera se considera prolongada y se resalta.
// TODO: mover a Configuración cuando esa pestaña exista (ver docs/modules/appointments.md).
export const WAITING_ALERT_MINUTES = 20

export function getElapsedMinutes(sinceIso: string | null | undefined, nowMs: number): number | null {
  if (!sinceIso) return null
  const since = new Date(sinceIso).getTime()
  if (Number.isNaN(since)) return null
  return Math.max(0, Math.floor((nowMs - since) / 60000))
}

export function formatMinutesAgo(minutes: number): string {
  return minutes < 1 ? 'hace instantes' : `hace ${minutes} min`
}

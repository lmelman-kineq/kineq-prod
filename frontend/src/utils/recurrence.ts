import { zonedTimeToUtcIso } from './timezone'

// Recurrencia siempre finita (nunca infinita) — ver docs/modules/appointments.md.
// "none" = no se repite; un número = cada cuántas semanas se repite (1 =
// semanal, 2 = cada 2 semanas, siempre el día de la semana de la fecha
// inicial); "monthly" = todos los meses, el N-ésimo díaDeSemana de la fecha
// inicial (ver generateMonthlyOrdinalDates). No se soportan múltiples días
// por semana en esta ronda (ver limitación documentada en appointments.md).
export type RecurrenceFrequency = 'none' | 1 | 2 | 'monthly'

const WEEKDAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const ORDINAL_LABELS = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto']

function weekdayOfDateString(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Nombre del día de la semana (en español) de una fecha `YYYY-MM-DD`, sin depender de zona horaria del navegador. */
export function weekdayLabel(dateStr: string): string {
  return WEEKDAY_LABELS[weekdayOfDateString(dateStr)]
}

/**
 * Posición ordinal (1-5) que ocupa `dateStr` entre las ocurrencias de su
 * mismo día de la semana dentro de su mes — ej. el 04/09/2026 es el primer
 * viernes de septiembre, el 18/09/2026 es el tercero.
 */
export function ordinalOfWeekdayInMonth(dateStr: string): number {
  const day = Number(dateStr.split('-')[2])
  return Math.floor((day - 1) / 7) + 1
}

/** "primer"/"segundo"/"tercer"/"cuarto"/"quinto" para un ordinal 1-5. */
export function ordinalLabel(ordinal: number): string {
  return ORDINAL_LABELS[ordinal - 1] ?? `${ordinal}°`
}

/** "Todos los meses, el primer viernes" (u ordinal/día que corresponda) para la fecha inicial dada. */
export function monthlyRecurrenceLabel(dateStr: string): string {
  return `Todos los meses, el ${ordinalLabel(ordinalOfWeekdayInMonth(dateStr))} ${weekdayLabel(dateStr)}`
}

/** Suma `days` días de calendario a una fecha `YYYY-MM-DD` (aritmética de calendario pura, sin zona horaria). */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

/**
 * Genera las `cantidad` fechas (`YYYY-MM-DD`) de una serie recurrente, cada
 * `frecuenciaSemanas` semanas a partir de `startDateStr` (incluida).
 */
export function generateRecurrenceDates(startDateStr: string, frecuenciaSemanas: number, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => addDaysToDateString(startDateStr, i * frecuenciaSemanas * 7))
}

/**
 * N-ésima ocurrencia de `weekday` (0=domingo..6=sábado) en `year`/`month`
 * (mes 1-based), o `null` si ese mes no tiene esa cantidad de ocurrencias
 * (ej. un "quinto viernes" no existe en todos los meses).
 */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, ordinal: number): string | null {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const offset = (weekday - firstWeekday + 7) % 7
  const day = 1 + offset + (ordinal - 1) * 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * Genera las `cantidad` fechas (`YYYY-MM-DD`) de una serie mensual por
 * ordinal de día de semana ("todos los meses, el N-ésimo díaDeSemana"), a
 * partir del ordinal/día de semana de `startDateStr` (mes calendario real,
 * nunca sumando ~30 días). Si un mes no tiene esa N-ésima ocurrencia (solo
 * relevante para "quinto X", ver `ordinalOfWeekdayInMonth`), ese mes se
 * salta y se sigue buscando en el siguiente — nunca se reinterpreta como
 * "último X" — para que `cantidad` siga siendo siempre el total exacto de
 * turnos generados (ver "Cantidad de sesiones" en appointments.md).
 */
export function generateMonthlyOrdinalDates(startDateStr: string, cantidad: number): string[] {
  const [year, month] = startDateStr.split('-').map(Number)
  const weekday = weekdayOfDateString(startDateStr)
  const ordinal = ordinalOfWeekdayInMonth(startDateStr)

  const dates: string[] = []
  let y = year
  let m = month
  // Cota de seguridad: un "quinto X" ocurre unas 4-5 veces por año, así que
  // en el peor caso hacen falta unos pocos meses de más por ocurrencia
  // pedida — 100 iteraciones cubre holgadamente hasta el máximo de 60
  // sesiones permitido por serie.
  let guard = 0
  while (dates.length < cantidad && guard < 1200) {
    const candidate = nthWeekdayOfMonth(y, m, weekday, ordinal)
    if (candidate) dates.push(candidate)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    guard += 1
  }
  return dates
}

/**
 * Igual que `generateRecurrenceDates`, pero ya convertido a instantes UTC
 * (`fechasInicio` que espera POST /api/turnos/serie) — cada ocurrencia se
 * convierte de forma independiente vía `zonedTimeToUtcIso`, así que el
 * horario de verano de cada fecha puntual se resuelve correctamente en vez
 * de sumar milisegundos fijos sobre un único instante.
 */
export function buildSerieFechasInicio(startDateStr: string, timeStr: string, frecuenciaSemanas: number, cantidad: number, timeZone: string): string[] {
  return generateRecurrenceDates(startDateStr, frecuenciaSemanas, cantidad).map((date) => zonedTimeToUtcIso(date, timeStr, timeZone))
}

/** Igual que `buildSerieFechasInicio`, pero para el patrón mensual por ordinal de día de semana. */
export function buildMonthlySerieFechasInicio(startDateStr: string, timeStr: string, cantidad: number, timeZone: string): string[] {
  return generateMonthlyOrdinalDates(startDateStr, cantidad).map((date) => zonedTimeToUtcIso(date, timeStr, timeZone))
}

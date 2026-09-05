import { addDaysToDateString } from './recurrence'

// Vistas del calendario de Home — ver docs/modules/dashboard.md, "Vistas
// Día/Semana/Mes/Año". Toda la aritmética acá es de calendario puro (nunca
// suma milisegundos fijos), misma convención que utils/recurrence.ts.
export type CalendarView = 'day' | 'week' | 'month' | 'year'

function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay()
}

/** Índice "la semana empieza el lunes" (lunes→0 ... domingo→6). */
function mondayFirstIndex(weekday: number): number {
  return (weekday + 6) % 7
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate()
}

/** Lunes (YYYY-MM-DD) de la semana calendario que contiene `dateStr`. */
export function getWeekStart(dateStr: string): string {
  return addDaysToDateString(dateStr, -mondayFirstIndex(weekdayOf(dateStr)))
}

/** Los 7 días (lunes a domingo) de la semana que contiene `dateStr`. */
export function getWeekDates(dateStr: string): string[] {
  const monday = getWeekStart(dateStr)
  return Array.from({ length: 7 }, (_, i) => addDaysToDateString(monday, i))
}

/**
 * Suma `months` meses de calendario a `dateStr`, preservando el día del mes
 * salvo que el mes destino tenga menos días (clamp al último día real) —
 * misma convención que `generateEveryNMonthsDates` en utils/recurrence.ts,
 * pero para navegación de calendario en vez de generación de series.
 */
export function addMonthsToDateString(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const totalMonthIndex = (month - 1) + months
  const targetYear = year + Math.floor(totalMonthIndex / 12)
  const targetMonth = ((totalMonthIndex % 12) + 12) % 12 + 1
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`
}

/** Primer día (YYYY-MM-DD) del mes que contiene `dateStr`. */
export function getMonthStart(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/**
 * Grilla completa de la vista Mes: siempre semanas completas (lunes a
 * domingo), incluyendo días de relleno del mes anterior/siguiente — nunca
 * corta una semana a la mitad. Longitud siempre múltiplo de 7.
 */
export function getMonthGridDates(dateStr: string): string[] {
  const [year, month] = dateStr.split('-').map(Number)
  const lastDay = daysInMonth(year, month)
  const lastDateOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const gridStart = getWeekStart(getMonthStart(dateStr))
  const gridEnd = addDaysToDateString(lastDateOfMonth, 6 - mondayFirstIndex(weekdayOf(lastDateOfMonth)))

  const dates: string[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    dates.push(cursor)
    cursor = addDaysToDateString(cursor, 1)
  }
  return dates
}

/** Los 12 meses (1-based) del año que contiene `dateStr`. */
export function getYearMonths(dateStr: string): { year: number; month: number }[] {
  const [year] = dateStr.split('-').map(Number)
  return Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }))
}

/** Avanza/retrocede `dateStr` según la vista activa — 1 unidad de esa vista. */
export function navigateDate(dateStr: string, view: CalendarView, direction: 1 | -1): string {
  if (view === 'day') return addDaysToDateString(dateStr, direction)
  if (view === 'week') return addDaysToDateString(dateStr, direction * 7)
  if (view === 'month') return addMonthsToDateString(dateStr, direction)
  return addMonthsToDateString(dateStr, direction * 12)
}

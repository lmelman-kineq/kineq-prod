import { zonedTimeToUtcIso } from './timezone'

// Recurrencia siempre finita (nunca infinita) — ver docs/modules/appointments.md.
// "none" = no se repite; un número = cada cuántas semanas se repite (1 =
// semanal, 2 = cada 2 semanas, siempre el día de la semana de la fecha
// inicial); "monthly" = todos los meses, el N-ésimo díaDeSemana de la fecha
// inicial (ver generateMonthlyOrdinalDates); "custom" = "Personalizado..."
// (intervalo + unidad + días de semana, ver CustomRecurrenceConfig).
export type RecurrenceFrequency = 'none' | 1 | 2 | 'monthly' | 'custom'

export type CustomRecurrenceUnit = 'DIA' | 'SEMANA' | 'MES' | 'ANIO'

// Configuración de "Personalizado...". `diasSemana` solo aplica (y es
// obligatorio, no vacío) cuando `unidad === 'SEMANA'` — con otras unidades
// no hay selección de día de semana, se repite por intervalo de calendario
// puro (ver generateCustomRecurrenceDates).
export type CustomRecurrenceConfig = {
  intervalo: number
  unidad: CustomRecurrenceUnit
  diasSemana?: number[]
}

const WEEKDAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const WEEKDAY_SHORT_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const ORDINAL_LABELS = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto']

function weekdayOfDateString(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Nombre del día de la semana (en español) de una fecha `YYYY-MM-DD`, sin depender de zona horaria del navegador. */
export function weekdayLabel(dateStr: string): string {
  return WEEKDAY_LABELS[weekdayOfDateString(dateStr)]
}

/** Inicial (`L M X J V S D`) de un día de semana (0=domingo..6=sábado). */
export function weekdayShortLabel(weekday: number): string {
  return WEEKDAY_SHORT_LABELS[weekday]
}

/** Nombre completo (en español) de un día de semana (0=domingo..6=sábado), sin pasar por una fecha. */
export function weekdayFullLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday]
}

/** Índice "la semana empieza el lunes" (lunes→0 ... domingo→6) — para ordenar/generar en orden cronológico dentro de una semana. */
function mondayFirstIndex(weekday: number): number {
  return (weekday + 6) % 7
}

/** 0=domingo..6=sábado, en el orden en que se muestran los chips (L M X J V S D). */
export const WEEKDAYS_MONDAY_FIRST: number[] = [1, 2, 3, 4, 5, 6, 0]

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

// ---------------------------------------------------------------------------
// "Personalizado...": intervalo (cada N) + unidad (día/semana/mes/año) +
// para semana, uno o más días de la semana. Las fechas se calculan siempre
// por calendario real (nunca sumando ~30/~365 días) — ver cada generador.
// ---------------------------------------------------------------------------

/** Cada `intervaloDias` días, a partir de `startDateStr` (incluida). */
export function generateEveryNDaysDates(startDateStr: string, intervaloDias: number, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => addDaysToDateString(startDateStr, i * intervaloDias))
}

/** Lunes de la semana calendario (semana empieza lunes) que contiene `dateStr`. */
function mondayOfWeek(dateStr: string): string {
  return addDaysToDateString(dateStr, -mondayFirstIndex(weekdayOfDateString(dateStr)))
}

/**
 * Semanal con uno o más días de la semana, en orden estrictamente
 * cronológico (nunca "todos los lunes primero, después todos los
 * viernes") — cada semana de intervalo se recorre día por día en orden de
 * calendario (L→D). Regla de ancla: nunca se generan ocurrencias
 * anteriores a `startDateStr`; si `startDateStr` coincide con uno de los
 * días elegidos es la primera ocurrencia, si no, la primera ocurrencia real
 * es el próximo día válido posterior (ver "Fecha inicial y días elegidos"
 * en docs/modules/appointments.md).
 */
export function generateWeeklyMultiDayDates(startDateStr: string, intervaloSemanas: number, diasSemana: number[], cantidad: number): string[] {
  const sortedDays = [...diasSemana].sort((a, b) => mondayFirstIndex(a) - mondayFirstIndex(b))
  const anchorMonday = mondayOfWeek(startDateStr)
  const dates: string[] = []
  let weekIndex = 0
  let guard = 0
  while (dates.length < cantidad && guard < 10000) {
    const weekMonday = addDaysToDateString(anchorMonday, weekIndex * intervaloSemanas * 7)
    for (const weekday of sortedDays) {
      if (dates.length >= cantidad) break
      const candidate = addDaysToDateString(weekMonday, mondayFirstIndex(weekday))
      if (candidate >= startDateStr) dates.push(candidate)
    }
    weekIndex += 1
    guard += 1
  }
  return dates
}

/**
 * Suma `totalMeses` meses de calendario a `dateStr`, preservando el día del
 * mes salvo que el mes destino tenga menos días — en ese caso se ajusta
 * (clamp) al último día real de ese mes (ej. 31/01 + 1 mes → 28/02 o 29/02
 * en bisiesto). Convención estándar y explícita, nunca un mes "inválido".
 */
function addMonthsClampToLastDay(dateStr: string, totalMeses: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const totalMonthIndex = (month - 1) + totalMeses
  const targetYear = year + Math.floor(totalMonthIndex / 12)
  const targetMonth = ((totalMonthIndex % 12) + 12) % 12 + 1
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  const targetDay = Math.min(day, daysInTargetMonth)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`
}

/** Cada `intervaloMeses` meses, mismo día del mes que `startDateStr` (clamp si el mes es más corto). */
export function generateEveryNMonthsDates(startDateStr: string, intervaloMeses: number, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => addMonthsClampToLastDay(startDateStr, i * intervaloMeses))
}

/** Cada `intervaloAnios` años, misma fecha que `startDateStr` (clamp 29/02 en años no bisiestos). */
export function generateEveryNYearsDates(startDateStr: string, intervaloAnios: number, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => addMonthsClampToLastDay(startDateStr, i * intervaloAnios * 12))
}

/** Despacha según `config.unidad` — única función que necesita conocer el resto del módulo. */
export function generateCustomRecurrenceDates(startDateStr: string, config: CustomRecurrenceConfig, cantidad: number): string[] {
  switch (config.unidad) {
    case 'DIA':
      return generateEveryNDaysDates(startDateStr, config.intervalo, cantidad)
    case 'SEMANA':
      return generateWeeklyMultiDayDates(startDateStr, config.intervalo, config.diasSemana ?? [], cantidad)
    case 'MES':
      return generateEveryNMonthsDates(startDateStr, config.intervalo, cantidad)
    case 'ANIO':
      return generateEveryNYearsDates(startDateStr, config.intervalo, cantidad)
  }
}

/** Igual que `buildSerieFechasInicio`, para una configuración "Personalizado...". */
export function buildCustomSerieFechasInicio(startDateStr: string, timeStr: string, config: CustomRecurrenceConfig, cantidad: number, timeZone: string): string[] {
  return generateCustomRecurrenceDates(startDateStr, config, cantidad).map((date) => zonedTimeToUtcIso(date, timeStr, timeZone))
}

/** "a y b" / "a, b y c" — join al estilo español, usado en el resumen de recurrencia. */
function joinSpanishList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} y ${items[1]}`
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/**
 * Resumen legible de una configuración "Personalizado..." (nunca JSON ni
 * valores técnicos) — ej. "Cada semana, lunes y miércoles", "Cada 3 días".
 */
export function customRecurrenceSummary(config: CustomRecurrenceConfig): string {
  const { intervalo, unidad } = config
  if (unidad === 'DIA') return intervalo === 1 ? 'Cada día' : `Cada ${intervalo} días`
  if (unidad === 'MES') return intervalo === 1 ? 'Cada mes' : `Cada ${intervalo} meses`
  if (unidad === 'ANIO') return intervalo === 1 ? 'Cada año' : `Cada ${intervalo} años`

  const sortedNames = [...(config.diasSemana ?? [])]
    .sort((a, b) => mondayFirstIndex(a) - mondayFirstIndex(b))
    .map((weekday) => WEEKDAY_LABELS[weekday])
  const diasTexto = joinSpanishList(sortedNames)
  return intervalo === 1 ? `Cada semana, ${diasTexto}` : `Cada ${intervalo} semanas, ${diasTexto}`
}

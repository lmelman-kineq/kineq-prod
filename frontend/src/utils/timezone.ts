// Zonas horarias representativas por franja UTC (identificadores IANA
// válidos, nunca abreviaturas ambiguas tipo "ART"/"EST"). Buenos Aires
// primero/destacada porque es el default del consultorio. No lista cientos
// de ciudades equivalentes — una por franja alcanza para elegir el offset
// correcto, y el offset mostrado se calcula dinámicamente (respeta horario
// de verano) en vez de hardcodearse.
export const TIMEZONE_OPTIONS: Array<{ zone: string; city: string }> = [
  { zone: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires' },
  { zone: 'UTC', city: 'UTC' },
  { zone: 'America/Los_Angeles', city: 'Los Angeles' },
  { zone: 'America/Denver', city: 'Denver' },
  { zone: 'America/Chicago', city: 'Chicago' },
  { zone: 'America/New_York', city: 'New York' },
  { zone: 'America/Santiago', city: 'Santiago' },
  { zone: 'America/Sao_Paulo', city: 'São Paulo' },
  { zone: 'Atlantic/Azores', city: 'Azores' },
  { zone: 'Europe/London', city: 'London' },
  { zone: 'Europe/Paris', city: 'Paris' },
  { zone: 'Europe/Moscow', city: 'Moscow' },
  { zone: 'Asia/Dubai', city: 'Dubai' },
  { zone: 'Asia/Kolkata', city: 'India' },
  { zone: 'Asia/Bangkok', city: 'Bangkok' },
  { zone: 'Asia/Shanghai', city: 'Shanghai' },
  { zone: 'Asia/Tokyo', city: 'Tokyo' },
  { zone: 'Australia/Sydney', city: 'Sydney' },
  { zone: 'Pacific/Auckland', city: 'Auckland' },
  { zone: 'Pacific/Kiritimati', city: 'Kiritimati' },
]

export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires'

/** Offset actual (respeta DST) de una zona IANA, p.ej. "UTC-03". */
export function getTimezoneOffsetLabel(zone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(at)
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
    return offset.replace('GMT', 'UTC') || 'UTC±00'
  } catch {
    return ''
  }
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

function zonedFormatParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  // Intl puede devolver hour=24 para la medianoche con hour12:false.
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') }
}

/**
 * Convierte una fecha/hora "de pared" (tal como se ve en `timeZone`) a un
 * instante UTC real. Truco estándar sin librería de timezones: se arma un
 * instante ingenuo tratando los componentes como si ya fueran UTC, se mira
 * qué hora de pared representaría ese instante en la zona objetivo, y se
 * corrige por la diferencia — cubre el caso normal de agenda (no maneja con
 * precisión el segundo exacto de una transición de horario de verano, que
 * no es relevante para turnos agendados con minutos de anticipación).
 */
export function zonedTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)

  const zoned = zonedFormatParts(new Date(naiveUtcMs), timeZone)
  const zonedAsUtcMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second)
  const offsetMs = zonedAsUtcMs - naiveUtcMs

  return new Date(naiveUtcMs - offsetMs).toISOString()
}

/** Componentes de fecha/hora "de pared" de un instante UTC, en `timeZone`. */
export function utcIsoToZonedParts(isoString: string, timeZone: string): { date: string; time: string } {
  const { year, month, day, hour, minute } = zonedFormatParts(new Date(isoString), timeZone)
  const pad = (value: number) => String(value).padStart(2, '0')
  return { date: `${year}-${pad(month)}-${pad(day)}`, time: `${pad(hour)}:${pad(minute)}` }
}

/**
 * "Hoy" (YYYY-MM-DD) en la zona horaria del consultorio, nunca en la del
 * navegador — mismo criterio que el resto de la app (turnos, mini
 * calendario de Home): persistencia siempre en UTC, presentación siempre en
 * la zona del consultorio.
 */
export function todayInTimeZone(timeZone: string): string {
  return utcIsoToZonedParts(new Date().toISOString(), timeZone).date
}

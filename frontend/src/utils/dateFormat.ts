function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatDateOnly(iso: string | null | undefined) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

export function formatTimeOnly(iso: string | null | undefined) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return `${formatDateOnly(iso)} ${formatTimeOnly(iso)}`
}

/** Para strings "YYYY-MM-DD" planos (no ISO datetime), como `turno.date` del view-model de Turnos. */
export function formatPlainDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function calculateAge(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null
  const birth = new Date(fechaNacimiento)
  if (Number.isNaN(birth.getTime())) return null

  // fechaNacimiento es una fecha calendario, no un instante: el backend la
  // guarda como medianoche UTC (`new Date('YYYY-MM-DD')`), así que hay que
  // leerla con los getters UTC — con los locales, en un huso horario detrás
  // de UTC (como Argentina), la fecha de nacimiento se corre un día para atrás.
  const today = new Date()
  let age = today.getFullYear() - birth.getUTCFullYear()
  const hadBirthdayThisYear =
    today.getMonth() > birth.getUTCMonth() ||
    (today.getMonth() === birth.getUTCMonth() && today.getDate() >= birth.getUTCDate())
  if (!hadBirthdayThisYear) age -= 1

  return age >= 0 ? age : null
}

const DISPLAY_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/**
 * Parsea una fecha tipeada en formato local `dd/mm/aaaa` (también acepta
 * `d/m/aaaa`) a `YYYY-MM-DD`. Devuelve `null` si el texto no tiene el
 * formato esperado o si la fecha no existe calendario (31/02, 13/13, etc.)
 * — reconstruye la fecha y compara los componentes contra lo tipeado, el
 * truco estándar para detectar los desbordes que `Date` normaliza en vez de
 * rechazar (por ejemplo `new Date(2026, 1, 30)` da el 2 de marzo en vez de
 * fallar).
 */
export function parseDisplayDate(text: string): string | null {
  const match = DISPLAY_DATE_PATTERN.exec(text.trim())
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null

  return `${year}-${pad(month)}-${pad(day)}`
}

/** Formatea una fecha `YYYY-MM-DD` (o el prefijo de un ISO datetime) para mostrarla como `dd/mm/aaaa`. */
export function formatDisplayDate(isoDateOnly: string | null | undefined): string {
  if (!isoDateOnly) return ''
  const [year, month, day] = isoDateOnly.slice(0, 10).split('-')
  if (!year || !month || !day) return ''
  return `${day}/${month}/${year}`
}

export function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}…`
}

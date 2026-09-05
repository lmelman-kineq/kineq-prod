import type { Turno } from '../types/domain'
import { professionalName } from './professional'
import { utcIsoToZonedParts } from './timezone'

export interface SesionPlanItem {
  numeroSesion: number | null
  inicio: string
  duracionMinutos: number
  profesionalDisplay: string
  especialidadNombre: string
}

/**
 * Próximas sesiones vigentes de un paciente, para "Exportar plan de
 * sesiones" (ver docs/modules/patients.md). Turnos no cancelados cuyo
 * `inicio` (instante UTC real — comparar instantes nunca depende de la zona
 * horaria de quien mira la pantalla, a diferencia de mostrar la fecha) sea
 * posterior o igual a `nowIso`, ordenados cronológicamente. No filtra por
 * `serieId`: un turno individual, de una serie recurrente, o con
 * recurrencia personalizada entran todos por el mismo criterio — el plan
 * es la agenda real, no una regla de recurrencia.
 */
export function selectUpcomingSesiones(turnos: Turno[], nowIso: string): SesionPlanItem[] {
  const now = new Date(nowIso).getTime()
  return turnos
    .filter((turno) => turno.estado !== 'CANCELADO' && new Date(turno.inicio).getTime() >= now)
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
    .map((turno) => ({
      numeroSesion: turno.numeroSesion ?? null,
      inicio: turno.inicio,
      duracionMinutos: turno.duracionMinutos,
      profesionalDisplay: professionalName(turno.profesional),
      especialidadNombre: turno.especialidad?.nombre ?? '',
    }))
}

const WEEKDAY_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** "Miércoles 02/09" a partir de una fecha "YYYY-MM-DD" ya en la zona del consultorio. */
function formatWeekdayShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${WEEKDAY_NAMES_ES[weekday]} ${pad(day)}/${pad(month)}`
}

/** "4 de septiembre de 2026" a partir de "YYYY-MM-DD" ya en la zona del consultorio. */
function formatLongDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${day} de ${MONTH_NAMES_ES[month - 1]} de ${year}`
}

export interface SesionPlanRow {
  numeroSesionLabel: string
  weekdayDate: string
  hora: string
  profesionalEspecialidad: string | null
}

export interface SesionPlanDocument {
  patientName: string
  consultorioName: string
  rows: SesionPlanRow[]
  generatedOnLabel: string
}

/**
 * DTO puro (sin jsPDF) con todos los strings ya formateados — separa
 * "normalizar datos" de "dibujar el PDF" (ver `sesionesPlanPdf.ts`) para que
 * el contenido se pueda testear sin necesidad de parsear el binario del PDF.
 */
export function buildSesionesPlanDocument(input: {
  patientName: string
  consultorioName: string
  sesiones: SesionPlanItem[]
  timeZone: string
}): SesionPlanDocument {
  const rows = input.sesiones.map((sesion): SesionPlanRow => {
    const { date, time } = utcIsoToZonedParts(sesion.inicio, input.timeZone)
    const profesionalEspecialidad = sesion.especialidadNombre
      ? `${sesion.profesionalDisplay} · ${sesion.especialidadNombre}`
      : sesion.profesionalDisplay
    return {
      // `numeroSesion` es un dato clínico real, editable a mano — nunca se
      // recalcula por posición en la lista. Sin valor, fallback genérico
      // "Sesión" en vez de inventar un número.
      numeroSesionLabel: sesion.numeroSesion != null ? `Sesión ${sesion.numeroSesion}` : 'Sesión',
      weekdayDate: formatWeekdayShortDate(date),
      hora: `${time} hs`,
      profesionalEspecialidad: profesionalEspecialidad || null,
    }
  })

  return {
    patientName: input.patientName,
    consultorioName: input.consultorioName,
    rows,
    generatedOnLabel: `Generado el ${formatLongDate(utcIsoToZonedParts(new Date().toISOString(), input.timeZone).date)}`,
  }
}

const ACCENT_PATTERN = /[̀-ͯ]/g

/** "Nicolás Zotalis" → "nicolas-zotalis", para nombre de archivo. */
export function slugifyForFilename(text: string): string {
  return text
    .normalize('NFD')
    .replace(ACCENT_PATTERN, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function buildSesionesPlanFilename(patientName: string, todayDateStr: string): string {
  const slug = slugifyForFilename(patientName) || 'paciente'
  return `plan-sesiones-${slug}-${todayDateStr}.pdf`
}

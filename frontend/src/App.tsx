import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type SVGProps,
} from 'react'
import './App.css'
import TurnoFormFields, {
  type SpecialtyOption,
  type TurnoFormValue,
  type TurnoStatus,
} from './components/FormFields'
import TurnosPage, { type TurnosPageItem } from './components/TurnosPage'
import PatientsPage from './components/PatientsPage'
import PatientDetailPage from './components/PatientDetailPage'
import AuthorizedImg from './components/AuthorizedImg'
import ConfiguracionPage from './components/ConfiguracionPage'
import EstadisticasPage from './components/EstadisticasPage'
import * as api from './services/api'
import type { Turno as ApiTurno, Paciente, Profesional, Especialidad, ObraSocial, EstadoTurno, GrupoEvolucion } from './types/domain'
import { useAuth } from './auth/AuthContext'
import LoginPage from './auth/LoginPage'
import RegisterPage from './auth/RegisterPage'
import KineqIsologo from './assets/branding/KineqIsologo'
import BootScreen from './components/BootScreen'
import { useBootPhase } from './components/useBootPhase'
import { WAITING_ALERT_MINUTES, formatMinutesAgo, getElapsedMinutes } from './utils/turnoTimers'
import { mapEstadoToStatus, statusClass } from './utils/turnoStatus'
import { getSpecialtyColor, SPECIALTY_COLOR_TOKENS } from './utils/specialtyColors'
import { layoutTurnos } from './utils/turnoLayout'
import { patientFullName } from './utils/patient'
import { professionalName } from './utils/professional'
import { utcIsoToZonedParts, zonedTimeToUtcIso, todayInTimeZone, todayDateInTimeZone } from './utils/timezone'
import { buildSerieFechasInicio, buildMonthlySerieFechasInicio, buildCustomSerieFechasInicio, type CustomRecurrenceUnit } from './utils/recurrence'
import { getWeekDates, getMonthGridDates, getYearMonths, navigateDate, type CalendarView } from './utils/calendarRange'
import { useIsMobile } from './hooks/useIsMobile'

const CALENDAR_VIEW_STORAGE_KEY = 'kineq-calendar-view'
const CALENDAR_VIEW_TITLES: Record<CalendarView, string> = {
  day: 'Calendario del día',
  week: 'Calendario semanal',
  month: 'Calendario mensual',
  year: 'Calendario anual',
}

export type Turno = TurnosPageItem & {
  socialWorkId?: number | null
  notes?: string
}

type AppPage = 'home' | 'turnos' | 'pacientes' | 'paciente-detalle' | 'atencion' | 'estadisticas' | 'configuracion'

type Theme = 'light' | 'dark'

export type TurnoQuickAction = {
  key: string
  label: string
  tone: 'primary' | 'warning' | 'danger'
  onClick: () => void
}

// Copy compacto para la fila de acciones rápidas de "Editar turno" en mobile
// (ver .turno-quick-actions más abajo) — el `label` completo de arriba sigue
// usándose tal cual en los menús contextuales de Inicio/Turnos, que no
// necesitan acortarse.
const COMPACT_QUICK_ACTION_LABELS: Record<string, string> = {
  'en-espera': 'En espera',
  ausente: 'Ausente',
  cancelar: 'Cancelar',
  iniciar: 'Iniciar',
  continuar: 'Continuar',
  finalizar: 'Finalizar',
}

export type ConfirmDialogOptions = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  destructive: boolean
  onConfirm: () => void
}

type ConfirmDialogState = ConfirmDialogOptions | null

// "Editar/eliminar turno recurrente": Este turno / Este turno y los
// siguientes (ver docs/modules/appointments.md). Mismo look que
// ConfirmDialogOptions (reusa `.confirm-dialog`), pero con una elección de 2
// vías en vez de un solo confirmar/cancelar.
type SerieScopeDialogOptions = {
  title: string
  description: string
  confirmLabel: string
  destructive: boolean
  onConfirm: (scope: 'unico' | 'siguientes') => void
}

type SerieScopeDialogState = SerieScopeDialogOptions | null

const THEME_STORAGE_KEY = 'kineq-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  } catch {
    // Si localStorage no está disponible, usamos la preferencia del sistema.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

type MenuIconProps = SVGProps<SVGSVGElement>
type MenuIconComponent = ComponentType<MenuIconProps>

function HomeIcon(props: MenuIconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  )
}

function CalendarIcon(props: MenuIconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M3.5 10h17" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
    </svg>
  )
}

// Indicador discreto de "turno recurrente" — mismo criterio que el punto de
// color de Especialidad: un ícono chico, nunca una card cargada de metadata
// (ver docs/modules/appointments.md, "Indicador visual de recurrencia").
function RecurrenceIcon(props: MenuIconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M4 12a8 8 0 0 1 14-5.3L21 9" />
      <path d="M21 5v4h-4" />
      <path d="M20 12a8 8 0 0 1-14 5.3L3 15" />
      <path d="M3 19v-4h4" />
    </svg>
  )
}

function PatientIcon(props: MenuIconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-4.1 3.2-6.2 7-6.2s6.2 2.1 7 6.2" />
    </svg>
  )
}

function StatisticsIcon(props: MenuIconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M4 19.5V5M4 19.5h16" />
      <path d="m7 15 4-4 3 2 5-6" />
      <circle cx="7" cy="15" r="1" />
      <circle cx="11" cy="11" r="1" />
      <circle cx="14" cy="13" r="1" />
      <circle cx="19" cy="7" r="1" />
    </svg>
  )
}

function SettingsIcon(props: MenuIconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  )
}

const menuItems: Array<{ label: string; Icon: MenuIconComponent; page?: AppPage }> = [
  { label: 'Inicio', Icon: HomeIcon, page: 'home' },
  { label: 'Turnos', Icon: CalendarIcon, page: 'turnos' },
  { label: 'Pacientes', Icon: PatientIcon, page: 'pacientes' },
  { label: 'Estadísticas', Icon: StatisticsIcon, page: 'estadisticas' },
  { label: 'Configuración', Icon: SettingsIcon, page: 'configuracion' },
]

// Los datos se cargan desde la API.

function pad(n: number) { return n.toString().padStart(2, '0') }
function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function addMinutesToTime(time: string, minutesToAdd: number) {
  const [h, m] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(h, m + minutesToAdd, 0, 0)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function TurnoCardTimer({ turno, now }: { turno: Turno; now: number }) {
  if (turno.status === 'En Espera') {
    const minutes = getElapsedMinutes(turno.updatedAt, now)
    if (minutes === null) return null
    const isLong = minutes >= WAITING_ALERT_MINUTES
    return (
      <span className={`turno-card-timer ${isLong ? 'turno-card-timer--alert' : ''}`}>
        Esperando {formatMinutesAgo(minutes)}
      </span>
    )
  }

  if (turno.status === 'Atendiendo') {
    const minutes = getElapsedMinutes(turno.startAttention, now)
    if (minutes === null) return null
    const isOverDuration = minutes > turno.duration
    return (
      <span className={`turno-card-timer ${isOverDuration ? 'turno-card-timer--alert' : ''}`}>
        Atendiendo {formatMinutesAgo(minutes)}
      </span>
    )
  }

  return null
}

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTH_NAMES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatDateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekdayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  return `${weekdayNames[date.getDay()]} ${day} de ${MONTH_NAMES[month - 1]} de ${year}`
}

function formatShortDate(value: string): string {
  const [, month, day] = value.split('-').map(Number)
  return `${Number(day)} ${MONTH_NAMES_SHORT[month - 1]}`
}

/** Título del período según la vista activa — ver "Header según vista" en docs/modules/dashboard.md. */
function formatPeriodLabel(dateStr: string, view: CalendarView): string {
  if (view === 'day') return formatDateLabel(dateStr)
  if (view === 'week') {
    const dates = getWeekDates(dateStr)
    return `${formatShortDate(dates[0])} – ${formatShortDate(dates[6])} ${dates[6].split('-')[0]}`
  }
  const [year, month] = dateStr.split('-').map(Number)
  if (view === 'month') return `${MONTH_NAMES[month - 1][0].toUpperCase()}${MONTH_NAMES[month - 1].slice(1)} ${year}`
  return String(year)
}

const CALENDAR_START_HOUR = 8
const CALENDAR_END_HOUR = 21
const CALENDAR_TOTAL_MINUTES = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60
const CALENDAR_SLOT_SNAP_MINUTES = 15
const hourLabels = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, index) => CALENDAR_START_HOUR + index,
)

function getMonthDays(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const totalDays = new Date(year, month + 1, 0).getDate()
  // getDay() es domingo-primero (0=Dom..6=Sáb); la fila de encabezado es
  // lunes-primero (L,M,M,J,V,S,D), así que hay que correr el offset para
  // que el primer día caiga en la columna correcta.
  const startWeekday = (firstDay.getDay() + 6) % 7
  const days: Array<number | null> = []

  for (let i = 0; i < startWeekday; i += 1) {
    days.push(null)
  }

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(day)
  }

  return days
}

// ---------------------------------------------------------------------------
// Vistas Semana / Mes / Año del calendario de Home — ver docs/modules/
// dashboard.md, "Vistas Día/Semana/Mes/Año". Día no se tocó (sigue inline
// en App): estas tres son componentes de módulo nuevos, sin estado propio
// de turnos (reciben `turnos` ya cargados por rango desde App), para no
// arriesgar ninguna regresión sobre Día. Comparten con Día el mismo
// `.turno-card`/`RecurrenceIcon`/`layoutTurnos`/rango horario
// (CALENDAR_START_HOUR/CALENDAR_END_HOUR) — nunca reimplementan esa lógica.
// ---------------------------------------------------------------------------

const WEEKDAY_HEADER_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type WeekViewProps = {
  selectedDate: string
  todayEnZonaConsultorio: string
  turnos: Turno[]
  loading: boolean
  specialtiesState: SpecialtyOption[]
  selectedTurnoId: number
  onSelectTurno: (turno: Turno) => void
  onContextMenuTurno: (turno: Turno, x: number, y: number) => void
  onCreateSlot: (date: string, time: string) => void
  onSelectDate: (date: string) => void
  canCreate: boolean
  isMobile: boolean
}

function WeekView({
  selectedDate, todayEnZonaConsultorio, turnos, loading, specialtiesState, selectedTurnoId,
  onSelectTurno, onContextMenuTurno, onCreateSlot, onSelectDate, canCreate, isMobile,
}: WeekViewProps) {
  const weekDates = getWeekDates(selectedDate)
  // Mobile (ver "Vista Semana mobile" en docs/modules/dashboard.md): 7
  // columnas angostas son ilegibles en ~390px — se reusa el mismo timeline
  // de Día para un solo día, con una franja de 7 días arriba para cambiarlo.
  const visibleDates = isMobile ? [selectedDate] : weekDates

  const handleColumnClick = (date: string) => (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canCreate) return
    const target = event.target as HTMLElement
    if (target.closest('.turno-card')) return
    const rect = event.currentTarget.getBoundingClientRect()
    const offsetY = Math.max(0, Math.min(CALENDAR_TOTAL_MINUTES, event.clientY - rect.top))
    const snappedMinutes = Math.round(offsetY / CALENDAR_SLOT_SNAP_MINUTES) * CALENDAR_SLOT_SNAP_MINUTES
    const hour = CALENDAR_START_HOUR + Math.floor(snappedMinutes / 60)
    const minute = snappedMinutes % 60
    onCreateSlot(date, `${pad(hour)}:${pad(minute)}`)
  }

  const renderDayColumn = (date: string) => {
    const dayTurnos = turnos.filter((t) => t.date === date)
    const isToday = date === todayEnZonaConsultorio
    const dayLabel = formatShortDate(date)
    const columnLayout = layoutTurnos(
      dayTurnos.map((t) => {
        const [h, m] = t.time.split(':').map(Number)
        const startMinutes = h * 60 + m
        return { id: t.id, startMinutes, endMinutes: startMinutes + t.duration }
      }),
    )

    return (
      <div key={date} className="week-day-column-wrapper">
        <div className={`week-day-header ${isToday ? 'week-day-header--today' : ''}`}>
          <span className="week-day-header-name">{WEEKDAY_HEADER_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay() === 0 ? 6 : new Date(`${date}T00:00:00Z`).getUTCDay() - 1]}</span>
          <span className="week-day-header-date">{dayLabel}</span>
        </div>
        <div className="calendar-column week-day-column" onClick={handleColumnClick(date)}>
          <div className="timeline-lines">
            {hourLabels.map((hour) => <div key={hour} className="timeline-row" />)}
          </div>
          {dayTurnos.map((turno) => {
            const [hourString, minuteString] = turno.time.split(':')
            const top = (Number(hourString) + Number(minuteString) / 60 - CALENDAR_START_HOUR) * 60
            if (top < 0 || top > CALENDAR_TOTAL_MINUTES) return null
            const specialty = specialtiesState.find((s) => s.id === turno.specialtyId)
            const bgColor = specialty?.color ?? turno.color
            const endTime = addMinutesToTime(turno.time, turno.duration)
            const layout = columnLayout.get(turno.id)
            const columns = layout?.columns ?? 1
            const column = layout?.column ?? 0
            const columnGapPx = 4
            const left = `calc(4px + (100% - 8px) * ${column / columns})`
            const width = columns > 1 ? `calc((100% - 8px) * ${1 / columns} - ${columnGapPx}px)` : 'calc(100% - 8px)'
            const renderedHeight = Math.max(turno.duration - 2, 12)

            return (
              <button
                key={turno.id}
                type="button"
                className={`turno-card turno-card--narrow ${turno.id === selectedTurnoId ? 'selected' : ''} short-turno`}
                style={{ top: `${top}px`, height: `${renderedHeight}px`, left, width, backgroundColor: bgColor }}
                onClick={(event) => { event.stopPropagation(); onSelectTurno(turno) }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onContextMenuTurno(turno, event.clientX, event.clientY)
                }}
                title={`${turno.patientDisplay} — ${turno.time} a ${endTime}`}
              >
                <span className={`turno-card-status-dot turno-card-status-dot--${statusClass(turno.status)}`} aria-hidden="true" />
                {turno.serieId ? (
                  <span className="turno-card-recurrence-badge" aria-hidden="true">
                    <RecurrenceIcon className="turno-card-recurrence-icon" />
                  </span>
                ) : null}
                <strong>{turno.patientDisplay}</strong>
                <span>{turno.time}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="week-view">
      {loading ? <p>Cargando turnos...</p> : null}
      {isMobile ? (
        <div className="week-day-strip" role="tablist" aria-label="Elegir día de la semana">
          {weekDates.map((date) => {
            const isToday = date === todayEnZonaConsultorio
            const isSelected = date === selectedDate
            const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
            return (
              <button
                key={date}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`week-day-strip-item ${isSelected ? 'week-day-strip-item--selected' : ''} ${isToday ? 'week-day-strip-item--today' : ''}`}
                onClick={() => onSelectDate(date)}
              >
                <span className="week-day-strip-name">{WEEKDAY_HEADER_LABELS[weekday === 0 ? 6 : weekday - 1]}</span>
                <span className="week-day-strip-date">{Number(date.split('-')[2])}</span>
              </button>
            )
          })}
        </div>
      ) : null}
      <div className={`week-grid ${isMobile ? 'week-grid--single-day' : ''}`}>
        <div className="hours-column week-hours-column">
          <div className="week-day-header week-day-header--spacer" aria-hidden="true" />
          {hourLabels.map((hour) => (
            <div key={hour} className="hour-label">{hour}:00</div>
          ))}
        </div>
        {visibleDates.map((date) => renderDayColumn(date))}
      </div>
    </div>
  )
}

type MonthViewProps = {
  selectedDate: string
  turnos: Turno[]
  loading: boolean
  todayEnZonaConsultorio: string
  onSelectDay: (date: string) => void
  onCreateSlot: (date: string) => void
  canCreate: boolean
}

const MONTH_VIEW_MAX_VISIBLE_PER_DAY = 3

function MonthView({ selectedDate, turnos, loading, todayEnZonaConsultorio, onSelectDay, onCreateSlot, canCreate }: MonthViewProps) {
  const gridDates = getMonthGridDates(selectedDate)
  const activeMonth = Number(selectedDate.split('-')[1])
  const turnosByDate = useMemo(() => {
    const map = new Map<string, Turno[]>()
    for (const turno of turnos) {
      const list = map.get(turno.date)
      if (list) list.push(turno)
      else map.set(turno.date, [turno])
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time))
    return map
  }, [turnos])

  return (
    <div className="month-view">
      {loading ? <p>Cargando turnos...</p> : null}
      <div className="month-view-weekdays">
        {WEEKDAY_HEADER_LABELS.map((label) => <div key={label} className="month-view-weekday">{label}</div>)}
      </div>
      <div className="month-view-grid">
        {gridDates.map((date) => {
          const dayTurnos = turnosByDate.get(date) ?? []
          const visible = dayTurnos.slice(0, MONTH_VIEW_MAX_VISIBLE_PER_DAY)
          const overflowCount = dayTurnos.length - visible.length
          const dayNumber = Number(date.split('-')[2])
          const inCurrentMonth = Number(date.split('-')[1]) === activeMonth
          const isToday = date === todayEnZonaConsultorio

          return (
            <div
              key={date}
              className={`month-view-cell ${inCurrentMonth ? '' : 'month-view-cell--outside'} ${isToday ? 'month-view-cell--today' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => (canCreate ? onCreateSlot(date) : onSelectDay(date))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  if (canCreate) onCreateSlot(date)
                  else onSelectDay(date)
                }
              }}
            >
              <span className="month-view-cell-number">{dayNumber}</span>
              <div className="month-view-cell-turnos">
                {visible.map((turno) => (
                  <button
                    key={turno.id}
                    type="button"
                    className="month-view-turno-chip"
                    style={{ borderLeftColor: turno.color }}
                    onClick={(event) => { event.stopPropagation(); onSelectDay(date) }}
                    title={`${turno.time} — ${turno.patientDisplay}`}
                  >
                    <span className="month-view-turno-chip-time">{turno.time}</span> {turno.patientDisplay}
                  </button>
                ))}
                {overflowCount > 0 ? (
                  <button
                    type="button"
                    className="month-view-overflow"
                    onClick={(event) => { event.stopPropagation(); onSelectDay(date) }}
                  >
                    + {overflowCount} más
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type YearViewProps = {
  selectedDate: string
  todayEnZonaConsultorio: string
  onSelectDay: (date: string) => void
  onSelectMonth: (date: string) => void
}

function YearView({ selectedDate, todayEnZonaConsultorio, onSelectDay, onSelectMonth }: YearViewProps) {
  const months = getYearMonths(selectedDate)

  return (
    <div className="year-view">
      {months.map(({ year, month }) => {
        const monthDate = new Date(year, month - 1, 1)
        const days = getMonthDays(monthDate)
        const monthAnchor = `${year}-${pad(month)}-01`

        return (
          <div key={month} className="year-view-month">
            <button type="button" className="year-view-month-header" onClick={() => onSelectMonth(monthAnchor)}>
              {MONTH_NAMES[month - 1][0].toUpperCase()}{MONTH_NAMES[month - 1].slice(1)}
            </button>
            <div className="year-view-weekdays">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, index) => <div key={index}>{label}</div>)}
            </div>
            <div className="year-view-days">
              {days.map((day, index) => {
                const dayStr = day ? `${year}-${pad(month)}-${pad(day)}` : null
                const isToday = dayStr !== null && dayStr === todayEnZonaConsultorio
                return (
                  <button
                    key={`${day ?? 'empty'}-${index}`}
                    type="button"
                    className={`year-view-day ${day ? '' : 'year-view-day--empty'} ${isToday ? 'year-view-day--today' : ''}`}
                    disabled={!day}
                    onClick={() => dayStr && onSelectDay(dayStr)}
                  >
                    {day ?? ''}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function mapUiStatusToApi(status: TurnoStatus): EstadoTurno {
  const statusMap: Record<TurnoStatus, EstadoTurno> = {
    Asignado: 'ASIGNADO',
    'En Espera': 'EN_ESPERA',
    Atendiendo: 'ATENDIENDO',
    Finalizado: 'FINALIZADO',
    Ausente: 'AUSENTE',
    Cancelado: 'CANCELADO',
  }

  return statusMap[status]
}

const ROL_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  PROFESIONAL: 'Profesional',
  RECEPCION: 'Recepción',
  SUPERVISOR: 'Supervisor',
}

function Dashboard() {
  const { user, logout, refreshUser } = useAuth()
  const [activePage, setActivePage] = useState<AppPage>('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Sidebar comprimida a solo íconos (desktop): en vez de tooltips CSS
  // puros (`::after` con `content: attr(...)`), que quedarían recortados
  // por el `overflow-y: auto` de `.sidebar` (ver comentario en App.css —
  // fijar solo un eje a un valor no-visible hace que el otro eje compute a
  // `auto` también, aunque nunca se haya declarado explícito), se computa
  // la posición con `getBoundingClientRect` sobre el elemento en hover/foco
  // y se renderiza un único tooltip `position: fixed` — mismo patrón ya
  // usado en la app para dropdowns/menús contextuales, así que escapa de
  // cualquier ancestro con overflow recortado sin tocar ese overflow.
  const [sidebarTooltip, setSidebarTooltip] = useState<{ label: string; top: number; left: number } | null>(null)
  const showSidebarTooltip = (label: string) => (event: { currentTarget: HTMLElement }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setSidebarTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 12 })
  }
  const hideSidebarTooltip = () => setSidebarTooltip(null)
  const [profilePhotoInfoOpen, setProfilePhotoInfoOpen] = useState(false)
  // Posición calculada, no CSS estático: el popover vive dentro de
  // `.avatar-wrapper`, que vive dentro de `.sidebar` — `.sidebar` tiene
  // `overflow-y: auto`, que por la interacción overflow-x/overflow-y del
  // spec recorta también el eje horizontal (aunque nunca se haya declarado
  // overflow-x explícito). Un `position: absolute` relativo al wrapper
  // quedaba parcialmente cortado y además generaba scroll horizontal en el
  // propio sidebar (bug real reportado). Mismo mecanismo que
  // `.sidebar-tooltip` (position:fixed + getBoundingClientRect), ya
  // establecido en este archivo para exactamente este problema.
  const [profilePhotoPopoverPos, setProfilePhotoPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false)
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null)
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null)
  const avatarWrapperRef = useRef<HTMLDivElement | null>(null)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [specialtiesState, setSpecialtiesState] = useState<SpecialtyOption[]>([])
  const [patientSocialWorkById, setPatientSocialWorkById] = useState<Record<number, string | null>>({})
  const [turnosPageRefreshKey, setTurnosPageRefreshKey] = useState(0)
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [attentionTurno, setAttentionTurno] = useState<Turno | null>(null)
  // A dónde volver desde Atención: la pantalla real desde la que se entró
  // (Inicio o Turnos, hoy los dos únicos orígenes posibles), en vez de
  // asumir 'home' — evitaba que "Volver" desde una atención iniciada en
  // Turnos devolviera a Inicio en lugar de a Turnos.
  const [attentionReturnPage, setAttentionReturnPage] = useState<AppPage>('home')
  const [selectedTurnoId, setSelectedTurnoId] = useState<number>(0)
  // Ancla el mes/año inicial del mini calendario a la zona horaria del
  // consultorio (no `new Date()` crudo, que es hora del navegador) — si no,
  // la grilla se arma en un marco horario (local) y la comparación de "hoy"
  // más abajo (`todayEnZonaConsultorio`, siempre en la zona del consultorio)
  // en otro, y el día resaltado puede quedar corrido cuando el navegador y
  // el consultorio están en zonas distintas. Mismo criterio que `selectedDate`.
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => todayDateInTimeZone(api.getConsultorioTimeZone()))
  // "Hoy" en la zona horaria del consultorio, no la del navegador — antes
  // de que cargue el consultorio real, api.getConsultorioTimeZone() ya
  // devuelve el default (Buenos Aires), razonable para el primer render.
  const [selectedDate, setSelectedDate] = useState<string>(() => todayInTimeZone(api.getConsultorioTimeZone()))
  // Vista del calendario de Home (Día/Semana/Mes/Año) — persistida en
  // localStorage (conveniencia por dispositivo, nunca server-side) para que
  // no vuelva a "Día" al navegar dentro de la sesión. `selectedDate` es el
  // ancla única para las 4 vistas (no un estado de mes/año separado) — ver
  // docs/modules/dashboard.md, "Vistas Día/Semana/Mes/Año".
  const [calendarView, setCalendarView] = useState<CalendarView>(() => {
    try {
      const stored = localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY)
      if (stored === 'day' || stored === 'week' || stored === 'month' || stored === 'year') return stored
    } catch {
      // localStorage puede no estar disponible (modo privado, etc.) — "day" por default.
    }
    return 'day'
  })
  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, calendarView)
    } catch {
      // Sin persistencia si localStorage falla — no rompe la vista actual.
    }
  }, [calendarView])
  // Turnos de la vista Semana/Mes (rango, no un solo día) — separado de
  // `turnosState` a propósito: Día sigue usando exactamente el mismo
  // estado/efecto de siempre, sin ningún riesgo de regresión.
  const [rangeTurnosState, setRangeTurnosState] = useState<Turno[]>([])
  const [rangeTurnosLoading, setRangeTurnosLoading] = useState(false)
  const [turnosState, setTurnosState] = useState<Turno[]>([])
  const [pacientesState, setPacientesState] = useState<{id:number;displayName:string}[]>([])
  const [profesionalesState, setProfesionalesState] = useState<{id:number;displayName:string}[]>([])
  // Diagnósticos del paciente elegido en el turno que esté abierto (nuevo o
  // edición) — para el selector "Sesión X de Y" en TurnoFormFields. Solo se
  // ofrece a roles con acceso clínico (mismo gate que Evoluciones/Ficha
  // Inicial); RECEPCION/SUPERVISOR siguen viendo el campo "Nro. de sesión"
  // manual de siempre, nunca Diagnósticos (dato clínico).
  const [turnoGruposState, setTurnoGruposState] = useState<GrupoEvolucion[]>([])
  // Usuarios sin profesional vinculado, para "Usuario vinculado" en el alta
  // rápida de Profesional — GET /api/usuarios es solo ADMINISTRADOR, así
  // que para el resto de los roles queda vacío (el campo directamente no
  // se muestra, ver FormFields.tsx).
  const [vinculableUsuariosState, setVinculableUsuariosState] = useState<{id:number;displayName:string}[]>([])
  const [obrasSocialesState, setObrasSocialesState] = useState<string[]>([])
  const [filters, setFilters] = useState({
    specialtyIds: [] as number[],
    socialWorks: [] as string[],
    professionals: [] as string[],
    statuses: [] as string[],
  })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showNewTurno, setShowNewTurno] = useState(false)
  // Placeholder visual del turno que se está por crear al clickear una
  // franja vacía del calendario diario. Puramente de frontend: no se
  // persiste, no afecta filtros ni contadores, y sigue la misma fecha/hora/
  // duración que el formulario (newTurnoForm) mientras el modal está abierto.
  const [showDraftPreview, setShowDraftPreview] = useState(false)

  // Única fuente de verdad para ocultar el placeholder del calendario.
  // Debe correr en cada salida del modal de nuevo turno: cancelar, cerrar
  // con X, Escape, click en el backdrop y guardado exitoso (todos abajo),
  // más el cambio de página (ver el chequeo atado a `activePage` cerca del
  // return de este componente).
  const clearDraftAppointmentPreview = useCallback(() => {
    setShowDraftPreview(false)
  }, [])

  const closeNewTurnoModal = useCallback(() => {
    setShowNewTurno(false)
    clearDraftAppointmentPreview()
  }, [clearDraftAppointmentPreview])

  const [newTurnoForm, setNewTurnoForm] = useState<TurnoFormValue>({
    date: selectedDate,
    time: '09:00',
    patientId: null,
    professionalId: null,
    specialtyId: 0,
    sessionNumber: 1,
    esSesionConsulta: false,
    monto: '',
    grupoId: null,
    status: 'Asignado',
    duration: 60,
    recurrenceFrequency: 'none',
    recurrenceCount: 2,
    customRecurrence: null,
  })
  // Card compacta (quick-create) por default al abrir "Nuevo turno" / click en
  // un slot vacío; "Más opciones" pasa al formulario completo existente sin
  // resetear nada (mismo newTurnoForm/setNewTurnoForm).
  const [newTurnoExpanded, setNewTurnoExpanded] = useState(false)
  const isMobile = useIsMobile()
  // En mobile no existe la distinción compacta/"Más opciones" (ver spec de
  // rediseño mobile-first) — el formulario completo (con Repetición
  // incluida) se muestra siempre, sin un segundo paso.
  const newTurnoIsFull = newTurnoExpanded || isMobile
  const [showViewTurno, setShowViewTurno] = useState(false)
  const [isEditingTurno, setIsEditingTurno] = useState(false)
  const [editingTurnoId, setEditingTurnoId] = useState<number | null>(null)
  const [editingTurnoForm, setEditingTurnoForm] = useState<TurnoFormValue | null>(null)
  // serieId del turno que se está editando/viendo (null si no pertenece a
  // una serie) — capturado en openTurnoDetails, no se deriva de
  // editingTurnoForm porque TurnoFormValue no tiene ese campo.
  const [editingTurnoSerieId, setEditingTurnoSerieId] = useState<number | null>(null)
  const [catalogsLoading, setCatalogsLoading] = useState(true)
  const [turnosLoading, setTurnosLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ turnoId: number; x: number; y: number } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const [serieScopeDialog, setSerieScopeDialog] = useState<SerieScopeDialogState>(null)
  const [serieScopeChoice, setSerieScopeChoice] = useState<'unico' | 'siguientes'>('unico')

  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const confirmDialogRef = useRef<HTMLDivElement | null>(null)
  const newModalRef = useRef<HTMLDivElement | null>(null)
  const viewModalRef = useRef<HTMLDivElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const resizingRef = useRef<{
    id: number
    startY: number
    originalDuration: number
    currentDuration: number
  } | null>(null)
  const draggingRef = useRef<{
    id: number
    startY: number
    startTop: number
    originalTime: string
    currentTime: string
    duration: number
  } | null>(null)
  const isDraggingRef = useRef(false)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // El modo visual sigue funcionando aunque el navegador bloquee localStorage.
    }
  }, [theme])

  const mapApiTurnoToUi = useCallback((t: ApiTurno): Turno => {
    // Igual que al guardar (services/api.ts toInicio): el turno se muestra
    // en la zona horaria del consultorio, no en la del navegador.
    const { date, time } = utcIsoToZonedParts(t.inicio, api.getConsultorioTimeZone())
    return {
      id: t.id,
      date,
      time,
      duration: t.duracionMinutos,
      patientDisplay: patientFullName(t.paciente),
      patientId: t.paciente.id,
      professionalDisplay: professionalName(t.profesional),
      professionalId: t.profesional.id,
      specialtyId: t.especialidad.id,
      specialtyName: t.especialidad.nombre,
      socialWorkId: t.obraSocial?.id ?? null,
      socialWorkDisplay: t.paciente.obraSocial?.nombre ?? patientSocialWorkById[t.paciente.id] ?? t.obraSocial?.nombre ?? null,
      sessionNumber: t.numeroSesion ?? undefined,
      esSesionConsulta: t.esSesionConsulta ?? false,
      monto: t.monto ?? null,
      grupoId: t.grupoId ?? null,
      notes: t.notas ?? undefined,
      status: mapEstadoToStatus(t.estado),
      startAttention: t.inicioAtencion ?? null,
      color: t.especialidad.color || 'var(--color-primary)',
      updatedAt: t.updatedAt,
      serieId: t.serieId ?? null,
      ordenEnSerie: t.ordenEnSerie ?? null,
      serieCantidadSesiones: t.serie?.cantidadSesiones ?? null,
    }
  }, [patientSocialWorkById])

  function mapTurnoToFormValue(turno: Turno): TurnoFormValue {
    return {
      date: turno.date,
      time: turno.time,
      patientId: turno.patientId,
      professionalId: turno.professionalId ?? null,
      specialtyId: turno.specialtyId ?? 0,
      sessionNumber: turno.sessionNumber ?? 1,
      esSesionConsulta: turno.esSesionConsulta ?? false,
      monto: turno.monto != null ? String(turno.monto) : '',
      grupoId: turno.grupoId ?? null,
      status: turno.status,
      duration: turno.duration,
      // La recurrencia no se edita desde este formulario (ver el diálogo
      // "Este turno / Este turno y los siguientes" en openTurnoDetails) —
      // estos dos campos son irrelevantes acá, quedan en su default neutro.
      recurrenceFrequency: 'none',
      recurrenceCount: 2,
      customRecurrence: null,
    }
  }

  // Carga de catálogos. Se ejecuta al iniciar y al reintentar.
  useEffect(() => {
    let cancelled = false

    async function loadCatalogs() {
      setCatalogsLoading(true)
      setLoadError(null)

      try {
        const [pacientes, profesionales, especialidades, obras, consultorio] = await Promise.all([
          api.getPacientes(),
          api.getProfesionales(),
          api.getEspecialidades(),
          api.getObrasSociales(),
          api.getConsultorio(),
        ])

        if (cancelled) return

        // La fecha/hora de los turnos se interpreta en la zona horaria del
        // consultorio, nunca en la del navegador — ver services/api.ts.
        api.setConsultorioTimeZone(consultorio.zonaHoraria)

        setPacientesState(
          pacientes.map((paciente: Paciente) => ({
            id: paciente.id,
            displayName: patientFullName(paciente),
          })),
        )
        setProfesionalesState(
          profesionales.map((profesional: Profesional) => ({
            id: profesional.id,
            displayName: professionalName(profesional),
          })),
        )
        setSpecialtiesState(
          especialidades.map((especialidad: Especialidad, index: number) => ({
            id: especialidad.id,
            name: especialidad.nombre,
            color: especialidad.color || getSpecialtyColor(index),
          })),
        )
        const socialWorkNameById = new Map(
          obras.map((obraSocial: ObraSocial) => [obraSocial.id, obraSocial.nombre]),
        )
        setObrasSocialesState(obras.map((obraSocial: ObraSocial) => obraSocial.nombre).sort())
        setPatientSocialWorkById(
          Object.fromEntries(
            pacientes.map((paciente: Paciente) => [
              paciente.id,
              paciente.obraSocialId
                ? (socialWorkNameById.get(paciente.obraSocialId) ?? null)
                : null,
            ]),
          ),
        )
      } catch (error) {
        if (!cancelled) {
          setLoadError(getErrorMessage(error, 'No se pudieron cargar los datos del consultorio.'))
        }
      } finally {
        if (!cancelled) setCatalogsLoading(false)
      }
    }

    void loadCatalogs()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Carga los turnos cada vez que cambia el día seleccionado.
  useEffect(() => {
    let cancelled = false

    async function loadTurnos() {
      setTurnosLoading(true)
      setLoadError(null)

      try {
        const turnos = await api.getTurnos({
          from: selectedDate,
          to: selectedDate,
        })

        if (cancelled) return

        const mappedTurnos = turnos.map(mapApiTurnoToUi)
        setTurnosState(mappedTurnos)
        setSelectedTurnoId((currentId) =>
          mappedTurnos.some((turno) => turno.id === currentId)
            ? currentId
            : (mappedTurnos[0]?.id ?? 0),
        )
      } catch (error) {
        if (!cancelled) {
          setTurnosState([])
          setSelectedTurnoId(0)
          setLoadError(getErrorMessage(error, 'No se pudieron cargar los turnos.'))
        }
      } finally {
        if (!cancelled) setTurnosLoading(false)
      }
    }

    void loadTurnos()
    return () => {
      cancelled = true
    }
  }, [mapApiTurnoToUi, selectedDate, reloadKey])

  // Turnos para las vistas Semana/Mes: una sola consulta por rango (nunca
  // una request por día) — el backend ya soporta from/to genérico, sin
  // cambios. Año no carga turnos (sin indicadores, ver docs/modules/
  // dashboard.md) — solo necesita navegación, no datos operativos.
  useEffect(() => {
    if (calendarView !== 'week' && calendarView !== 'month') return undefined
    let cancelled = false

    async function loadRangeTurnos() {
      setRangeTurnosLoading(true)
      try {
        const dates = calendarView === 'week' ? getWeekDates(selectedDate) : getMonthGridDates(selectedDate)
        const turnos = await api.getTurnos({ from: dates[0], to: dates[dates.length - 1] })
        if (cancelled) return
        setRangeTurnosState(turnos.map(mapApiTurnoToUi))
      } catch (error) {
        if (!cancelled) {
          setRangeTurnosState([])
          setLoadError(getErrorMessage(error, 'No se pudieron cargar los turnos.'))
        }
      } finally {
        if (!cancelled) setRangeTurnosLoading(false)
      }
    }

    void loadRangeTurnos()
    return () => {
      cancelled = true
    }
  }, [calendarView, selectedDate, mapApiTurnoToUi, reloadKey])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // El diálogo de confirmación (o el de elección de alcance de serie) es
      // la capa más alta: si está abierto, un click afuera solo lo cierra a
      // él, sin cascadear al modal que pueda haber debajo. Nunca están
      // abiertos los dos a la vez.
      if (confirmDialog || serieScopeDialog) {
        if (confirmDialogRef.current && !confirmDialogRef.current.contains(target)) {
          setConfirmDialog(null)
          setSerieScopeDialog(null)
        }
        return
      }

      if (filtersOpen && filtersRef.current && !filtersRef.current.contains(target)) {
        setFiltersOpen(false)
      }

      if (showNewTurno && newModalRef.current && !newModalRef.current.contains(target)) {
        closeNewTurnoModal()
      }

      if (showViewTurno && viewModalRef.current && !viewModalRef.current.contains(target)) {
        setShowViewTurno(false)
        setIsEditingTurno(false)
        setEditingTurnoForm(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [confirmDialog, serieScopeDialog, filtersOpen, showNewTurno, showViewTurno, closeNewTurnoModal])

  // Cierra el popover de "Foto de perfil" al hacer click afuera o presionar Escape.
  useEffect(() => {
    if (!profilePhotoInfoOpen) return undefined

    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (avatarWrapperRef.current && !avatarWrapperRef.current.contains(target)) {
        setProfilePhotoInfoOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfilePhotoInfoOpen(false)
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [profilePhotoInfoOpen])

  const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
  const ALLOWED_PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

  const handleProfilePhotoSelected = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return

    if (!ALLOWED_PROFILE_PHOTO_TYPES.includes(file.type)) {
      setProfilePhotoError('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.')
      return
    }
    if (file.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      setProfilePhotoError(`La foto debe pesar como máximo ${MAX_PROFILE_PHOTO_SIZE_BYTES / (1024 * 1024)}MB.`)
      return
    }

    setProfilePhotoError(null)
    setProfilePhotoUploading(true)
    try {
      await api.uploadUsuarioFoto(file)
      await refreshUser()
      setProfilePhotoInfoOpen(false)
    } catch (err) {
      setProfilePhotoError(err instanceof Error && err.message.trim() ? err.message : 'No se pudo subir la foto.')
    } finally {
      setProfilePhotoUploading(false)
    }
  }

  const removeProfilePhoto = async () => {
    setProfilePhotoError(null)
    setProfilePhotoUploading(true)
    try {
      await api.deleteUsuarioFoto()
      await refreshUser()
      setProfilePhotoInfoOpen(false)
    } catch (err) {
      setProfilePhotoError(err instanceof Error && err.message.trim() ? err.message : 'No se pudo eliminar la foto.')
    } finally {
      setProfilePhotoUploading(false)
    }
  }

  // Cierra el menú contextual del turno al hacer click afuera, scrollear o presionar Escape.
  useEffect(() => {
    if (!contextMenu) return undefined

    const handleOutside = (event: MouseEvent) => {
      // Un right-click (que dispara su propio contextmenu con la nueva
      // ubicación) no debe contar como "click afuera" y cerrar el menú
      // que ese mismo evento está por abrir/reposicionar.
      if (event.button !== 0) return

      const target = event.target as Node
      if (contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenu(null)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null)
    }

    const handleScroll = () => setContextMenu(null)

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [contextMenu])

  const onDragStart = (event: React.MouseEvent, turnoId: number, top: number, duration: number) => {
    if (event.button !== 0) return
    event.preventDefault()

    const turno = turnosState.find((item) => item.id === turnoId)
    if (!turno) return

    draggingRef.current = {
      id: turnoId,
      startY: event.clientY,
      startTop: top,
      originalTime: turno.time,
      currentTime: turno.time,
      duration,
    }
    isDraggingRef.current = false

    const onMove = (moveEvent: MouseEvent) => {
      const dragging = draggingRef.current
      if (!dragging) return

      const deltaY = moveEvent.clientY - dragging.startY
      if (Math.abs(deltaY) > 3) isDraggingRef.current = true

      const newTop = Math.max(0, Math.min(CALENDAR_TOTAL_MINUTES - dragging.duration, dragging.startTop + deltaY))
      const minutesFromEight = Math.round(newTop / 5) * 5
      const hour = CALENDAR_START_HOUR + Math.floor(minutesFromEight / 60)
      const minute = minutesFromEight % 60
      const newTime = `${pad(hour)}:${pad(minute)}`

      dragging.currentTime = newTime
      setTurnosState((currentTurnos) =>
        currentTurnos.map((item) => (item.id === dragging.id ? { ...item, time: newTime } : item)),
      )
    }

    const onUp = async () => {
      const dragging = draggingRef.current
      draggingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)

      if (!dragging || dragging.currentTime === dragging.originalTime) return

      const currentTurno = turnosState.find((item) => item.id === dragging.id)
      const date = currentTurno?.date ?? selectedDate

      try {
        const updated = await api.patchTurno(dragging.id, {
          date,
          time: dragging.currentTime,
        })
        const mapped = mapApiTurnoToUi(updated)
        setTurnosState((currentTurnos) =>
          currentTurnos.map((item) => (item.id === mapped.id ? mapped : item)),
        )
        setTurnosPageRefreshKey((key) => key + 1)
      } catch (error) {
        setTurnosState((currentTurnos) =>
          currentTurnos.map((item) =>
            item.id === dragging.id ? { ...item, time: dragging.originalTime } : item,
          ),
        )
        setLoadError(getErrorMessage(error, 'No se pudo guardar el nuevo horario del turno.'))
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const openNewTurnoModal = (prefillDate?: string, prefillTime?: string, prefillPatientId?: number) => {
    setShowNewTurno(true)
    setNewTurnoExpanded(false)
    setNewTurnoForm({
      date: prefillDate ?? (activePage === 'turnos' ? formatDate(new Date()) : selectedDate),
      time: prefillTime ?? '09:00',
      patientId: prefillPatientId ?? null,
      professionalId: user?.rol === 'PROFESIONAL' ? user.profesionalId ?? null : null,
      specialtyId: specialtiesState[0]?.id ?? 0,
      sessionNumber: 1,
      esSesionConsulta: false,
      monto: '',
      grupoId: null,
      status: 'Asignado',
      duration: 60,
      recurrenceFrequency: 'none',
      recurrenceCount: 2,
      customRecurrence: null,
    })
  }

  const openPatientDetail = (patientId: number) => {
    setSelectedPatientId(patientId)
    setActivePage('paciente-detalle')
  }

  const closePatientDetail = () => {
    setSelectedPatientId(null)
    setActivePage('pacientes')
  }

  const closeAttentionScreen = () => {
    setAttentionTurno(null)
    setActivePage(attentionReturnPage)
  }

  const createSpecialty = async (rawName: string) => {
    const name = rawName.trim()
    const existingSpecialty = specialtiesState.find((s) => s.name.toLowerCase() === name.toLowerCase())
    if (existingSpecialty) return existingSpecialty
    const color = getSpecialtyColor(specialtiesState.length)
    const created = await api.createEspecialidad(name, color)
    const next = { id: created.id, name: created.nombre, color: created.color }
    setSpecialtiesState((s) => [...s, next])
    return next
  }

  // Alta rápida de Paciente desde Crear/Editar Turno: mismo patrón que
  // createSpecialty arriba — crea, agrega al listado ya cargado y devuelve
  // el Item para que el selector lo marque como elegido sin recargar nada.
  const createPatientQuick = async (data: { nombreCompleto: string; documento?: string; telefono?: string }) => {
    const created = await api.createPaciente({
      nombre: data.nombreCompleto,
      apellido: '',
      documento: data.documento || null,
      telefono: data.telefono || null,
    })
    const next = { id: created.id, displayName: patientFullName(created) }
    setPacientesState((s) => [...s, next])
    return next
  }

  // Alta rápida de Profesional desde Crear/Editar Turno: mismo patrón que
  // createPatientQuick — "Nombre completo" en un solo campo (mismo criterio
  // que Paciente: se guarda entero en `nombre`, `apellido` queda ''; ver
  // utils/patient.ts). No repite el campo Especialidad acá: son datos
  // administrativos mínimos para poder agendarlo ya mismo, la ficha
  // completa (especialidades, email, teléfono) se termina de cargar
  // después desde Configuración → Profesionales.
  const createProfesionalQuick = async (data: { nombreCompleto: string; titulo?: string; matricula?: string; usuarioId?: number }) => {
    const created = await api.createProfesional({
      nombre: data.nombreCompleto,
      apellido: '',
      titulo: data.titulo || null,
      matricula: data.matricula || null,
      usuarioId: data.usuarioId ?? null,
    })
    const next = { id: created.id, displayName: professionalName(created) }
    setProfesionalesState((s) => [...s, next])
    return next
  }

  const canSeeDiagnostico = user?.rol === 'ADMINISTRADOR' || user?.rol === 'PROFESIONAL'
  // Misma política que 'eliminar' en getTurnoQuickActions: administración y
  // recepción pueden eliminar turnos; profesional y supervisor, no.
  const canDeleteTurno = user?.rol === 'ADMINISTRADOR' || user?.rol === 'RECEPCION'

  // Diagnósticos del paciente del turno abierto (nuevo o edición) — se
  // recarga cada vez que cambia el paciente elegido en cualquiera de los
  // dos formularios, mientras ese modal esté abierto.
  useEffect(() => {
    const patientId = showNewTurno ? newTurnoForm.patientId : (showViewTurno ? editingTurnoForm?.patientId ?? null : null)
    if (!patientId || !canSeeDiagnostico) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTurnoGruposState([])
      return
    }
    let cancelled = false
    api.getGruposEvolucion(patientId).then((grupos) => {
      if (!cancelled) setTurnoGruposState(grupos)
    }).catch(() => {
      if (!cancelled) setTurnoGruposState([])
    })
    return () => {
      cancelled = true
    }
  }, [showNewTurno, showViewTurno, newTurnoForm.patientId, editingTurnoForm?.patientId, canSeeDiagnostico])

  // Usuarios sin profesional vinculado, para el alta rápida de Profesional
  // — solo se cargan una vez que hace falta (al abrir esa sección), y solo
  // si el rol puede verlos (GET /api/usuarios es ADMINISTRADOR-only).
  const loadVinculableUsuarios = async () => {
    if (user?.rol !== 'ADMINISTRADOR') return
    try {
      const usuarios = await api.getUsuarios()
      setVinculableUsuariosState(
        usuarios
          .filter((u) => u.activo !== false && !u.profesionalId)
          .map((u) => ({ id: u.id, displayName: `${u.nombre} ${u.apellido} · ${u.email}` })),
      )
    } catch {
      // Sección opcional del alta rápida — si falla, el campo "Usuario
      // vinculado" simplemente no aparece, no bloquea crear el profesional.
    }
  }

  // Alta rápida de Diagnóstico desde el propio dropdown del turno — mismo
  // patrón que PatientDetailPage.tsx: único campo obligatorio es el
  // nombre, color por rotación de paleta.
  const createDiagnosticoInlineParaTurno = async (nombre: string): Promise<GrupoEvolucion> => {
    const patientId = showNewTurno ? newTurnoForm.patientId : editingTurnoForm?.patientId
    if (!patientId) throw new Error('Elegí un paciente primero.')
    const color = SPECIALTY_COLOR_TOKENS[turnoGruposState.length % SPECIALTY_COLOR_TOKENS.length]
    const created = await api.createGrupoEvolucion(patientId, { nombre, color })
    setTurnoGruposState((current) => [created, ...current])
    return created
  }

  const fetchProximaSesion = (grupoId: number) => api.getProximaSesion(grupoId)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showNewTurno || showViewTurno) void loadVinculableUsuarios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNewTurno, showViewTurno])

  // Serie recurrente: crea todos los turnos de una vez (POST /api/turnos/serie).
  // Si el backend avisa superposiciones (409 con `overlaps`, ver docs/modules/
  // appointments.md), se ofrece confirmar y reintentar en vez de bloquear —
  // Kineq nunca bloquea turnos superpuestos, solo advierte.
  const saveNewTurnoSerie = async (confirmarSuperposicion: boolean) => {
    if (!newTurnoForm.patientId || !newTurnoForm.professionalId || newTurnoForm.recurrenceFrequency === 'none') return
    const timeZone = api.getConsultorioTimeZone()
    const { recurrenceFrequency } = newTurnoForm

    let fechasInicio: string[]
    let patron: 'SEMANAL' | 'MENSUAL_ORDINAL' | 'PERSONALIZADO'
    let frecuenciaSemanas: number | undefined
    let intervaloPersonalizado: number | undefined
    let unidadPersonalizada: CustomRecurrenceUnit | undefined
    let diasSemanaPersonalizado: number[] | undefined

    if (recurrenceFrequency === 'monthly') {
      fechasInicio = buildMonthlySerieFechasInicio(newTurnoForm.date, newTurnoForm.time, newTurnoForm.recurrenceCount, timeZone)
      patron = 'MENSUAL_ORDINAL'
    } else if (recurrenceFrequency === 'custom') {
      if (!newTurnoForm.customRecurrence) return
      fechasInicio = buildCustomSerieFechasInicio(newTurnoForm.date, newTurnoForm.time, newTurnoForm.customRecurrence, newTurnoForm.recurrenceCount, timeZone)
      patron = 'PERSONALIZADO'
      intervaloPersonalizado = newTurnoForm.customRecurrence.intervalo
      unidadPersonalizada = newTurnoForm.customRecurrence.unidad
      diasSemanaPersonalizado = newTurnoForm.customRecurrence.diasSemana
    } else {
      fechasInicio = buildSerieFechasInicio(newTurnoForm.date, newTurnoForm.time, recurrenceFrequency, newTurnoForm.recurrenceCount, timeZone)
      patron = 'SEMANAL'
      frecuenciaSemanas = recurrenceFrequency
    }

    try {
      const { turnos } = await api.createSerieTurno({
        pacienteId: newTurnoForm.patientId,
        profesionalId: newTurnoForm.professionalId,
        especialidadId: newTurnoForm.specialtyId,
        duracionMinutos: newTurnoForm.duration,
        patron,
        frecuenciaSemanas,
        intervaloPersonalizado,
        unidadPersonalizada,
        diasSemanaPersonalizado,
        fechasInicio,
        numeroSesionInicial: newTurnoForm.sessionNumber,
        esSesionConsulta: newTurnoForm.esSesionConsulta,
        monto: newTurnoForm.monto.trim() ? Number(newTurnoForm.monto) : null,
        grupoId: newTurnoForm.grupoId,
        confirmarSuperposicion,
      })
      const mappedList = turnos.map(mapApiTurnoToUi)
      setTurnosState((currentTurnos) => [...currentTurnos, ...mappedList.filter((t) => t.date === selectedDate)])
      setSelectedTurnoId(mappedList[0]?.id ?? 0)
      closeNewTurnoModal()
      setTurnosPageRefreshKey((key) => key + 1)
      setLoadError(null)
    } catch (error) {
      if (error instanceof api.ApiError && error.status === 409 && Array.isArray(error.body?.overlaps)) {
        const overlapCount = error.body.overlaps.length
        const total = (error.body.totalOcurrencias as number | undefined) ?? fechasInicio.length
        setConfirmDialog({
          title: 'Turnos superpuestos',
          description: `${overlapCount} de ${total} turnos se superponen con otros turnos existentes. ¿Querés crearlos igualmente?`,
          confirmLabel: 'Crear igualmente',
          cancelLabel: 'Cancelar',
          destructive: false,
          onConfirm: () => { void saveNewTurnoSerie(true) },
        })
        return
      }
      setLoadError(getErrorMessage(error, 'No pudimos crear la serie de turnos.'))
    }
  }

  const saveNewTurno = async () => {
    if (!newTurnoForm.patientId || !newTurnoForm.professionalId || newTurnoForm.specialtyId === 0) return

    if (newTurnoForm.recurrenceFrequency !== 'none') {
      await saveNewTurnoSerie(false)
      return
    }

    try {
      const created = await api.createTurno({
        pacienteId: newTurnoForm.patientId,
        profesionalId: newTurnoForm.professionalId,
        especialidadId: newTurnoForm.specialtyId,
        date: newTurnoForm.date,
        time: newTurnoForm.time,
        duracionMinutos: newTurnoForm.duration,
        numeroSesion: newTurnoForm.sessionNumber,
        esSesionConsulta: newTurnoForm.esSesionConsulta,
        monto: newTurnoForm.monto.trim() ? Number(newTurnoForm.monto) : null,
        grupoId: newTurnoForm.grupoId,
        estado: mapUiStatusToApi(newTurnoForm.status),
      })
      const mapped = mapApiTurnoToUi(created)
      setTurnosState((currentTurnos) => [...currentTurnos, mapped])
      setSelectedTurnoId(mapped.id)
      closeNewTurnoModal()
      setTurnosPageRefreshKey((key) => key + 1)
      setLoadError(null)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'No se pudo crear el turno.'))
    }
  }

  const openTurnoDetails = (turno: Turno) => {
  setEditingTurnoId(turno.id)
  setEditingTurnoForm(mapTurnoToFormValue(turno))
  setEditingTurnoSerieId(turno.serieId ?? null)
  setIsEditingTurno(true)
  setShowViewTurno(true)
}

  const closeTurnoDetails = () => {
    setShowViewTurno(false)
    setIsEditingTurno(false)
    setEditingTurnoId(null)
    setEditingTurnoForm(null)
    setEditingTurnoSerieId(null)
  }

  // Cierra el modal de turno (nuevo o edición) o el diálogo de confirmación con Escape.
  // El diálogo de confirmación tiene prioridad: si está abierto, Escape solo lo cierra a él.
  useEffect(() => {
    if (!confirmDialog && !serieScopeDialog && !showNewTurno && !showViewTurno) return undefined

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (confirmDialog) {
        setConfirmDialog(null)
        return
      }
      if (serieScopeDialog) {
        setSerieScopeDialog(null)
        return
      }
      if (showNewTurno) closeNewTurnoModal()
      if (showViewTurno) closeTurnoDetails()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [confirmDialog, serieScopeDialog, showNewTurno, showViewTurno, closeNewTurnoModal])

  // No existe un endpoint de borrado físico: "Cancelado" ya es, en el dominio
  // de Kineq, el estado que libera el horario.
  const cancelTurno = async (turnoId: number) => {
    try {
      await api.patchTurno(turnoId, { estado: 'CANCELADO' })
      setTurnosState((currentTurnos) => currentTurnos.filter((item) => item.id !== turnoId))
      if (selectedTurnoId === turnoId) setSelectedTurnoId(0)
      if (editingTurnoId === turnoId) closeTurnoDetails()
      setTurnosPageRefreshKey((key) => key + 1)
      setLoadError(null)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'No se pudo cancelar el turno.'))
    }
  }

  const handleCancelTurno = (turnoId: number) => {
    setContextMenu(null)
    setConfirmDialog({
      title: 'Cancelar turno',
      description: 'El horario quedará disponible nuevamente.',
      confirmLabel: 'Cancelar turno',
      cancelLabel: 'Volver',
      destructive: true,
      onConfirm: () => { void cancelTurno(turnoId) },
    })
  }

  // Baja lógica real (Turno.eliminadoAt en el backend) — a diferencia de
  // cancelTurno, esto saca al turno de toda lectura operativa, no solo
  // cambia su estado. Disponible para cualquier estado (ver getTurnoQuickActions).
  const deleteTurno = async (turnoId: number) => {
    try {
      await api.deleteTurno(turnoId)
      setTurnosState((currentTurnos) => currentTurnos.filter((item) => item.id !== turnoId))
      if (selectedTurnoId === turnoId) setSelectedTurnoId(0)
      if (editingTurnoId === turnoId) closeTurnoDetails()
      setTurnosPageRefreshKey((key) => key + 1)
      setLoadError(null)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'No se pudo eliminar el turno.'))
    }
  }

  // "Eliminar este turno y los siguientes": baja lógica desde el turno-ancla
  // en adelante dentro de su serie (DELETE /api/turnos/:id/serie). Los
  // anteriores al corte nunca se tocan. Como los siguientes casi siempre
  // caen en otro día del calendario diario, se recarga por reloadKey en vez
  // de intentar parchear turnosState a mano.
  const deleteTurnoSerie = async (turnoId: number) => {
    try {
      await api.deleteSerieTurno(turnoId)
      if (selectedTurnoId === turnoId) setSelectedTurnoId(0)
      if (editingTurnoId === turnoId) closeTurnoDetails()
      setTurnosPageRefreshKey((key) => key + 1)
      setReloadKey((key) => key + 1)
      setLoadError(null)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'No pudimos eliminar los turnos siguientes.'))
    }
  }

  const handleDeleteTurno = (turnoId: number, serieId?: number | null) => {
    setContextMenu(null)

    if (serieId) {
      setSerieScopeChoice('unico')
      setSerieScopeDialog({
        title: 'Eliminar turno recurrente',
        description: 'Este turno pertenece a una serie recurrente. Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar',
        destructive: true,
        onConfirm: (scope) => {
          if (scope === 'unico') void deleteTurno(turnoId)
          else void deleteTurnoSerie(turnoId)
        },
      })
      return
    }

    setConfirmDialog({
      title: 'Eliminar turno',
      description: 'Esta acción eliminará el turno de forma permanente de la agenda. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Volver',
      destructive: true,
      onConfirm: () => { void deleteTurno(turnoId) },
    })
  }

  // Transición genérica de estado (En Espera / Atendiendo / Finalizado / Ausente).
  // El backend registra automáticamente el timestamp correspondiente al transicionar.
  const updateTurnoEstado = async (turnoId: number, nextEstado: EstadoTurno) => {
    try {
      const updated = await api.patchTurno(turnoId, { estado: nextEstado })
      const mapped = mapApiTurnoToUi(updated)
      setTurnosState((currentTurnos) =>
        currentTurnos.map((item) => (item.id === mapped.id ? mapped : item)),
      )
      if (editingTurnoId === mapped.id) {
        setEditingTurnoForm(mapTurnoToFormValue(mapped))
      }
      setTurnosPageRefreshKey((key) => key + 1)
      setLoadError(null)
      return mapped
    } catch (error) {
      setLoadError(getErrorMessage(error, 'No se pudo actualizar el estado del turno.'))
      return null
    }
  }

  const marcarAusente = (turnoId: number) => {
    setContextMenu(null)
    setConfirmDialog({
      title: 'Marcar paciente ausente',
      description: 'Este turno contará como sesión consumida.',
      confirmLabel: 'Marcar ausente',
      cancelLabel: 'Volver',
      destructive: true,
      onConfirm: () => { void updateTurnoEstado(turnoId, 'AUSENTE') },
    })
  }

  // Única función que finaliza una atención desde fuera de la propia pantalla
  // de Atención (calendario de Inicio, menú de Turnos, acciones rápidas del
  // modal "Editar turno" — las tres comparten getTurnoQuickActions más abajo,
  // así que confirmar acá alcanza para las tres superficies).
  const requestFinalizarAtencion = (turnoId: number) => {
    setContextMenu(null)
    setConfirmDialog({
      title: 'Finalizar atención',
      description: '¿Seguro que querés finalizar la atención de este paciente? El turno quedará marcado como finalizado.',
      confirmLabel: 'Finalizar atención',
      cancelLabel: 'Cancelar',
      destructive: false,
      onConfirm: () => { void updateTurnoEstado(turnoId, 'FINALIZADO') },
    })
  }

  // "Iniciar atención" es el punto de entrada único al flujo clínico: primero
  // confirma el cambio de estado en el backend y solo si eso funciona navega
  // a la pantalla de atención. Si falla, no navega (el error ya quedó en loadError).
  const iniciarAtencion = async (turnoId: number) => {
    setContextMenu(null)
    // Si esta acción se disparó desde las acciones rápidas del modal "Editar
    // turno" (turno-quick-actions), ese modal sigue montado como overlay
    // hermano de `activePage` — no se cierra solo al navegar. Sin este
    // cierre explícito quedaba flotando por encima de la pantalla de
    // Atención (backdrop incluido, nunca un problema de scroll/focus-trap
    // porque no usan JS para eso, pero sí una modal fantasma).
    closeTurnoDetails()
    const returnPage = activePage
    const updated = await updateTurnoEstado(turnoId, 'ATENDIENDO')
    if (!updated) return
    setAttentionTurno(updated)
    setAttentionReturnPage(returnPage)
    setActivePage('atencion')
  }

  // El turno ya está ATENDIENDO: solo navega, sin volver a pegarle al backend.
  // Recibe el turno completo (no solo el id) porque quien llama a esta acción
  // no siempre tiene el turno en `turnosState`: esa lista solo trae los
  // turnos de `selectedDate` (la agenda del día en Inicio), mientras que
  // TurnosPage muestra turnos de un rango de fechas más amplio. Buscar por id
  // en `turnosState` fallaba en silencio para cualquier turno fuera del día
  // seleccionado en Inicio.
  const continuarAtencion = (turno: TurnosPageItem) => {
    setContextMenu(null)
    // Mismo motivo que en iniciarAtencion: cierra el modal "Editar turno" si
    // la acción se disparó desde sus acciones rápidas, para no dejarlo
    // flotando sobre la pantalla de Atención.
    closeTurnoDetails()
    setAttentionTurno(turno)
    setAttentionReturnPage(activePage)
    setActivePage('atencion')
  }

  // Recepción/administrador operan la agenda; profesional solo su propia
  // atención clínica (iniciar/continuar/finalizar) y solo sobre turnos
  // propios; supervisor queda en modo lectura. El backend vuelve a validar
  // todo esto: este filtro es únicamente para no ofrecer acciones que el
  // servidor rechazaría.
  //
  // Recibe el turno completo por el mismo motivo que `continuarAtencion`:
  // no depender de `turnosState`, que no incluye los turnos que muestra
  // TurnosPage fuera del día seleccionado en Inicio.
  function getTurnoQuickActions(turno: TurnosPageItem): TurnoQuickAction[] {
    const { status, id: turnoId } = turno
    let actions: TurnoQuickAction[] = []

    if (status === 'Asignado') {
      actions = [
        { key: 'en-espera', label: 'Marcar en espera', tone: 'primary', onClick: () => { void updateTurnoEstado(turnoId, 'EN_ESPERA') } },
        { key: 'ausente', label: 'Marcar ausente', tone: 'warning', onClick: () => marcarAusente(turnoId) },
        { key: 'cancelar', label: 'Cancelar turno', tone: 'danger', onClick: () => handleCancelTurno(turnoId) },
      ]
    } else if (status === 'En Espera') {
      actions = [
        { key: 'iniciar', label: 'Iniciar atención', tone: 'primary', onClick: () => { void iniciarAtencion(turnoId) } },
        { key: 'ausente', label: 'Marcar ausente', tone: 'warning', onClick: () => marcarAusente(turnoId) },
        { key: 'cancelar', label: 'Cancelar turno', tone: 'danger', onClick: () => handleCancelTurno(turnoId) },
      ]
    } else if (status === 'Atendiendo') {
      actions = [
        { key: 'continuar', label: 'Continuar atención', tone: 'primary', onClick: () => continuarAtencion(turno) },
        { key: 'finalizar', label: 'Finalizar atención', tone: 'warning', onClick: () => requestFinalizarAtencion(turnoId) },
      ]
    }

    // "Eliminar turno" (baja lógica) va siempre al final, sin importar el
    // estado: a diferencia de las transiciones de arriba, es una operación
    // administrativa que tiene sentido incluso sobre turnos ya finalizados,
    // ausentes o cancelados.
    actions = [...actions, { key: 'eliminar', label: 'Eliminar turno', tone: 'danger', onClick: () => handleDeleteTurno(turnoId, turno.serieId) }]

    if (!user || user.rol === 'SUPERVISOR') return []
    if (user.rol === 'ADMINISTRADOR') return actions

    const clinicalKeys = ['iniciar', 'continuar', 'finalizar']
    if (user.rol === 'RECEPCION') return actions.filter((action) => !clinicalKeys.includes(action.key))

    // PROFESIONAL: solo acciones clínicas, y solo sobre turnos propios.
    const esPropio = turno.professionalId != null && turno.professionalId === user.profesionalId
    if (!esPropio) return []
    return actions.filter((action) => clinicalKeys.includes(action.key))
  }

  const saveEditedTurnoSingle = async () => {
    if (editingTurnoId === null || !editingTurnoForm) return
    if (!editingTurnoForm.patientId || !editingTurnoForm.professionalId || editingTurnoForm.specialtyId === 0) return

    try {
      const updated = await api.patchTurno(editingTurnoId, {
        pacienteId: editingTurnoForm.patientId,
        profesionalId: editingTurnoForm.professionalId,
        especialidadId: editingTurnoForm.specialtyId,
        date: editingTurnoForm.date,
        time: editingTurnoForm.time,
        duracionMinutos: editingTurnoForm.duration,
        numeroSesion: editingTurnoForm.sessionNumber,
        esSesionConsulta: editingTurnoForm.esSesionConsulta,
        monto: editingTurnoForm.monto.trim() ? Number(editingTurnoForm.monto) : null,
        grupoId: editingTurnoForm.grupoId,
        estado: mapUiStatusToApi(editingTurnoForm.status),
      })

      const mappedTurno = mapApiTurnoToUi(updated)
      setTurnosState((currentTurnos) => {
        const withoutUpdated = currentTurnos.filter(
          (turno) => turno.id !== mappedTurno.id,
        )
        return mappedTurno.date === selectedDate
          ? [...withoutUpdated, mappedTurno]
          : withoutUpdated
      })
      setLoadError(null)
      closeTurnoDetails()
      setTurnosPageRefreshKey((key) => key + 1)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'No se pudieron guardar los cambios del turno.'))
    }
  }

  // "Editar este turno y los siguientes": solo cambia hora (de pared),
  // duración, profesional, especialidad, diagnóstico, monto y "sesión de
  // consulta" — nunca la fecha de cada ocurrencia (cada una conserva su
  // propio día, ver docs/modules/appointments.md) ni numeroSesion (nunca se
  // renumera en bloque). Recarga por reloadKey en vez de parchear
  // turnosState a mano, ya que las ocurrencias afectadas casi siempre caen
  // en otros días del calendario diario.
  const saveEditedTurnoSiguientes = async (confirmarSuperposicion: boolean) => {
    if (editingTurnoId === null || !editingTurnoForm) return
    if (!editingTurnoForm.professionalId || editingTurnoForm.specialtyId === 0) return

    try {
      const { turnos: siguientes } = await api.getSerieTurno(editingTurnoId)
      const timeZone = api.getConsultorioTimeZone()
      const ocurrencias = siguientes.map((t) => {
        const { date } = utcIsoToZonedParts(t.inicio, timeZone)
        return { turnoId: t.id, inicio: zonedTimeToUtcIso(date, editingTurnoForm.time, timeZone) }
      })

      const { turnos: actualizados } = await api.patchSerieTurno(editingTurnoId, {
        ocurrencias,
        profesionalId: editingTurnoForm.professionalId,
        especialidadId: editingTurnoForm.specialtyId,
        duracionMinutos: editingTurnoForm.duration,
        monto: editingTurnoForm.monto.trim() ? Number(editingTurnoForm.monto) : null,
        grupoId: editingTurnoForm.grupoId,
        esSesionConsulta: editingTurnoForm.esSesionConsulta,
        confirmarSuperposicion,
      })

      const mappedList = actualizados.map(mapApiTurnoToUi)
      const updatedIds = new Set(mappedList.map((t) => t.id))
      setTurnosState((currentTurnos) => [
        ...currentTurnos.filter((t) => !updatedIds.has(t.id)),
        ...mappedList.filter((t) => t.date === selectedDate),
      ])
      setLoadError(null)
      closeTurnoDetails()
      setTurnosPageRefreshKey((key) => key + 1)
      setReloadKey((key) => key + 1)
    } catch (error) {
      if (error instanceof api.ApiError && error.status === 409 && Array.isArray(error.body?.overlaps)) {
        const overlapCount = error.body.overlaps.length
        const total = (error.body.totalOcurrencias as number | undefined) ?? overlapCount
        setConfirmDialog({
          title: 'Turnos superpuestos',
          description: `${overlapCount} de ${total} turnos se superponen con otros turnos existentes. ¿Querés guardar igualmente?`,
          confirmLabel: 'Guardar igualmente',
          cancelLabel: 'Cancelar',
          destructive: false,
          onConfirm: () => { void saveEditedTurnoSiguientes(true) },
        })
        return
      }
      setLoadError(getErrorMessage(error, 'No pudimos modificar los turnos siguientes.'))
    }
  }

  const saveEditedTurno = async () => {
    if (editingTurnoId === null || !editingTurnoForm) return
    if (!editingTurnoForm.patientId || !editingTurnoForm.professionalId || editingTurnoForm.specialtyId === 0) return

    if (editingTurnoSerieId) {
      setSerieScopeChoice('unico')
      setSerieScopeDialog({
        title: 'Editar turno recurrente',
        description: 'Este turno pertenece a una serie recurrente. Elegí qué querés modificar.',
        confirmLabel: 'Continuar',
        destructive: false,
        onConfirm: (scope) => {
          if (scope === 'unico') void saveEditedTurnoSingle()
          else void saveEditedTurnoSiguientes(false)
        },
      })
      return
    }

    await saveEditedTurnoSingle()
  }

  // compute month grid based on currentMonthDate
  const monthDays = useMemo(() => getMonthDays(currentMonthDate), [currentMonthDate])
  // "Hoy" para resaltar el día actual en el mini calendario — zona horaria
  // del consultorio, nunca la del navegador (ver todayInTimeZone).
  const todayEnZonaConsultorio = todayInTimeZone(api.getConsultorioTimeZone())

  const selectedTurno =
    turnosState.find((turno) => turno.id === selectedTurnoId) ??
    turnosState.find((turno) => turno.date === selectedDate) ??
    null

  // Opciones de filtro: vienen del consultorio completo (profesionalesState/
  // obrasSocialesState, ya activos y aislados por consultorio vía backend),
  // no de los turnos del día seleccionado. Antes se derivaban de
  // `turnosState`, que solo trae los turnos de `selectedDate`: un
  // profesional u obra social sin turno ese día específico directamente no
  // aparecía como opción de filtro.
  const uniqueSocialWorks = obrasSocialesState
  const uniqueProfessionals = profesionalesState.map((profesional) => profesional.displayName)

  const dayTurnos = turnosState
    .filter((t) => t.date === selectedDate)
    .filter((turno) => {
      const specialtyMatch =
        filters.specialtyIds.length === 0 ||
        (turno.specialtyId ? filters.specialtyIds.includes(turno.specialtyId) : false)
      const socialWorkMatch = filters.socialWorks.length === 0 || filters.socialWorks.includes(turno.socialWorkDisplay ?? '')
      const professionalMatch = filters.professionals.length === 0 || filters.professionals.includes(turno.professionalDisplay ?? '')
      const statusMatch = filters.statuses.length === 0 || filters.statuses.includes(turno.status)

      return specialtyMatch && socialWorkMatch && professionalMatch && statusMatch
    })
    .sort((a, b) => a.time.localeCompare(b.time))

  const visibleDayTurnos = dayTurnos.filter((turno) => {
    const [hour, minute] = turno.time.split(':').map(Number)
    const minutesFromStart = (hour - CALENDAR_START_HOUR) * 60 + minute
    return minutesFromStart >= 0 && minutesFromStart < CALENDAR_TOTAL_MINUTES
  })

  const hiddenDayTurnosCount = dayTurnos.length - visibleDayTurnos.length

  // Turnos superpuestos (de distintos profesionales) comparten el ancho de
  // la columna en vez de taparse; ver utils/turnoLayout.ts.
  const turnoColumnLayout = layoutTurnos(
    visibleDayTurnos.map((turno) => {
      const [hourString, minuteString] = turno.time.split(':')
      const startMinutes = Number(hourString) * 60 + Number(minuteString)
      return { id: turno.id, startMinutes, endMinutes: startMinutes + turno.duration }
    }),
  )

  // Reloj usado para refrescar los timers de En Espera/Atendiendo (panel lateral y calendario).
  const [clockNow, setClockNow] = useState(() => Date.now())

  useEffect(() => {
    const hasLiveTimer =
      activePage === 'home' &&
      dayTurnos.some((turno) => turno.status === 'En Espera' || turno.status === 'Atendiendo')

    if (!hasLiveTimer) return undefined

    const timer = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activePage, dayTurnos])

  const elapsedSeconds =
    selectedTurno?.status === 'Atendiendo' && selectedTurno.startAttention
      ? Math.max(0, Math.floor((clockNow - new Date(selectedTurno.startAttention).getTime()) / 1000))
      : 0
  const isSelectedAttendingOverDuration =
    selectedTurno?.status === 'Atendiendo' && Math.floor(elapsedSeconds / 60) > selectedTurno.duration
  const selectedWaitingMinutes =
    selectedTurno?.status === 'En Espera' ? getElapsedMinutes(selectedTurno.updatedAt, clockNow) : null
  const isSelectedWaitingTooLong =
    selectedWaitingMinutes !== null && selectedWaitingMinutes >= WAITING_ALERT_MINUTES

  const prevMonth = () => setCurrentMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  // Navegación del calendario principal — respeta la vista activa (Día:
  // ±1 día, Semana: ±7 días, Mes: ±1 mes calendario, Año: ±1 año). "Hoy"
  // vuelve al período que contiene la fecha actual sin cambiar de vista.
  const goToPreviousPeriod = () => setSelectedDate((current) => navigateDate(current, calendarView, -1))
  const goToNextPeriod = () => setSelectedDate((current) => navigateDate(current, calendarView, 1))
  const goToToday = () => setSelectedDate(todayInTimeZone(api.getConsultorioTimeZone()))

  // Redimensiona visualmente durante el movimiento y persiste una sola vez al soltar.
  const onResizeStart = (event: React.MouseEvent, turnoId: number) => {
    if (event.button !== 0) return
    event.preventDefault()

    const turno = turnosState.find((item) => item.id === turnoId)
    if (!turno) return

    resizingRef.current = {
      id: turnoId,
      startY: event.clientY,
      originalDuration: turno.duration,
      currentDuration: turno.duration,
    }
    isDraggingRef.current = false

    const onMove = (moveEvent: MouseEvent) => {
      const resizing = resizingRef.current
      if (!resizing) return

      const deltaY = Math.round(moveEvent.clientY - resizing.startY)
      if (Math.abs(deltaY) > 3) isDraggingRef.current = true
      const newDuration = Math.max(15, Math.round((resizing.originalDuration + deltaY) / 5) * 5)
      resizing.currentDuration = newDuration

      setTurnosState((currentTurnos) =>
        currentTurnos.map((item) =>
          item.id === resizing.id ? { ...item, duration: newDuration } : item,
        ),
      )
    }

    const onUp = async () => {
      const resizing = resizingRef.current
      resizingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)

      if (!resizing || resizing.currentDuration === resizing.originalDuration) return

      try {
        const updated = await api.patchTurno(resizing.id, {
          duracionMinutos: resizing.currentDuration,
        })
        const mapped = mapApiTurnoToUi(updated)
        setTurnosState((currentTurnos) =>
          currentTurnos.map((item) => (item.id === mapped.id ? mapped : item)),
        )
        setTurnosPageRefreshKey((key) => key + 1)
      } catch (error) {
        setTurnosState((currentTurnos) =>
          currentTurnos.map((item) =>
            item.id === resizing.id ? { ...item, duration: resizing.originalDuration } : item,
          ),
        )
        setLoadError(getErrorMessage(error, 'No se pudo guardar la duración del turno.'))
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Abre la creación rápida de turno al hacer click en un espacio vacío del calendario diario.
  const handleCalendarBackgroundClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      return
    }

    const target = event.target as HTMLElement
    if (target.closest('.turno-card')) return

    const rect = event.currentTarget.getBoundingClientRect()
    const offsetY = Math.max(0, Math.min(CALENDAR_TOTAL_MINUTES, event.clientY - rect.top))
    const snappedMinutes = Math.round(offsetY / CALENDAR_SLOT_SNAP_MINUTES) * CALENDAR_SLOT_SNAP_MINUTES
    const hour = CALENDAR_START_HOUR + Math.floor(snappedMinutes / 60)
    const minute = snappedMinutes % 60

    openNewTurnoModal(selectedDate, `${pad(hour)}:${pad(minute)}`)
    setShowDraftPreview(true)
  }

  // El placeholder del calendario solo tiene sentido en Inicio: si se
  // navega a otra página (Turnos, Pacientes, etc.) mientras sigue activo,
  // se limpia acá (ajuste de estado durante el render, patrón recomendado
  // por React en vez de un efecto, ya que se deriva de otro estado/prop).
  if (activePage !== 'home' && showDraftPreview) {
    setShowDraftPreview(false)
  }

  const fullName = user ? `${user.nombre} ${user.apellido}`.trim() : ''
  const roleLabel = user ? ROL_LABELS[user.rol] ?? user.rol : ''
  const initials = user ? `${user.nombre[0] ?? ''}${user.apellido[0] ?? ''}`.toUpperCase() : ''
  const visibleMenuItems = menuItems.filter((item) => item.label !== 'Configuración' || user?.rol === 'ADMINISTRADOR')
  // El profesional vinculado debe existir y estar activo: profesionalesState
  // ya viene filtrado a solo activos (api.getProfesionales() sin incluirInactivos).
  const profesionalVinculadoActivo = user?.profesionalId != null
    && profesionalesState.some((p) => p.id === user.profesionalId)
  const puedeCrearTurnos = user?.rol === 'ADMINISTRADOR' || user?.rol === 'RECEPCION' || user?.rol === 'SUPERVISOR'
    || (user?.rol === 'PROFESIONAL' && profesionalVinculadoActivo)

  return (
    <div
      className={`dashboard-shell ${
        activePage !== 'home' ? 'dashboard-shell--turnos' : ''
      }`}
    >
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-button"
          aria-label="Abrir menú"
          aria-controls="main-navigation"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(true)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
          </svg>
        </button>

        <strong
          className="mobile-brand"
          role="button"
          tabIndex={0}
          aria-label="Ir a Inicio"
          onClick={() => { setActivePage('home'); setMobileMenuOpen(false) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setActivePage('home')
              setMobileMenuOpen(false)
            }
          }}
        >
          <KineqIsologo aria-hidden="true" />
          Kineq
        </strong>

        <div className="mobile-topbar-actions">
          <button
            type="button"
            className="theme-toggle mobile-theme-toggle"
            aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
          >
            <ThemeIcon theme={theme} />
          </button>

          <div
            className="mobile-profile-avatar"
            title={fullName}
            aria-label={`Perfil de ${fullName}`}
          >
            {initials}
          </div>
        </div>
      </header>

      {mobileMenuOpen ? (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <aside
        id="main-navigation"
        className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}
      >
        <div
          className="sidebar-logo"
          role="button"
          tabIndex={0}
          aria-label="Ir a Inicio"
          onClick={() => setActivePage('home')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setActivePage('home')
            }
          }}
        >
          <KineqIsologo />
        </div>

        <div className="sidebar-brand">
          <div
            className="avatar-wrapper"
            ref={avatarWrapperRef}
            tabIndex={0}
            aria-label={fullName}
            // El tooltip de hover (nombre completo) y el popover de "Foto de
            // perfil" comparten esta misma zona — sin este guard, justo
            // después de clickear el ícono de editar (el mouse todavía está
            // encima), el tooltip se abre por el hover y queda superpuesto
            // arriba del popover (mismo z-index más alto que el popover, a
            // propósito para menús contextuales — acá compite con contenido
            // que sí necesita estar arriba). El popover ya muestra "Foto de
            // perfil" como título, así que el tooltip con el nombre no suma
            // nada en ese momento.
            onMouseEnter={profilePhotoInfoOpen ? undefined : showSidebarTooltip(fullName)}
            onMouseLeave={hideSidebarTooltip}
            onFocus={profilePhotoInfoOpen ? undefined : showSidebarTooltip(fullName)}
            onBlur={hideSidebarTooltip}
          >
            {user?.fotoUrl ? (
              <div className="avatar avatar--photo">
                <AuthorizedImg src={user.fotoUrl} alt="" />
              </div>
            ) : (
              <div className="avatar">{initials}</div>
            )}
            <button
              type="button"
              className="avatar-edit-button"
              aria-label="Foto de perfil"
              title="Foto de perfil"
              onClick={() => {
                if (!profilePhotoInfoOpen) {
                  // El hover ya pudo haber abierto el tooltip antes de este
                  // click (el mouse llega al botón pasando por encima del
                  // wrapper) — se lo oculta acá explícitamente, el guard de
                  // onMouseEnter de arriba solo previene que se reabra.
                  hideSidebarTooltip()
                  const rect = avatarWrapperRef.current?.getBoundingClientRect()
                  if (rect) {
                    // Desktop (sidebar comprimida a 86px, ≥1171px): a la
                    // derecha del avatar, no debajo — "debajo" queda
                    // encimado con los ítems de navegación que siguen más
                    // abajo en esa misma columna angosta (no clipping, pero
                    // se ve superpuesto/desprolijo). Mismo criterio de
                    // flyout que .sidebar-tooltip (rect.right + 12).
                    // Mobile (panel deslizable, ≤1170px, con labels
                    // restaurados): "a la derecha" desbordaría el drawer
                    // (hasta 320px de ancho) y potencialmente el viewport en
                    // un celular angosto — ahí se mantiene "debajo", que es
                    // donde ya cabe sin superponerse a nada.
                    const isDesktopRail = window.matchMedia('(min-width: 1171px)').matches
                    setProfilePhotoPopoverPos(
                      isDesktopRail
                        ? { top: rect.top, left: rect.right + 12 }
                        : { top: rect.bottom + 8, left: rect.left },
                    )
                  }
                }
                setProfilePhotoInfoOpen((current) => !current)
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <input
              ref={profilePhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                void handleProfilePhotoSelected(event.target.files)
                event.target.value = ''
              }}
            />
            {profilePhotoInfoOpen && profilePhotoPopoverPos ? (
              <div
                className="avatar-edit-popover"
                role="dialog"
                aria-label="Foto de perfil"
                style={{ top: profilePhotoPopoverPos.top, left: profilePhotoPopoverPos.left }}
              >
                <p className="avatar-edit-popover-title">Foto de perfil</p>
                <div className="avatar-edit-popover-actions">
                  <button type="button" className="secondary-button" disabled={profilePhotoUploading} onClick={() => profilePhotoInputRef.current?.click()}>
                    {profilePhotoUploading ? 'Subiendo...' : user?.fotoUrl ? 'Reemplazar foto' : 'Subir foto'}
                  </button>
                  {user?.fotoUrl ? (
                    <button type="button" className="secondary-button" disabled={profilePhotoUploading} onClick={() => { void removeProfilePhoto() }}>
                      Quitar foto
                    </button>
                  ) : null}
                </div>
                {profilePhotoError ? <p className="evolution-form-error">{profilePhotoError}</p> : null}
                <button type="button" className="secondary-button" onClick={() => setProfilePhotoInfoOpen(false)}>Cerrar</button>
              </div>
            ) : null}
          </div>
          <div className="sidebar-brand-text">
            <p className="user-role">{roleLabel}</p>
            <strong>{fullName}</strong>
          </div>
          <button
            type="button"
            className="mobile-menu-close"
            aria-label="Cerrar menú"
            onClick={() => setMobileMenuOpen(false)}
          >
            &times;
          </button>
        </div>
        <nav className="sidebar-nav">
          {visibleMenuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              className={`nav-item ${
                item.page === activePage ||
                (item.page === 'pacientes' && activePage === 'paciente-detalle')
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                if (item.page) setActivePage(item.page)
                setMobileMenuOpen(false)
              }}
              onMouseEnter={showSidebarTooltip(item.label)}
              onMouseLeave={hideSidebarTooltip}
              onFocus={showSidebarTooltip(item.label)}
              onBlur={hideSidebarTooltip}
            >
              <span className="nav-icon" aria-hidden="true">
                <item.Icon focusable="false" />
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="theme-toggle sidebar-theme-toggle"
          aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
          aria-pressed={theme === 'dark'}
          onClick={toggleTheme}
          onMouseEnter={showSidebarTooltip(theme === 'dark' ? 'Modo claro' : 'Modo oscuro')}
          onMouseLeave={hideSidebarTooltip}
          onFocus={showSidebarTooltip(theme === 'dark' ? 'Modo claro' : 'Modo oscuro')}
          onBlur={hideSidebarTooltip}
        >
          <span className="theme-toggle-icon">
            <ThemeIcon theme={theme} />
          </span>
          <span className="nav-label">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>

        <button
          type="button"
          className="secondary-button sidebar-logout"
          aria-label="Cerrar sesión"
          onClick={() => { void logout() }}
          onMouseEnter={showSidebarTooltip('Cerrar sesión')}
          onMouseLeave={hideSidebarTooltip}
          onFocus={showSidebarTooltip('Cerrar sesión')}
          onBlur={hideSidebarTooltip}
        >
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </span>
          <span className="nav-label">Cerrar sesión</span>
        </button>

        {sidebarTooltip ? (
          <div className="sidebar-tooltip" style={{ top: sidebarTooltip.top, left: sidebarTooltip.left }}>
            {sidebarTooltip.label}
          </div>
        ) : null}
      </aside>

      <main
        className={`main-area ${
          activePage !== 'home' ? 'turnos-main-area' : ''
        }`}
      >
        {activePage === 'home' ? (
          <>
        <header className="main-header">
          <div>
            <p className="breadcrumb">Home / Inicio</p>
            <h1>Turnos del día</h1>
          </div>
          <div className="header-actions">
            {puedeCrearTurnos ? (
              <button type="button" className="new-turn-button" onClick={() => openNewTurnoModal()}>
                Nuevo turno
              </button>
            ) : null}
          </div>
        </header>

        {puedeCrearTurnos ? (
          // FAB — reemplaza a "Nuevo turno" del header solo en mobile (ver
          // @media 820px en App.css); en desktop el botón del header ya
          // cumple esa función y este queda oculto.
          <button
            type="button"
            className="fab-new-turno"
            aria-label="Nuevo turno"
            onClick={() => openNewTurnoModal()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        ) : null}

        {loadError ? (
          <section className="schedule-panel" role="alert">
            <h2>No se pudieron cargar los datos</h2>
            <p>{loadError}</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
            >
              Reintentar
            </button>
          </section>
        ) : null}

        <section className="schedule-panel">
            <div className="schedule-header">
              <div className="calendar-nav">
                <button type="button" className="secondary-button calendar-nav-today" onClick={goToToday}>
                  Hoy
                </button>
                <div className="calendar-nav-arrows">
                  <button type="button" className="small-button" aria-label="Período anterior" onClick={goToPreviousPeriod}>&#9664;</button>
                  <button type="button" className="small-button" aria-label="Período siguiente" onClick={goToNextPeriod}>&#9654;</button>
                </div>
                <div>
                  <h2>{CALENDAR_VIEW_TITLES[calendarView]}</h2>
                  <p>{formatPeriodLabel(selectedDate, calendarView)}</p>
                </div>
              </div>
              <div className="schedule-header-actions">
                <label className="calendar-view-select">
                  <span className="sr-only">Vista del calendario</span>
                  <select value={calendarView} onChange={(event) => setCalendarView(event.target.value as CalendarView)}>
                    <option value="day">Día</option>
                    <option value="week">Semana</option>
                    <option value="month">Mes</option>
                    <option value="year">Año</option>
                  </select>
                </label>
              <div className="schedule-filters-wrapper" ref={filtersRef}>
                <button className="filter-button" type="button" onClick={() => setFiltersOpen(!filtersOpen)}>
                  <span>Filtro</span>
                  <span className="filter-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 4H21L14 11V18L10 20V11L3 4Z" />
                    </svg>
                  </span>
                </button>
                {filtersOpen ? (
                  <div className="filters-panel">
                    <div className="filter-group">
                      <strong>Especialidad</strong>
                      {specialtiesState.map((spec) => (
                        <label key={spec.id}>
                          <input
                            type="checkbox"
                            checked={filters.specialtyIds.includes(spec.id)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...filters.specialtyIds, spec.id]
                                : filters.specialtyIds.filter((id) => id !== spec.id)
                              setFilters({ ...filters, specialtyIds: next })
                            }}
                          />
                          {spec.name}
                        </label>
                      ))}
                    </div>
                    <div className="filter-group">
                      <strong>Obra social</strong>
                      {uniqueSocialWorks.map((socialWork) => (
                        <label key={socialWork}>
                          <input
                            type="checkbox"
                            checked={filters.socialWorks.includes(socialWork)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...filters.socialWorks, socialWork]
                                : filters.socialWorks.filter((item) => item !== socialWork)
                              setFilters({ ...filters, socialWorks: next })
                            }}
                          />
                          {socialWork}
                        </label>
                      ))}
                    </div>
                    <div className="filter-group">
                      <strong>Profesional</strong>
                      {uniqueProfessionals.map((professional) => (
                        <label key={professional}>
                          <input
                            type="checkbox"
                            checked={filters.professionals.includes(professional)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...filters.professionals, professional]
                                : filters.professionals.filter((item) => item !== professional)
                              setFilters({ ...filters, professionals: next })
                            }}
                          />
                          {professional}
                        </label>
                      ))}
                    </div>
                    <div className="filter-group">
                      <strong>Estado</strong>
                      {['Asignado', 'En Espera', 'Atendiendo', 'Finalizado', 'Ausente', 'Cancelado'].map((status) => (
                        <label key={status}>
                          <input
                            type="checkbox"
                            checked={filters.statuses.includes(status)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...filters.statuses, status]
                                : filters.statuses.filter((item) => item !== status)
                              setFilters({ ...filters, statuses: next })
                            }}
                          />
                          {status}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              </div>
            </div>

          {calendarView === 'day' && (turnosLoading ? (
            <p>Cargando turnos...</p>
          ) : dayTurnos.length === 0 ? (
            <p className="empty-day-message">
              No hay turnos para este día.
            </p>
          ) : null)}

          {calendarView === 'day' && hiddenDayTurnosCount > 0 ? (
            <p className="calendar-range-warning">
              {hiddenDayTurnosCount === 1 ? 'Hay 1 turno' : `Hay ${hiddenDayTurnosCount} turnos`} fuera del horario visible ({CALENDAR_START_HOUR}:00 a {CALENDAR_END_HOUR}:00).
            </p>
          ) : null}

          {calendarView === 'day' ? (
          <div className="day-grid">
            <div className="hours-column">
              {hourLabels.map((hour) => (
                <div key={hour} className="hour-label">
                  {hour}:00
                </div>
              ))}
            </div>
            <div className="calendar-column" onClick={handleCalendarBackgroundClick}>
              <div className="timeline-lines">
                {hourLabels.map((hour) => (
                  <div key={hour} className="timeline-row" />
                ))}
              </div>

              {visibleDayTurnos.map((turno) => {
                const [hourString, minuteString] = turno.time.split(':')
                const top = ((Number(hourString) + Number(minuteString) / 60 - CALENDAR_START_HOUR) * 60)
                const specialty = specialtiesState.find(s => s.id === turno.specialtyId)
                const bgColor = specialty?.color ?? turno.color

                const endTime = addMinutesToTime(turno.time, turno.duration)

                const layout = turnoColumnLayout.get(turno.id)
                const columns = layout?.columns ?? 1
                const column = layout?.column ?? 0
                const columnGapPx = 6
                const left = `calc(16px + (100% - 32px) * ${column / columns})`
                const width = columns > 1
                  ? `calc((100% - 32px) * ${1 / columns} - ${columnGapPx}px)`
                  : 'calc(100% - 32px)'
                // Separación visual mínima entre turnos contiguos (el de
                // arriba termina exactamente cuando empieza el siguiente):
                // se achica un poco la altura renderizada, nunca el `top`
                // (la hora real no cambia), con un piso para no comerse
                // turnos muy cortos (15 min = 15px).
                const renderedHeight = Math.max(turno.duration - 3, 12)

                return (
                  <button
                    key={turno.id}
                    type="button"
                    className={`turno-card ${turno.id === selectedTurnoId ? 'selected' : ''} ${turno.duration < 60 ? 'short-turno' : ''} ${columns > 1 ? 'turno-card--narrow' : ''}`}
                    style={{
                      top: `${top}px`,
                      height: `${renderedHeight}px`,
                      left,
                      width,
                      backgroundColor: bgColor,
                      alignItems: 'flex-start'
                    }}
                    onMouseDown={(e) => onDragStart(e, turno.id, top, turno.duration)}
                    onClick={(e) => {
                      if (e.button !== 0) return
                      if (isDraggingRef.current) {
                        e.preventDefault()
                        isDraggingRef.current = false
                        return
                      }
                      setSelectedTurnoId(turno.id)
                      openTurnoDetails(turno)
                    }}
                    onContextMenu={(e) => {
                      // El menú nativo del navegador nunca debe aparecer sobre un turno,
                      // sin importar si hay acciones disponibles para su estado actual.
                      e.preventDefault()
                      e.stopPropagation()

                      // "Editar Turno" y "Ver Historia Clínica" siempre están
                      // disponibles (no cambian estado) — el menú ya no se
                      // suprime solo porque no haya acciones de estado para
                      // este rol/turno.
                      const actions = getTurnoQuickActions(turno)
                      const menuWidth = 190
                      const menuHeight = (actions.length + 2) * 40 + 12
                      setContextMenu({
                        turnoId: turno.id,
                        x: Math.max(8, Math.min(e.clientX, window.innerWidth - menuWidth - 8)),
                        y: Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8)),
                      })
                    }}
                  >
                    <span
                      className={`turno-card-status-dot turno-card-status-dot--${statusClass(turno.status)}`}
                      aria-hidden="true"
                      title={turno.status}
                    />
                    {/* Posicionado absoluto, fuera del flujo de texto a propósito: puesto
                        inline junto al nombre, un nombre largo lo empuja a una segunda
                        línea dentro de <strong> y esa línea extra desplaza el horario
                        fuera del área visible de la card (bug real, ver HANDOVER.md).
                        El nombre y el horario deben poder render siempre en su propia
                        línea sin importar si el turno es recurrente. */}
                    {turno.serieId ? (
                      <span
                        className="turno-card-recurrence-badge"
                        title={turno.ordenEnSerie && turno.serieCantidadSesiones ? `Turno recurrente — Sesión ${turno.ordenEnSerie} de ${turno.serieCantidadSesiones}` : 'Turno recurrente'}
                      >
                        <RecurrenceIcon className="turno-card-recurrence-icon" aria-hidden="true" />
                      </span>
                    ) : null}
                    <strong>{turno.patientDisplay}</strong>
                    <span>{turno.time} - {endTime}</span>
                    {turno.duration >= 90 ? <TurnoCardTimer turno={turno} now={clockNow} /> : null}
                    <div className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, turno.id) }} />
                  </button>
                )
                })}

              {showDraftPreview && showNewTurno && newTurnoForm.date === selectedDate ? (() => {
                const [draftHourString, draftMinuteString] = newTurnoForm.time.split(':')
                const draftTop = (Number(draftHourString) + Number(draftMinuteString) / 60 - CALENDAR_START_HOUR) * 60
                const draftEndTime = addMinutesToTime(newTurnoForm.time, newTurnoForm.duration)

                return (
                  <div
                    className="turno-card turno-card--draft"
                    style={{ top: `${draftTop}px`, height: `${newTurnoForm.duration}px` }}
                    aria-hidden="true"
                  >
                    <strong>Nuevo turno</strong>
                    <span>{newTurnoForm.time} - {draftEndTime}</span>
                  </div>
                )
              })() : null}
            </div>
          </div>
          ) : calendarView === 'week' ? (
            <WeekView
              selectedDate={selectedDate}
              todayEnZonaConsultorio={todayEnZonaConsultorio}
              turnos={rangeTurnosState}
              loading={rangeTurnosLoading}
              specialtiesState={specialtiesState}
              selectedTurnoId={selectedTurnoId}
              onSelectTurno={(turno) => { setSelectedTurnoId(turno.id); openTurnoDetails(turno) }}
              onContextMenuTurno={(turno, x, y) => {
                const actions = getTurnoQuickActions(turno)
                const menuWidth = 190
                const menuHeight = (actions.length + 2) * 40 + 12
                setContextMenu({
                  turnoId: turno.id,
                  x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)),
                  y: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)),
                })
              }}
              onCreateSlot={(date, time) => openNewTurnoModal(date, time)}
              onSelectDate={setSelectedDate}
              canCreate={puedeCrearTurnos}
              isMobile={isMobile}
            />
          ) : calendarView === 'month' ? (
            <MonthView
              selectedDate={selectedDate}
              turnos={rangeTurnosState}
              loading={rangeTurnosLoading}
              todayEnZonaConsultorio={todayEnZonaConsultorio}
              onSelectDay={(date) => { setSelectedDate(date); setCalendarView('day') }}
              onCreateSlot={(date) => openNewTurnoModal(date)}
              canCreate={puedeCrearTurnos}
            />
          ) : (
            <YearView
              selectedDate={selectedDate}
              todayEnZonaConsultorio={todayEnZonaConsultorio}
              onSelectDay={(date) => { setSelectedDate(date); setCalendarView('day') }}
              onSelectMonth={(date) => { setSelectedDate(date); setCalendarView('month') }}
            />
          )}
        </section>
          </>
        ) : activePage === 'turnos' ? (
          <TurnosPage
            refreshKey={turnosPageRefreshKey}
            patientSocialWorkById={patientSocialWorkById}
            onNewTurno={puedeCrearTurnos ? () => openNewTurnoModal() : undefined}
            onOpenTurno={(turno) => continuarAtencion(turno)}
            onEditTurno={(turno) => openTurnoDetails(turno as Turno)}
            getQuickActions={getTurnoQuickActions}
          />
        ) : activePage === 'paciente-detalle' && selectedPatientId !== null ? (
          <PatientDetailPage
            patientId={selectedPatientId}
            patientSocialWorkById={patientSocialWorkById}
            refreshKey={turnosPageRefreshKey}
            onBack={closePatientDetail}
            onNewTurno={(patientId) => openNewTurnoModal(undefined, undefined, patientId)}
            onEditTurno={(turno) => openTurnoDetails(mapApiTurnoToUi(turno))}
            onRequestConfirm={setConfirmDialog}
          />
        ) : activePage === 'atencion' && attentionTurno !== null ? (
          // Misma pantalla que "paciente-detalle" — nunca una variante
          // separada — con `activeTurno`/`onUpdateEstado` agregando el
          // contexto de sesión (timer, Finalizar atención, evolución
          // vinculada al turno) de forma aditiva. Ver PatientDetailPage.tsx.
          <PatientDetailPage
            patientId={attentionTurno.patientId}
            patientSocialWorkById={patientSocialWorkById}
            refreshKey={turnosPageRefreshKey}
            onBack={closeAttentionScreen}
            onEditTurno={(turno) => openTurnoDetails(mapApiTurnoToUi(turno))}
            onRequestConfirm={setConfirmDialog}
            activeTurno={attentionTurno}
            onUpdateEstado={updateTurnoEstado}
          />
        ) : activePage === 'estadisticas' ? (
          <EstadisticasPage />
        ) : activePage === 'configuracion' ? (
          <ConfiguracionPage onRequestConfirm={setConfirmDialog} onProfesionalesChanged={() => setReloadKey((key) => key + 1)} />
        ) : (
          <PatientsPage
            refreshKey={turnosPageRefreshKey}
            patientSocialWorkById={patientSocialWorkById}
            onOpenPatient={openPatientDetail}
          />
        )}

        {showNewTurno && (
          <div className="modal-overlay">
            <div className={`modal-card ${newTurnoIsFull ? '' : 'modal-card--compact'}`} ref={newModalRef}>
              <span className="sheet-drag-handle" aria-hidden="true" />
              <div className={`modal-header ${newTurnoIsFull ? '' : 'modal-header--compact'}`}>
                <div className="modal-header-title">
                  {newTurnoIsFull ? (
                    <span className="modal-header-icon" aria-hidden="true">
                      <CalendarIcon />
                    </span>
                  ) : null}
                  <div>
                    <h3>Nuevo turno</h3>
                    {newTurnoIsFull ? <p>Completá los datos para agendar el turno.</p> : null}
                  </div>
                </div>
                <div className="modal-header-actions">
                  <button type="button" className="modal-header-save-mobile" onClick={saveNewTurno}>
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="close-button"
                    aria-label="Cerrar nuevo turno"
                    onClick={closeNewTurnoModal}
                  >
                    &times;
                  </button>
                </div>
              </div>

              <TurnoFormFields
                value={newTurnoForm}
                onChange={setNewTurnoForm}
                patients={pacientesState}
                professionals={profesionalesState}
                specialties={specialtiesState}
                onCreateSpecialty={user?.rol === 'ADMINISTRADOR' ? createSpecialty : undefined}
                onCreatePatient={createPatientQuick}
                onCreateProfessional={user?.rol === 'PROFESIONAL' ? undefined : createProfesionalQuick}
                vinculableUsers={vinculableUsuariosState}
                grupos={canSeeDiagnostico ? turnoGruposState : undefined}
                onCreateGrupo={canSeeDiagnostico ? createDiagnosticoInlineParaTurno : undefined}
                onFetchProximaSesion={fetchProximaSesion}
                hideProfessionalField={user?.rol === 'PROFESIONAL'}
                compact={!newTurnoIsFull}
                allowRecurrence={isMobile || !newTurnoExpanded}
              />

              {user?.rol === 'PROFESIONAL' && !profesionalVinculadoActivo ? (
                <p className="evolution-form-error">
                  Tu usuario no está vinculado a un profesional activo. Un administrador debe completar el vínculo para que puedas crear turnos.
                </p>
              ) : null}

              <div className="modal-actions modal-actions--new">
                {newTurnoExpanded ? (
                  <button type="button" className="secondary-button" onClick={closeNewTurnoModal}>
                    Cancelar
                  </button>
                ) : (
                  // Sin "Cancelar" acá a propósito: la X del header ya cierra
                  // la card compacta — "Cancelar" solo vuelve a aparecer en
                  // el formulario completo de "Más opciones" (arriba, oculto
                  // en mobile — ver .modal-actions-more en App.css).
                  <button
                    type="button"
                    className="ghost-button modal-actions-more"
                    onClick={() => setNewTurnoExpanded(true)}
                  >
                    Más opciones
                  </button>
                )}
                <button type="button" className="primary-button" onClick={saveNewTurno}>
                  Guardar turno
                </button>
              </div>
            </div>
          </div>
        )}

        {showViewTurno && editingTurnoForm && (
          <div className="modal-overlay">
            <div className="modal-card" ref={viewModalRef}>
              <span className="sheet-drag-handle" aria-hidden="true" />
              <div className="modal-header">
                <div className="modal-header-title">
                  <span className="modal-header-icon" aria-hidden="true">
                    <CalendarIcon />
                  </span>
                  <div>
                    <h3>Editar turno</h3>
                    <p>{isEditingTurno ? 'Modificá los datos del turno.' : 'Revisá los datos del turno.'}</p>
                  </div>
                </div>

                <div className="modal-header-actions">
                  {isEditingTurno ? (
                    <button type="button" className="modal-header-save-mobile" onClick={saveEditedTurno}>
                      Guardar
                    </button>
                  ) : null}
                  {!isEditingTurno && (() => {
                    const esPropio = user?.rol !== 'PROFESIONAL'
                      || (editingTurnoForm.professionalId != null && editingTurnoForm.professionalId === user.profesionalId)
                    return (
                      <button
                        type="button"
                        className="modal-icon-button edit-turno-button"
                        aria-label="Editar turno"
                        title={esPropio ? 'Editar turno' : 'Solo podés editar tus propios turnos'}
                        disabled={!esPropio}
                        onClick={() => setIsEditingTurno(true)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                    )
                  })()}

                  <button
                    type="button"
                    className="close-button"
                    aria-label="Cerrar datos del turno"
                    onClick={closeTurnoDetails}
                  >
                    &times;
                  </button>
                </div>
              </div>

              {editingTurnoSerieId && editingTurnoId !== null ? (() => {
                const liveTurno = turnosState.find((item) => item.id === editingTurnoId)
                // Posición dentro de la serie ≠ numeroSesion clínico (ver
                // TurnoFormFields más abajo) — pueden divergir si el usuario
                // editó el número a mano, por eso se muestran por separado.
                return (
                  <p className="turno-serie-badge">
                    <RecurrenceIcon />
                    Turno recurrente
                    {liveTurno?.ordenEnSerie && liveTurno?.serieCantidadSesiones
                      ? ` — Sesión ${liveTurno.ordenEnSerie} de ${liveTurno.serieCantidadSesiones}`
                      : null}
                  </p>
                )
              })() : null}

              {editingTurnoId !== null ? (() => {
                const liveTurno = turnosState.find((item) => item.id === editingTurnoId)
                // 'eliminar' se excluye acá: este modal ya tiene su propio
                // botón "Eliminar turno" fijo más abajo (modal-delete-button),
                // mostrarlo también en las acciones rápidas lo duplicaría.
                const actions = liveTurno ? getTurnoQuickActions(liveTurno).filter((action) => action.key !== 'eliminar') : []
                if (actions.length === 0) return null

                return (
                  <div className="turno-quick-actions">
                    {actions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        className={`turno-quick-action turno-quick-action--${action.tone}`}
                        onClick={action.onClick}
                      >
                        <span className="label-full">{action.label}</span>
                        <span className="label-compact">{COMPACT_QUICK_ACTION_LABELS[action.key] ?? action.label}</span>
                      </button>
                    ))}
                  </div>
                )
              })() : null}

              <TurnoFormFields
                value={editingTurnoForm}
                onChange={setEditingTurnoForm}
                disabled={!isEditingTurno}
                patients={pacientesState}
                professionals={profesionalesState}
                specialties={specialtiesState}
                onCreateSpecialty={user?.rol === 'ADMINISTRADOR' ? createSpecialty : undefined}
                onCreatePatient={createPatientQuick}
                onCreateProfessional={user?.rol === 'PROFESIONAL' ? undefined : createProfesionalQuick}
                vinculableUsers={vinculableUsuariosState}
                grupos={canSeeDiagnostico ? turnoGruposState : undefined}
                onCreateGrupo={canSeeDiagnostico ? createDiagnosticoInlineParaTurno : undefined}
                onFetchProximaSesion={fetchProximaSesion}
                hideProfessionalField={user?.rol === 'PROFESIONAL'}
              />

              <div className="modal-actions">
                {editingTurnoId !== null && canDeleteTurno ? (
                  <button
                    type="button"
                    className="modal-delete-button"
                    onClick={() => handleDeleteTurno(editingTurnoId, editingTurnoSerieId)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
                      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                    </svg>
                    Eliminar turno
                  </button>
                ) : null}

                <button
                  type="button"
                  className="secondary-button modal-actions-cancel-desktop"
                  onClick={closeTurnoDetails}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="primary-button modal-actions-save-desktop"
                  onClick={saveEditedTurno}
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {contextMenu ? (() => {
          const menuTurno = turnosState.find((item) => item.id === contextMenu.turnoId)
          const allActions = menuTurno ? getTurnoQuickActions(menuTurno) : []
          // Orden fijo pedido para este menú, sin importar el estado: Ver
          // Historia Clínica / Editar Turno / [acciones de estado] /
          // Eliminar Turno. "Eliminar" se saca de la lista de acciones de
          // estado acá para reubicarlo siempre al final — el filtro por rol
          // que ya aplica getTurnoQuickActions (quién ve "eliminar") se
          // respeta igual, solo cambia dónde se renderiza.
          const stateActions = allActions.filter((action) => action.key !== 'eliminar')
          const eliminarAction = allActions.find((action) => action.key === 'eliminar')

          return (
            <div
              className="context-menu"
              ref={contextMenuRef}
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              {menuTurno ? (
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    setContextMenu(null)
                    openPatientDetail(menuTurno.patientId)
                  }}
                >
                  Ver Historia Clínica
                </button>
              ) : null}
              {menuTurno ? (
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    setContextMenu(null)
                    openTurnoDetails(menuTurno)
                  }}
                >
                  Editar Turno
                </button>
              ) : null}
              {stateActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={`context-menu-item context-menu-item--${action.tone}`}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
              {eliminarAction ? (
                <button
                  type="button"
                  className={`context-menu-item context-menu-item--${eliminarAction.tone}`}
                  onClick={eliminarAction.onClick}
                >
                  Eliminar Turno
                </button>
              ) : null}
            </div>
          )
        })() : null}

        {confirmDialog ? (
          <div className="modal-overlay confirm-dialog-overlay">
            <div className="confirm-dialog" ref={confirmDialogRef}>
              <h3>{confirmDialog.title}</h3>
              <p>{confirmDialog.description}</p>
              <div className="confirm-dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setConfirmDialog(null)}
                >
                  {confirmDialog.cancelLabel}
                </button>
                <button
                  type="button"
                  className={`primary-button ${confirmDialog.destructive ? 'primary-button--danger' : ''}`}
                  onClick={() => {
                    confirmDialog.onConfirm()
                    setConfirmDialog(null)
                  }}
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {serieScopeDialog ? (
          <div className="modal-overlay confirm-dialog-overlay">
            <div className="confirm-dialog" ref={confirmDialogRef}>
              <h3>{serieScopeDialog.title}</h3>
              <p>{serieScopeDialog.description}</p>
              <div className="serie-scope-options">
                <label className="serie-scope-option">
                  <input
                    type="radio"
                    name="serie-scope"
                    checked={serieScopeChoice === 'unico'}
                    onChange={() => setSerieScopeChoice('unico')}
                  />
                  Este turno
                </label>
                <label className="serie-scope-option">
                  <input
                    type="radio"
                    name="serie-scope"
                    checked={serieScopeChoice === 'siguientes'}
                    onChange={() => setSerieScopeChoice('siguientes')}
                  />
                  Este turno y los siguientes
                </label>
              </div>
              <div className="confirm-dialog-actions">
                <button type="button" className="secondary-button" onClick={() => setSerieScopeDialog(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`primary-button ${serieScopeDialog.destructive ? 'primary-button--danger' : ''}`}
                  onClick={() => {
                    const chosen = serieScopeChoice
                    serieScopeDialog.onConfirm(chosen)
                    setSerieScopeDialog(null)
                  }}
                >
                  {serieScopeDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {activePage === 'home' ? (
      <aside className="side-panel">
        <div className="month-card">
          <div className="month-header">
              <button className="small-button" onClick={prevMonth}>&#9664;</button>
              <div>
                <strong>{currentMonthDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</strong>
                <p>Calendario mensual</p>
              </div>
              <button className="small-button" onClick={nextMonth}>&#9654;</button>
          </div>
          <div className="weekdays-row">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
              <div key={index} className="weekday-cell">
                {day}
              </div>
            ))}
          </div>
          <div className="month-grid">
            {monthDays.map((day, index) => {
              const dayStr = day ? formatDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), day)) : null
              const isToday = dayStr !== null && dayStr === todayEnZonaConsultorio
              const selectedClass = dayStr === selectedDate ? 'selected' : ''
              return (
                <div
                  key={`${day ?? 'empty'}-${index}`}
                  className={`month-cell ${isToday ? 'today' : ''} ${day ? '' : 'empty'} ${selectedClass}`}
                  onClick={() => dayStr && setSelectedDate(dayStr)}
                >
                  {day || ''}
                </div>
              )
            })}
          </div>
        </div>

        <div className="details-card">
          {catalogsLoading || turnosLoading ? (
            <p>Cargando datos del turno...</p>
          ) : selectedTurno ? (
            <>
              <div className="details-header">
                <h2>Datos del turno</h2>
                <span>{selectedTurno.time}</span>
              </div>
              <div className="details-body">
                <div>
                  <p className="details-label">Paciente</p>
                  <strong>{selectedTurno.patientDisplay}</strong>
                </div>
                <div>
                  <p className="details-label">Profesional</p>
                  <p>{selectedTurno.professionalDisplay ?? '-'}</p>
                </div>

                <div>
                  <p className="details-label">Especialidad</p>
                  <p>
                    <span
                      className="spec-dot"
                      style={{
                        backgroundColor: specialtiesState.find(
                          (specialty) => specialty.id === selectedTurno.specialtyId,
                        )?.color,
                      }}
                    />
                    {specialtiesState.find(
                      (specialty) => specialty.id === selectedTurno.specialtyId,
                    )?.name ?? '-'}
                  </p>
                </div>

                <div>
                  <p className="details-label">Nro. de Sesión</p>
                  <p>{selectedTurno.sessionNumber ?? '-'}</p>
                </div>

                <div>
                  <p className="details-label">Estado</p>
                  <p>{selectedTurno.status}</p>
                </div>
                <div>
                  <p className="details-label">Duración</p>
                  <p>{selectedTurno.duration} min</p>
                </div>

                {selectedTurno.status === 'En Espera' && selectedWaitingMinutes !== null ? (
                  <div>
                    <p className="details-label">Tiempo esperando</p>
                    <p className={isSelectedWaitingTooLong ? 'details-alert details-alert--warning' : ''}>
                      {formatMinutesAgo(selectedWaitingMinutes)}
                    </p>
                  </div>
                ) : null}

                {selectedTurno.status === 'Atendiendo' && selectedTurno.startAttention ? (
                  <div>
                    <p className="details-label">Tiempo atendiendo</p>
                    <p className={isSelectedAttendingOverDuration ? 'details-alert details-alert--danger' : ''}>
                      {new Date(elapsedSeconds * 1000).toISOString().slice(11, 19)}
                      <span className="details-duration-hint"> / reservado {selectedTurno.duration} min</span>
                    </p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="details-button"
                onClick={() => openTurnoDetails(selectedTurno)}
              >
                Ver más
              </button>
            </>
          ) : (
            <>
              <div className="details-header">
                <h2>Datos del turno</h2>
              </div>
              <p>No hay ningún turno seleccionado para este día.</p>
            </>
          )}
        </div>
      </aside>
      ) : null}
    </div>
  )
}

function App() {
  const { user, loading, loginBootTrigger } = useAuth()
  const [authView, setAuthView] = useState<'login' | 'registro'>('login')
  const bootPhase = useBootPhase(loading, loginBootTrigger)

  if (!user) {
    // Sin sesión: nada que precargar todavía, se mantiene el comportamiento
    // previo (el splash tapa la restauración de sesión y da paso a Login).
    if (bootPhase !== 'hidden') return <BootScreen fading={bootPhase === 'fading'} />
    return authView === 'login' ? (
      <LoginPage onSwitchToRegister={() => setAuthView('registro')} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
    )
  }

  // Con sesión ya resuelta: `Dashboard` se monta de una, así que sus fetches
  // iniciales (pacientes/profesionales/especialidades/turnos del día, ver
  // `loadCatalogs`/`loadTurnos`) arrancan en paralelo con el splash en vez de
  // esperar a que termine — `BootScreen` es un overlay `position: fixed`
  // (`z-index: 9999`, ver BootScreen.css) que tapa a `Dashboard` mientras
  // dura, así que no cambia nada visualmente ni de duración, solo cuándo
  // empieza a cargar lo de abajo. En la práctica, para cuando el splash
  // termina los datos ya suelen estar listos y no aparece un segundo
  // "Cargando..." después del splash.
  return (
    <>
      <Dashboard />
      {bootPhase !== 'hidden' ? <BootScreen fading={bootPhase === 'fading'} /> : null}
    </>
  )
}

export default App

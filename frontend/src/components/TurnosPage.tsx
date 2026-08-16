import { useEffect, useMemo, useRef, useState } from 'react'
import type { TurnoStatus } from './FormFields'
import * as api from '../services/api'
import type { Turno as ApiTurno } from '../types/domain'
import { WAITING_ALERT_MINUTES, getElapsedMinutes } from '../utils/turnoTimers'
import { mapEstadoToStatus, statusClass, compareByAttentionPriority } from '../utils/turnoStatus'
import { professionalName } from '../utils/professional'
import { utcIsoToZonedParts } from '../utils/timezone'
import DateInput from './DateInput'
import type { TurnoQuickAction } from '../App'

export type TurnosPageItem = {
  id: number
  date: string
  time: string
  duration: number
  patientDisplay: string
  patientId: number
  professionalDisplay?: string
  professionalId?: number
  specialtyId?: number
  specialtyName?: string
  socialWorkDisplay?: string | null
  sessionNumber?: number
  status: TurnoStatus
  startAttention?: string | null
  color: string
  updatedAt?: string
}

type QuickFilter = 'waiting' | 'remaining' | 'attending' | null
type SortMode = 'priority' | 'date-desc' | 'date-asc' | 'patient-asc'

type TableFilters = {
  from: string
  to: string
  statuses: TurnoStatus[]
  professionalIds: number[]
  specialtyIds: number[]
  socialWorks: string[]
}

type TurnosPageProps = {
  refreshKey: number
  patientSocialWorkById: Record<number, string | null>
  onNewTurno?: () => void
  onOpenTurno: (turno: TurnosPageItem) => void
  onEditTurno: (turno: TurnosPageItem) => void
  getQuickActions: (turno: TurnosPageItem) => TurnoQuickAction[]
}

const ACTIVE_STATUSES: TurnoStatus[] = ['Asignado', 'En Espera', 'Atendiendo']
const ALL_STATUSES: TurnoStatus[] = [
  'Asignado',
  'En Espera',
  'Atendiendo',
  'Finalizado',
  'Ausente',
  'Cancelado',
]

const EMPTY_FILTERS: TableFilters = {
  from: '',
  to: '',
  statuses: [],
  professionalIds: [],
  specialtyIds: [],
  socialWorks: [],
}

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function mapApiTurno(
  turno: ApiTurno,
  patientSocialWorkById: Record<number, string | null>,
): TurnosPageItem {
  // Igual que en App.tsx: el turno se muestra en la zona horaria del
  // consultorio, no en la del navegador (services/api.ts toInicio guarda
  // con ese mismo criterio).
  const { date, time } = utcIsoToZonedParts(turno.inicio, api.getConsultorioTimeZone())
  const patientSocialWork = turno.paciente.obraSocial?.nombre
    ?? patientSocialWorkById[turno.pacienteId]
    ?? turno.obraSocial?.nombre
    ?? null

  return {
    id: turno.id,
    date,
    time,
    duration: turno.duracionMinutos,
    patientDisplay: `${turno.paciente.nombre} ${turno.paciente.apellido}`,
    patientId: turno.pacienteId,
    professionalDisplay: professionalName(turno.profesional),
    professionalId: turno.profesionalId,
    specialtyId: turno.especialidadId,
    specialtyName: turno.especialidad.nombre,
    socialWorkDisplay: patientSocialWork,
    sessionNumber: turno.numeroSesion ?? undefined,
    status: mapEstadoToStatus(turno.estado),
    startAttention: turno.inicioAtencion ?? null,
    color: turno.especialidad.color || 'var(--color-primary)',
    updatedAt: turno.updatedAt,
  }
}

function getAppointmentTimestamp(turno: TurnosPageItem) {
  return new Date(`${turno.date}T${turno.time}:00`).getTime()
}

function getWaitingTimestamp(turno: TurnosPageItem) {
  const updatedTimestamp = turno.updatedAt ? new Date(turno.updatedAt).getTime() : Number.NaN
  return Number.isNaN(updatedTimestamp) ? getAppointmentTimestamp(turno) : updatedTimestamp
}

function getAttendingTimestamp(turno: TurnosPageItem) {
  const startedTimestamp = turno.startAttention ? new Date(turno.startAttention).getTime() : Number.NaN
  return Number.isNaN(startedTimestamp) ? getAppointmentTimestamp(turno) : startedTimestamp
}

function formatTableDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function getStatusPillContent(turno: TurnosPageItem, now: number): { text: string; isAlert: boolean } {
  if (turno.status === 'En Espera') {
    const minutes = getElapsedMinutes(turno.updatedAt, now)
    return {
      text: minutes === null ? turno.status : `${turno.status} \u00b7 ${minutes} min`,
      isAlert: minutes !== null && minutes >= WAITING_ALERT_MINUTES,
    }
  }

  if (turno.status === 'Atendiendo') {
    const minutes = getElapsedMinutes(turno.startAttention, now)
    return {
      text: minutes === null ? turno.status : `${turno.status} \u00b7 ${minutes} min`,
      isAlert: minutes !== null && minutes > turno.duration,
    }
  }

  return { text: turno.status, isAlert: false }
}

export default function TurnosPage({
  refreshKey,
  patientSocialWorkById,
  onNewTurno,
  onOpenTurno,
  onEditTurno,
  getQuickActions,
}: TurnosPageProps) {
  const [turnos, setTurnos] = useState<TurnosPageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [localReloadKey, setLocalReloadKey] = useState(0)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null)
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS)
  const [sortMode, setSortMode] = useState<SortMode>('priority')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [rowMenu, setRowMenu] = useState<{ turnoId: number; x: number; y: number } | null>(null)
  const [catalogProfesionales, setCatalogProfesionales] = useState<{ id: number; name: string }[]>([])
  const [catalogEspecialidades, setCatalogEspecialidades] = useState<{ id: number; name: string; color: string }[]>([])
  const [catalogObrasSociales, setCatalogObrasSociales] = useState<string[]>([])

  const filtersRef = useRef<HTMLDivElement | null>(null)
  const sortRef = useRef<HTMLDivElement | null>(null)
  const rowMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTurnos() {
      setLoading(true)
      setError(null)

      try {
        const response = await api.getTurnos()
        if (cancelled) return
        setTurnos(response.map((turno) => mapApiTurno(turno, patientSocialWorkById)))
      } catch (loadError) {
        if (cancelled) return
        setTurnos([])
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los turnos.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTurnos()
    return () => {
      cancelled = true
    }
  }, [localReloadKey, patientSocialWorkById, refreshKey])

  // Opciones de filtro: se cargan del consultorio completo (ya filtradas por
  // activo/consultorioId en el backend), no de los turnos visibles. Antes se
  // derivaban de `turnos`, así que un profesional/especialidad/obra social
  // sin ningún turno cargado (o un día sin turnos) directamente no aparecía
  // como opción, aunque existiera en el consultorio.
  useEffect(() => {
    let cancelled = false

    async function loadFilterCatalogs() {
      try {
        const [profesionales, especialidades, obras] = await Promise.all([
          api.getProfesionales(),
          api.getEspecialidades(),
          api.getObrasSociales(),
        ])
        if (cancelled) return

        setCatalogProfesionales(
          profesionales
            .map((p) => ({ id: p.id, name: `${p.titulo ? `${p.titulo} ` : ''}${p.nombre} ${p.apellido}` }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
        setCatalogEspecialidades(
          especialidades
            .map((e) => ({ id: e.id, name: e.nombre, color: e.color }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
        setCatalogObrasSociales(obras.map((o) => o.nombre).sort())
      } catch {
        // Los filtros son una mejora de UX sobre la tabla, no un dato crítico:
        // si falla la carga de catálogos, la tabla de turnos sigue funcionando,
        // solo con menos opciones de filtro disponibles.
      }
    }

    void loadFilterCatalogs()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const closePopovers = (event: MouseEvent) => {
      const target = event.target as Node
      if (filtersOpen && filtersRef.current && !filtersRef.current.contains(target)) {
        setFiltersOpen(false)
      }
      if (sortOpen && sortRef.current && !sortRef.current.contains(target)) {
        setSortOpen(false)
      }
    }

    document.addEventListener('mousedown', closePopovers)
    return () => document.removeEventListener('mousedown', closePopovers)
  }, [filtersOpen, sortOpen])

  // Cierra el menú de acciones de la fila al hacer click afuera, scrollear o presionar Escape.
  useEffect(() => {
    if (!rowMenu) return undefined

    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (rowMenuRef.current && !rowMenuRef.current.contains(target)) setRowMenu(null)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRowMenu(null)
    }
    const handleScroll = () => setRowMenu(null)

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [rowMenu])

  // Solo corre el intervalo mientras haya turnos con timer visible (En Espera/Atendiendo).
  useEffect(() => {
    const hasLiveTimer = turnos.some((turno) => turno.status === 'En Espera' || turno.status === 'Atendiendo')
    if (!hasLiveTimer) return undefined

    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [turnos])

  const today = formatLocalDate(new Date())
  const todayTurnos = useMemo(() => turnos.filter((turno) => turno.date === today), [today, turnos])

  const summary = useMemo(() => ({
    waiting: todayTurnos.filter((turno) => turno.status === 'En Espera').length,
    remaining: todayTurnos.filter((turno) => ACTIVE_STATUSES.includes(turno.status)).length,
    // A diferencia de waiting/remaining, esto cuenta TODAS las atenciones
    // abiertas del consultorio, sin importar la fecha del turno — un turno
    // en ATENDIENDO nunca debería quedar "invisible" solo porque quedó
    // abierto de un día anterior. No se corrige/cierra nada automáticamente.
    attending: turnos.filter((turno) => turno.status === 'Atendiendo').length,
  }), [todayTurnos, turnos])

  const professionals = catalogProfesionales
  const specialties = catalogEspecialidades
  const socialWorks = catalogObrasSociales

  const hasManualFilters = Boolean(
    filters.from
      || filters.to
      || filters.statuses.length
      || filters.professionalIds.length
      || filters.specialtyIds.length
      || filters.socialWorks.length,
  )
  const hasActiveFilters = quickFilter !== null || hasManualFilters

  const visibleTurnos = useMemo(() => {
    const filtered = turnos.filter((turno) => {
      if (quickFilter === 'waiting' && (turno.date !== today || turno.status !== 'En Espera')) return false
      if (quickFilter === 'remaining' && (turno.date !== today || !ACTIVE_STATUSES.includes(turno.status))) return false
      if (quickFilter === 'attending' && turno.status !== 'Atendiendo') return false

      if (filters.from && turno.date < filters.from) return false
      if (filters.to && turno.date > filters.to) return false
      if (filters.statuses.length && !filters.statuses.includes(turno.status)) return false
      if (filters.professionalIds.length && (!turno.professionalId || !filters.professionalIds.includes(turno.professionalId))) return false
      if (filters.specialtyIds.length && (!turno.specialtyId || !filters.specialtyIds.includes(turno.specialtyId))) return false
      if (filters.socialWorks.length && !filters.socialWorks.includes(turno.socialWorkDisplay ?? '')) return false

      return true
    })

    return filtered.sort((first, second) => {
      if (sortMode === 'priority') {
        return compareByAttentionPriority(
          {
            status: first.status,
            appointmentTimestamp: getAppointmentTimestamp(first),
            waitingSinceTimestamp: getWaitingTimestamp(first),
            attendingSinceTimestamp: getAttendingTimestamp(first),
          },
          {
            status: second.status,
            appointmentTimestamp: getAppointmentTimestamp(second),
            waitingSinceTimestamp: getWaitingTimestamp(second),
            attendingSinceTimestamp: getAttendingTimestamp(second),
          },
        )
      }

      if (sortMode === 'date-asc') return getAppointmentTimestamp(first) - getAppointmentTimestamp(second)
      if (sortMode === 'patient-asc') return first.patientDisplay.localeCompare(second.patientDisplay)
      return getAppointmentTimestamp(second) - getAppointmentTimestamp(first)
    })
  }, [filters, quickFilter, sortMode, today, turnos])

  const clearFilters = () => {
    setQuickFilter(null)
    setFilters(EMPTY_FILTERS)
  }

  const toggleArrayValue = <T,>(values: T[], value: T) => (
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
  )

  const applyQuickFilter = (filter: Exclude<QuickFilter, null>) => {
    setQuickFilter((current) => current === filter ? null : filter)
  }

  return (
    <div className="turnos-page">
      <header className="turnos-page-header">
        <div>
          <p className="breadcrumb">Home / Turnos</p>
          <h1>Turnos</h1>
        </div>
        {onNewTurno ? (
          <button type="button" className="new-turn-button" onClick={onNewTurno}>
            Nuevo turno
          </button>
        ) : null}
      </header>

      <section className="turnos-summary-grid" aria-label="Resumen de turnos de hoy">
        <button
          type="button"
          className={`turnos-summary-card turnos-summary-card--waiting ${quickFilter === 'waiting' ? 'active' : ''}`}
          aria-pressed={quickFilter === 'waiting'}
          onClick={() => applyQuickFilter('waiting')}
        >
          <strong>{summary.waiting}</strong>
          <span>En espera</span>
          <small>Pacientes esperando atención hoy</small>
        </button>

        <button
          type="button"
          className={`turnos-summary-card turnos-summary-card--remaining ${quickFilter === 'remaining' ? 'active' : ''}`}
          aria-pressed={quickFilter === 'remaining'}
          onClick={() => applyQuickFilter('remaining')}
        >
          <strong>{summary.remaining}</strong>
          <span>Turnos restantes</span>
          <small>Citas activas del día</small>
        </button>

        <button
          type="button"
          className={`turnos-summary-card turnos-summary-card--attending ${quickFilter === 'attending' ? 'active' : ''}`}
          aria-pressed={quickFilter === 'attending'}
          onClick={() => applyQuickFilter('attending')}
        >
          <strong>{summary.attending}</strong>
          <span>Atendiendo</span>
          <small>Pacientes en sesión</small>
        </button>
      </section>

      <section className="turnos-table-card">
        <div className="turnos-table-toolbar">
          <div>
            <h2>Listado de turnos</h2>
            <p>{visibleTurnos.length} {visibleTurnos.length === 1 ? 'turno visible' : 'turnos visibles'}</p>
          </div>

          <div className="turnos-toolbar-actions">
            <div className="turnos-popover-wrapper" ref={filtersRef}>
              <button
                type="button"
                className={`filter-button ${hasActiveFilters ? 'has-active-filter' : ''}`}
                aria-expanded={filtersOpen}
                onClick={() => {
                  setFiltersOpen((current) => !current)
                  setSortOpen(false)
                }}
              >
                <span>Filtro</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 4h18l-7 8v6l-4 2v-8Z" />
                </svg>
              </button>

              {filtersOpen ? (
                <div className="turnos-filter-panel">
                  <div className="turnos-filter-dates">
                    <label>
                      Desde
                      <DateInput
                        value={filters.from}
                        onChange={(from) => setFilters((current) => ({ ...current, from }))}
                      />
                    </label>
                    <label>
                      Hasta
                      <DateInput
                        value={filters.to}
                        onChange={(to) => setFilters((current) => ({ ...current, to }))}
                      />
                    </label>
                  </div>

                  <div className="filter-group">
                    <strong>Estado</strong>
                    {ALL_STATUSES.map((status) => (
                      <label key={status}>
                        <input
                          type="checkbox"
                          checked={filters.statuses.includes(status)}
                          onChange={() => setFilters((current) => ({
                            ...current,
                            statuses: toggleArrayValue(current.statuses, status),
                          }))}
                        />
                        {status}
                      </label>
                    ))}
                  </div>

                  <div className="filter-group">
                    <strong>Profesional</strong>
                    {professionals.map((professional) => (
                      <label key={professional.id}>
                        <input
                          type="checkbox"
                          checked={filters.professionalIds.includes(professional.id)}
                          onChange={() => setFilters((current) => ({
                            ...current,
                            professionalIds: toggleArrayValue(current.professionalIds, professional.id),
                          }))}
                        />
                        {professional.name}
                      </label>
                    ))}
                  </div>

                  <div className="filter-group">
                    <strong>Especialidad</strong>
                    {specialties.map((specialty) => (
                      <label key={specialty.id}>
                        <input
                          type="checkbox"
                          checked={filters.specialtyIds.includes(specialty.id)}
                          onChange={() => setFilters((current) => ({
                            ...current,
                            specialtyIds: toggleArrayValue(current.specialtyIds, specialty.id),
                          }))}
                        />
                        <span className="turnos-specialty-dot" style={{ backgroundColor: specialty.color }} />
                        {specialty.name}
                      </label>
                    ))}
                  </div>

                  {socialWorks.length ? (
                    <div className="filter-group">
                      <strong>Obra social</strong>
                      {socialWorks.map((socialWork) => (
                        <label key={socialWork}>
                          <input
                            type="checkbox"
                            checked={filters.socialWorks.includes(socialWork)}
                            onChange={() => setFilters((current) => ({
                              ...current,
                              socialWorks: toggleArrayValue(current.socialWorks, socialWork),
                            }))}
                          />
                          {socialWork}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {hasActiveFilters ? (
              <button
                type="button"
                className="turnos-clear-filters"
                aria-label="Quitar todos los filtros"
                title="Quitar filtros"
                onClick={clearFilters}
              >
                &times;
              </button>
            ) : null}

            <div className="turnos-popover-wrapper" ref={sortRef}>
              <button
                type="button"
                className="turnos-sort-button"
                aria-label="Ordenar turnos"
                aria-expanded={sortOpen}
                onClick={() => {
                  setSortOpen((current) => !current)
                  setFiltersOpen(false)
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 6h12M8 12h8M8 18h4" />
                  <path d="m3 5 2-2 2 2M5 3v16M3 17l2 2 2-2" />
                </svg>
                <span>Ordenar</span>
              </button>

              {sortOpen ? (
                <div className="turnos-sort-panel">
                  {[
                    ['priority', 'Prioridad de atención'],
                    ['date-desc', 'Fecha: más recientes'],
                    ['date-asc', 'Fecha: más antiguos'],
                    ['patient-asc', 'Paciente: A–Z'],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="turnos-sort"
                        value={value}
                        checked={sortMode === value}
                        onChange={() => {
                          setSortMode(value as SortMode)
                          setSortOpen(false)
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="turnos-table-message" role="alert">
            <strong>No se pudieron cargar los turnos.</strong>
            <span>{error}</span>
            <button type="button" className="primary-button" onClick={() => setLocalReloadKey((key) => key + 1)}>
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <div className="turnos-table-message">Cargando turnos...</div>
        ) : visibleTurnos.length === 0 ? (
          <div className="turnos-table-message">
            <strong>No hay turnos para mostrar.</strong>
            <span>Probá quitar los filtros o crear un turno nuevo.</span>
          </div>
        ) : (
          <div className="turnos-table-scroll">
            <table className="turnos-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Nombre</th>
                  <th>Profesional</th>
                  <th>Obra Social</th>
                  <th>Nro. de Sesión</th>
                  <th>Especialidad</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {visibleTurnos.map((turno) => {
                  const pillContent = getStatusPillContent(turno, now)
                  const rowActions = getQuickActions(turno)

                  return (
                    <tr
                      key={turno.id}
                      tabIndex={0}
                      onClick={() => onOpenTurno(turno)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onOpenTurno(turno)
                        }
                      }}
                      onContextMenu={(event) => {
                        if (rowActions.length === 0) return
                        event.preventDefault()
                        event.stopPropagation()
                        const menuWidth = 190
                        const menuHeight = rowActions.length * 40 + 12
                        setRowMenu({
                          turnoId: turno.id,
                          x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
                          y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
                        })
                      }}
                    >
                      <td>
                        <strong>{turno.time}</strong>
                        <small>{formatTableDate(turno.date)}</small>
                      </td>
                      <td data-label="Nombre"><strong>{turno.patientDisplay}</strong></td>
                      <td data-label="Profesional">{turno.professionalDisplay ?? '—'}</td>
                      <td data-label="Obra Social">{turno.socialWorkDisplay ?? 'Sin obra social'}</td>
                      <td data-label="Nro. de Sesión">{turno.sessionNumber ?? '—'}</td>
                      <td data-label="Especialidad">
                        <span className="turnos-specialty-cell">
                          <span className="turnos-specialty-dot" style={{ backgroundColor: turno.color }} />
                          {turno.specialtyName ?? '—'}
                        </span>
                      </td>
                      <td data-label="Estado">
                        <span
                          className={`turnos-status-pill turnos-status-pill--${statusClass(turno.status)} ${pillContent.isAlert ? 'turnos-status-pill--alert' : ''}`}
                        >
                          {pillContent.text}
                        </span>
                      </td>
                      <td className="turnos-actions-cell config-row-actions">
                        <button
                          type="button"
                          className="config-icon-button"
                          aria-label="Editar turno"
                          title="Editar turno"
                          onKeyDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation()
                            onEditTurno(turno)
                          }}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        {rowActions.length > 0 ? (
                          <button
                            type="button"
                            className="turnos-row-actions-button"
                            aria-label="Acciones del turno"
                            onKeyDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation()
                              const rect = event.currentTarget.getBoundingClientRect()
                              const menuWidth = 190
                              setRowMenu((current) =>
                                current?.turnoId === turno.id
                                  ? null
                                  : {
                                      turnoId: turno.id,
                                      x: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
                                      y: rect.bottom + 6,
                                    },
                              )
                            }}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="12" cy="5" r="1.6" />
                              <circle cx="12" cy="12" r="1.6" />
                              <circle cx="12" cy="19" r="1.6" />
                            </svg>
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {rowMenu ? (() => {
          const menuTurno = turnos.find((item) => item.id === rowMenu.turnoId)
          const actions = menuTurno ? getQuickActions(menuTurno) : []

          return (
            <div className="context-menu" ref={rowMenuRef} style={{ top: rowMenu.y, left: rowMenu.x }}>
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={`context-menu-item context-menu-item--${action.tone}`}
                  onClick={() => {
                    action.onClick()
                    setRowMenu(null)
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )
        })() : null}
      </section>
    </div>
  )
}

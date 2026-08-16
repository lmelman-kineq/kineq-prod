import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from '../services/api'
import type { Paciente } from '../types/domain'
import { useAuth } from '../auth/AuthContext'
import PatientFormModal from './PatientFormModal'

type PatientsPageProps = {
  refreshKey: number
  patientSocialWorkById: Record<number, string | null>
  onOpenPatient: (patientId: number) => void
}

type PatientFilters = {
  status: string[]
  socialWorks: string[]
}

type SortMode = 'recent' | 'az' | 'za'

const EMPTY_FILTERS: PatientFilters = { status: [], socialWorks: [] }
const STATUS_OPTIONS = ['Activo', 'Inactivo']
const SORT_OPTIONS: Array<[SortMode, string]> = [
  ['recent', 'Más recientes'],
  ['az', 'Alfabético A–Z'],
  ['za', 'Alfabético Z–A'],
]

function fullNameKey(patient: Paciente) {
  return `${patient.apellido} ${patient.nombre}`
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function PatientsPage({ refreshKey, patientSocialWorkById, onOpenPatient }: PatientsPageProps) {
  const { user } = useAuth()
  const canCreatePatient = user?.rol === 'ADMINISTRADOR' || user?.rol === 'RECEPCION'

  const [patients, setPatients] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<PatientFilters>(EMPTY_FILTERS)
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [sortOpen, setSortOpen] = useState(false)
  const [newPatientOpen, setNewPatientOpen] = useState(false)

  const filtersRef = useRef<HTMLDivElement | null>(null)
  const sortRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPatients() {
      setLoading(true)
      setError(null)

      try {
        const response = await api.getPacientes()
        if (!cancelled) setPatients(response)
      } catch (loadError) {
        if (!cancelled) {
          setPatients([])
          setError(getErrorMessage(loadError, 'No se pudieron cargar los pacientes.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPatients()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (filtersOpen && filtersRef.current && !filtersRef.current.contains(target)) {
        setFiltersOpen(false)
      }
      if (sortOpen && sortRef.current && !sortRef.current.contains(target)) {
        setSortOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false)
        setSortOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [filtersOpen, sortOpen])

  const uniqueSocialWorks = useMemo(
    () =>
      [...new Set(patients.map((patient) => patientSocialWorkById[patient.id]).filter((value): value is string => Boolean(value)))].sort(),
    [patients, patientSocialWorkById],
  )

  const hasActiveFilters = filters.status.length > 0 || filters.socialWorks.length > 0

  const toggleFilterValue = (key: keyof PatientFilters, value: string) => {
    setFilters((current) => {
      const values = current[key]
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
      return { ...current, [key]: nextValues }
    })
  }

  const visiblePatients = useMemo(() => {
    const term = search.trim().toLowerCase()

    const filtered = patients.filter((patient) => {
      const fullName = `${patient.nombre} ${patient.apellido}`.toLowerCase()
      const matchesSearch = !term || fullName.includes(term) || (patient.documento ?? '').toLowerCase().includes(term)
      if (!matchesSearch) return false

      const statusLabel = patient.activo ? 'Activo' : 'Inactivo'
      if (filters.status.length && !filters.status.includes(statusLabel)) return false

      if (filters.socialWorks.length) {
        const socialWork = patientSocialWorkById[patient.id]
        if (!socialWork || !filters.socialWorks.includes(socialWork)) return false
      }

      return true
    })

    return [...filtered].sort((a, b) => {
      if (sortMode === 'recent') {
        const diff = new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        return diff !== 0 ? diff : b.id - a.id
      }
      const cmp = fullNameKey(a).localeCompare(fullNameKey(b), 'es', { sensitivity: 'base' })
      const ordered = sortMode === 'za' ? -cmp : cmp
      return ordered !== 0 ? ordered : a.id - b.id
    })
  }, [patients, search, filters, patientSocialWorkById, sortMode])

  return (
    <div className="patients-page">
      <header className="patients-page-header">
        <div>
          <p className="breadcrumb">Home / Pacientes</p>
          <h1>Pacientes</h1>
        </div>
        {canCreatePatient ? (
          <button type="button" className="new-turn-button" onClick={() => setNewPatientOpen(true)}>
            Nuevo paciente
          </button>
        ) : null}
      </header>

      <section className="patients-table-card">
        <div className="patients-table-toolbar">
          <div>
            <h2>Listado de pacientes</h2>
            <p>{visiblePatients.length} {visiblePatients.length === 1 ? 'paciente' : 'pacientes'}</p>
          </div>

          <div className="patients-search-row">
            <input
              type="text"
              className="patients-search-input"
              placeholder="Buscar por nombre o DNI"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="schedule-filters-wrapper" ref={filtersRef}>
              <button
                type="button"
                className={`filter-button ${hasActiveFilters ? 'has-active-filter' : ''}`}
                aria-expanded={filtersOpen}
                aria-label="Filtro"
                title="Filtro"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <span className="label-full">Filtro</span>
                <span className="filter-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 4H21L14 11V18L10 20V11L3 4Z" />
                  </svg>
                </span>
              </button>

              {filtersOpen ? (
                <div className="filters-panel">
                  <div className="filter-group">
                    <strong>Estado</strong>
                    {STATUS_OPTIONS.map((status) => (
                      <label key={status}>
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={() => toggleFilterValue('status', status)}
                        />
                        {status}
                      </label>
                    ))}
                  </div>

                  {uniqueSocialWorks.length ? (
                    <div className="filter-group">
                      <strong>Obra social</strong>
                      {uniqueSocialWorks.map((socialWork) => (
                        <label key={socialWork}>
                          <input
                            type="checkbox"
                            checked={filters.socialWorks.includes(socialWork)}
                            onChange={() => toggleFilterValue('socialWorks', socialWork)}
                          />
                          {socialWork}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="turnos-popover-wrapper" ref={sortRef}>
              <button
                type="button"
                className="turnos-sort-button"
                aria-label="Ordenar pacientes"
                title="Ordenar"
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
                <span className="label-full">Ordenar</span>
              </button>

              {sortOpen ? (
                <div className="turnos-sort-panel">
                  {SORT_OPTIONS.map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="patients-sort"
                        value={value}
                        checked={sortMode === value}
                        onChange={() => {
                          setSortMode(value)
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
            <strong>No se pudieron cargar los pacientes.</strong>
            <span>{error}</span>
          </div>
        ) : loading ? (
          <div className="turnos-table-message">Cargando pacientes...</div>
        ) : visiblePatients.length === 0 ? (
          <div className="turnos-table-message">
            <strong>No hay pacientes para mostrar.</strong>
            <span>Probá con otra búsqueda o quitá los filtros.</span>
          </div>
        ) : (
          <div className="turnos-table-scroll">
            <table className="turnos-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Documento</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {visiblePatients.map((patient) => (
                  <tr
                    key={patient.id}
                    tabIndex={0}
                    onClick={() => onOpenPatient(patient.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpenPatient(patient.id)
                      }
                    }}
                  >
                    <td>
                      <div className="patients-name-cell">
                        <span className="patients-avatar" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="8" r="3.5" />
                            <path d="M5 20c.8-4.1 3.2-6.2 7-6.2s6.2 2.1 7 6.2" />
                          </svg>
                        </span>
                        <strong>{patient.nombre} {patient.apellido}</strong>
                      </div>
                    </td>
                    <td data-label="Documento">{patient.documento ?? '—'}</td>
                    <td data-label="Teléfono">{patient.telefono ?? '—'}</td>
                    <td data-label="Estado">
                      <span className={`turnos-status-pill ${patient.activo ? 'turnos-status-pill--finalizado' : 'turnos-status-pill--cancelado'}`}>
                        {patient.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="turnos-actions-cell">
                      <span className="patients-row-chevron" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {newPatientOpen ? (
        <PatientFormModal
          canEditObservaciones={false}
          onClose={() => setNewPatientOpen(false)}
          onSaved={(created) => {
            setNewPatientOpen(false)
            onOpenPatient(created.id)
          }}
        />
      ) : null}
    </div>
  )
}

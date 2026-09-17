import { useEffect, useMemo, useRef, useState } from 'react'
import type { EstadoTurno, Turno } from '../types/domain'
import * as api from '../services/api'
import DateInput from './DateInput'
import { selectSesionesPlan, buildSesionesPlanDocument, buildSesionesPlanFilename } from '../utils/sesionesPlan'
import { renderSesionesPlanPdf } from '../utils/sesionesPlanPdf'
import { todayInTimeZone } from '../utils/timezone'

type Props = {
  turnos: Turno[]
  patientName: string
  onClose: () => void
}

const ESTADO_OPTIONS: { value: EstadoTurno; label: string }[] = [
  { value: 'ASIGNADO', label: 'Asignado' },
  { value: 'EN_ESPERA', label: 'En Espera' },
  { value: 'ATENDIENDO', label: 'Atendiendo' },
  { value: 'FINALIZADO', label: 'Finalizado' },
  { value: 'AUSENTE', label: 'Ausente' },
  { value: 'REPROGRAMADO', label: 'Reprogramado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

// Modal de filtros previo a "Exportar plan de sesiones" — mismo generador
// PDF de siempre (renderSesionesPlanPdf/buildSesionesPlanDocument), solo
// cambia qué turnos del paciente (ya cargados por PatientDetailPage, sin
// fetch nuevo) entran al documento. Selección inicial: solo Asignado (el
// comportamiento esperado hoy del Plan de Sesiones) — el usuario amplía
// desde ahí. Reutilizado tal cual desde la tab Turnos y desde el menú "…"
// del encabezado del paciente.
export default function ExportSesionesPlanModal({ turnos, patientName, onClose }: Props) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [estados, setEstados] = useState<EstadoTurno[]>(['ASIGNADO'])
  const [especialidadId, setEspecialidadId] = useState<number | ''>('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estadoDropdownOpen, setEstadoDropdownOpen] = useState(false)
  const [estadoPanelPos, setEstadoPanelPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const estadoDropdownRef = useRef<HTMLDivElement | null>(null)
  const estadoButtonRef = useRef<HTMLButtonElement | null>(null)

  // `.modal-card` scrollea con overflow-y:auto — un panel `position:absolute`
  // colgando adentro queda recortado por ese overflow apenas se acerca al
  // borde (bug real reportado). Se calcula la posición contra el viewport
  // (`position:fixed`, mismo truco que ya usan los combobox de Paciente/
  // Profesional/Especialidad en FormFields.tsx) y se cierra en vez de
  // reposicionar si el modal scrollea — no hace falta más que eso, el
  // contenido de este modal es corto.
  useEffect(() => {
    if (!estadoDropdownOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        estadoDropdownRef.current && !estadoDropdownRef.current.contains(target)
        && estadoButtonRef.current && !estadoButtonRef.current.contains(target)
      ) {
        setEstadoDropdownOpen(false)
      }
    }
    // Un scroll DENTRO del panel (la lista de estados, que scrollea
    // internamente) también llega acá — los eventos "scroll" pasan por la
    // fase de captura de todos los ancestros, `document` incluido, sin
    // importar si burbujean. Sin este chequeo, el primer intento de
    // scrollear la lista la cerraba de inmediato (bug real reportado: "no
    // puedo scrollear, se salen las opciones"). Solo cierra si el scroll
    // vino de afuera del panel (el modal moviéndose detrás, por ejemplo).
    const closeOnScroll = (event: Event) => {
      if (estadoDropdownRef.current?.contains(event.target as Node)) return
      setEstadoDropdownOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [estadoDropdownOpen])

  const toggleEstadoDropdown = () => {
    if (!estadoDropdownOpen) {
      const rect = estadoButtonRef.current?.getBoundingClientRect()
      if (rect) {
        // El botón puede quedar en la mitad inferior de una pantalla chica
        // (mobile, bottom sheet) — sin este clamp, un panel de altura fija
        // se extendía más allá del viewport, con parte de la lista
        // inalcanzable (bug real reportado: "hay que scrollear demasiado,
        // está cortado"). Nunca menos de 120px (~3 filas) para que siga
        // siendo usable incluso muy abajo.
        const viewportMargin = 12
        const availableBelow = window.innerHeight - rect.bottom - viewportMargin
        setEstadoPanelPos({
          top: rect.bottom + 6,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.max(120, Math.min(280, availableBelow)),
        })
      }
    }
    setEstadoDropdownOpen((current) => !current)
  }

  const especialidades = useMemo(() => {
    const map = new Map<number, { id: number; nombre: string }>()
    for (const turno of turnos) {
      if (!map.has(turno.especialidadId)) {
        map.set(turno.especialidadId, { id: turno.especialidadId, nombre: turno.especialidad.nombre })
      }
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [turnos])

  const allSelected = estados.length === ESTADO_OPTIONS.length
  const toggleTodos = () => setEstados(allSelected ? [] : ESTADO_OPTIONS.map((option) => option.value))
  const toggleEstado = (value: EstadoTurno) => {
    setEstados((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))
  }

  const dateRangeInvalid = Boolean(from && to && from > to)
  const noEstadosSelected = estados.length === 0
  const estadoSummaryLabel = noEstadosSelected
    ? 'Elegí un estado'
    : allSelected
      ? 'Todos'
      : estados.length === 1
        ? ESTADO_OPTIONS.find((option) => option.value === estados[0])?.label
        : `${estados.length} estados`

  const submit = async () => {
    if (noEstadosSelected || dateRangeInvalid || exporting) return
    setError(null)

    const timeZone = api.getConsultorioTimeZone()
    const sesiones = selectSesionesPlan(turnos, {
      from: from || undefined,
      to: to || undefined,
      estados,
      especialidadId: especialidadId === '' ? null : especialidadId,
      timeZone,
    })
    if (sesiones.length === 0) {
      setError('Ninguna sesión coincide con estos filtros.')
      return
    }

    setExporting(true)
    try {
      const consultorio = await api.getConsultorio()
      const documento = buildSesionesPlanDocument({ patientName, consultorioName: consultorio.nombre, sesiones, timeZone })
      const pdf = renderSesionesPlanPdf(documento)
      pdf.save(buildSesionesPlanFilename(patientName, todayInTimeZone(timeZone)))
      onClose()
    } catch (exportError) {
      setError(getErrorMessage(exportError, 'No pudimos generar el plan de sesiones.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <span className="sheet-drag-handle" aria-hidden="true" />
        <div className="modal-header">
          <div className="modal-header-title">
            <div>
              <h3>Exportar plan de sesiones</h3>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="export-plan-date-row">
            <label>
              Desde
              <DateInput value={from} onChange={setFrom} />
            </label>
            <label>
              Hasta
              <DateInput value={to} onChange={setTo} />
            </label>
          </div>
          {dateRangeInvalid ? <p className="evolution-form-error">"Desde" no puede ser posterior a "Hasta".</p> : null}

          <div>
            <span className="details-label">Estado</span>
            <div className="turnos-popover-wrapper">
              <button
                ref={estadoButtonRef}
                type="button"
                className={`filter-button export-plan-estado-button ${noEstadosSelected ? 'field-invalid' : ''}`}
                aria-expanded={estadoDropdownOpen}
                onClick={toggleEstadoDropdown}
              >
                <span>{estadoSummaryLabel}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className={`export-plan-estado-chevron ${estadoDropdownOpen ? 'export-plan-estado-chevron--open' : ''}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {estadoDropdownOpen && estadoPanelPos ? (
                <div
                  className="filters-panel export-plan-estado-panel"
                  ref={estadoDropdownRef}
                  style={{ position: 'fixed', top: estadoPanelPos.top, left: estadoPanelPos.left, width: estadoPanelPos.width, maxHeight: estadoPanelPos.maxHeight, right: 'auto' }}
                >
                  <div className="filter-group">
                    <label>
                      <input type="checkbox" checked={allSelected} onChange={toggleTodos} />
                      Todos
                    </label>
                    {ESTADO_OPTIONS.map((option) => (
                      <label key={option.value}>
                        <input
                          type="checkbox"
                          checked={estados.includes(option.value)}
                          onChange={() => toggleEstado(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {noEstadosSelected ? <p className="evolution-form-error">Elegí al menos un estado.</p> : null}
          </div>

          <label>
            Especialidad
            <select value={especialidadId} onChange={(event) => setEspecialidadId(event.target.value ? Number(event.target.value) : '')}>
              <option value="">Todas</option>
              {especialidades.map((especialidad) => (
                <option key={especialidad.id} value={especialidad.id}>{especialidad.nombre}</option>
              ))}
            </select>
          </label>

          {error ? <p className="evolution-form-error">{error}</p> : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={exporting}>Cancelar</button>
          <button
            type="button"
            className="primary-button"
            disabled={exporting || noEstadosSelected || dateRangeInvalid}
            onClick={() => { void submit() }}
          >
            {exporting ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type SVGProps } from 'react'
import DateInput from './DateInput'
import DiagnosticoSelect from './DiagnosticoSelect'
import type { GrupoEvolucion } from '../types/domain'
import { weekdayLabel, monthlyRecurrenceLabel, customRecurrenceSummary, type RecurrenceFrequency, type CustomRecurrenceConfig } from '../utils/recurrence'
import CustomRecurrenceModal from './CustomRecurrenceModal'

// Íconos chicos para las filas compactas del quick-create (alta rápida desde
// Home) — mismo estilo trazo-simple que el resto de Kineq (viewBox 24x24,
// stroke=currentColor, sin relleno). Reemplazan el label grande de cada
// campo ("Paciente", "Profesional", etc.) en modo `compact`.
function PersonFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-4 4.2-6 7.5-6s6.1 2 7.5 6" />
    </svg>
  )
}

function ProfessionalFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M9 3.5h6v3a3 3 0 0 1-6 0z" />
      <path d="M6 9.5v3a6 6 0 0 0 12 0v-3" />
      <path d="M12 15.5v3M8 20.5h8" />
    </svg>
  )
}

function HashFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M9 4 7 20M17 4l-2 16M4.5 9h15M3.5 15h15" />
    </svg>
  )
}

function ClockFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

function EditFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function RepeatFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M4 12a8 8 0 0 1 14-5.3L21 9" />
      <path d="M21 5v4h-4" />
      <path d="M20 12a8 8 0 0 1-14 5.3L3 15" />
      <path d="M3 19v-4h4" />
    </svg>
  )
}

export type TurnoStatus =
  | 'Asignado'
  | 'En Espera'
  | 'Atendiendo'
  | 'Finalizado'
  | 'Ausente'
  | 'Cancelado'

export type TurnoFormValue = {
  date: string
  time: string
  patientId: number | null
  professionalId: number | null
  specialtyId: number
  socialWorkId?: number | null
  sessionNumber: number
  esSesionConsulta: boolean
  monto: string
  grupoId: number | null
  status: TurnoStatus
  duration: number
  // Solo tiene efecto en la creación (alta rápida compacta) — ver
  // `allowRecurrence` más abajo. 'none' = turno único, 1/2 = cada cuántas
  // semanas se repite (siempre el día de la semana de `date`).
  recurrenceFrequency: RecurrenceFrequency
  recurrenceCount: number
  // Configuración de "Personalizado..." — solo tiene valor cuando
  // recurrenceFrequency === 'custom'; se conserva aunque el usuario cambie
  // a otra opción y vuelva, para no perder lo ya configurado (ver "Reabrir
  // Personalizado" en docs/modules/appointments.md).
  customRecurrence: CustomRecurrenceConfig | null
}

export type SpecialtyOption = {
  id: number
  name: string
  color: string
}

export type NewPatientInput = {
  nombreCompleto: string
  documento?: string
  telefono?: string
}

export type NewProfessionalInput = {
  nombreCompleto: string
  titulo?: string
  matricula?: string
  usuarioId?: number
}

type DropdownName = 'patient' | 'professional' | 'specialty'
type DropdownPosition = { top: number; left: number; width: number } | null

type Item = { id: number; displayName: string }

type TurnoFormFieldsProps = {
  value: TurnoFormValue
  onChange: (nextValue: TurnoFormValue) => void
  disabled?: boolean
  patients: Item[]
  professionals: Item[]
  specialties: SpecialtyOption[]
  onCreateSpecialty?: (name: string) => Promise<SpecialtyOption> | SpecialtyOption
  onCreatePatient?: (patient: NewPatientInput) => Promise<Item>
  onCreateProfessional?: (profesional: NewProfessionalInput) => Promise<Item>
  // Usuarios del consultorio sin profesional vinculado todavía — para el
  // campo opcional "Usuario vinculado" del alta rápida de Profesional.
  vinculableUsers?: Item[]

  /*
   * Diagnóstico ("Sesión X de Y"): solo se ofrece cuando el rol puede ver
   * contenido clínico (mismo gate que Evoluciones/Ficha Inicial) — no se
   * amplía el alcance de quién ve Diagnósticos. Sin `grupos`/`onChangeGrupo`,
   * el campo directamente no se muestra (compatibilidad con el turno sin
   * diagnóstico de siempre).
   */
  grupos?: GrupoEvolucion[]
  onCreateGrupo?: (nombre: string) => Promise<GrupoEvolucion>
  // Pide al backend la próxima "Sesión X" real para un diagnóstico (ver
  // GET /api/grupos-evolucion/:id/proxima-sesion) — FormFields no llama a
  // la API directamente, se mantiene "tonto"/controlado por props como el
  // resto del formulario.
  onFetchProximaSesion?: (grupoId: number) => Promise<number>

  /*
   * Un usuario PROFESIONAL solo puede crear/editar turnos para sí mismo: el
   * backend ya ignora/rechaza cualquier profesionalId distinto del propio,
   * así que este campo ni se muestra (nada que elegir).
   */
  hideProfessionalField?: boolean

  /*
   * Compatibilidad temporal:
   * obra social pertenece al paciente y ya no se muestra en este formulario.
   * Estas props quedan opcionales para no romper llamadas existentes desde App.tsx.
   */
  socialWorks?: Item[]
  onCreateSocialWork?: (name: string) => Promise<Item> | Item

  /*
   * Alta rápida compacta (Home → calendario): fusiona Fecha/Hora inicio/Hora
   * fin en una fila, deriva la duración de esas dos horas (nunca se muestra
   * el campo "Duración (min)"), y oculta Monto/Estado (disponibles solo en
   * "Más opciones", ver App.tsx). El resto de los campos (Paciente,
   * Profesional, Especialidad, Diagnóstico, Sesión) se comparten sin cambios
   * con el formulario completo — mismo componente, mismo estado.
   */
  compact?: boolean
  // Selector de Repetición + Cantidad de sesiones: solo tiene sentido en la
  // creación de un turno nuevo (nunca al editar uno ya existente).
  allowRecurrence?: boolean
}

function addMinutesToTimeOfDay(time: string, minutesToAdd: number): string {
  const [h, m] = time.split(':').map(Number)
  const totalMinutes = (h * 60 + m + minutesToAdd + 1440) % 1440
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`
}

function minutesBetweenTimesOfDay(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const diff = eh * 60 + em - (sh * 60 + sm)
  return diff > 0 ? diff : diff + 1440
}

const minuteOptions = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']
const statusOptions: TurnoStatus[] = [
  'Asignado',
  'En Espera',
  'Atendiendo',
  'Finalizado',
  'Ausente',
  'Cancelado',
]

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

export function TurnoFormFields({
  value,
  onChange,
  disabled = false,
  patients,
  professionals,
  specialties,
  onCreateSpecialty,
  onCreatePatient,
  onCreateProfessional,
  vinculableUsers = [],
  grupos,
  onCreateGrupo,
  onFetchProximaSesion,
  hideProfessionalField = false,
  compact = false,
  allowRecurrence = false,
}: TurnoFormFieldsProps) {
  const [activeDropdown, setActiveDropdown] = useState<DropdownName | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>(null)
  const [patientSearch, setPatientSearch] = useState('')
  const [professionalSearch, setProfessionalSearch] = useState('')
  const [addingSpecialty, setAddingSpecialty] = useState(false)
  const [newSpecialtyName, setNewSpecialtyName] = useState('')

  // Alta rápida de Paciente/Profesional: los campos viven FUERA del panel
  // del dropdown (una sección propia del formulario del turno) — el
  // dropdown solo tiene el botón que la abre y se cierra al abrirla.
  const [newPatientSectionOpen, setNewPatientSectionOpen] = useState(false)
  const [newPatient, setNewPatient] = useState<NewPatientInput>({ nombreCompleto: '', documento: '', telefono: '' })
  const [creatingPatient, setCreatingPatient] = useState(false)
  const [newPatientError, setNewPatientError] = useState<string | null>(null)

  const [newProfessionalSectionOpen, setNewProfessionalSectionOpen] = useState(false)
  const [newProfessional, setNewProfessional] = useState<NewProfessionalInput>({ nombreCompleto: '', titulo: '', matricula: '', usuarioId: undefined })
  const [creatingProfessional, setCreatingProfessional] = useState(false)
  const [newProfessionalError, setNewProfessionalError] = useState<string | null>(null)

  const [proximaSesionLoading, setProximaSesionLoading] = useState(false)
  const [customModalOpen, setCustomModalOpen] = useState(false)

  const patientFieldRef = useRef<HTMLDivElement | null>(null)
  const professionalFieldRef = useRef<HTMLDivElement | null>(null)
  const specialtyFieldRef = useRef<HTMLDivElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const specialtyInputId = useId()
  const specialtyFieldLabelId = useId()
  const dateInputId = useId()
  const startTimeId = useId()
  const endTimeId = useId()
  const patientInputId = useId()
  const professionalInputId = useId()
  const repeatSelectId = useId()
  const recurrenceCountId = useId()
  const sessionConsultaCheckboxId = useId()
  const sessionNumberId = useId()

  const fieldRefs = useMemo<Record<DropdownName, React.RefObject<HTMLDivElement | null>>>(
    () => ({
      patient: patientFieldRef,
      professional: professionalFieldRef,
      specialty: specialtyFieldRef,
    }),
    [],
  )

  useLayoutEffect(() => {
    if (!activeDropdown) return

    const updatePosition = () => {
      const field = fieldRefs[activeDropdown].current
      if (!field) return

      const rect = field.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [activeDropdown, fieldRefs])

  useEffect(() => {
    if (!activeDropdown) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      const activeField = fieldRefs[activeDropdown].current

      if (
        activeField &&
        !activeField.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setActiveDropdown(null)
        setAddingSpecialty(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [activeDropdown, fieldRefs])

  const filteredPatients = useMemo(
    () => patients.filter((patient) => patient.displayName.toLowerCase().includes(patientSearch.toLowerCase())),
    [patientSearch, patients],
  )

  const filteredProfessionals = useMemo(
    () => professionals.filter((professional) => professional.displayName.toLowerCase().includes(professionalSearch.toLowerCase())),
    [professionalSearch, professionals],
  )

  // `valueRef` sigue siempre el `value` más reciente, aunque cambie mientras
  // hay una operación async en vuelo (ej. alta rápida de paciente/
  // profesional/especialidad, que espera una respuesta de red). Sin esto,
  // `createPatient`/`createProfessional`/`createSpecialty` — todas async —
  // capturarían por closure el `value` de cuando arrancaron, y al resolver
  // pisarían silenciosamente cualquier otro campo tocado mientras tanto (ej.
  // Repetición) con esa foto vieja. Bug real: crear paciente → profesional →
  // especialidad y elegir Repetición entre medio podía terminar creando un
  // turno único en vez de la serie elegida, sin ningún error visible.
  const valueRef = useRef(value)
  useLayoutEffect(() => {
    valueRef.current = value
  })

  const updateValue = (patch: Partial<TurnoFormValue>) => {
    onChange({ ...valueRef.current, ...patch })
  }

  const openDropdown = (dropdown: DropdownName) => {
    if (disabled) return
    setActiveDropdown((current) => (current === dropdown ? null : dropdown))
  }

  const createSpecialty = async () => {
    const name = newSpecialtyName.trim()
    if (!name || !onCreateSpecialty) return

    const createdSpecialty = await onCreateSpecialty(name)
    updateValue({ specialtyId: createdSpecialty.id })
    setNewSpecialtyName('')
    setAddingSpecialty(false)
    setActiveDropdown(null)
  }

  const cancelNewPatient = () => {
    setNewPatient({ nombreCompleto: '', documento: '', telefono: '' })
    setNewPatientError(null)
    setNewPatientSectionOpen(false)
  }

  const createPatient = async () => {
    const nombreCompleto = newPatient.nombreCompleto.trim()
    if (!nombreCompleto || !onCreatePatient) return

    setCreatingPatient(true)
    setNewPatientError(null)
    try {
      const created = await onCreatePatient({
        nombreCompleto,
        documento: newPatient.documento?.trim() || undefined,
        telefono: newPatient.telefono?.trim() || undefined,
      })
      updateValue({ patientId: created.id })
      setNewPatient({ nombreCompleto: '', documento: '', telefono: '' })
      setNewPatientSectionOpen(false)
    } catch (error) {
      setNewPatientError(error instanceof Error && error.message.trim() ? error.message : 'No se pudo crear el paciente.')
    } finally {
      setCreatingPatient(false)
    }
  }

  const cancelNewProfessional = () => {
    setNewProfessional({ nombreCompleto: '', titulo: '', matricula: '', usuarioId: undefined })
    setNewProfessionalError(null)
    setNewProfessionalSectionOpen(false)
  }

  const createProfessional = async () => {
    const nombreCompleto = newProfessional.nombreCompleto.trim()
    if (!nombreCompleto || !onCreateProfessional) return

    setCreatingProfessional(true)
    setNewProfessionalError(null)
    try {
      const created = await onCreateProfessional({
        nombreCompleto,
        titulo: newProfessional.titulo?.trim() || undefined,
        matricula: newProfessional.matricula?.trim() || undefined,
        usuarioId: newProfessional.usuarioId,
      })
      updateValue({ professionalId: created.id })
      setNewProfessional({ nombreCompleto: '', titulo: '', matricula: '', usuarioId: undefined })
      setNewProfessionalSectionOpen(false)
    } catch (error) {
      setNewProfessionalError(error instanceof Error && error.message.trim() ? error.message : 'No se pudo crear el profesional.')
    } finally {
      setCreatingProfessional(false)
    }
  }

  const selectedGrupo = grupos?.find((grupo) => grupo.id === value.grupoId) ?? null

  const fetchProximaSesion = (grupoId: number) => {
    if (!onFetchProximaSesion) return
    setProximaSesionLoading(true)
    onFetchProximaSesion(grupoId)
      .then((numeroSesion) => updateValue({ sessionNumber: numeroSesion }))
      .catch(() => {})
      .finally(() => setProximaSesionLoading(false))
  }

  const changeGrupo = (grupoId: number | '') => {
    if (grupoId === '') {
      updateValue({ grupoId: null })
      return
    }
    updateValue({ grupoId })
    // Se sugiere el próximo número para cualquier diagnóstico, tenga o no
    // cantidadSesionesPlanificadas configurada — ese campo solo cambia si se
    // muestra "Sesión (de Y)" o "Nro. de sesión" a secas, nunca si el
    // cálculo automático se ofrece o no. No aplica si ya está tildado
    // "Sesión de consulta" (el número queda oculto de cualquier forma).
    if (!value.esSesionConsulta) fetchProximaSesion(grupoId)
  }

  // Al tildar "Sesión de consulta" el número deja de aplicar (se oculta más
  // abajo); al destildarla, si ya hay un diagnóstico elegido, se vuelve a
  // sugerir el próximo número — mismo criterio que elegir el diagnóstico.
  const toggleSesionConsulta = (checked: boolean) => {
    // Una sesión de consulta es una visita administrativa puntual — nunca
    // parte de un pack recurrente. Se oculta el selector de Repetición (más
    // abajo) y se resetea a "No se repite" para que no quede un valor
    // recurrente invisible pero todavía vigente al guardar.
    updateValue({ esSesionConsulta: checked, ...(checked ? { recurrenceFrequency: 'none' as const } : {}) })
    if (!checked && value.grupoId) fetchProximaSesion(value.grupoId)
  }

  const selectedPatient = patients.find((patient) => patient.id === value.patientId)
  const selectedProfessional = professionals.find((professional) => professional.id === value.professionalId)
  const selectedSpecialty = specialties.find((specialty) => specialty.id === value.specialtyId)
  const [selectedHour = '09', selectedMinute = '00'] = value.time.split(':')

  const endTime = addMinutesToTimeOfDay(value.time, value.duration)

  return (
    <>
    <div className={`modal-body appointment-form ${disabled ? 'appointment-form--readonly' : ''} ${compact ? 'appointment-form--compact' : ''}`}>
      {compact ? (
        <div className="quick-datetime-row">
          <ClockFieldIcon className="quick-field-icon" aria-hidden="true" />
          <label className="sr-only" htmlFor={dateInputId}>Fecha</label>
          <DateInput id={dateInputId} value={value.date} onChange={(date) => updateValue({ date })} disabled={disabled} />
          <label className="sr-only" htmlFor={startTimeId}>Hora de inicio</label>
          <input
            id={startTimeId}
            type="time"
            value={value.time}
            onChange={(event) => updateValue({ time: event.target.value })}
            disabled={disabled}
          />
          <span className="quick-datetime-sep" aria-hidden="true">–</span>
          <label className="sr-only" htmlFor={endTimeId}>Hora de fin</label>
          <input
            id={endTimeId}
            type="time"
            value={endTime}
            onChange={(event) => {
              const duration = minutesBetweenTimesOfDay(value.time, event.target.value)
              if (duration >= 15) updateValue({ duration })
            }}
            disabled={disabled}
          />
        </div>
      ) : (
        <>
          <label>
            Fecha
            <DateInput
              className="narrow-input"
              value={value.date}
              onChange={(date) => updateValue({ date })}
              disabled={disabled}
            />
          </label>

          <label>
            Hora
            <div className="time-selects">
              <select
                value={selectedHour}
                onChange={(event) => updateValue({ time: `${pad(Number(event.target.value))}:${selectedMinute}` })}
                disabled={disabled}
              >
                {Array.from({ length: 24 }, (_, index) => pad(index)).map((hour) => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <span className="colon">:</span>
              <select
                value={selectedMinute}
                onChange={(event) => updateValue({ time: `${selectedHour}:${event.target.value}` })}
                disabled={disabled}
              >
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>
            </div>
          </label>
        </>
      )}

      {compact && allowRecurrence && !value.esSesionConsulta ? (
        <div className="quick-recurrence-row">
          <RepeatFieldIcon className="quick-field-icon" aria-hidden="true" />
          <label className="sr-only" htmlFor={repeatSelectId}>Repetición</label>
          <select
            id={repeatSelectId}
            className="quick-repeat-select"
            value={value.recurrenceFrequency}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === 'custom') {
                setCustomModalOpen(true)
                return
              }
              const next: RecurrenceFrequency = raw === 'none' ? 'none' : raw === 'monthly' ? 'monthly' : (Number(raw) as 1 | 2)
              updateValue({ recurrenceFrequency: next })
            }}
            disabled={disabled}
          >
            <option value="none">No se repite</option>
            <option value={1}>{`Cada semana, el ${weekdayLabel(value.date)}`}</option>
            <option value={2}>{`Cada 2 semanas, el ${weekdayLabel(value.date)}`}</option>
            <option value="monthly">{monthlyRecurrenceLabel(value.date)}</option>
            <option value="custom">{value.customRecurrence ? customRecurrenceSummary(value.customRecurrence) : 'Personalizado...'}</option>
          </select>
          {value.recurrenceFrequency === 'custom' ? (
            <button
              type="button"
              className="quick-repeat-edit"
              aria-label="Editar recurrencia personalizada"
              title="Editar recurrencia personalizada"
              onClick={() => setCustomModalOpen(true)}
              disabled={disabled}
            >
              <EditFieldIcon aria-hidden="true" />
            </button>
          ) : null}
          {value.recurrenceFrequency !== 'none' ? (
            <span className="quick-repeat-count">
              <label className="sr-only" htmlFor={recurrenceCountId}>Cantidad de sesiones</label>
              <input
                id={recurrenceCountId}
                type="number"
                title="Cantidad de sesiones"
                min={2}
                max={60}
                value={value.recurrenceCount}
                onChange={(event) => updateValue({ recurrenceCount: Number(event.target.value) })}
                disabled={disabled}
              />
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={`dropdown-field ${compact ? 'dropdown-field--compact' : ''}`}>
        {compact ? <PersonFieldIcon className="quick-field-icon" aria-hidden="true" /> : null}
        <label className={compact ? 'sr-only' : undefined} htmlFor={patientInputId}>Paciente</label>
        <div className="dropdown-input-row" ref={patientFieldRef}>
          <input
            id={patientInputId}
            type="text"
            value={activeDropdown === 'patient' ? patientSearch : (selectedPatient?.displayName ?? '')}
            placeholder="Buscar paciente..."
            onFocus={() => {
              if (disabled) return
              // Vacío (no el nombre ya elegido): al abrir, se ve la lista
              // completa — el paciente seleccionado sigue en la lista,
              // marcado con un check, nunca "escondido" por el buscador.
              setPatientSearch('')
              setActiveDropdown('patient')
            }}
            onChange={(event) => {
              const nextSearch = event.target.value
              setPatientSearch(nextSearch)
              setActiveDropdown('patient')
            }}
            disabled={disabled}
          />
          {!disabled && value.patientId ? (
            <button
              type="button"
              className="clear-button"
              aria-label="Limpiar paciente"
              onClick={() => {
                setPatientSearch('')
                updateValue({ patientId: null })
                setActiveDropdown(null)
              }}
            >
              &times;
            </button>
          ) : null}
        </div>
      </div>

      {!disabled && newPatientSectionOpen ? (
        <div className="quick-create-section">
          <p className="quick-create-title">Nuevo paciente</p>
          <input
            autoFocus
            value={newPatient.nombreCompleto}
            placeholder="Nombre completo *"
            onChange={(event) => setNewPatient((current) => ({ ...current, nombreCompleto: event.target.value }))}
          />
          <input
            value={newPatient.documento}
            placeholder="Documento"
            onChange={(event) => setNewPatient((current) => ({ ...current, documento: event.target.value }))}
          />
          <input
            value={newPatient.telefono}
            placeholder="Teléfono"
            onChange={(event) => setNewPatient((current) => ({ ...current, telefono: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') createPatient()
            }}
          />
          {newPatientError ? <p className="evolution-form-error">{newPatientError}</p> : null}
          <div className="quick-create-actions">
            <button type="button" className="secondary-button" onClick={cancelNewPatient}>Cancelar</button>
            <button
              type="button"
              className="primary-button"
              disabled={!newPatient.nombreCompleto.trim() || creatingPatient}
              onClick={createPatient}
            >
              {creatingPatient ? 'Creando...' : '+ Agregar'}
            </button>
          </div>
        </div>
      ) : null}

      {hideProfessionalField ? null : (
        <div className={`dropdown-field ${compact ? 'dropdown-field--compact' : ''}`}>
          {compact ? <ProfessionalFieldIcon className="quick-field-icon" aria-hidden="true" /> : null}
          <label className={compact ? 'sr-only' : undefined} htmlFor={professionalInputId}>Profesional</label>
          <div className="dropdown-input-row" ref={professionalFieldRef}>
            <input
              id={professionalInputId}
              type="text"
              value={activeDropdown === 'professional' ? professionalSearch : (selectedProfessional?.displayName ?? '')}
              placeholder="Buscar profesional..."
              onFocus={() => {
                if (disabled) return
                setProfessionalSearch('')
                setActiveDropdown('professional')
              }}
              onChange={(event) => {
                const nextSearch = event.target.value
                setProfessionalSearch(nextSearch)
                setActiveDropdown('professional')
              }}
              disabled={disabled}
            />
            {!disabled && value.professionalId ? (
              <button
                type="button"
                className="clear-button"
                aria-label="Limpiar profesional"
                onClick={() => {
                  setProfessionalSearch('')
                  updateValue({ professionalId: null })
                  setActiveDropdown(null)
                }}
              >
                &times;
              </button>
            ) : null}
          </div>
        </div>
      )}

      {!disabled && !hideProfessionalField && newProfessionalSectionOpen ? (
        <div className="quick-create-section">
          <p className="quick-create-title">Nuevo profesional</p>
          <input
            autoFocus
            value={newProfessional.nombreCompleto}
            placeholder="Nombre completo *"
            onChange={(event) => setNewProfessional((current) => ({ ...current, nombreCompleto: event.target.value }))}
          />
          <input
            value={newProfessional.titulo}
            placeholder="Ej. Lic. en Kinesiología y Fisiatría"
            onChange={(event) => setNewProfessional((current) => ({ ...current, titulo: event.target.value }))}
          />
          <input
            value={newProfessional.matricula}
            placeholder="Matrícula"
            onChange={(event) => setNewProfessional((current) => ({ ...current, matricula: event.target.value }))}
          />
          {vinculableUsers.length > 0 ? (
            <select
              value={newProfessional.usuarioId ?? ''}
              onChange={(event) => setNewProfessional((current) => ({ ...current, usuarioId: event.target.value ? Number(event.target.value) : undefined }))}
            >
              <option value="">Usuario vinculado (opcional)</option>
              {vinculableUsers.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>{usuario.displayName}</option>
              ))}
            </select>
          ) : null}
          {newProfessionalError ? <p className="evolution-form-error">{newProfessionalError}</p> : null}
          <div className="quick-create-actions">
            <button type="button" className="secondary-button" onClick={cancelNewProfessional}>Cancelar</button>
            <button
              type="button"
              className="primary-button"
              disabled={!newProfessional.nombreCompleto.trim() || creatingProfessional}
              onClick={createProfessional}
            >
              {creatingProfessional ? 'Creando...' : '+ Agregar'}
            </button>
          </div>
        </div>
      ) : null}

      <div className={`dropdown-field ${compact ? 'dropdown-field--compact' : ''}`}>
        <label className={compact ? 'sr-only' : undefined} htmlFor={specialtyFieldLabelId}>Especialidad</label>
        <div
          className="dropdown-input-row"
          ref={specialtyFieldRef}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onClick={() => openDropdown('specialty')}
          onKeyDown={(event) => {
            if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              openDropdown('specialty')
            }
          }}
        >
          {/* El punto de color siempre se muestra cuando hay una especialidad
              elegida (compact y full); sin selección, en compact ocupa el
              mismo lugar el ícono genérico de la fila para no perder la
              alineación con Paciente/Profesional. */}
          {selectedSpecialty ? (
            <span className="turnos-specialty-dot" style={{ backgroundColor: selectedSpecialty.color }} aria-hidden="true" />
          ) : compact ? (
            <span className="turnos-specialty-dot turnos-specialty-dot--empty" aria-hidden="true" />
          ) : null}
          <input id={specialtyFieldLabelId} readOnly placeholder="Buscar especialidad..." value={selectedSpecialty?.name ?? ''} disabled={disabled} />
          {!disabled && value.specialtyId !== 0 ? (
            <button
              type="button"
              className="clear-button"
              aria-label="Limpiar especialidad"
              onClick={(event) => {
                event.stopPropagation()
                updateValue({ specialtyId: 0 })
                setActiveDropdown(null)
              }}
            >
              &times;
            </button>
          ) : null}
        </div>
      </div>



      {/* Diagnóstico es un campo avanzado: nunca se muestra en el quick-create
          compacto, solo en el formulario completo ("Más opciones"). */}
      {!compact && grupos && onCreateGrupo ? (
        <DiagnosticoSelect
          grupos={grupos}
          value={value.grupoId ?? ''}
          onChange={changeGrupo}
          onCreate={onCreateGrupo}
          disabled={disabled || !value.patientId}
        />
      ) : null}

      {compact ? (
        <div className="quick-session-row">
          <label className="checkbox-field" htmlFor={sessionConsultaCheckboxId}>
            <input
              id={sessionConsultaCheckboxId}
              type="checkbox"
              checked={value.esSesionConsulta}
              onChange={(event) => toggleSesionConsulta(event.target.checked)}
              disabled={disabled}
            />
            Sesión de consulta
          </label>

          {!value.esSesionConsulta ? (
            <span className="quick-session-number">
              <HashFieldIcon className="quick-field-icon" aria-hidden="true" />
              <label className="sr-only" htmlFor={sessionNumberId}>
                {selectedGrupo?.cantidadSesionesPlanificadas ? `Sesión (de ${selectedGrupo.cantidadSesionesPlanificadas})` : 'Nro. de sesión'}
              </label>
              <input
                id={sessionNumberId}
                type="number"
                title={selectedGrupo?.cantidadSesionesPlanificadas ? `Sesión (de ${selectedGrupo.cantidadSesionesPlanificadas})` : 'Nro. de sesión'}
                min={1}
                value={value.sessionNumber}
                onChange={(event) => updateValue({ sessionNumber: Number(event.target.value) })}
                disabled={disabled || proximaSesionLoading}
              />
            </span>
          ) : null}
        </div>
      ) : (
        <>
          {/* "Sesión de consulta" ocupa su propia fila completa (antes
              compartía celda de grid con "Nro. de sesión", lo que estiraba
              esa fila y hacía parecer que "Monto" tenía un gap enorme
              label→input — en realidad era la fila del grid, no el campo). */}
          <label className="checkbox-field checkbox-field--section appointment-form-full-row" htmlFor={sessionConsultaCheckboxId}>
            <input
              id={sessionConsultaCheckboxId}
              type="checkbox"
              checked={value.esSesionConsulta}
              onChange={(event) => toggleSesionConsulta(event.target.checked)}
              disabled={disabled}
            />
            Sesión de consulta
          </label>

          {!value.esSesionConsulta ? (
            <label>
              {selectedGrupo?.cantidadSesionesPlanificadas ? `Sesión (de ${selectedGrupo.cantidadSesionesPlanificadas})` : 'Nro. de sesión'}
              <input
                type="number"
                className="narrow-input"
                min={1}
                value={value.sessionNumber}
                onChange={(event) => updateValue({ sessionNumber: Number(event.target.value) })}
                disabled={disabled || proximaSesionLoading}
              />
            </label>
          ) : null}

          <label>
            Monto
            <div className="turno-monto-field">
              <span className="turno-monto-symbol" aria-hidden="true">$</span>
              <input
                type="number"
                className="narrow-input"
                min={0}
                step={0.01}
                placeholder="Opcional"
                value={value.monto}
                onChange={(event) => updateValue({ monto: event.target.value })}
                disabled={disabled}
              />
            </div>
          </label>

          <label>
            Estado
            <select
              value={value.status}
              onChange={(event) => updateValue({ status: event.target.value as TurnoStatus })}
              disabled={disabled}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label>
            Duración (min)
            <input
              type="number"
              min={15}
              step={5}
              value={value.duration}
              onChange={(event) => updateValue({ duration: Number(event.target.value) })}
              disabled={disabled}
            />
          </label>
        </>
      )}

      {!disabled && activeDropdown && dropdownPosition ? (
        <div
          className="dropdown-list"
          ref={dropdownRef}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          {activeDropdown === 'patient' && (
            <>
              {filteredPatients.map((patient) => {
                const isSelected = patient.id === value.patientId
                return (
                  <button
                    key={patient.id}
                    type="button"
                    className={isSelected ? 'dropdown-option--selected' : undefined}
                    onClick={() => {
                      setPatientSearch('')
                      updateValue({ patientId: patient.id })
                      setActiveDropdown(null)
                    }}
                  >
                    {isSelected ? <span className="dropdown-option-check" aria-hidden="true">✓</span> : null}
                    {patient.displayName}
                  </button>
                )
              })}

              {onCreatePatient && (
                <div className="dropdown-footer">
                  <button
                    type="button"
                    className="add-item-button"
                    onClick={() => {
                      setActiveDropdown(null)
                      setNewPatientSectionOpen(true)
                    }}
                  >
                    + Agregar paciente
                  </button>
                </div>
              )}
            </>
          )}

          {activeDropdown === 'professional' && (
            <>
              {filteredProfessionals.map((professional) => {
                const isSelected = professional.id === value.professionalId
                return (
                  <button
                    key={professional.id}
                    type="button"
                    className={isSelected ? 'dropdown-option--selected' : undefined}
                    onClick={() => {
                      setProfessionalSearch('')
                      updateValue({ professionalId: professional.id })
                      setActiveDropdown(null)
                    }}
                  >
                    {isSelected ? <span className="dropdown-option-check" aria-hidden="true">✓</span> : null}
                    {professional.displayName}
                  </button>
                )
              })}

              {onCreateProfessional && (
                <div className="dropdown-footer">
                  <button
                    type="button"
                    className="add-item-button"
                    onClick={() => {
                      setActiveDropdown(null)
                      setNewProfessionalSectionOpen(true)
                    }}
                  >
                    + Agregar profesional
                  </button>
                </div>
              )}
            </>
          )}

          {activeDropdown === 'specialty' && (
            <>
              {specialties.map((specialty) => {
                const isSelected = specialty.id === value.specialtyId
                return (
                  <button
                    key={specialty.id}
                    type="button"
                    className={isSelected ? 'dropdown-option--selected' : undefined}
                    onClick={() => {
                      updateValue({ specialtyId: specialty.id })
                      setActiveDropdown(null)
                    }}
                  >
                    <span className="turnos-specialty-dot" style={{ backgroundColor: specialty.color }} aria-hidden="true" />
                    {specialty.name}
                    {isSelected ? <span className="dropdown-option-check" aria-hidden="true">✓</span> : null}
                  </button>
                )
              })}

              {onCreateSpecialty && (
                !addingSpecialty ? (
                  <div className="dropdown-footer">
                    <button
                      type="button"
                      className="add-item-button"
                      onClick={() => setAddingSpecialty(true)}
                    >
                      + Nueva Especialidad
                    </button>
                  </div>
                ) : (
                  <div className="dropdown-footer-edit">
                    <input
                      id={specialtyInputId}
                      autoFocus
                      value={newSpecialtyName}
                      placeholder="Nombre de la especialidad"
                      onChange={(event) => setNewSpecialtyName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') createSpecialty()
                      }}
                    />
                    <button type="button" className="add-button" onClick={createSpecialty}>Agregar</button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => {
                        setNewSpecialtyName('')
                        setAddingSpecialty(false)
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                )
              )}
            </>
          )}

        </div>
      ) : null}
    </div>

    {customModalOpen ? (
      <CustomRecurrenceModal
        startDate={value.date}
        initialConfig={value.customRecurrence}
        initialCount={value.recurrenceCount}
        onCancel={() => setCustomModalOpen(false)}
        onConfirm={(config, cantidadSesiones) => {
          updateValue({ recurrenceFrequency: 'custom', customRecurrence: config, recurrenceCount: cantidadSesiones })
          setCustomModalOpen(false)
        }}
      />
    ) : null}
    </>
  )
}

export default TurnoFormFields

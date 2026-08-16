import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import DateInput from './DateInput'

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
  status: TurnoStatus
  duration: number
}

export type SpecialtyOption = {
  id: number
  name: string
  color: string
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
  hideProfessionalField = false,
}: TurnoFormFieldsProps) {
  const [activeDropdown, setActiveDropdown] = useState<DropdownName | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>(null)
  const [patientSearch, setPatientSearch] = useState('')
  const [professionalSearch, setProfessionalSearch] = useState('')
  const [addingSpecialty, setAddingSpecialty] = useState(false)
  const [newSpecialtyName, setNewSpecialtyName] = useState('')

  const patientFieldRef = useRef<HTMLDivElement | null>(null)
  const professionalFieldRef = useRef<HTMLDivElement | null>(null)
  const specialtyFieldRef = useRef<HTMLDivElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const specialtyInputId = useId()

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

  const updateValue = (patch: Partial<TurnoFormValue>) => {
    onChange({ ...value, ...patch })
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


  const selectedPatient = patients.find((patient) => patient.id === value.patientId)
  const selectedProfessional = professionals.find((professional) => professional.id === value.professionalId)
  const selectedSpecialty = specialties.find((specialty) => specialty.id === value.specialtyId)
  const [selectedHour = '09', selectedMinute = '00'] = value.time.split(':')

  return (
    <div className={`modal-body appointment-form ${disabled ? 'appointment-form--readonly' : ''}`}>
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

      <div className="dropdown-field">
        <label>Paciente</label>
        <div className="dropdown-input-row" ref={patientFieldRef}>
          <input
            type="text"
            value={activeDropdown === 'patient' ? patientSearch : (selectedPatient?.displayName ?? '')}
            placeholder="Buscar paciente..."
            onFocus={() => {
              if (disabled) return
              setPatientSearch(selectedPatient?.displayName ?? '')
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

      {hideProfessionalField ? null : (
        <div className="dropdown-field">
          <label>Profesional</label>
          <div className="dropdown-input-row" ref={professionalFieldRef}>
            <input
              type="text"
              value={activeDropdown === 'professional' ? professionalSearch : (selectedProfessional?.displayName ?? '')}
              placeholder="Buscar profesional..."
              onFocus={() => {
                if (disabled) return
                setProfessionalSearch(selectedProfessional?.displayName ?? '')
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

      <div className="dropdown-field">
        <label>Especialidad</label>
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
          {selectedSpecialty ? (
            <span className="turnos-specialty-dot" style={{ backgroundColor: selectedSpecialty.color }} aria-hidden="true" />
          ) : null}
          <input readOnly value={selectedSpecialty?.name ?? ''} disabled={disabled} />
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



      <label>
        Nro. de sesión
        <input
          type="number"
          className="narrow-input"
          min={1}
          value={value.sessionNumber}
          onChange={(event) => updateValue({ sessionNumber: Number(event.target.value) })}
          disabled={disabled}
        />
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
          {activeDropdown === 'patient' && filteredPatients.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onClick={() => {
                setPatientSearch(patient.displayName)
                updateValue({ patientId: patient.id })
                setActiveDropdown(null)
              }}
            >
              {patient.displayName}
            </button>
          ))}

          {activeDropdown === 'professional' && filteredProfessionals.map((professional) => (
            <button
              key={professional.id}
              type="button"
              onClick={() => {
                setProfessionalSearch(professional.displayName)
                updateValue({ professionalId: professional.id })
                setActiveDropdown(null)
              }}
            >
              {professional.displayName}
            </button>
          ))}

          {activeDropdown === 'specialty' && (
            <>
              {specialties.map((specialty) => (
                <button
                  key={specialty.id}
                  type="button"
                  onClick={() => {
                    updateValue({ specialtyId: specialty.id })
                    setActiveDropdown(null)
                  }}
                >
                  <span className="turnos-specialty-dot" style={{ backgroundColor: specialty.color }} aria-hidden="true" />
                  {specialty.name}
                </button>
              ))}

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
  )
}

export default TurnoFormFields

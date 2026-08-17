import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GrupoEvolucion } from '../types/domain'

type DiagnosticoSelectProps = {
  grupos: GrupoEvolucion[]
  value: number | ''
  onChange: (grupoId: number | '') => void
  onCreate: (nombre: string) => Promise<GrupoEvolucion>
  disabled?: boolean
}

// Mismo patrón visual/funcional que el combobox de Especialidad de
// TurnoFormFields (FormFields.tsx): dropdown posicionado con
// getBoundingClientRect, "+ Agregar diagnóstico" como último ítem del panel
// (nunca una acción suelta afuera), mini alta inline con un solo campo.
export default function DiagnosticoSelect({ grupos, value, onChange, onCreate, disabled = false }: DiagnosticoSelectProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const [adding, setAdding] = useState(false)
  const [nombre, setNombre] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fieldRef = useRef<HTMLDivElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const selected = grupos.find((grupo) => grupo.id === value) ?? null

  useLayoutEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const field = fieldRef.current
      if (!field) return
      const rect = field.getBoundingClientRect()
      setPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        fieldRef.current && !fieldRef.current.contains(target)
        && dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false)
        setAdding(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [open])

  const toggleOpen = () => {
    if (disabled) return
    setOpen((current) => !current)
  }

  const createDiagnostico = async () => {
    const trimmed = nombre.trim()
    if (!trimmed) return

    setCreating(true)
    setError(null)
    try {
      const created = await onCreate(trimmed)
      onChange(created.id)
      setNombre('')
      setAdding(false)
      setOpen(false)
    } catch (createError) {
      setError(createError instanceof Error && createError.message.trim() ? createError.message : 'No se pudo crear el diagnóstico.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="dropdown-field">
      <label className="dropdown-field-label">Diagnóstico</label>
      <div
        className="dropdown-input-row"
        ref={fieldRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            toggleOpen()
          }
        }}
      >
        {selected ? <span className="grupo-evolucion-dot" style={{ backgroundColor: selected.color }} aria-hidden="true" /> : null}
        <input readOnly value={selected?.nombre ?? 'Sin diagnóstico'} disabled={disabled} />
        {!disabled && value !== '' ? (
          <button
            type="button"
            className="clear-button"
            aria-label="Quitar diagnóstico"
            onClick={(event) => {
              event.stopPropagation()
              onChange('')
              setOpen(false)
            }}
          >
            &times;
          </button>
        ) : null}
      </div>

      {!disabled && open && position ? (
        <div
          className="dropdown-list"
          ref={dropdownRef}
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <button type="button" onClick={() => { onChange(''); setOpen(false) }}>
            Sin diagnóstico
          </button>

          {grupos.map((grupo) => (
            <button key={grupo.id} type="button" onClick={() => { onChange(grupo.id); setOpen(false) }}>
              <span className="grupo-evolucion-dot" style={{ backgroundColor: grupo.color }} aria-hidden="true" />
              {grupo.nombre}
            </button>
          ))}

          {!adding ? (
            <div className="dropdown-footer">
              <button type="button" className="add-item-button" onClick={() => setAdding(true)}>
                + Agregar diagnóstico
              </button>
            </div>
          ) : (
            <div className="dropdown-footer-edit">
              <input
                autoFocus
                value={nombre}
                placeholder="Ej. Lumbalgia"
                onChange={(event) => setNombre(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') createDiagnostico()
                }}
              />
              <button type="button" className="add-button" disabled={!nombre.trim() || creating} onClick={createDiagnostico}>
                {creating ? 'Creando...' : 'Agregar'}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setNombre('')
                  setError(null)
                  setAdding(false)
                }}
              >
                Cancelar
              </button>
            </div>
          )}
          {error ? <p className="evolution-form-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

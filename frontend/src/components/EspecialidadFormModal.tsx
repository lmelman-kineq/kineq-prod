import { useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { Especialidad } from '../types/domain'
import { SPECIALTY_COLOR_TOKENS } from '../utils/specialtyColors'
import { useModalDismiss } from '../hooks/useModalDismiss'

type EspecialidadFormModalProps = {
  especialidad?: Especialidad
  onClose: () => void
  onSaved: (especialidad: Especialidad) => void
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function EspecialidadFormModal({ especialidad, onClose, onSaved, onRequestConfirm }: EspecialidadFormModalProps) {
  const isCreate = !especialidad
  const [initial] = useState(() => ({
    nombre: especialidad?.nombre ?? '',
    color: especialidad?.color ?? SPECIALTY_COLOR_TOKENS[0],
    activo: especialidad?.activo ?? true,
  }))
  const [nombre, setNombre] = useState(initial.nombre)
  const [color, setColor] = useState(initial.color)
  const [activo, setActivo] = useState(initial.activo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDirty = nombre !== initial.nombre || color !== initial.color || activo !== initial.activo
  const requestClose = useModalDismiss({ isDirty, saving, onClose, onRequestConfirm })

  const submit = async () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const saved = isCreate
        ? await api.createEspecialidad(nombre.trim(), color)
        : await api.patchEspecialidad(especialidad.id, { nombre: nombre.trim(), color, activo })
      onSaved(saved)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar la especialidad.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <span className="modal-header-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></svg>
            </span>
            <div>
              <h3>{isCreate ? 'Nueva especialidad' : 'Editar especialidad'}</h3>
              <p>{isCreate ? 'Categoría de atención del consultorio' : especialidad.nombre}</p>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={requestClose}>&times;</button>
        </div>

        <div className="modal-body">
          <label>
            Nombre
            <input type="text" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Rehabilitación deportiva" />
          </label>

          <div className="ficha-field">
            <span>Color</span>
            <div className="config-color-picker">
              {SPECIALTY_COLOR_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  className={`config-color-swatch${color === token ? ' config-color-swatch--selected' : ''}`}
                  style={{ backgroundColor: token }}
                  aria-label={`Elegir color ${token}`}
                  aria-pressed={color === token}
                  onClick={() => setColor(token)}
                />
              ))}
            </div>
          </div>

          {!isCreate ? (
            <label className="checkbox-field">
              <input type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} />
              Especialidad activa
            </label>
          ) : null}

          {error ? <p className="evolution-form-error">{error}</p> : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" onClick={() => { void submit() }} disabled={saving}>
            {saving ? 'Guardando...' : isCreate ? 'Crear especialidad' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

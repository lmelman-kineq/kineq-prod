import { useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { GrupoEvolucion } from '../types/domain'
import { SPECIALTY_COLOR_TOKENS } from '../utils/specialtyColors'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { TrashIcon } from './EvolutionTable'

type GrupoEvolucionModalProps = {
  pacienteId: number
  grupo?: GrupoEvolucion
  onClose: () => void
  onSaved: (grupo: GrupoEvolucion) => void
  onDelete?: (grupo: GrupoEvolucion) => void
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

// UI: "Diagnóstico". Internamente sigue siendo GrupoEvolucion — una
// organización libre y simple de evoluciones (ej. "Lumbalgia") creada por el
// profesional, nunca CIE/SNOMED, tratamiento ni diagnóstico codificado.
// Eliminar se delega íntegramente a `onDelete` (misma función que usa
// GestionarGruposModal) para que ambos puntos de entrada compartan
// exactamente la misma confirmación y lógica.
export default function GrupoEvolucionModal({ pacienteId, grupo, onClose, onSaved, onDelete, onRequestConfirm }: GrupoEvolucionModalProps) {
  const isCreate = !grupo
  const [initial] = useState(() => ({ nombre: grupo?.nombre ?? '', color: grupo?.color ?? SPECIALTY_COLOR_TOKENS[0] }))
  const [nombre, setNombre] = useState(initial.nombre)
  const [color, setColor] = useState(initial.color)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDirty = nombre !== initial.nombre || color !== initial.color
  const requestClose = useModalDismiss({ isDirty, saving, onClose, onRequestConfirm })

  const submit = async () => {
    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      setError('El nombre es obligatorio.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = isCreate
        ? await api.createGrupoEvolucion(pacienteId, { nombre: nombreTrim, color })
        : await api.patchGrupoEvolucion(grupo.id, { nombre: nombreTrim, color })
      onSaved(saved)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar el grupo.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <div>
              <h3>{isCreate ? 'Nuevo diagnóstico' : 'Editar diagnóstico'}</h3>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={requestClose}>&times;</button>
        </div>

        <div className="modal-body">
          <label>
            Nombre
            <input type="text" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Lumbalgia" />
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

          {error ? <p className="evolution-form-error">{error}</p> : null}
        </div>

        <div className="modal-actions">
          {!isCreate && onDelete ? (
            <button type="button" className="modal-delete-button" onClick={() => onDelete(grupo)} disabled={saving} title="Eliminar diagnóstico">
              <TrashIcon />
              Eliminar diagnóstico
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" onClick={() => { void submit() }} disabled={saving}>
            {saving ? 'Guardando...' : isCreate ? 'Crear diagnóstico' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

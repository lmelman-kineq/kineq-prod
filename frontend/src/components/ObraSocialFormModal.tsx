import { useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { ObraSocial } from '../types/domain'
import { useModalDismiss } from '../hooks/useModalDismiss'

type ObraSocialFormModalProps = {
  obraSocial?: ObraSocial
  onClose: () => void
  onSaved: (obraSocial: ObraSocial) => void
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function ObraSocialFormModal({ obraSocial, onClose, onSaved, onRequestConfirm }: ObraSocialFormModalProps) {
  const isCreate = !obraSocial
  const [initial] = useState(() => ({ nombre: obraSocial?.nombre ?? '', activo: obraSocial?.activo ?? true }))
  const [nombre, setNombre] = useState(initial.nombre)
  const [activo, setActivo] = useState(initial.activo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDirty = nombre !== initial.nombre || activo !== initial.activo
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
        ? await api.createObraSocial(nombre.trim())
        : await api.patchObraSocial(obraSocial.id, { nombre: nombre.trim(), activo })
      onSaved(saved)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar la obra social.'))
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
              <svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10Z" /></svg>
            </span>
            <div>
              <h3>{isCreate ? 'Nueva obra social' : 'Editar obra social'}</h3>
              <p>{isCreate ? 'Cobertura administrada por el consultorio' : obraSocial.nombre}</p>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={requestClose}>&times;</button>
        </div>

        <div className="modal-body">
          <label>
            Nombre
            <input type="text" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="OSDE" />
          </label>

          {!isCreate ? (
            <label className="checkbox-field">
              <input type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} />
              Obra social activa
            </label>
          ) : null}

          {error ? <p className="evolution-form-error">{error}</p> : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" onClick={() => { void submit() }} disabled={saving}>
            {saving ? 'Guardando...' : isCreate ? 'Crear obra social' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

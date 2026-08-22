import { useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { PlantillaEvolucion } from '../types/domain'
import { useModalDismiss } from '../hooks/useModalDismiss'
import RichTextEditor from './RichTextEditor'
import { TrashIcon } from './EvolutionTable'

type PlantillaFormModalProps = {
  plantilla?: PlantillaEvolucion
  onClose: () => void
  onSaved: (plantilla: PlantillaEvolucion) => void
  onDelete?: (plantilla: PlantillaEvolucion) => void
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

// Crear/editar una Plantilla de Evolución (V1) — mismo patrón que
// GrupoEvolucionModal: nombre + contenido con el mismo editor rico básico
// (negrita/cursiva/subrayado) que ya usa Evolución, para que copiar una
// plantilla al editor preserve el formato tal cual.
export default function PlantillaFormModal({ plantilla, onClose, onSaved, onDelete, onRequestConfirm }: PlantillaFormModalProps) {
  const isCreate = !plantilla
  const [initial] = useState(() => ({ nombre: plantilla?.nombre ?? '', html: plantilla?.contenidoHtml ?? '' }))
  const [nombre, setNombre] = useState(initial.nombre)
  const [html, setHtml] = useState(initial.html)
  const [text, setText] = useState(plantilla?.contenido ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDirty = nombre !== initial.nombre || html !== initial.html
  const requestClose = useModalDismiss({ isDirty, saving, onClose, onRequestConfirm })

  const submit = async () => {
    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!text.trim()) {
      setError('El contenido es obligatorio.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const data = { nombre: nombreTrim, contenido: text, contenidoHtml: html || null }
      const saved = isCreate
        ? await api.createPlantillaEvolucion(data)
        : await api.patchPlantillaEvolucion(plantilla.id, data)
      onSaved(saved)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar la plantilla.'))
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
              <h3>{isCreate ? 'Nueva plantilla' : 'Editar plantilla'}</h3>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={requestClose}>&times;</button>
        </div>

        <div className="modal-body">
          <label>
            Nombre
            <input type="text" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Evaluación cervical" />
          </label>

          <div className="ficha-field">
            <span>Contenido</span>
            <RichTextEditor
              html={html}
              placeholder="Contenido de la plantilla..."
              onChange={(nextHtml, plainText) => {
                setHtml(nextHtml)
                setText(plainText)
              }}
            />
          </div>

          {error ? <p className="evolution-form-error">{error}</p> : null}
        </div>

        <div className="modal-actions">
          {!isCreate && onDelete ? (
            <button type="button" className="modal-delete-button" onClick={() => onDelete(plantilla)} disabled={saving} title="Eliminar plantilla">
              <TrashIcon />
              Eliminar plantilla
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" onClick={() => { void submit() }} disabled={saving}>
            {saving ? 'Guardando...' : isCreate ? 'Crear plantilla' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

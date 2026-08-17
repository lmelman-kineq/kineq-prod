import { useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { Especialidad, Profesional, ProfesionalInput, Usuario } from '../types/domain'
import { useModalDismiss } from '../hooks/useModalDismiss'

const ROL_LABELS: Record<Usuario['rol'], string> = {
  ADMINISTRADOR: 'Administrador',
  PROFESIONAL: 'Profesional',
  RECEPCION: 'Recepción',
  SUPERVISOR: 'Supervisor',
}

type ProfesionalFormModalProps = {
  profesional?: Profesional
  especialidades: Especialidad[]
  usuariosDisponibles: Usuario[]
  onClose: () => void
  onSaved: (profesional: Profesional) => void
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

type FormState = {
  nombre: string
  apellido: string
  titulo: string
  matricula: string
  email: string
  telefono: string
  activo: boolean
  especialidadIds: number[]
  usuarioId: string
}

function formFromProfesional(profesional?: Profesional): FormState {
  return {
    nombre: profesional?.nombre ?? '',
    apellido: profesional?.apellido ?? '',
    titulo: profesional?.titulo ?? '',
    matricula: profesional?.matricula ?? '',
    email: profesional?.email ?? '',
    telefono: profesional?.telefono ?? '',
    activo: profesional?.activo ?? true,
    especialidadIds: profesional?.especialidades?.map((pe) => pe.especialidadId) ?? [],
    usuarioId: profesional?.usuario ? String(profesional.usuario.id) : '',
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function ProfesionalFormModal({ profesional, especialidades, usuariosDisponibles, onClose, onSaved, onRequestConfirm }: ProfesionalFormModalProps) {
  const isCreate = !profesional
  const [initialForm] = useState(() => formFromProfesional(profesional))
  const [form, setForm] = useState<FormState>(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const requestClose = useModalDismiss({ isDirty, saving, onClose, onRequestConfirm })

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }))

  const toggleEspecialidad = (especialidadId: number) => {
    setForm((current) => ({
      ...current,
      especialidadIds: current.especialidadIds.includes(especialidadId)
        ? current.especialidadIds.filter((id) => id !== especialidadId)
        : [...current.especialidadIds, especialidadId],
    }))
  }

  const submit = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError('Nombre y apellido son obligatorios.')
      return
    }

    setSaving(true)
    setError(null)

    const payload: ProfesionalInput = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      titulo: form.titulo.trim() || null,
      matricula: form.matricula.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      especialidadIds: form.especialidadIds,
      usuarioId: form.usuarioId ? Number(form.usuarioId) : null,
    }
    if (!isCreate) {
      payload.activo = form.activo
    }

    try {
      const saved = isCreate ? await api.createProfesional(payload) : await api.patchProfesional(profesional.id, payload)
      onSaved(saved)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar el profesional.'))
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
              <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>
            </span>
            <div>
              <h3>{isCreate ? 'Nuevo profesional' : 'Editar profesional'}</h3>
              <p>{isCreate ? 'Alta de un profesional del consultorio' : `${profesional.nombre} ${profesional.apellido}`}</p>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={requestClose}>&times;</button>
        </div>

        <div className="modal-body">
          <label>
            Nombre
            <input type="text" value={form.nombre} onChange={(event) => update({ nombre: event.target.value })} />
          </label>
          <label>
            Apellido
            <input type="text" value={form.apellido} onChange={(event) => update({ apellido: event.target.value })} />
          </label>
          <label>
            Título
            <input type="text" value={form.titulo} onChange={(event) => update({ titulo: event.target.value })} placeholder="Ej. Lic. en Kinesiología y Fisiatría" />
          </label>
          <label>
            Matrícula
            <input type="text" value={form.matricula} onChange={(event) => update({ matricula: event.target.value })} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => update({ email: event.target.value })} />
          </label>
          <label>
            Teléfono
            <input type="text" value={form.telefono} onChange={(event) => update({ telefono: event.target.value })} />
          </label>

          <div className="ficha-field ficha-field--wide">
            <span>Especialidades</span>
            {especialidades.length === 0 ? (
              <p className="patient-detail-note patient-detail-note--inline">Todavía no hay especialidades cargadas.</p>
            ) : (
              <div className="config-checkbox-list">
                {especialidades.map((especialidad) => (
                  <label key={especialidad.id} className="config-checkbox-item">
                    <input
                      type="checkbox"
                      checked={form.especialidadIds.includes(especialidad.id)}
                      onChange={() => toggleEspecialidad(especialidad.id)}
                    />
                    <span className="turnos-specialty-dot config-checkbox-dot" style={{ backgroundColor: especialidad.color }} />
                    <span className="config-checkbox-label" title={especialidad.nombre}>{especialidad.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label>
            Usuario vinculado
            <select value={form.usuarioId} onChange={(event) => update({ usuarioId: event.target.value })}>
              <option value="">Sin usuario vinculado</option>
              {usuariosDisponibles.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} {usuario.apellido} · {usuario.email} · {ROL_LABELS[usuario.rol]}
                </option>
              ))}
            </select>
          </label>

          {!isCreate ? (
            <label className="checkbox-field">
              <input type="checkbox" checked={form.activo} onChange={(event) => update({ activo: event.target.checked })} />
              Profesional activo
            </label>
          ) : null}

          {error ? <p className="evolution-form-error">{error}</p> : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" onClick={() => { void submit() }} disabled={saving}>
            {saving ? 'Guardando...' : isCreate ? 'Crear profesional' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

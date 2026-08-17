import { useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { Profesional, RolUsuario, Usuario, UsuarioInput, UsuarioUpdateInput } from '../types/domain'
import { useModalDismiss } from '../hooks/useModalDismiss'

const ROL_OPTIONS: Array<{ value: RolUsuario; label: string; description: string }> = [
  { value: 'ADMINISTRADOR', label: 'Administrador', description: 'Acceso completo, incluida Configuración.' },
  { value: 'PROFESIONAL', label: 'Profesional', description: 'Atención clínica: sus turnos, pacientes, evoluciones.' },
  { value: 'RECEPCION', label: 'Recepción', description: 'Agenda y pacientes, sin contenido clínico.' },
  { value: 'SUPERVISOR', label: 'Supervisor', description: 'Vista operativa de lectura, sin Configuración.' },
]

type UsuarioFormModalProps = {
  usuario?: Usuario
  profesionalesDisponibles: Profesional[]
  onClose: () => void
  onSaved: (usuario: Usuario) => void
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

type FormState = {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: RolUsuario
  profesionalId: string
  activo: boolean
}

function formFromUsuario(usuario?: Usuario): FormState {
  return {
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    email: usuario?.email ?? '',
    password: '',
    rol: usuario?.rol ?? 'RECEPCION',
    profesionalId: usuario?.profesionalId ? String(usuario.profesionalId) : '',
    activo: usuario?.activo ?? true,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function UsuarioFormModal({ usuario, profesionalesDisponibles, onClose, onSaved, onRequestConfirm }: UsuarioFormModalProps) {
  const isCreate = !usuario
  const [initialForm] = useState(() => formFromUsuario(usuario))
  const [form, setForm] = useState<FormState>(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const requestClose = useModalDismiss({ isDirty, saving, onClose, onRequestConfirm })

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }))

  const submit = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError('Nombre y apellido son obligatorios.')
      return
    }
    if (isCreate && (!form.email.trim() || !form.password)) {
      setError('Email y contraseña temporal son obligatorios para el alta.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (isCreate) {
        const payload: UsuarioInput = {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          email: form.email.trim(),
          password: form.password,
          rol: form.rol,
          profesionalId: form.profesionalId ? Number(form.profesionalId) : null,
        }
        const created = await api.createUsuario(payload)
        onSaved(created)
      } else {
        const payload: UsuarioUpdateInput = {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          rol: form.rol,
          activo: form.activo,
          profesionalId: form.profesionalId ? Number(form.profesionalId) : null,
        }
        const updated = await api.patchUsuario(usuario.id, payload)
        onSaved(updated)
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar el usuario.'))
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
              <h3>{isCreate ? 'Nuevo usuario' : 'Editar usuario'}</h3>
              <p>{isCreate ? 'Alta de una cuenta con acceso al sistema' : `Cuenta de ${usuario.nombre} ${usuario.apellido}`}</p>
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
            Email
            <input type="email" value={form.email} disabled={!isCreate} onChange={(event) => update({ email: event.target.value })} />
          </label>
          {isCreate ? (
            <label>
              Contraseña temporal
              <input type="password" value={form.password} onChange={(event) => update({ password: event.target.value })} placeholder="Mínimo 8 caracteres" />
            </label>
          ) : null}
          <label>
            Rol
            <select value={form.rol} onChange={(event) => update({ rol: event.target.value as RolUsuario })}>
              {ROL_OPTIONS.map((rol) => (
                <option key={rol.value} value={rol.value}>{rol.label}</option>
              ))}
            </select>
          </label>
          <p className="patient-detail-note patient-detail-note--inline">
            {ROL_OPTIONS.find((rol) => rol.value === form.rol)?.description}
          </p>
          <label>
            Profesional vinculado
            <select value={form.profesionalId} onChange={(event) => update({ profesionalId: event.target.value })}>
              <option value="">Sin profesional vinculado</option>
              {profesionalesDisponibles.map((profesional) => (
                <option key={profesional.id} value={profesional.id}>
                  {profesional.nombre} {profesional.apellido}
                  {profesional.matricula ? ` · Mat. ${profesional.matricula}` : ''}
                  {profesional.especialidades?.[0]?.especialidad?.nombre ? ` · ${profesional.especialidades[0].especialidad?.nombre}` : ''}
                </option>
              ))}
            </select>
          </label>
          {form.rol === 'PROFESIONAL' && !form.profesionalId ? (
            <p className="patient-detail-note patient-detail-note--inline">
              Si no elegís un profesional existente, se va a crear uno automáticamente (mismo nombre y apellido) y quedar vinculado a este usuario.
            </p>
          ) : null}
          {!isCreate ? (
            <label className="checkbox-field">
              <input type="checkbox" checked={form.activo} onChange={(event) => update({ activo: event.target.checked })} />
              Usuario activo
            </label>
          ) : null}

          {error ? <p className="evolution-form-error">{error}</p> : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" onClick={() => { void submit() }} disabled={saving}>
            {saving ? 'Guardando...' : isCreate ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

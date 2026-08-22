import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { ObraSocial, Paciente, PacienteInput } from '../types/domain'
import { toDateInputValue } from '../utils/dateFormat'
import { patientFullName } from '../utils/patient'
import AddressAutocompleteInput from './AddressAutocompleteInput'
import DateInput from './DateInput'

type PatientFormModalProps = {
  patient?: Paciente
  canEditObservaciones: boolean
  onClose: () => void
  onSaved: (patient: Paciente) => void
}

type FormState = {
  nombreCompleto: string
  documento: string
  fechaNacimiento: string
  email: string
  telefono: string
  direccion: string
  obraSocialId: string
  numeroAfiliado: string
  observaciones: string
  activo: boolean
}

function formFromPatient(patient?: Paciente): FormState {
  return {
    nombreCompleto: patient ? patientFullName(patient) : '',
    documento: patient?.documento ?? '',
    fechaNacimiento: toDateInputValue(patient?.fechaNacimiento),
    email: patient?.email ?? '',
    telefono: patient?.telefono ?? '',
    direccion: patient?.direccion ?? '',
    obraSocialId: patient?.obraSocialId ? String(patient.obraSocialId) : '',
    numeroAfiliado: patient?.numeroAfiliado ?? '',
    observaciones: patient?.observaciones ?? '',
    activo: patient?.activo ?? true,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function PatientFormModal({ patient, canEditObservaciones, onClose, onSaved }: PatientFormModalProps) {
  const isCreate = !patient
  const [form, setForm] = useState<FormState>(() => formFromPatient(patient))
  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getObrasSociales().then((response) => {
      if (!cancelled) setObrasSociales(response)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }))

  const submit = async () => {
    if (!form.nombreCompleto.trim()) {
      setError('El nombre completo es obligatorio.')
      return
    }

    setSaving(true)
    setError(null)

    const payload: PacienteInput = {
      nombre: form.nombreCompleto.trim(),
      apellido: '',
      documento: form.documento.trim() || null,
      fechaNacimiento: form.fechaNacimiento || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      direccion: form.direccion.trim() || null,
      obraSocialId: form.obraSocialId ? Number(form.obraSocialId) : null,
      numeroAfiliado: form.numeroAfiliado.trim() || null,
    }
    if (!isCreate) {
      payload.activo = form.activo
      if (canEditObservaciones) payload.observaciones = form.observaciones.trim() || null
    }

    try {
      const saved = isCreate ? await api.createPaciente(payload) : await api.patchPaciente(patient.id, payload)
      onSaved(saved)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar el paciente.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-header-title">
            <span className="modal-header-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5Z" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
            </span>
            <div>
              <h3>{isCreate ? 'Nuevo paciente' : 'Editar paciente'}</h3>
              <p>{isCreate ? 'Alta de un paciente en el consultorio' : `Datos administrativos de ${patientFullName(patient)}`}</p>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <label>
            Nombre completo
            <input type="text" value={form.nombreCompleto} onChange={(event) => update({ nombreCompleto: event.target.value })} />
          </label>
          <label>
            Documento
            <input type="text" value={form.documento} onChange={(event) => update({ documento: event.target.value })} />
          </label>
          <label>
            Fecha de nacimiento
            <DateInput value={form.fechaNacimiento} onChange={(fechaNacimiento) => update({ fechaNacimiento })} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => update({ email: event.target.value })} />
          </label>
          <label>
            Teléfono
            <input type="text" value={form.telefono} onChange={(event) => update({ telefono: event.target.value })} />
          </label>
          <label>
            Dirección
            <AddressAutocompleteInput value={form.direccion} onChange={(direccion) => update({ direccion })} />
          </label>
          <label>
            Obra social
            <select value={form.obraSocialId} onChange={(event) => update({ obraSocialId: event.target.value })}>
              <option value="">Particular</option>
              {obrasSociales.map((obraSocial) => (
                <option key={obraSocial.id} value={obraSocial.id}>{obraSocial.nombre}</option>
              ))}
            </select>
          </label>
          <label>
            Número de afiliado
            <input type="text" value={form.numeroAfiliado} onChange={(event) => update({ numeroAfiliado: event.target.value })} />
          </label>
          {!isCreate && canEditObservaciones ? (
            <label>
              Observaciones
              <textarea rows={3} value={form.observaciones} onChange={(event) => update({ observaciones: event.target.value })} />
            </label>
          ) : null}
          {!isCreate ? (
            <label className="checkbox-field">
              <input type="checkbox" checked={form.activo} onChange={(event) => update({ activo: event.target.checked })} />
              Paciente activo
            </label>
          ) : null}

          {error ? <p className="evolution-form-error">{error}</p> : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" onClick={() => { void submit() }} disabled={saving}>
            {saving ? 'Guardando...' : isCreate ? 'Crear paciente' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

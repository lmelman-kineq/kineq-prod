import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { Paciente } from '../types/domain'
import { patientFullName } from '../utils/patient'
import { calculateAge, formatDateOnly } from '../utils/dateFormat'
import KineqLoader from './KineqLoader'

type PatientViewModalProps = {
  patientId: number
  canEditObservaciones: boolean
  canEdit: boolean
  onClose: () => void
  onEdit: (patient: Paciente) => void
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

// Solo lectura: reemplaza el destino directo a "Editar paciente" al hacer
// click en la card de datos del paciente o en "Ver Datos del Paciente" (menú
// "…" de Paciente, click derecho de un turno) — antes ambos abrían el
// formulario editable de una, sin un paso intermedio de solo consulta. El
// lápiz de acá adentro es el único camino hacia PatientFormModal desde este
// modal.
export default function PatientViewModal({ patientId, canEditObservaciones, canEdit, onClose, onEdit }: PatientViewModalProps) {
  const [patient, setPatient] = useState<Paciente | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api.getPaciente(patientId)
      .then((result) => {
        if (!cancelled) setPatient(result)
      })
      .catch((loadError) => {
        if (!cancelled) setError(getErrorMessage(loadError, 'No se pudo cargar el paciente.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  const age = patient ? calculateAge(patient.fechaNacimiento) : null

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-header-title">
            <span className="modal-header-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5Z" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
            </span>
            <div>
              <h3>Datos del paciente</h3>
              <p>{patient ? `Datos administrativos de ${patientFullName(patient)}` : 'Consulta de solo lectura'}</p>
            </div>
          </div>
          <div className="modal-header-actions">
            {canEdit && patient ? (
              <button
                type="button"
                className="modal-icon-button"
                aria-label="Editar paciente"
                title="Editar paciente"
                onClick={() => onEdit(patient)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            ) : null}
            <button type="button" className="close-button" aria-label="Cerrar" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="modal-body">
          {loading ? (
            <KineqLoader size="small" label="Cargando datos del paciente" />
          ) : error ? (
            <p className="evolution-form-error">{error}</p>
          ) : patient ? (
            <div className="details-body patient-view-body">
              <div className="patient-view-field patient-view-field--nombre">
                <p className="details-label">Nombre completo</p>
                <p>{patientFullName(patient)}</p>
              </div>
              <div className="patient-view-field patient-view-field--documento">
                <p className="details-label">Documento</p>
                <p>{patient.documento || '—'}</p>
              </div>
              <div className="patient-view-field patient-view-field--fecha">
                <p className="details-label">Fecha de nacimiento</p>
                <p>{patient.fechaNacimiento ? `${formatDateOnly(patient.fechaNacimiento)}${age !== null ? ` (${age} años)` : ''}` : '—'}</p>
              </div>
              <div className="patient-view-field patient-view-field--email">
                <p className="details-label">Email</p>
                <p>{patient.email || '—'}</p>
              </div>
              <div className="patient-view-field patient-view-field--telefono">
                <p className="details-label">Teléfono</p>
                <p>{patient.telefono || '—'}</p>
              </div>
              <div className="patient-view-field patient-view-field--direccion">
                <p className="details-label">Dirección</p>
                <p>{patient.direccion || '—'}</p>
              </div>
              <div className="patient-view-field patient-view-field--obra-social">
                <p className="details-label">Obra social</p>
                <p>{patient.obraSocial?.nombre ?? 'Particular'}</p>
              </div>
              <div className="patient-view-field patient-view-field--afiliado">
                <p className="details-label">Número de afiliado</p>
                <p>{patient.numeroAfiliado || '—'}</p>
              </div>
              {canEditObservaciones ? (
                <div className="patient-view-field patient-view-field--observaciones">
                  <p className="details-label">Observaciones</p>
                  <p>{patient.observaciones || '—'}</p>
                </div>
              ) : null}
              <div className="patient-view-field patient-view-field--estado">
                <p className="details-label">Estado</p>
                <p>{patient.activo ? 'Activo' : 'Inactivo'}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

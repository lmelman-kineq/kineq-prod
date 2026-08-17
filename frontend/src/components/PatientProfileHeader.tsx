import { useState, type ReactNode } from 'react'
import type { Paciente } from '../types/domain'
import { calculateAge } from '../utils/dateFormat'
import { patientFullName } from '../utils/patient'
import PatientAvatar from './PatientAvatar'

type PatientProfileHeaderProps = {
  patient: Paciente
  socialWorkName?: string | null
  actions?: ReactNode
}

function joinFacts(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

export default function PatientProfileHeader({ patient, socialWorkName, actions }: PatientProfileHeaderProps) {
  const [photoInfoOpen, setPhotoInfoOpen] = useState(false)
  const age = calculateAge(patient.fechaNacimiento)
  const contactLine = joinFacts([patient.email, patient.telefono])
  const metaLine = joinFacts([
    patient.documento ? `DNI ${patient.documento}` : null,
    age !== null ? `${age} años` : null,
    socialWorkName ?? patient.obraSocial?.nombre ?? null,
    patient.numeroAfiliado ? `Afiliado ${patient.numeroAfiliado}` : null,
  ])

  return (
    <header className="patient-profile-header">
      <div className="patient-header-identity">
        <div className="avatar-wrapper">
          <PatientAvatar nombre={patient.nombre} apellido={patient.apellido} size="xl" />
          <button
            type="button"
            className="avatar-edit-button avatar-edit-button--circle"
            aria-label="Foto del paciente"
            title="Foto del paciente"
            onClick={() => setPhotoInfoOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          {photoInfoOpen ? (
            <div className="avatar-edit-popover" role="dialog" aria-label="Foto del paciente">
              <p className="avatar-edit-popover-title">Foto del paciente</p>
              <p>La carga de imágenes estará disponible próximamente.</p>
              <button type="button" className="secondary-button" onClick={() => setPhotoInfoOpen(false)}>Entendido</button>
            </div>
          ) : null}
        </div>
        <div className="patient-profile-info">
          <div className="patient-detail-title-row">
            <h1>{patientFullName(patient)}</h1>
            <span className={`turnos-status-pill ${patient.activo ? 'turnos-status-pill--finalizado' : 'turnos-status-pill--cancelado'}`}>
              {patient.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="patient-profile-contact">{contactLine || 'Sin datos de contacto registrados'}</p>
          <p className="patient-profile-meta">{metaLine || 'Sin documento ni obra social registrados'}</p>
        </div>
      </div>

      {actions ? <div className="patient-profile-actions">{actions}</div> : null}
    </header>
  )
}

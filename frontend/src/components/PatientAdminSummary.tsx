import type { Paciente } from '../types/domain'

type InfoFieldProps = { label: string; value: string | null | undefined; hideIfEmpty?: boolean }

function InfoField({ label, value, hideIfEmpty = false }: InfoFieldProps) {
  if (hideIfEmpty && !value) return null

  return (
    <div className="patient-info-field">
      <p className="details-label">{label}</p>
      <p>{value || '—'}</p>
    </div>
  )
}

type PatientAdminSummaryProps = {
  patient: Paciente
  socialWorkName?: string | null
}

export default function PatientAdminSummary({ patient, socialWorkName }: PatientAdminSummaryProps) {
  return (
    <div className="patient-info-grid">
      <InfoField label="Documento" value={patient.documento} />
      <InfoField label="Teléfono" value={patient.telefono} />
      <InfoField label="Email" value={patient.email} hideIfEmpty />
      <InfoField label="Obra social" value={socialWorkName ?? patient.obraSocial?.nombre} hideIfEmpty />
      <InfoField label="Número de afiliado" value={patient.numeroAfiliado} hideIfEmpty />
    </div>
  )
}

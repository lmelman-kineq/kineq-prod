import { useState } from 'react'
import type { FichaInicial, Turno } from '../types/domain'
import { formatDateOnly } from '../utils/dateFormat'
import { FICHA_COMPLETION_LABELS, type FichaCompletionStatus } from '../utils/fichaInicial'
import { computeAlertasClinicas } from '../utils/clinicalAlerts'
import type { ClinicalNavRequest } from '../utils/clinicalNavTarget'
import ClinicalAlertsDetail from './ClinicalAlertsDetail'

function SummaryCard({ label, value, hint, tone, onClick }: {
  label: string
  value: string
  hint?: string
  tone?: 'ok' | 'activa' | 'pendiente'
  onClick?: () => void
}) {
  const className = `patient-summary-card${tone ? ` patient-summary-card--${tone}` : ''}${onClick ? ' patient-summary-card--clickable' : ''}`
  const content = (
    <>
      <p className="patient-summary-label">{label}</p>
      <strong className="patient-summary-value">{value}</strong>
      {hint ? <span className="patient-summary-hint">{hint}</span> : null}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
        <span className="patient-summary-link">Ver detalle</span>
      </button>
    )
  }
  return <div className={className}>{content}</div>
}

type PatientSummaryCardsProps = {
  turnos: Turno[]
  ficha: FichaInicial | null
  fichaStatus: FichaCompletionStatus
  onGoToFicha: () => void
  onNavigateToTarget: (target: ClinicalNavRequest) => void
}

export default function PatientSummaryCards({ turnos, ficha, fichaStatus, onGoToFicha, onNavigateToTarget }: PatientSummaryCardsProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const sesionesFinalizadas = turnos.filter((turno) => turno.estado === 'FINALIZADO')
  const ultimaAtencion = sesionesFinalizadas
    .slice()
    .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())[0] ?? null

  const alertas = computeAlertasClinicas(ficha)
  const alertaValue = alertas.estado === 'pendiente' ? 'Información pendiente' : alertas.estado === 'sin-alertas' ? 'Sin alertas activas' : `${alertas.total} activa${alertas.total === 1 ? '' : 's'}`
  const alertaHint = alertas.estado === 'activa'
    ? [
        alertas.alergias.length ? `${alertas.alergias.length} alergia${alertas.alergias.length === 1 ? '' : 's'}` : null,
        alertas.antecedentesAlerta.length ? `${alertas.antecedentesAlerta.length} antecedente${alertas.antecedentesAlerta.length === 1 ? '' : 's'}` : null,
        alertas.medicacionAlerta.length ? `${alertas.medicacionAlerta.length} medicación${alertas.medicacionAlerta.length === 1 ? '' : 'es'}` : null,
        alertas.otrasAlertas.length ? `${alertas.otrasAlertas.length} otra${alertas.otrasAlertas.length === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' · ')
    : undefined

  return (
    <section className="patient-summary-grid" aria-label="Resumen del paciente">
      <SummaryCard label="Sesiones realizadas" value={String(sesionesFinalizadas.length)} />
      <SummaryCard label="Última atención" value={ultimaAtencion ? formatDateOnly(ultimaAtencion.inicio) : 'Sin atenciones'} />
      <SummaryCard
        label="Ficha inicial"
        value={FICHA_COMPLETION_LABELS[fichaStatus]}
        tone={fichaStatus === 'completa' ? 'ok' : fichaStatus === 'parcial' ? 'activa' : 'pendiente'}
        onClick={onGoToFicha}
      />
      <SummaryCard
        label="Alertas clínicas"
        value={alertaValue}
        hint={alertaHint}
        tone={alertas.estado === 'sin-alertas' ? 'ok' : alertas.estado}
        onClick={() => setDetailOpen(true)}
      />
      {detailOpen ? (
        <ClinicalAlertsDetail
          alertas={alertas}
          onClose={() => setDetailOpen(false)}
          onNavigate={() => { setDetailOpen(false); onGoToFicha() }}
          onNavigateToTarget={(target) => { setDetailOpen(false); onNavigateToTarget(target) }}
        />
      ) : null}
    </section>
  )
}

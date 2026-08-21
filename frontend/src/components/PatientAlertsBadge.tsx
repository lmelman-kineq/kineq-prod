import { useState } from 'react'
import type { FichaInicial } from '../types/domain'
import { computeAlertasClinicas } from '../utils/clinicalAlerts'
import type { ClinicalNavRequest } from '../utils/clinicalNavTarget'
import ClinicalAlertsDetail from './ClinicalAlertsDetail'

type PatientAlertsBadgeProps = {
  ficha: FichaInicial | null
  onGoToFicha: () => void
  onNavigateToTarget: (target: ClinicalNavRequest) => void
}

// Versión resumida de la vieja card "Alertas clínicas" (antes una de las 4
// cards de PatientSummaryCards, ver esa sección eliminada en
// docs/modules/patients.md) — mismo cálculo (computeAlertasClinicas) y
// mismo popup de detalle (ClinicalAlertsDetail), reutilizados tal cual para
// no duplicar esa lógica. Pensada para vivir junto a "Editar"/"Nuevo turno"
// en el header del paciente, visible de un vistazo sin ocupar una fila
// entera de cards.
export default function PatientAlertsBadge({ ficha, onGoToFicha, onNavigateToTarget }: PatientAlertsBadgeProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const alertas = computeAlertasClinicas(ficha)

  const label = alertas.estado === 'pendiente'
    ? 'Alertas: información pendiente'
    : alertas.estado === 'sin-alertas'
      ? 'Sin alertas clínicas activas'
      : `${alertas.total} alerta${alertas.total === 1 ? '' : 's'} clínica${alertas.total === 1 ? '' : 's'}`

  return (
    <>
      <button
        type="button"
        className={`patient-alerts-badge patient-alerts-badge--${alertas.estado}`}
        onClick={() => setDetailOpen(true)}
        title={label}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l9 16H3l9-16Z" />
          <path d="M12 10v4" />
          <path d="M12 17.5v.01" />
        </svg>
        <span>{alertas.estado === 'activa' ? alertas.total : alertas.estado === 'sin-alertas' ? 'Sin alertas' : 'Pendiente'}</span>
      </button>
      {detailOpen ? (
        <ClinicalAlertsDetail
          alertas={alertas}
          onClose={() => setDetailOpen(false)}
          onNavigate={() => { setDetailOpen(false); onGoToFicha() }}
          onNavigateToTarget={(target) => { setDetailOpen(false); onNavigateToTarget(target) }}
        />
      ) : null}
    </>
  )
}

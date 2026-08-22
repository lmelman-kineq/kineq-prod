import type { FichaInicial } from '../types/domain'
import { computeFichaCompletionStatus } from '../utils/fichaInicial'
import { computeAlertasClinicas } from '../utils/clinicalAlerts'
import type { ClinicalNavRequest } from '../utils/clinicalNavTarget'
import ClinicalAlertsList from './ClinicalAlertsList'

type ClinicalSummaryPanelProps = {
  loading: boolean
  ficha: FichaInicial | null
  fichaForm: Record<string, string>
  onGoToFicha: () => void
  onNavigateToTarget: (target: ClinicalNavRequest) => void
  showNoEvolucionAlert?: boolean
}

// Resumen clínico reducido a alertas — nunca datos administrativos (estado
// de ficha/última evolución/próximo turno, ya visibles en sus propias tabs
// o en la card de datos del paciente). Misma fuente de verdad que
// PatientAlertsBadge/ClinicalAlertsDetail (computeAlertasClinicas) y mismo
// render de items (ClinicalAlertsList), para no divergir del popup.
export default function ClinicalSummaryPanel({
  loading,
  ficha,
  fichaForm,
  onGoToFicha,
  onNavigateToTarget,
  showNoEvolucionAlert = false,
}: ClinicalSummaryPanelProps) {
  if (loading) return <p>Cargando resumen clínico...</p>

  const fichaPendiente = computeFichaCompletionStatus(fichaForm) === 'pendiente'
  const alertas = computeAlertasClinicas(ficha)
  const hasAnyAlert = fichaPendiente || alertas.total > 0 || showNoEvolucionAlert

  return (
    <div className="clinical-summary">
      <p className="details-label">Alertas clínicas</p>
      {!hasAnyAlert ? (
        <p className="patient-detail-note patient-detail-note--inline">Sin alertas clínicas relevantes.</p>
      ) : (
        <div className="antecedentes-list">
          {fichaPendiente ? (
            <button type="button" className="antecedentes-item antecedentes-item--clickable" onClick={onGoToFicha}>
              <div className="antecedentes-item-info">
                <strong>⚠ Ficha inicial pendiente</strong>
                <span>Todavía falta completar información clínica base.</span>
              </div>
            </button>
          ) : null}
          {showNoEvolucionAlert ? (
            <div className="antecedentes-item">
              <div className="antecedentes-item-info">
                <strong>Sin evolución en esta sesión</strong>
              </div>
            </div>
          ) : null}
          <ClinicalAlertsList alertas={alertas} onNavigate={onNavigateToTarget} />
        </div>
      )}

      <button type="button" className="clinical-summary-link" onClick={onGoToFicha}>
        Ir a ficha inicial →
      </button>
    </div>
  )
}

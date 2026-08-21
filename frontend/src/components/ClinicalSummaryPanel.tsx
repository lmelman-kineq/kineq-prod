import type { FichaInicial } from '../types/domain'
import { formatDateTime } from '../utils/dateFormat'
import { FICHA_COMPLETION_LABELS, computeFichaCompletionStatus } from '../utils/fichaInicial'
import { computeAlertasClinicas, groupAntecedentesPositivos } from '../utils/clinicalAlerts'
import AntecedentesSummaryGroups from './AntecedentesSummaryGroups'

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

type ClinicalSummaryPanelProps = {
  loading: boolean
  ficha: FichaInicial | null
  fichaForm: Record<string, string>
  lastEvolucionDate: string | null
  nextTurnoDate?: string | null
  onGoToFicha: () => void
  showNoEvolucionAlert?: boolean
}

export default function ClinicalSummaryPanel({
  loading,
  ficha,
  fichaForm,
  lastEvolucionDate,
  nextTurnoDate,
  onGoToFicha,
  showNoEvolucionAlert = false,
}: ClinicalSummaryPanelProps) {
  if (loading) return <p>Cargando resumen clínico...</p>

  const completionStatus = computeFichaCompletionStatus(fichaForm)
  // Misma fuente de verdad que PatientAlertsBadge (el indicador compacto del
  // header del paciente) y su popup de detalle (ClinicalAlertsDetail) —
  // antes este panel tenía su
  // propio cálculo ad-hoc (solo alergias + "algún antecedente positivo", sin
  // contemplar medicación/otras alertas manuales, y contando cualquier
  // antecedente positivo como alerta aunque no estuviera marcado como tal)
  // que podía divergir del popup real. Bug real encontrado en producción.
  const alertas = computeAlertasClinicas(ficha)
  const alergiasActivas = alertas.alergias
  const hasAlergia = alergiasActivas.length > 0
  const antecedentesGroups = groupAntecedentesPositivos(ficha?.antecedentes)
  const antecedentesRevisado = ficha?.seccionesEstado?.find((s) => s.seccion === 'ANTECEDENTES')?.estado === 'REVISADA'

  return (
    <div className="clinical-summary">
      <div className="clinical-alerts">
        {hasAlergia ? (
          <span className="clinical-alert-badge">
            ⚠ Alergias: {alergiasActivas.map((a) => a.catalogoItem?.nombre ?? a.nombreLibre).join(', ')}
          </span>
        ) : null}
        {completionStatus === 'pendiente' ? <span className="clinical-alert-badge clinical-alert-badge--neutral">Ficha inicial pendiente</span> : null}
        {showNoEvolucionAlert ? (
          <span className="clinical-alert-badge clinical-alert-badge--neutral">Sin evolución en esta sesión</span>
        ) : null}
        {completionStatus !== 'pendiente' && alertas.estado !== 'activa' && !showNoEvolucionAlert ? (
          <span className="clinical-alert-badge clinical-alert-badge--ok">Sin alertas activas</span>
        ) : null}
      </div>

      <div className="patient-info-field clinical-summary-antecedentes">
        <p className="details-label">Antecedentes</p>
        <AntecedentesSummaryGroups groups={antecedentesGroups} seccionRevisada={antecedentesRevisado} />
      </div>

      {/* Grid propio de 2 columnas, separado del resto (alertas/antecedentes/
          link, que ocupan el ancho completo arriba/abajo) — mezclar ítems de
          ancho completo con ítems de a-dos en un mismo grid implícito
          depende de cuántos ítems haya y en qué orden, lo que puede
          "desacomodar" cuál campo queda solo en su fila. Con un grid propio
          solo para estos 3 campos, el acomodo de a-dos es siempre
          predecible sin importar el resto del panel. */}
      <div className="clinical-summary-fields">
        <InfoField label="Estado de ficha inicial" value={FICHA_COMPLETION_LABELS[completionStatus]} />
        <InfoField label="Última evolución" value={lastEvolucionDate ? formatDateTime(lastEvolucionDate) : 'Sin evoluciones'} />
        <InfoField label="Próximo turno" value={nextTurnoDate ? formatDateTime(nextTurnoDate) : 'Sin turnos próximos'} />
      </div>

      <button type="button" className="clinical-summary-link" onClick={onGoToFicha}>
        Ir a ficha inicial →
      </button>
    </div>
  )
}

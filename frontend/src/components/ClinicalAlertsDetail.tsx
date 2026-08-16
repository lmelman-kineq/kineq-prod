import type { AlertasClinicas, AntecedenteCategoria } from '../utils/clinicalAlerts'
import { ELIGIBLE_ALERT_FIELDS } from '../utils/eligibleAlertFields'
import type { ClinicalNavRequest } from '../utils/clinicalNavTarget'

type Props = {
  alertas: AlertasClinicas
  onClose: () => void
  onNavigate: () => void
  onNavigateToTarget: (target: ClinicalNavRequest) => void
}

export default function ClinicalAlertsDetail({ alertas, onClose, onNavigate, onNavigateToTarget }: Props) {
  const { alergias, antecedentesAlerta, medicacionAlerta, otrasAlertas, estado } = alertas

  const goTo = (target: ClinicalNavRequest) => {
    onClose()
    onNavigateToTarget(target)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title"><h3>Alertas clínicas</h3></div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={onClose}>&times;</button>
        </div>

        <div className="clinical-alerts-body">
          {estado === 'pendiente' ? (
            <p className="patient-detail-note">
              Todavía no se relevaron Antecedentes y Seguridad clínica por completo, así que no se puede confirmar que no haya alertas.
            </p>
          ) : estado === 'sin-alertas' ? (
            <p className="patient-detail-note">Sin alertas activas registradas.</p>
          ) : (
            <div className="antecedentes-list">
              {alergias.map((a) => (
                <button
                  key={`alergia-${a.id}`}
                  type="button"
                  className="antecedentes-item antecedentes-item--clickable"
                  onClick={() => goTo({ outerTab: 'ficha', section: 'seguridad', elementId: `alergia-row-${a.id}` })}
                >
                  <div className="antecedentes-item-info">
                    <strong>Alergia · {a.catalogoItem?.nombre ?? a.nombreLibre}</strong>
                    <span>{a.reaccion ? `Reacción: ${a.reaccion}` : 'Origen: ficha inicial · Seguridad clínica'}</span>
                  </div>
                </button>
              ))}
              {antecedentesAlerta.map((a) => (
                <button
                  key={`antecedente-${a.id}`}
                  type="button"
                  className="antecedentes-item antecedentes-item--clickable"
                  onClick={() => goTo({ outerTab: 'ficha', section: 'antecedentes', categoria: a.catalogoItem.categoria as AntecedenteCategoria, elementId: `antecedente-row-${a.id}` })}
                >
                  <div className="antecedentes-item-info">
                    <strong>Antecedente · {a.catalogoItem.nombre}</strong>
                    <span>Origen: ficha inicial · Antecedentes{a.detalle ? ` · ${a.detalle}` : ''}{a.fechaAproximada ? ` · ${a.fechaAproximada.slice(0, 10)}` : ''}</span>
                  </div>
                </button>
              ))}
              {medicacionAlerta.map((m) => (
                <button
                  key={`medicacion-${m.id}`}
                  type="button"
                  className="antecedentes-item antecedentes-item--clickable"
                  onClick={() => goTo({ outerTab: 'ficha', section: 'seguridad', elementId: `medicacion-row-${m.id}` })}
                >
                  <div className="antecedentes-item-info">
                    <strong>Medicación · {m.nombre}</strong>
                    <span>Origen: ficha inicial · Seguridad clínica{m.motivo ? ` · ${m.motivo}` : ''}</span>
                  </div>
                </button>
              ))}
              {otrasAlertas.map((a) => {
                const field = ELIGIBLE_ALERT_FIELDS[a.campo]
                const contenido = a.valor?.trim()
                return (
                  <button
                    key={`campo-${a.id}`}
                    type="button"
                    className="antecedentes-item antecedentes-item--clickable"
                    onClick={() => goTo({ outerTab: field?.outerTab ?? 'ficha', section: field?.section, elementId: `ficha-field-${a.campo}` })}
                  >
                    <div className="antecedentes-item-info">
                      <strong>{field?.label ?? a.campo}</strong>
                      <span className={contenido ? 'alert-field-preview' : undefined}>
                        {contenido || 'Marcada manualmente por el profesional'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button type="button" className="clinical-summary-link" onClick={onNavigate}>
          Ir a ficha inicial →
        </button>
      </div>
    </div>
  )
}

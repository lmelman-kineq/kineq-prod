import { useState } from 'react'
import type { AntecedenteGroup } from '../utils/clinicalAlerts'

const MAX_PER_GROUP = 3

type Props = {
  groups: AntecedenteGroup[]
  // Distingue "todavía no se revisó Antecedentes" de "se revisó y no hay
  // nada cargado" — nunca se conflacionan (pedido explícito del usuario).
  seccionRevisada: boolean
}

export default function AntecedentesSummaryGroups({ groups, seccionRevisada }: Props) {
  const [openGroup, setOpenGroup] = useState<AntecedenteGroup | null>(null)

  if (groups.length === 0) {
    return <p>{seccionRevisada ? 'Sin registros.' : 'No relevados.'}</p>
  }

  return (
    <div className="antecedentes-summary-groups">
      {groups.map((group) => (
        <div key={group.key} className="antecedentes-summary-group">
          <strong>{group.label}</strong>
          <div className="antecedentes-summary-chips">
            {group.items.slice(0, MAX_PER_GROUP).map((item) => (
              <span
                key={item.id}
                className={`antecedentes-summary-chip${item.esAlertaClinica ? ' antecedentes-summary-chip--alerta' : ''}`}
              >
                {item.catalogoItem.nombre}
              </span>
            ))}
            {group.items.length > MAX_PER_GROUP ? (
              <button type="button" className="antecedentes-summary-more" onClick={() => setOpenGroup(group)}>
                +{group.items.length - MAX_PER_GROUP} más
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {openGroup ? (
        <div className="modal-overlay" onClick={() => setOpenGroup(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title"><h3>{openGroup.label}</h3></div>
              <button type="button" className="close-button" aria-label="Cerrar" onClick={() => setOpenGroup(null)}>&times;</button>
            </div>
            <div className="antecedentes-list">
              {openGroup.items.map((item) => (
                <div key={item.id} className="antecedentes-item">
                  <div className="antecedentes-item-info">
                    <strong>
                      {item.catalogoItem.nombre}
                      {item.esAlertaClinica ? <span className="clinical-alert-flag" title="Alerta clínica"> ⚠</span> : null}
                    </strong>
                    <span>
                      {[
                        item.parentesco,
                        item.detalle,
                        item.edadAproximada != null ? `${item.edadAproximada} años` : null,
                        item.fechaAproximada ? item.fechaAproximada.slice(0, 10) : null,
                      ].filter(Boolean).join(' · ') || 'Sin detalle'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

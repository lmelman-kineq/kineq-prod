import type { AlertasClinicas, AntecedenteCategoria } from '../utils/clinicalAlerts'
import { ELIGIBLE_ALERT_FIELDS } from '../utils/eligibleAlertFields'
import type { ClinicalNavRequest } from '../utils/clinicalNavTarget'

type Props = {
  alertas: AlertasClinicas
  onNavigate: (target: ClinicalNavRequest) => void
}

// Forma adjetiva singular para el título de la alerta ("Antecedente
// personal · X") — distinta de ANTECEDENTE_CATEGORIA_LABELS (plural, usada
// como encabezado de categoría en la tab Ficha inicial).
const ANTECEDENTE_CATEGORIA_ADJETIVO: Record<AntecedenteCategoria, string> = {
  ANTECEDENTE_PERSONAL: 'personal',
  ANTECEDENTE_FAMILIAR: 'familiar',
  PROCEDIMIENTO_QUIRURGICO: 'quirúrgico',
}

// Lista de alertas clínicas activas (alergias, antecedentes/medicación
// marcados, campos libres alertados) — mismo criterio y misma UI en el
// popup de detalle (ClinicalAlertsDetail) y en la card de Resumen clínico
// del paciente (ClinicalSummaryPanel), para no duplicar este render en dos
// lugares. Asume `alertas.total > 0` — el caller decide qué mostrar cuando
// no hay nada (los mensajes de "sin alertas"/"pendiente" difieren según
// contexto, así que quedan afuera de este componente).
export default function ClinicalAlertsList({ alertas, onNavigate }: Props) {
  const { alergias, antecedentesAlerta, medicacionAlerta, otrasAlertas } = alertas

  return (
    <div className="antecedentes-list">
      {alergias.map((a) => (
        <button
          key={`alergia-${a.id}`}
          type="button"
          className="antecedentes-item antecedentes-item--clickable"
          onClick={() => onNavigate({ outerTab: 'ficha', section: 'seguridad', elementId: `alergia-row-${a.id}` })}
        >
          <div className="antecedentes-item-info">
            <strong>Alergia · {a.catalogoItem?.nombre ?? a.nombreLibre}</strong>
            {a.reaccion ? <span>Reacción: {a.reaccion}</span> : null}
          </div>
        </button>
      ))}
      {antecedentesAlerta.map((a) => {
        const categoria = a.catalogoItem.categoria as AntecedenteCategoria
        const detalle = [a.detalle, a.fechaAproximada ? a.fechaAproximada.slice(0, 10) : null].filter(Boolean).join(' · ')
        return (
          <button
            key={`antecedente-${a.id}`}
            type="button"
            className="antecedentes-item antecedentes-item--clickable"
            onClick={() => onNavigate({ outerTab: 'ficha', section: 'antecedentes', categoria, elementId: `antecedente-row-${a.id}` })}
          >
            <div className="antecedentes-item-info">
              <strong>Antecedente {ANTECEDENTE_CATEGORIA_ADJETIVO[categoria]} · {a.catalogoItem.nombre}</strong>
              {detalle ? <span>{detalle}</span> : null}
            </div>
          </button>
        )
      })}
      {medicacionAlerta.map((m) => (
        <button
          key={`medicacion-${m.id}`}
          type="button"
          className="antecedentes-item antecedentes-item--clickable"
          onClick={() => onNavigate({ outerTab: 'ficha', section: 'seguridad', elementId: `medicacion-row-${m.id}` })}
        >
          <div className="antecedentes-item-info">
            <strong>Medicación · {m.nombre}</strong>
            {m.motivo ? <span>{m.motivo}</span> : null}
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
            onClick={() => onNavigate({ outerTab: field?.outerTab ?? 'ficha', section: field?.section, elementId: `ficha-field-${a.campo}` })}
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
  )
}

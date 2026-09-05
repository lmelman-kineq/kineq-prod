import { useEffect, useRef, useState } from 'react'
import { WEEKDAYS_MONDAY_FIRST, weekdayShortLabel, weekdayFullLabel, type CustomRecurrenceConfig, type CustomRecurrenceUnit } from '../utils/recurrence'

type CustomRecurrenceModalProps = {
  startDate: string
  initialConfig: CustomRecurrenceConfig | null
  initialCount: number
  onCancel: () => void
  onConfirm: (config: CustomRecurrenceConfig, cantidadSesiones: number) => void
}

const UNIT_LABELS: Record<CustomRecurrenceUnit, [string, string]> = {
  DIA: ['día', 'días'],
  SEMANA: ['semana', 'semanas'],
  MES: ['mes', 'meses'],
  ANIO: ['año', 'años'],
}

/**
 * "Recurrencia personalizada" (referencia conceptual: Google Calendar, sin
 * copiarlo literalmente) — intervalo + unidad + días de semana (solo con
 * unidad semana) + Cantidad de sesiones, que sigue siendo el único límite
 * de la serie (nunca "Finaliza: Nunca/El/Después de X" de Google Calendar).
 * "Listo" solo valida y devuelve la configuración al quick-create — no crea
 * turnos todavía, eso pasa recién en "Guardar turno".
 */
export default function CustomRecurrenceModal({ startDate, initialConfig, initialCount, onCancel, onConfirm }: CustomRecurrenceModalProps) {
  const startWeekday = new Date(`${startDate}T00:00:00Z`).getUTCDay()
  const [intervalo, setIntervalo] = useState(initialConfig?.intervalo ?? 1)
  const [unidad, setUnidad] = useState<CustomRecurrenceUnit>(initialConfig?.unidad ?? 'SEMANA')
  const [diasSemana, setDiasSemana] = useState<number[]>(initialConfig?.diasSemana?.length ? initialConfig.diasSemana : [startWeekday])
  const [cantidad, setCantidad] = useState(Math.max(2, initialCount || 2))

  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onCancel])

  const toggleDia = (weekday: number) => {
    setDiasSemana((current) => {
      if (current.includes(weekday)) {
        // Mínimo 1 día seleccionado — no se permite vaciar la selección.
        if (current.length === 1) return current
        return current.filter((d) => d !== weekday)
      }
      return [...current, weekday]
    })
  }

  const canConfirm = Number.isInteger(intervalo) && intervalo >= 1
    && Number.isInteger(cantidad) && cantidad >= 2 && cantidad <= 60
    && (unidad !== 'SEMANA' || diasSemana.length >= 1)

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(
      unidad === 'SEMANA' ? { intervalo, unidad, diasSemana } : { intervalo, unidad },
      cantidad,
    )
  }

  const unitLabel = (unit: CustomRecurrenceUnit) => (intervalo === 1 ? UNIT_LABELS[unit][0] : UNIT_LABELS[unit][1])

  return (
    <div className="modal-overlay confirm-dialog-overlay">
      <div className="custom-recurrence-modal" ref={modalRef}>
        <h3>Recurrencia personalizada</h3>

        <div className="modal-body custom-recurrence-body">
          <div className="custom-recurrence-field">
            <label htmlFor="custom-recurrence-intervalo">Repetir cada</label>
            <div className="custom-recurrence-interval-row">
              <input
                id="custom-recurrence-intervalo"
                className="custom-recurrence-intervalo-input"
                type="number"
                min={1}
                value={intervalo}
                onChange={(event) => setIntervalo(Math.max(1, Number(event.target.value) || 1))}
              />
              <span className="select-chevron-wrap">
                <select value={unidad} onChange={(event) => setUnidad(event.target.value as CustomRecurrenceUnit)}>
                  <option value="DIA">{unitLabel('DIA')}</option>
                  <option value="SEMANA">{unitLabel('SEMANA')}</option>
                  <option value="MES">{unitLabel('MES')}</option>
                  <option value="ANIO">{unitLabel('ANIO')}</option>
                </select>
              </span>
            </div>
          </div>

          {unidad === 'SEMANA' ? (
            <div className="custom-recurrence-field">
              <span className="custom-recurrence-field-label">Repetir el</span>
              <div className="custom-recurrence-weekdays" role="group" aria-label="Días de la semana">
                {WEEKDAYS_MONDAY_FIRST.map((weekday) => (
                  <button
                    key={weekday}
                    type="button"
                    aria-pressed={diasSemana.includes(weekday)}
                    aria-label={weekdayFullLabel(weekday)}
                    className={`weekday-chip ${diasSemana.includes(weekday) ? 'weekday-chip--active' : ''}`}
                    onClick={() => toggleDia(weekday)}
                  >
                    {weekdayShortLabel(weekday)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="custom-recurrence-field">
            Cantidad de sesiones
            <input
              type="number"
              min={2}
              max={60}
              value={cantidad}
              onChange={(event) => setCantidad(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="confirm-dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
          <button type="button" className="primary-button" disabled={!canConfirm} onClick={handleConfirm}>Listo</button>
        </div>
      </div>
    </div>
  )
}

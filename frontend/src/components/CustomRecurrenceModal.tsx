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
  // `'' ` es un estado transitorio válido mientras se escribe (permite
  // borrar el campo para reemplazarlo) — nunca se persiste así: `canConfirm`
  // ya exige `Number.isInteger(...)`, que da `false` para `''`, y el blur de
  // cada campo lo repone a un valor válido si se queda vacío.
  const [intervalo, setIntervalo] = useState<number | ''>(initialConfig?.intervalo ?? 1)
  const [unidad, setUnidad] = useState<CustomRecurrenceUnit>(initialConfig?.unidad ?? 'SEMANA')
  const [diasSemana, setDiasSemana] = useState<number[]>(initialConfig?.diasSemana?.length ? initialConfig.diasSemana : [startWeekday])
  const [cantidad, setCantidad] = useState<number | ''>(Math.max(2, initialCount || 2))

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

  const canConfirm = intervalo !== '' && Number.isInteger(intervalo) && intervalo >= 1
    && cantidad !== '' && Number.isInteger(cantidad) && cantidad >= 2 && cantidad <= 60
    && (unidad !== 'SEMANA' || diasSemana.length >= 1)

  const handleConfirm = () => {
    if (!canConfirm) return
    // `canConfirm` ya garantiza que ambos son enteros válidos acá — el
    // `Number(...)` es solo para que TypeScript vea `number`, no `number | ''`
    // (ese `''` es un estado transitorio de los inputs mientras se escribe).
    const intervaloValido = Number(intervalo)
    const cantidadValida = Number(cantidad)
    onConfirm(
      unidad === 'SEMANA' ? { intervalo: intervaloValido, unidad, diasSemana } : { intervalo: intervaloValido, unidad },
      cantidadValida,
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
                onChange={(event) => {
                  const raw = event.target.value
                  setIntervalo(raw === '' ? '' : Number(raw))
                }}
                onBlur={() => setIntervalo((current) => (current === '' || current < 1 ? 1 : current))}
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
              onChange={(event) => {
                const raw = event.target.value
                setCantidad(raw === '' ? '' : Number(raw))
              }}
              onBlur={() => setCantidad((current) => (current === '' || current < 2 ? 2 : current > 60 ? 60 : current))}
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

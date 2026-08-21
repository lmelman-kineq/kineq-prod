import type { Turno } from '../types/domain'
import { formatDateOnly, formatTimeOnly } from '../utils/dateFormat'
import { professionalName } from '../utils/professional'
import { mapEstadoToStatus, statusClass } from '../utils/turnoStatus'

type PatientAppointmentsTableProps = {
  turnos: Turno[]
  onEditTurno?: (turno: Turno) => void
}

function formatMonto(monto: number | null | undefined): string {
  if (monto == null) return '—'
  return `$${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PatientAppointmentsTable({ turnos, onEditTurno }: PatientAppointmentsTableProps) {
  if (turnos.length === 0) {
    return (
      <div className="turnos-table-message">
        <strong>Sin turnos registrados.</strong>
        <span>Los turnos del paciente van a aparecer acá.</span>
      </div>
    )
  }

  const sorted = [...turnos].sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())

  return (
    <div className="turnos-table-scroll">
      <table className="turnos-table patient-turnos-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Profesional</th>
            <th>Especialidad</th>
            <th>Sesión</th>
            <th>Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((turno) => (
            <tr
              key={turno.id}
              tabIndex={onEditTurno ? 0 : undefined}
              onClick={() => onEditTurno?.(turno)}
              onKeyDown={(event) => {
                if (onEditTurno && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  onEditTurno(turno)
                }
              }}
            >
              <td>
                <strong>{formatDateOnly(turno.inicio)}</strong>
                <small>{formatTimeOnly(turno.inicio)}</small>
              </td>
              <td data-label="Profesional" className="patient-turnos-cell-truncate" title={professionalName(turno.profesional)}>
                {professionalName(turno.profesional)}
              </td>
              <td data-label="Especialidad" className="patient-turnos-cell-truncate" title={turno.especialidad?.nombre ?? '—'}>
                <span className="turnos-specialty-cell">
                  <span className="turnos-specialty-dot" style={{ backgroundColor: turno.especialidad?.color }} />
                  {turno.especialidad?.nombre ?? '—'}
                </span>
              </td>
              <td data-label="Sesión">{turno.numeroSesion ?? '—'}</td>
              <td data-label="Monto">{formatMonto(turno.monto)}</td>
              <td data-label="Estado">
                <span className={`turnos-status-pill turnos-status-pill--${statusClass(mapEstadoToStatus(turno.estado))}`}>
                  {mapEstadoToStatus(turno.estado)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

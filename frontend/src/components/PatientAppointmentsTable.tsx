import type { Turno } from '../types/domain'
import { formatDateOnly, formatTimeOnly } from '../utils/dateFormat'
import { professionalName } from '../utils/professional'
import { mapEstadoToStatus, statusClass } from '../utils/turnoStatus'

type PatientAppointmentsTableProps = {
  turnos: Turno[]
}

export default function PatientAppointmentsTable({ turnos }: PatientAppointmentsTableProps) {
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
      <table className="turnos-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Profesional</th>
            <th>Especialidad</th>
            <th>Nro. de Sesión</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((turno) => (
            <tr key={turno.id}>
              <td>{formatDateOnly(turno.inicio)}</td>
              <td data-label="Hora">{formatTimeOnly(turno.inicio)}</td>
              <td data-label="Profesional">{professionalName(turno.profesional)}</td>
              <td data-label="Especialidad">
                <span className="turnos-specialty-cell">
                  <span className="turnos-specialty-dot" style={{ backgroundColor: turno.especialidad?.color }} />
                  {turno.especialidad?.nombre ?? '—'}
                </span>
              </td>
              <td data-label="Nro. de Sesión">{turno.numeroSesion ?? '—'}</td>
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

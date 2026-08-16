import type { TurnoStatus } from '../components/FormFields'
import type { EstadoTurno } from '../types/domain'

export function statusClass(status: TurnoStatus): string {
  return status.toLowerCase().replaceAll(' ', '-').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const ESTADO_TO_STATUS: Record<string, TurnoStatus> = {
  ASIGNADO: 'Asignado',
  EN_ESPERA: 'En Espera',
  ATENDIENDO: 'Atendiendo',
  FINALIZADO: 'Finalizado',
  AUSENTE: 'Ausente',
  CANCELADO: 'Cancelado',
}

export function mapEstadoToStatus(estado: EstadoTurno | string): TurnoStatus {
  return ESTADO_TO_STATUS[String(estado)] ?? 'Asignado'
}

// "Prioridad de atención": menor valor = aparece primero. Centralizado acá
// para no dispersar el criterio de orden en distintas pantallas.
export const STATUS_PRIORITY: Record<TurnoStatus, number> = {
  'En Espera': 0,
  'Atendiendo': 1,
  'Asignado': 2,
  'Cancelado': 3,
  'Ausente': 4,
  'Finalizado': 5,
}

export type PriorityComparable = {
  status: TurnoStatus
  /** Fecha/hora programada del turno, en ms. */
  appointmentTimestamp: number
  /** Momento en que ingresó a la sala de espera, en ms. Si falta, se usa `appointmentTimestamp`. */
  waitingSinceTimestamp?: number
  /** Momento en que arrancó la atención, en ms. Si falta, se usa `appointmentTimestamp`. */
  attendingSinceTimestamp?: number
}

/**
 * Orden de "Prioridad de atención":
 * En Espera (mayor espera primero) → Atendiendo (quien empezó antes primero)
 * → Asignado (horario más próximo primero) → Cancelado → Ausente → Finalizado
 * (estos tres últimos, más recientes primero).
 */
export function compareByAttentionPriority(a: PriorityComparable, b: PriorityComparable): number {
  const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
  if (priorityDiff !== 0) return priorityDiff

  if (a.status === 'En Espera') {
    return (a.waitingSinceTimestamp ?? a.appointmentTimestamp) - (b.waitingSinceTimestamp ?? b.appointmentTimestamp)
  }

  if (a.status === 'Atendiendo') {
    return (a.attendingSinceTimestamp ?? a.appointmentTimestamp) - (b.attendingSinceTimestamp ?? b.appointmentTimestamp)
  }

  if (a.status === 'Asignado') {
    return a.appointmentTimestamp - b.appointmentTimestamp
  }

  // Cancelado / Ausente / Finalizado: mismo criterio estable ya usado antes
  // de este cambio (turno más reciente primero dentro del grupo).
  return b.appointmentTimestamp - a.appointmentTimestamp
}

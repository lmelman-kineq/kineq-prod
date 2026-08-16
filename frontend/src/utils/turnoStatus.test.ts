import { describe, it, expect } from 'vitest'
import { compareByAttentionPriority, type PriorityComparable } from './turnoStatus'

function item(overrides: Partial<PriorityComparable> & Pick<PriorityComparable, 'status'>): PriorityComparable {
  return { appointmentTimestamp: 0, ...overrides }
}

describe('compareByAttentionPriority', () => {
  it('ordena los seis estados según la prioridad de atención', () => {
    const items: PriorityComparable[] = [
      item({ status: 'Finalizado', appointmentTimestamp: 1 }),
      item({ status: 'Ausente', appointmentTimestamp: 1 }),
      item({ status: 'Cancelado', appointmentTimestamp: 1 }),
      item({ status: 'Asignado', appointmentTimestamp: 1 }),
      item({ status: 'Atendiendo', appointmentTimestamp: 1 }),
      item({ status: 'En Espera', appointmentTimestamp: 1 }),
    ]

    const sorted = [...items].sort(compareByAttentionPriority).map((i) => i.status)

    expect(sorted).toEqual(['En Espera', 'Atendiendo', 'Asignado', 'Cancelado', 'Ausente', 'Finalizado'])
  })

  it('entre dos En Espera, ordena primero al que espera hace más tiempo', () => {
    const wentInFirst = item({ status: 'En Espera', waitingSinceTimestamp: 1000 })
    const wentInLater = item({ status: 'En Espera', waitingSinceTimestamp: 5000 })

    expect(compareByAttentionPriority(wentInFirst, wentInLater)).toBeLessThan(0)
    expect(compareByAttentionPriority(wentInLater, wentInFirst)).toBeGreaterThan(0)
  })

  it('entre dos Asignado, ordena primero el horario más próximo', () => {
    const sooner = item({ status: 'Asignado', appointmentTimestamp: 1000 })
    const later = item({ status: 'Asignado', appointmentTimestamp: 5000 })

    expect(compareByAttentionPriority(sooner, later)).toBeLessThan(0)
    expect(compareByAttentionPriority(later, sooner)).toBeGreaterThan(0)
  })

  it('entre dos Atendiendo, ordena primero a quien empezó a atender antes', () => {
    const startedFirst = item({ status: 'Atendiendo', attendingSinceTimestamp: 1000 })
    const startedLater = item({ status: 'Atendiendo', attendingSinceTimestamp: 5000 })

    expect(compareByAttentionPriority(startedFirst, startedLater)).toBeLessThan(0)
  })

  it('cancelados aparecen antes que finalizados', () => {
    const cancelado = item({ status: 'Cancelado', appointmentTimestamp: 1000 })
    const finalizado = item({ status: 'Finalizado', appointmentTimestamp: 1000 })

    expect(compareByAttentionPriority(cancelado, finalizado)).toBeLessThan(0)
  })

  it('usa appointmentTimestamp como fallback si falta el timestamp específico del estado', () => {
    const a = item({ status: 'En Espera', appointmentTimestamp: 1000 })
    const b = item({ status: 'En Espera', appointmentTimestamp: 2000 })

    expect(compareByAttentionPriority(a, b)).toBeLessThan(0)
  })
})

import { describe, expect, it } from 'vitest'
import type { Evolucion } from '../types/domain'
import { inicioPackIds } from './packsEvoluciones'

function ev(id: number, fecha: string, grupoId: number | null): Evolucion {
  return { id, consultorioId: 1, pacienteId: 1, profesionalId: 1, grupoId, contenido: '', createdAt: `${fecha}T12:00:00Z`, updatedAt: `${fecha}T12:00:00Z` }
}

describe('inicioPackIds', () => {
  it('marca la primera de cada diagnóstico y la primera tras un hueco largo', () => {
    const evoluciones = [
      ev(1, '2026-01-10', 1),
      ev(2, '2026-01-17', 1),
      ev(3, '2026-01-20', 2), // otro diagnóstico
      ev(4, '2026-07-01', 1), // vuelve con lumbalgia 5 meses después
      ev(5, '2026-07-08', 1),
      ev(6, '2026-07-09', null),
    ]
    expect([...inicioPackIds(evoluciones, 60)].sort()).toEqual([1, 3, 4, 6])
  })

  it('no depende del orden de entrada (la tabla viene más reciente primero)', () => {
    const evoluciones = [ev(2, '2026-01-17', 1), ev(1, '2026-01-10', 1)]
    expect([...inicioPackIds(evoluciones, 60)]).toEqual([1])
  })
})

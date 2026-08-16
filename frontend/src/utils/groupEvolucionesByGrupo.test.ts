import { describe, it, expect } from 'vitest'
import { groupEvolucionesByGrupo } from './groupEvolucionesByGrupo'
import type { Evolucion, GrupoEvolucion } from '../types/domain'

function grupo(id: number, nombre: string): GrupoEvolucion {
  return { id, consultorioId: 1, pacienteId: 1, nombre, color: 'var(--appointment-purple)', createdAt: '', updatedAt: '' }
}

function evolucion(id: number, overrides: Partial<Evolucion> = {}): Evolucion {
  return { id, consultorioId: 1, pacienteId: 1, profesionalId: 1, contenido: `evolución ${id}`, createdAt: '', updatedAt: '', ...overrides }
}

describe('groupEvolucionesByGrupo', () => {
  it('agrupa evoluciones por grupo, preservando el orden interno (ya viene ordenado por fecha)', () => {
    const lumbalgia = grupo(1, 'Lumbalgia')
    const { secciones } = groupEvolucionesByGrupo([
      evolucion(3, { grupo: lumbalgia }),
      evolucion(2, { grupo: lumbalgia }),
      evolucion(1, { grupo: lumbalgia }),
    ])
    expect(secciones).toHaveLength(1)
    expect(secciones[0].grupo.nombre).toBe('Lumbalgia')
    expect(secciones[0].items.map((e) => e.id)).toEqual([3, 2, 1])
  })

  it('evoluciones sin grupo van a "sinGrupo", no a una sección', () => {
    const { secciones, sinGrupo } = groupEvolucionesByGrupo([evolucion(1), evolucion(2)])
    expect(secciones).toHaveLength(0)
    expect(sinGrupo.map((e) => e.id)).toEqual([1, 2])
  })

  it('separa correctamente varios grupos distintos, cada uno con sus propias evoluciones', () => {
    const lumbalgia = grupo(1, 'Lumbalgia')
    const tobillo = grupo(2, 'Lesión de tobillo')
    const { secciones, sinGrupo } = groupEvolucionesByGrupo([
      evolucion(4, { grupo: lumbalgia }),
      evolucion(3, { grupo: tobillo }),
      evolucion(2), // sin grupo
      evolucion(1, { grupo: lumbalgia }),
    ])

    expect(secciones.map((s) => s.grupo.nombre)).toEqual(['Lumbalgia', 'Lesión de tobillo'])
    expect(secciones.find((s) => s.grupo.id === 1)!.items.map((e) => e.id)).toEqual([4, 1])
    expect(secciones.find((s) => s.grupo.id === 2)!.items.map((e) => e.id)).toEqual([3])
    expect(sinGrupo.map((e) => e.id)).toEqual([2])
  })

  it('el primer grupo en aparecer (evolución más reciente) queda primero', () => {
    const antiguo = grupo(1, 'Grupo antiguo')
    const reciente = grupo(2, 'Grupo reciente')
    // Ya viene ordenado más reciente primero: la evolución de "reciente" aparece antes.
    const { secciones } = groupEvolucionesByGrupo([
      evolucion(2, { grupo: reciente }),
      evolucion(1, { grupo: antiguo }),
    ])
    expect(secciones.map((s) => s.grupo.id)).toEqual([2, 1])
  })

  it('lista vacía no rompe', () => {
    expect(groupEvolucionesByGrupo([])).toEqual({ secciones: [], sinGrupo: [] })
  })
})

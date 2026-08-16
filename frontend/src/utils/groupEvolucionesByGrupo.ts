import type { Evolucion, GrupoEvolucion } from '../types/domain'

export type EvolucionesPorGrupo = {
  secciones: Array<{ grupo: GrupoEvolucion; items: Evolucion[] }>
  sinGrupo: Evolucion[]
}

/**
 * Agrupa evoluciones (ya ordenadas, más reciente primero) por su grupo —
 * "Ver por grupo" en la tab de Evoluciones. Los grupos aparecen en el orden
 * en que se los encuentra recorriendo la lista (el grupo con la evolución
 * más reciente queda primero), preservando el orden interno de cada grupo.
 */
export function groupEvolucionesByGrupo(evolucionesOrdenadas: Evolucion[]): EvolucionesPorGrupo {
  const porGrupoId = new Map<number, { grupo: GrupoEvolucion; items: Evolucion[] }>()
  const sinGrupo: Evolucion[] = []

  for (const ev of evolucionesOrdenadas) {
    if (ev.grupo) {
      const entry = porGrupoId.get(ev.grupo.id) ?? { grupo: ev.grupo, items: [] }
      entry.items.push(ev)
      porGrupoId.set(ev.grupo.id, entry)
    } else {
      sinGrupo.push(ev)
    }
  }

  return { secciones: Array.from(porGrupoId.values()), sinGrupo }
}

import type { Evolucion } from '../types/domain'

const MS_POR_DIA = 24 * 60 * 60 * 1000

export function esEvolucionDeConsulta(evolucion: Evolucion): boolean {
  return evolucion.turno?.esSesionConsulta === true
}

/**
 * Ids de las evoluciones que abren un pack de sesiones: la primera de cada
 * diagnóstico ("sin diagnóstico" cuenta como uno más), o la primera después
 * de un hueco mayor a `diasCortePack` días sin evoluciones de ese mismo
 * diagnóstico. Mismo criterio que la numeración de turnos del backend
 * (backend/src/sesionesPack.ts), aplicado a la fecha de cada evolución: las
 * de una sesión de consulta no abren ni continúan un pack (se marcan aparte,
 * ver esEvolucionDeConsulta).
 */
export function inicioPackIds(evoluciones: Evolucion[], diasCortePack: number): Set<number> {
  const ordenadas = [...evoluciones].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const ultimaPorGrupo = new Map<number | null, number>()
  const inicios = new Set<number>()

  for (const evolucion of ordenadas) {
    if (esEvolucionDeConsulta(evolucion)) continue
    const grupo = evolucion.grupoId ?? null
    const fecha = new Date(evolucion.createdAt).getTime()
    const previa = ultimaPorGrupo.get(grupo)
    if (previa === undefined || fecha - previa > diasCortePack * MS_POR_DIA) inicios.add(evolucion.id)
    ultimaPorGrupo.set(grupo, fecha)
  }

  return inicios
}

import type { Evolucion } from '../types/domain'

const MS_POR_DIA = 24 * 60 * 60 * 1000

export function esEvolucionDeConsulta(evolucion: Evolucion): boolean {
  return evolucion.turno?.esSesionConsulta === true
}

/**
 * Ids de las evoluciones que abren un módulo (pack) de sesiones.
 *
 * - Con turno: la del turno que es la sesión 1 — la numeración del backend
 *   (backend/src/sesionesPack.ts) ya resolvió el corte, incluida la marca
 *   manual "Comienzo de módulo", así que acá no se vuelve a adivinar.
 * - Sin turno (cargada suelta): misma regla automática que el backend,
 *   aplicada a su fecha — la primera de su diagnóstico ("sin diagnóstico"
 *   cuenta como uno más) o la primera después de más de `diasCortePack`
 *   días sin evoluciones de ese diagnóstico.
 * - De una sesión de consulta: nunca (se marca aparte, ver
 *   esEvolucionDeConsulta) y no cuenta para el hueco.
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
    const esInicio = evolucion.turno
      ? evolucion.turno.numeroSesion === 1
      : previa === undefined || fecha - previa > diasCortePack * MS_POR_DIA
    if (esInicio) inicios.add(evolucion.id)
    ultimaPorGrupo.set(grupo, fecha)
  }

  return inicios
}

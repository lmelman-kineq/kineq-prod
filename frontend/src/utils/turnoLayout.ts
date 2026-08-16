export type TurnoLayoutInput = {
  id: number
  startMinutes: number
  endMinutes: number
}

export type TurnoLayoutResult = {
  id: number
  column: number
  columns: number
}

/**
 * Distribuye turnos superpuestos en columnas (estilo agenda diaria de
 * Google Calendar, sin copiar su estética): turnos que se solapan comparten
 * el ancho disponible en vez de taparse. Usa intervalos semiabiertos
 * [inicio, fin) — un turno que termina a las 10:00 no se considera superpuesto
 * con uno que empieza a las 10:00.
 *
 * No hace "widening" de columnas liberadas (a diferencia de Google Calendar
 * real): cada turno de un grupo de colisión ocupa 1/N del ancho, con N la
 * concurrencia máxima del grupo. Suficiente para los casos pedidos sin la
 * complejidad extra de un layout dinámico.
 */
export function layoutTurnos(turnos: TurnoLayoutInput[]): Map<number, TurnoLayoutResult> {
  const sorted = [...turnos].sort((a, b) => (
    a.startMinutes - b.startMinutes ||
    b.endMinutes - a.endMinutes ||
    a.id - b.id
  ))

  const results = new Map<number, TurnoLayoutResult>()

  let cluster: TurnoLayoutInput[] = []
  let clusterEnd = -Infinity

  function flushCluster() {
    if (cluster.length === 0) return

    // Asignación greedy: cada turno va a la primera columna cuyo último
    // turno ya terminó (en el sentido semiabierto); si ninguna está libre,
    // abre una columna nueva. Es el algoritmo clásico de coloreo de
    // intervalos — óptimo en cantidad de columnas para un grafo de intervalos.
    const columnEnds: number[] = []
    const assignments: Array<{ turno: TurnoLayoutInput; column: number }> = []

    for (const turno of cluster) {
      let column = columnEnds.findIndex((end) => end <= turno.startMinutes)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(turno.endMinutes)
      } else {
        columnEnds[column] = turno.endMinutes
      }
      assignments.push({ turno, column })
    }

    const columns = columnEnds.length
    for (const { turno, column } of assignments) {
      results.set(turno.id, { id: turno.id, column, columns })
    }

    cluster = []
    clusterEnd = -Infinity
  }

  for (const turno of sorted) {
    if (cluster.length > 0 && turno.startMinutes >= clusterEnd) {
      flushCluster()
    }
    cluster.push(turno)
    clusterEnd = Math.max(clusterEnd, turno.endMinutes)
  }
  flushCluster()

  return results
}

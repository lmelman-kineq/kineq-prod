import type { EstadoTurno } from './generated/prisma/enums'
import prisma from './prisma'

// Numeración automática de sesiones por "pack" de tratamiento.
//
// Un pack son los turnos de un mismo paciente + diagnóstico (GrupoEvolucion;
// "sin diagnóstico" cuenta como uno más) sin un hueco mayor a
// `Consultorio.diasCortePack` días entre turnos consecutivos que cuentan. Un
// cambio de diagnóstico ya es otro pack por construcción (otra clave), y
// volver al mismo diagnóstico después de un hueco largo arranca un pack
// nuevo (numeroSesion vuelve a 1).
//
// `numeroSesion` es siempre derivado: se recalcula para todo el paciente
// cada vez que algo que lo afecta cambia (crear/editar/reprogramar/
// cancelar/eliminar turnos, cambiar de diagnóstico, cambiar el corte). No
// consumen número — y quedan en null — los turnos CANCELADO/REPROGRAMADO y
// las sesiones de consulta. AUSENTE sí consume (sesión perdida del plan).

const ESTADOS_SIN_NUMERO: EstadoTurno[] = ['CANCELADO', 'REPROGRAMADO']
const MS_POR_DIA = 24 * 60 * 60 * 1000

export type TurnoParaNumerar = {
  id: number
  grupoId: number | null
  inicio: Date
  estado: EstadoTurno
  esSesionConsulta: boolean
}

export function calcularNumerosSesion(turnos: TurnoParaNumerar[], diasCortePack: number): Map<number, number | null> {
  const ordenados = [...turnos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.id - b.id)
  const porGrupo = new Map<number | null, { numero: number; ultimoInicio: number }>()
  const resultado = new Map<number, number | null>()

  for (const turno of ordenados) {
    if (turno.esSesionConsulta || ESTADOS_SIN_NUMERO.includes(turno.estado)) {
      resultado.set(turno.id, null)
      continue
    }
    const inicio = turno.inicio.getTime()
    const previo = porGrupo.get(turno.grupoId)
    const nuevoPack = !previo || inicio - previo.ultimoInicio > diasCortePack * MS_POR_DIA
    const numero = nuevoPack ? 1 : previo.numero + 1
    porGrupo.set(turno.grupoId, { numero, ultimoInicio: inicio })
    resultado.set(turno.id, numero)
  }

  return resultado
}

// ponytail: recalcula todos los turnos del paciente en cada cambio — son
// decenas por paciente; si algún día son miles, acotar al grupo afectado.
export async function renumerarSesionesPaciente(consultorioId: number, pacienteId: number): Promise<void> {
  const [consultorio, turnos] = await Promise.all([
    prisma.consultorio.findUnique({ where: { id: consultorioId }, select: { diasCortePack: true } }),
    prisma.turno.findMany({
      where: { consultorioId, pacienteId, eliminadoAt: null },
      select: { id: true, grupoId: true, inicio: true, estado: true, esSesionConsulta: true, numeroSesion: true },
    }),
  ])
  if (!consultorio) return

  const numeros = calcularNumerosSesion(turnos, consultorio.diasCortePack)
  const cambios = turnos.filter((turno) => (numeros.get(turno.id) ?? null) !== turno.numeroSesion)
  if (cambios.length === 0) return

  await prisma.$transaction(
    cambios.map((turno) => prisma.turno.update({ where: { id: turno.id }, data: { numeroSesion: numeros.get(turno.id) ?? null } })),
  )
}

export async function renumerarSesionesConsultorio(consultorioId: number): Promise<void> {
  const pacientes = await prisma.turno.findMany({ where: { consultorioId, eliminadoAt: null }, select: { pacienteId: true }, distinct: ['pacienteId'] })
  for (const { pacienteId } of pacientes) await renumerarSesionesPaciente(consultorioId, pacienteId)
}

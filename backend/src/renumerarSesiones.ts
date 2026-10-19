import prisma from './prisma'
import { renumerarSesionesConsultorio } from './sesionesPack'

/**
 * Backfill único: recalcula `numeroSesion` de todos los turnos con la regla
 * de packs (ver sesionesPack.ts). Hace falta una vez al desplegar esa regla,
 * porque los turnos existentes tienen números cargados a mano o con la
 * regla vieja; de ahí en más cada cambio de turno renumera solo.
 * Idempotente: se puede correr varias veces.
 *
 * Desde backend/, después de las migraciones:
 *   npm run renumerar-sesiones
 */
async function main() {
  const consultorios = await prisma.consultorio.findMany({ select: { id: true, nombre: true } })
  for (const consultorio of consultorios) {
    await renumerarSesionesConsultorio(consultorio.id)
    console.log(`Renumerado: ${consultorio.nombre}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

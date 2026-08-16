import { Router } from 'express'
import { RolUsuario } from './generated/prisma/client'
import { requireRole } from './auth'
import { getEstadisticasResumen } from './estadisticasService'

const router = Router()

// Recepción queda fuera por default (no hay reportes definidos para ese rol
// todavía); Administrador y Supervisor ven todo el consultorio; Profesional
// solo su propio recorte, forzado server-side más abajo.
const ROLES_ESTADISTICAS = [RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.PROFESIONAL]

// Tope para "Personalizado": una consulta sin límite razonable en un rango
// arbitrario es la forma más simple de que esto se vuelva un problema de
// performance el día que un consultorio acumule años de turnos.
const MAX_RANGO_DIAS = 366

router.get('/resumen', requireRole(...ROLES_ESTADISTICAS), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId

  const desdeRaw = req.query.desde ? new Date(String(req.query.desde)) : null
  const hastaRaw = req.query.hasta ? new Date(String(req.query.hasta)) : null
  if (!desdeRaw || !hastaRaw || Number.isNaN(desdeRaw.getTime()) || Number.isNaN(hastaRaw.getTime())) {
    return res.status(400).json({ error: 'desde y hasta son requeridos y deben ser fechas válidas' })
  }
  if (desdeRaw > hastaRaw) {
    return res.status(400).json({ error: 'desde no puede ser posterior a hasta' })
  }
  const rangoDias = (hastaRaw.getTime() - desdeRaw.getTime()) / 86_400_000
  if (rangoDias > MAX_RANGO_DIAS) {
    return res.status(400).json({ error: `El rango no puede superar los ${MAX_RANGO_DIAS} días` })
  }

  const esProfesional = req.usuario!.rol === RolUsuario.PROFESIONAL
  // Un profesional nunca puede consultar estadísticas de otro: se ignora el
  // profesionalId del query y se fuerza el propio (mismo criterio que ya usa
  // POST /api/turnos). Sin vínculo, se usa un id imposible: la consulta
  // resuelve a ceros en vez de filtrar por error datos de todo el consultorio.
  const profesionalId = esProfesional ? (req.usuario!.profesionalId ?? -1) : (req.query.profesionalId ? Number(req.query.profesionalId) : undefined)
  const especialidadId = req.query.especialidadId ? Number(req.query.especialidadId) : undefined

  const resumen = await getEstadisticasResumen({
    consultorioId,
    desde: desdeRaw,
    hasta: hastaRaw,
    profesionalId,
    especialidadId,
    ocultarDesglosePorProfesional: esProfesional,
  })

  res.json(resumen)
})

export default router

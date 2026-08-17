import express from 'express'
import type { Request } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import prisma from './prisma'
import authRoutes from './authRoutes'
import estadisticasRoutes from './estadisticasRoutes'
import evolucionImagenesRoutes from './evolucionImagenesRoutes'
import estudioArchivoRoutes from './estudioArchivoRoutes'
import usuarioFotoRoutes from './usuarioFotoRoutes'
import pacienteFotoRoutes from './pacienteFotoRoutes'
import { estudioParaCliente, fichaParaCliente } from './estudioSerializer'
import { pacienteParaCliente } from './pacienteSerializer'
import { evolucionParaCliente } from './evolucionImagenSerializer'
import { sanitizeRichText, stripToPlainText } from './sanitizeRichText'
import {
  ADMIN_DATA_ROLES,
  CLINICAL_ROLES,
  MIN_PASSWORD_LENGTH,
  hashPassword,
  normalizeEmail,
  quedariaSinAdministrador,
  requireAuth,
  requireProfesionalVinculado,
  requireRole,
} from './auth'
import { RolUsuario } from './generated/prisma/client'

const app = express()

// Los listados de Configuración necesitan ver también los registros
// inactivos (para poder reactivarlos); el resto de la app (turnos,
// pacientes) solo debe ofrecer los activos. Efectivo solo para
// ADMINISTRADOR: evita que otros roles listen inactivos vía query string.
function filtroActivo(req: Request): { activo?: boolean } {
  const verTodos = req.query.estado === 'todos' && req.usuario!.rol === RolUsuario.ADMINISTRADOR
  return verTodos ? {} : { activo: true }
}

// Fuente única de verdad de "qué especialidad puede asignarse en este
// consultorio": la misma regla que arma el listado de GET /api/especialidades
// (global/default visible + custom propia, ambas activas). Antes, Profesional
// y Turno validaban con `especialidad.consultorioId === consultorioId`, que
// excluye a las globales (consultorioId: null) — por eso una especialidad
// visible y seleccionable en el frontend podía rechazarse acá con "no
// pertenece al consultorio". Centralizado para que las cuatro rutas que
// asignan especialidad (Crear/Editar Profesional, Crear/Editar Turno) usen
// siempre el mismo criterio.
async function especialidadesInvalidasParaConsultorio(especialidadIds: number[], consultorioId: number): Promise<boolean> {
  if (especialidadIds.length === 0) return false
  const validas = await prisma.especialidad.count({
    where: {
      id: { in: especialidadIds },
      activo: true,
      OR: [
        { consultorioId, esSistema: false },
        { consultorioId: null, esSistema: true, ocultaPara: { none: { consultorioId } } },
      ],
    },
  })
  return validas !== especialidadIds.length
}

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/', (_req, res) => {
  res.json({ message: 'Kine Admin API running' })
})

app.use('/auth', authRoutes)

// A partir de acá, todas las rutas requieren sesión válida.
// El consultorio activo se toma siempre de `req.usuario`, nunca de un
// parámetro enviado por el cliente.
app.use('/api', requireAuth)

// ESTADÍSTICAS
// Módulo aislado (ruta + servicio de agregación en archivos propios) para no
// seguir haciendo crecer este archivo — ver estadisticasRoutes.ts/estadisticasService.ts.
app.use('/api/estadisticas', estadisticasRoutes)

// CONSULTORIO
app.get('/api/consultorio', async (req, res) => {
  const consultorio = await prisma.consultorio.findUnique({ where: { id: req.usuario!.consultorioId } })
  if (!consultorio) return res.status(404).json({ error: 'consultorio not found' })
  res.json(consultorio)
})

// Sección "General" de Configuración. Solo campos administrativos que ya
// existen en el modelo.
function isValidTimeZone(zone: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

app.patch('/api/consultorio', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const allowed: any = {}
  const fields = ['nombre', 'email', 'telefono', 'direccion', 'ciudad', 'provincia', 'zonaHoraria']
  for (const f of fields) if (f in req.body) allowed[f] = req.body[f]

  if ('zonaHoraria' in allowed && !isValidTimeZone(allowed.zonaHoraria)) {
    return res.status(400).json({ error: 'zona horaria inválida' })
  }

  try {
    const updated = await prisma.consultorio.update({ where: { id: consultorioId }, data: allowed })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'failed to update consultorio' })
  }
})

// USUARIOS
// Gestión de cuentas del consultorio: exclusivo de Configuración, solo ADMINISTRADOR.
const USUARIO_LIST_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  rol: true,
  activo: true,
  profesionalId: true,
  createdAt: true,
  profesional: { select: { id: true, nombre: true, apellido: true } },
} as const

// Foto de perfil: siempre "la propia" (nunca un id de usuario recibido del
// cliente) — ver usuarioFotoRoutes.ts.
app.use('/api/usuarios/me/foto', usuarioFotoRoutes)

app.get('/api/usuarios', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const usuarios = await prisma.usuario.findMany({
    where: { consultorioId },
    select: USUARIO_LIST_SELECT,
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })
  res.json(usuarios)
})

app.post('/api/usuarios', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const { nombre, apellido, email, password, rol, profesionalId } = req.body

  if (!nombre || !apellido || !email || !password || !rol) {
    return res.status(400).json({ error: 'nombre, apellido, email, password y rol son requeridos' })
  }
  if (!Object.values(RolUsuario).includes(rol)) {
    return res.status(400).json({ error: 'rol inválido' })
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` })
  }

  try {
    let profesionalIdToLink: number | null = null
    if (profesionalId) {
      const profesional = await prisma.profesional.findFirst({ where: { id: Number(profesionalId), consultorioId } })
      if (!profesional) return res.status(404).json({ error: 'profesional not found in consultorio' })
      profesionalIdToLink = profesional.id
    }

    const passwordHash = await hashPassword(password)
    const emailNormalizado = normalizeEmail(String(email))

    // Un Usuario PROFESIONAL sin vínculo manual recibe un Profesional propio
    // automáticamente (mismo nombre/apellido/email), para no requerir un
    // segundo paso administrativo antes de poder recibir turnos o cargar
    // evoluciones. Se crea en la misma transacción que el Usuario: si algo
    // falla a mitad de camino, no queda ni un Usuario PROFESIONAL huérfano ni
    // un Profesional duplicado.
    const usuario = await prisma.$transaction(async (tx) => {
      let profesionalId = profesionalIdToLink
      if (profesionalId === null && rol === RolUsuario.PROFESIONAL) {
        const creado = await tx.profesional.create({ data: { consultorioId, nombre, apellido, email: emailNormalizado } })
        profesionalId = creado.id
      }
      return tx.usuario.create({
        data: { consultorioId, nombre, apellido, email: emailNormalizado, passwordHash, rol, profesionalId },
        select: USUARIO_LIST_SELECT,
      })
    })
    res.status(201).json(usuario)
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email, o el profesional ya tiene un usuario vinculado' })
    }
    res.status(500).json({ error: 'failed to create usuario' })
  }
})

app.patch('/api/usuarios/:usuarioId', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const usuarioId = Number(req.params.usuarioId)
  if (Number.isNaN(usuarioId)) return res.status(400).json({ error: 'invalid id' })

  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, consultorioId } })
  if (!usuario) return res.status(404).json({ error: 'usuario not found' })

  const { nombre, apellido, rol, activo, profesionalId } = req.body

  if (rol !== undefined && !Object.values(RolUsuario).includes(rol)) {
    return res.status(400).json({ error: 'rol inválido' })
  }

  const dejariaAdminActivo =
    usuario.rol === RolUsuario.ADMINISTRADOR &&
    usuario.activo &&
    ((rol !== undefined && rol !== RolUsuario.ADMINISTRADOR) || activo === false)

  if (dejariaAdminActivo && (await quedariaSinAdministrador(consultorioId, usuarioId))) {
    return res.status(409).json({ error: 'No podés dejar el consultorio sin un administrador activo' })
  }

  const profesionalIdProvided = profesionalId !== undefined

  const allowed: any = {}
  if (nombre !== undefined) allowed.nombre = nombre
  if (apellido !== undefined) allowed.apellido = apellido
  if (rol !== undefined) allowed.rol = rol
  if (activo !== undefined) allowed.activo = activo

  if (profesionalIdProvided) {
    if (profesionalId === null) {
      allowed.profesionalId = null
    } else {
      const profesional = await prisma.profesional.findFirst({ where: { id: Number(profesionalId), consultorioId } })
      if (!profesional) return res.status(404).json({ error: 'profesional not found in consultorio' })
      allowed.profesionalId = profesional.id
    }
  }

  // Solo la transición real de rol hacia PROFESIONAL dispara la creación
  // automática (mismo criterio que el alta) — nunca un PATCH cualquiera
  // sobre un usuario que ya era PROFESIONAL, porque ahí "profesionalId: null"
  // puede ser una desvinculación manual explícita (con su propia protección
  // de historial ya existente) y no debe revertirse solo. Cambio de
  // PROFESIONAL hacia otro rol tampoco desvincula ni borra el Profesional acá
  // — puede tener historial clínico (turnos, evoluciones) y se conserva.
  const rolCambiaAProfesional = rol !== undefined && rol === RolUsuario.PROFESIONAL && usuario.rol !== RolUsuario.PROFESIONAL
  const finalProfesionalId = profesionalIdProvided ? allowed.profesionalId : usuario.profesionalId
  const necesitaProfesionalAutomatico = rolCambiaAProfesional && finalProfesionalId === null

  try {
    const updated = necesitaProfesionalAutomatico
      ? await prisma.$transaction(async (tx) => {
          const creado = await tx.profesional.create({
            data: {
              consultorioId,
              nombre: allowed.nombre ?? usuario.nombre,
              apellido: allowed.apellido ?? usuario.apellido,
              email: usuario.email,
            },
          })
          return tx.usuario.update({ where: { id: usuarioId }, data: { ...allowed, profesionalId: creado.id }, select: USUARIO_LIST_SELECT })
        })
      : await prisma.usuario.update({ where: { id: usuarioId }, data: allowed, select: USUARIO_LIST_SELECT })
    res.json(updated)
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return res.status(409).json({ error: 'Ese profesional ya tiene un usuario vinculado' })
    }
    res.status(500).json({ error: 'failed to update usuario' })
  }
})

// PACIENTES
// Lectura: todos los roles. Alta y edición administrativa: administrador y recepción.
app.use('/api/pacientes/:pacienteId/foto', pacienteFotoRoutes)

app.get('/api/pacientes', async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacientes = await prisma.paciente.findMany({
    where: { consultorioId, activo: true },
    orderBy: [{ nombre: 'asc' }],
  })
  res.json(pacientes)
})

app.get('/api/pacientes/:pacienteId', async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found' })
  res.json(pacienteParaCliente(paciente))
})

app.post('/api/pacientes', requireRole(...ADMIN_DATA_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const { nombre, apellido, documento, fechaNacimiento, direccion, email, telefono, obraSocialId, numeroAfiliado } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre required' })

  try {
    const paciente = await prisma.paciente.create({
      data: {
        consultorioId,
        nombre,
        apellido: apellido || '',
        documento: documento || null,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        direccion: direccion || null,
        email: email || null,
        telefono: telefono || null,
        obraSocialId: obraSocialId || null,
        numeroAfiliado: numeroAfiliado || null,
      },
    })
    res.status(201).json(pacienteParaCliente(paciente))
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un paciente con ese documento en este consultorio' })
    }
    res.status(500).json({ error: 'failed to create paciente' })
  }
})

app.patch(
  '/api/pacientes/:pacienteId',
  requireRole(...ADMIN_DATA_ROLES),
  async (req, res) => {
    const consultorioId = req.usuario!.consultorioId
    const pacienteId = Number(req.params.pacienteId)
    if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

    // Datos administrativos del paciente: los cuatro roles del consultorio
    // pueden editarlos por igual — nunca contenido clínico, que vive en
    // Ficha Inicial/evoluciones/estudios y tiene su propio gate.
    const fields = ['nombre', 'apellido', 'documento', 'fechaNacimiento', 'direccion', 'email', 'telefono', 'obraSocialId', 'numeroAfiliado', 'activo', 'observaciones']

    const allowed: any = {}
    for (const f of fields) if (f in req.body) allowed[f] = req.body[f]
    if ('fechaNacimiento' in allowed) {
      allowed.fechaNacimiento = allowed.fechaNacimiento ? new Date(allowed.fechaNacimiento) : null
    }
    // Documento vacío se normaliza a null (nunca ''), para no chocar con el
    // unique(consultorioId, documento) ni divergir de cómo lo guarda el POST.
    if ('documento' in allowed) {
      allowed.documento = allowed.documento || null
    }
    if ('apellido' in allowed) {
      allowed.apellido = allowed.apellido || ''
    }
    if ('nombre' in allowed && !allowed.nombre) {
      return res.status(400).json({ error: 'nombre required' })
    }

    try {
      const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId } })
      if (!paciente) return res.status(404).json({ error: 'paciente not found' })

      // Al archivar un paciente (transición real activo→inactivo), sus
      // turnos futuros no terminales se cancelan para no seguir ocupando
      // agenda — se conservan (no se borran), con nota y timestamp de
      // cancelación. Los turnos pasados/terminales no se tocan: dejan de
      // verse en pantallas operativas porque esas ya filtran por paciente
      // activo, no porque se les cambie el estado acá.
      const archivando = allowed.activo === false && paciente.activo

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.paciente.update({ where: { id: pacienteId }, data: allowed })

        if (archivando) {
          const ahora = new Date()
          const turnosFuturos = await tx.turno.findMany({
            where: { pacienteId, consultorioId, inicio: { gt: ahora }, estado: { in: ['ASIGNADO', 'EN_ESPERA'] } },
          })
          const notaArchivado = 'Cancelado automáticamente: paciente archivado'
          for (const turno of turnosFuturos) {
            await tx.turno.update({
              where: { id: turno.id },
              data: {
                estado: 'CANCELADO',
                canceladoAt: ahora,
                notas: turno.notas ? `${turno.notas} — ${notaArchivado}` : notaArchivado,
              },
            })
          }
        }

        return result
      })

      res.json(pacienteParaCliente(updated))
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        return res.status(409).json({ error: 'Ya existe un paciente con ese documento en este consultorio' })
      }
      res.status(500).json({ error: 'failed to update paciente' })
    }
  },
)

// PROFESIONALES
// Lectura: todos los roles. Alta y edición: solo administrador.
// `deletedAt` (archivado/baja lógica) siempre queda fuera del listado, aun
// con `?estado=todos` — ese parámetro solo revela inactivos, no eliminados;
// no hay vista de auditoría de eliminados en esta iteración.
app.get('/api/profesionales', async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const profesionales = await prisma.profesional.findMany({
    where: { consultorioId, deletedAt: null, ...filtroActivo(req) },
    include: PROFESIONAL_INCLUDE,
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })
  res.json(profesionales)
})

const PROFESIONAL_INCLUDE = {
  especialidades: { include: { especialidad: true } },
  usuario: { select: { id: true, nombre: true, apellido: true, email: true, activo: true } },
  _count: { select: { turnos: true, evoluciones: true } },
} as const

// El vínculo con Usuario también se puede establecer en el alta (antes solo
// existía en la edición): mismo criterio 1:1 que PATCH — un usuario activo
// del propio consultorio, sin otro profesional ya vinculado.
app.post('/api/profesionales', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const { nombre, apellido, titulo, matricula, email, telefono, especialidadIds, usuarioId } = req.body
  if (!nombre || !apellido) return res.status(400).json({ error: 'nombre and apellido required' })

  const especialidadIdList: number[] = Array.isArray(especialidadIds) ? especialidadIds.map(Number) : []

  try {
    if (await especialidadesInvalidasParaConsultorio(especialidadIdList, consultorioId)) {
      return res.status(404).json({ error: 'una o más especialidades no pertenecen al consultorio' })
    }

    let usuarioAVincular: { id: number } | null = null
    if (usuarioId) {
      const usuario = await prisma.usuario.findFirst({ where: { id: Number(usuarioId), consultorioId, activo: true } })
      if (!usuario) return res.status(404).json({ error: 'usuario not found in consultorio' })
      if (usuario.profesionalId) return res.status(409).json({ error: 'Ese usuario ya está vinculado a otro profesional' })
      usuarioAVincular = usuario
    }

    const creadoId = await prisma.$transaction(async (tx) => {
      const creado = await tx.profesional.create({
        data: {
          consultorioId,
          nombre,
          apellido,
          titulo: titulo || null,
          matricula: matricula || null,
          email: email || null,
          telefono: telefono || null,
          especialidades: especialidadIdList.length
            ? { create: especialidadIdList.map((especialidadId) => ({ consultorioId, especialidadId })) }
            : undefined,
        },
      })
      if (usuarioAVincular) {
        await tx.usuario.update({ where: { id: usuarioAVincular.id }, data: { profesionalId: creado.id } })
      }
      return creado.id
    })

    const profesional = await prisma.profesional.findUniqueOrThrow({ where: { id: creadoId }, include: PROFESIONAL_INCLUDE })
    res.status(201).json(profesional)
  } catch (err) {
    res.status(500).json({ error: 'failed to create profesional' })
  }
})

app.patch('/api/profesionales/:profesionalId', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const profesionalId = Number(req.params.profesionalId)
  if (Number.isNaN(profesionalId)) return res.status(400).json({ error: 'invalid id' })

  const allowed: any = {}
  const fields = ['nombre', 'apellido', 'titulo', 'matricula', 'email', 'telefono', 'activo']
  for (const f of fields) if (f in req.body) allowed[f] = req.body[f]

  const { especialidadIds } = req.body
  const especialidadIdList: number[] | undefined = Array.isArray(especialidadIds) ? especialidadIds.map(Number) : undefined

  // Vínculo con Usuario, editable también desde este formulario — misma
  // relación que `Usuario.profesionalId` (fuente única de verdad, no se
  // duplica el campo). `usuarioId: null` desvincula.
  const usuarioIdProvided = 'usuarioId' in req.body
  const nextUsuarioId: number | null = usuarioIdProvided && req.body.usuarioId !== null ? Number(req.body.usuarioId) : null

  try {
    const profesional = await prisma.profesional.findFirst({ where: { id: profesionalId, consultorioId } })
    if (!profesional) return res.status(404).json({ error: 'profesional not found' })

    if (especialidadIdList && await especialidadesInvalidasParaConsultorio(especialidadIdList, consultorioId)) {
      return res.status(404).json({ error: 'una o más especialidades no pertenecen al consultorio' })
    }

    if (usuarioIdProvided && nextUsuarioId !== null) {
      const usuarioDestino = await prisma.usuario.findFirst({ where: { id: nextUsuarioId, consultorioId } })
      if (!usuarioDestino) return res.status(404).json({ error: 'usuario not found in consultorio' })
      if (usuarioDestino.profesionalId && usuarioDestino.profesionalId !== profesionalId) {
        return res.status(409).json({ error: 'Ese usuario ya está vinculado a otro profesional' })
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (especialidadIdList) {
        await tx.profesionalEspecialidad.deleteMany({ where: { profesionalId } })
        if (especialidadIdList.length > 0) {
          await tx.profesionalEspecialidad.createMany({
            data: especialidadIdList.map((especialidadId) => ({ consultorioId, profesionalId, especialidadId })),
          })
        }
      }
      if (usuarioIdProvided) {
        // Desvincula a quien tuviera este profesional antes (reasignación).
        await tx.usuario.updateMany({
          where: { consultorioId, profesionalId, ...(nextUsuarioId ? { id: { not: nextUsuarioId } } : {}) },
          data: { profesionalId: null },
        })
        if (nextUsuarioId !== null) {
          await tx.usuario.update({ where: { id: nextUsuarioId }, data: { profesionalId } })
        }
      }
      return tx.profesional.update({ where: { id: profesionalId }, data: allowed, include: PROFESIONAL_INCLUDE })
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'failed to update profesional' })
  }
})

// Eliminación: solo si no tiene historial (turnos, evoluciones, fichas
// donde figura como responsable, estudios) ni especialidades asignadas — en
// ese caso se borra físicamente. Si tiene cualquiera de esos registros, no
// se borra (el FK de Turno/Evolución la bloquearía igual): se responde 409
// para que el frontend explique que se conserva el historial. Un usuario
// vinculado (Usuario.profesionalId) se desvincula solo (SET NULL en el
// schema), nunca se borra su cuenta.
app.delete('/api/profesionales/:profesionalId', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const profesionalId = Number(req.params.profesionalId)
  if (Number.isNaN(profesionalId)) return res.status(400).json({ error: 'invalid id' })

  try {
    const profesional = await prisma.profesional.findFirst({ where: { id: profesionalId, consultorioId } })
    if (!profesional) return res.status(404).json({ error: 'profesional not found' })

    const [turnos, evoluciones, fichasResponsable, estudios] = await Promise.all([
      prisma.turno.count({ where: { profesionalId } }),
      prisma.evolucion.count({ where: { profesionalId } }),
      prisma.fichaInicial.count({ where: { profesionalResponsableId: profesionalId } }),
      prisma.fichaEstudioComplementario.count({ where: { profesionalId } }),
    ])
    if (turnos > 0 || evoluciones > 0 || fichasResponsable > 0 || estudios > 0) {
      return res.status(409).json({
        error: 'Este profesional tiene turnos o registros clínicos asociados. No puede eliminarse definitivamente. Se conservará su historial.',
      })
    }

    await prisma.$transaction([
      prisma.profesionalEspecialidad.deleteMany({ where: { profesionalId } }),
      prisma.profesional.delete({ where: { id: profesionalId } }),
    ])
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: 'failed to delete profesional' })
  }
})

// Archivar (baja lógica, distinta de "Inactivo"): para un profesional con
// historial que no puede borrarse físicamente (ver DELETE arriba), esto lo
// saca por completo de los listados de Configuración — no solo lo
// deshabilita como el `activo:false` de "Desactivar". Nunca toca turnos ni
// evoluciones. Siempre implica `activo:false` también, para que quede
// excluido de cualquier select operativo existente.
app.post('/api/profesionales/:profesionalId/archivar', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const profesionalId = Number(req.params.profesionalId)
  if (Number.isNaN(profesionalId)) return res.status(400).json({ error: 'invalid id' })

  const profesional = await prisma.profesional.findFirst({ where: { id: profesionalId, consultorioId } })
  if (!profesional) return res.status(404).json({ error: 'profesional not found' })

  await prisma.profesional.update({ where: { id: profesionalId }, data: { activo: false, deletedAt: new Date() } })
  res.status(204).end()
})

// Restaura técnicamente un profesional archivado (vuelve a aparecer en
// Configuración como Inactivo, no automáticamente como Activo).
app.delete('/api/profesionales/:profesionalId/archivar', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const profesionalId = Number(req.params.profesionalId)
  if (Number.isNaN(profesionalId)) return res.status(400).json({ error: 'invalid id' })

  const profesional = await prisma.profesional.findFirst({ where: { id: profesionalId, consultorioId } })
  if (!profesional) return res.status(404).json({ error: 'profesional not found' })

  await prisma.profesional.update({ where: { id: profesionalId }, data: { deletedAt: null } })
  res.status(204).end()
})

// ESPECIALIDADES
// Catálogo global (esSistema=true, consultorioId=null, administrado por
// Kineq) + custom por consultorio (esSistema=false). Lectura: todos los
// roles, ve las globales no ocultas por su consultorio + sus propias
// custom. Alta y edición de custom: solo administrador. Las globales nunca
// se editan/borran desde un consultorio — solo se pueden ocultar.
app.get('/api/especialidades', async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const incluirOcultas = req.query.incluirOcultas === 'true' && req.usuario!.rol === RolUsuario.ADMINISTRADOR

  const especialidades = await prisma.especialidad.findMany({
    where: {
      OR: [
        { consultorioId, esSistema: false, ...filtroActivo(req) },
        {
          consultorioId: null,
          esSistema: true,
          activo: true,
          ...(incluirOcultas ? {} : { ocultaPara: { none: { consultorioId } } }),
        },
      ],
    },
    include: { _count: { select: { profesionales: true, turnos: true } } },
    orderBy: { nombre: 'asc' },
  })

  if (!incluirOcultas) return res.json(especialidades.map((e) => ({ ...e, oculta: false })))

  const ocultas = await prisma.consultorioEspecialidadOculta.findMany({ where: { consultorioId }, select: { especialidadId: true } })
  const ocultasIds = new Set(ocultas.map((o) => o.especialidadId))
  res.json(especialidades.map((e) => ({ ...e, oculta: ocultasIds.has(e.id) })))
})

app.post('/api/especialidades', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const { nombre, color } = req.body
  if (!nombre || !color) return res.status(400).json({ error: 'nombre and color required' })

  try {
    const espec = await prisma.especialidad.upsert({
      where: { consultorioId_nombre: { consultorioId, nombre } },
      create: { consultorioId, nombre, color },
      update: { color },
    })
    res.status(201).json(espec)
  } catch (err) {
    res.status(500).json({ error: 'failed to create especialidad' })
  }
})

const ESPECIALIDAD_GLOBAL_MENSAJE = 'Este elemento es predeterminado de Kineq y no puede editarse. Podés ocultarlo para tu consultorio.'

app.patch('/api/especialidades/:especialidadId', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const especialidadId = Number(req.params.especialidadId)
  if (Number.isNaN(especialidadId)) return res.status(400).json({ error: 'invalid id' })

  const { nombre, color, activo } = req.body
  try {
    const especialidad = await prisma.especialidad.findUnique({ where: { id: especialidadId } })
    if (!especialidad || (especialidad.consultorioId !== null && especialidad.consultorioId !== consultorioId)) {
      return res.status(404).json({ error: 'especialidad not found' })
    }
    if (especialidad.esSistema) return res.status(403).json({ error: ESPECIALIDAD_GLOBAL_MENSAJE })

    const updated = await prisma.especialidad.update({
      where: { id: especialidadId },
      data: { nombre: nombre ?? especialidad.nombre, color: color ?? especialidad.color, activo: activo ?? especialidad.activo },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'failed to update especialidad' })
  }
})

// Eliminación: solo si no está asignada a ningún profesional ni tiene
// turnos que la referencien — en ese caso se borra físicamente. Si tiene
// alguna relación, no se borra (se conserva el color/nombre para lectura
// histórica de turnos pasados): 409 explicando que forma parte del historial.
// Una fila global nunca llega a borrarse acá — devuelve 403.
app.delete('/api/especialidades/:especialidadId', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const especialidadId = Number(req.params.especialidadId)
  if (Number.isNaN(especialidadId)) return res.status(400).json({ error: 'invalid id' })

  try {
    const especialidad = await prisma.especialidad.findUnique({ where: { id: especialidadId } })
    if (!especialidad || (especialidad.consultorioId !== null && especialidad.consultorioId !== consultorioId)) {
      return res.status(404).json({ error: 'especialidad not found' })
    }
    if (especialidad.esSistema) return res.status(403).json({ error: ESPECIALIDAD_GLOBAL_MENSAJE })

    const [profesionales, turnos] = await Promise.all([
      prisma.profesionalEspecialidad.count({ where: { especialidadId } }),
      prisma.turno.count({ where: { especialidadId } }),
    ])
    if (profesionales > 0 || turnos > 0) {
      return res.status(409).json({
        error: 'Esta especialidad está asociada a profesionales o turnos. No puede eliminarse definitivamente porque forma parte del historial.',
      })
    }

    await prisma.especialidad.delete({ where: { id: especialidadId } })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: 'failed to delete especialidad' })
  }
})

// Ocultar/restaurar una especialidad global para el consultorio actual — no
// la borra ni la desactiva para el resto de los consultorios.
app.post('/api/especialidades/:especialidadId/ocultar', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const especialidadId = Number(req.params.especialidadId)
  if (Number.isNaN(especialidadId)) return res.status(400).json({ error: 'invalid id' })

  const especialidad = await prisma.especialidad.findFirst({ where: { id: especialidadId, consultorioId: null, esSistema: true } })
  if (!especialidad) return res.status(404).json({ error: 'especialidad global not found' })

  await prisma.consultorioEspecialidadOculta.upsert({
    where: { consultorioId_especialidadId: { consultorioId, especialidadId } },
    create: { consultorioId, especialidadId },
    update: {},
  })
  res.status(204).end()
})

app.delete('/api/especialidades/:especialidadId/ocultar', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const especialidadId = Number(req.params.especialidadId)
  if (Number.isNaN(especialidadId)) return res.status(400).json({ error: 'invalid id' })

  await prisma.consultorioEspecialidadOculta.deleteMany({ where: { consultorioId, especialidadId } })
  res.status(204).end()
})

// OBRAS SOCIALES
// Mismo patrón global/custom que Especialidades.
app.get('/api/obras-sociales', async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const incluirOcultas = req.query.incluirOcultas === 'true' && req.usuario!.rol === RolUsuario.ADMINISTRADOR

  const obras = await prisma.obraSocial.findMany({
    where: {
      OR: [
        { consultorioId, esSistema: false, ...filtroActivo(req) },
        {
          consultorioId: null,
          esSistema: true,
          activo: true,
          ...(incluirOcultas ? {} : { ocultaPara: { none: { consultorioId } } }),
        },
      ],
    },
    include: { _count: { select: { pacientes: true, turnos: true } } },
    orderBy: { nombre: 'asc' },
  })

  if (!incluirOcultas) return res.json(obras.map((o) => ({ ...o, oculta: false })))

  const ocultas = await prisma.consultorioObraSocialOculta.findMany({ where: { consultorioId }, select: { obraSocialId: true } })
  const ocultasIds = new Set(ocultas.map((o) => o.obraSocialId))
  res.json(obras.map((o) => ({ ...o, oculta: ocultasIds.has(o.id) })))
})

app.post('/api/obras-sociales', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const { nombre } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre required' })
  try {
    const obra = await prisma.obraSocial.upsert({
      where: { consultorioId_nombre: { consultorioId, nombre } },
      create: { consultorioId, nombre },
      update: { nombre },
    })
    res.status(201).json(obra)
  } catch (err) {
    res.status(500).json({ error: 'failed to create obra social' })
  }
})

const OBRA_SOCIAL_GLOBAL_MENSAJE = 'Este elemento es predeterminado de Kineq y no puede editarse. Podés ocultarlo para tu consultorio.'

app.patch('/api/obras-sociales/:obraSocialId', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const obraSocialId = Number(req.params.obraSocialId)
  if (Number.isNaN(obraSocialId)) return res.status(400).json({ error: 'invalid id' })
  const { nombre, activo } = req.body
  try {
    const obra = await prisma.obraSocial.findUnique({ where: { id: obraSocialId } })
    if (!obra || (obra.consultorioId !== null && obra.consultorioId !== consultorioId)) {
      return res.status(404).json({ error: 'obra social not found' })
    }
    if (obra.esSistema) return res.status(403).json({ error: OBRA_SOCIAL_GLOBAL_MENSAJE })

    const updated = await prisma.obraSocial.update({ where: { id: obraSocialId }, data: { nombre: nombre ?? obra.nombre, activo: activo ?? obra.activo } })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'failed to update obra social' })
  }
})

// Eliminación: solo si no está asociada a pacientes ni turnos — en ese caso
// se borra físicamente. Si tiene alguna relación, no se borra ni se dejan
// referencias inválidas: 409 explicando que forma parte de información
// histórica. No se modifica a los pacientes automáticamente. Una fila
// global nunca llega a borrarse acá — devuelve 403.
app.delete('/api/obras-sociales/:obraSocialId', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const obraSocialId = Number(req.params.obraSocialId)
  if (Number.isNaN(obraSocialId)) return res.status(400).json({ error: 'invalid id' })

  try {
    const obra = await prisma.obraSocial.findUnique({ where: { id: obraSocialId } })
    if (!obra || (obra.consultorioId !== null && obra.consultorioId !== consultorioId)) {
      return res.status(404).json({ error: 'obra social not found' })
    }
    if (obra.esSistema) return res.status(403).json({ error: OBRA_SOCIAL_GLOBAL_MENSAJE })

    const [pacientes, turnos] = await Promise.all([
      prisma.paciente.count({ where: { obraSocialId } }),
      prisma.turno.count({ where: { obraSocialId } }),
    ])
    if (pacientes > 0 || turnos > 0) {
      return res.status(409).json({
        error: 'Esta obra social está asociada a pacientes. No puede eliminarse definitivamente porque forma parte de información histórica.',
      })
    }

    await prisma.obraSocial.delete({ where: { id: obraSocialId } })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: 'failed to delete obra social' })
  }
})

app.post('/api/obras-sociales/:obraSocialId/ocultar', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const obraSocialId = Number(req.params.obraSocialId)
  if (Number.isNaN(obraSocialId)) return res.status(400).json({ error: 'invalid id' })

  const obra = await prisma.obraSocial.findFirst({ where: { id: obraSocialId, consultorioId: null, esSistema: true } })
  if (!obra) return res.status(404).json({ error: 'obra social global not found' })

  await prisma.consultorioObraSocialOculta.upsert({
    where: { consultorioId_obraSocialId: { consultorioId, obraSocialId } },
    create: { consultorioId, obraSocialId },
    update: {},
  })
  res.status(204).end()
})

app.delete('/api/obras-sociales/:obraSocialId/ocultar', requireRole(RolUsuario.ADMINISTRADOR), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const obraSocialId = Number(req.params.obraSocialId)
  if (Number.isNaN(obraSocialId)) return res.status(400).json({ error: 'invalid id' })

  await prisma.consultorioObraSocialOculta.deleteMany({ where: { consultorioId, obraSocialId } })
  res.status(204).end()
})

// TURNOS
// Lectura de agenda: todos los roles (contexto operativo compartido).
// Alta: administrador, recepción y supervisor para cualquier profesional del
// consultorio; profesional solo para sí mismo (profesionalId se ignora y se
// toma del vínculo de sesión). Edición: administrador, recepción y
// supervisor sin restricción; profesional solo sobre sus propios turnos, sin
// poder reasignarlos a otro profesional.
// filtros: from, to, pacienteId, profesionalId, especialidadId, obraSocialId, estado
app.get('/api/turnos', async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const { from, to, pacienteId, profesionalId, especialidadId, obraSocialId, estado } = req.query

  const where: any = { consultorioId }
  if (from || to) where.inicio = {}
  if (from) where.inicio.gte = new Date(String(from))
  if (to) where.inicio.lte = new Date(String(to))
  if (pacienteId) where.pacienteId = Number(pacienteId)
  if (profesionalId) where.profesionalId = Number(profesionalId)
  if (especialidadId) where.especialidadId = Number(especialidadId)
  if (obraSocialId) where.obraSocialId = Number(obraSocialId)
  if (estado) where.estado = String(estado)

  const turnos = await prisma.turno.findMany({ where, include: { paciente: true, profesional: true, especialidad: true, obraSocial: true, grupo: true } })
  res.json(turnos)
})

function overlapExists(consultorioId: number, profesionalId: number, inicio: Date, duracionMinutos: number, excludeTurnoId?: number) {
  const fin = new Date(inicio.getTime() + duracionMinutos * 60000)
  return prisma.turno.findFirst({
    where: {
      consultorioId,
      profesionalId,
      NOT: excludeTurnoId ? { id: excludeTurnoId } : undefined,
      estado: { not: 'CANCELADO' },
      AND: [
        { inicio: { lt: fin } },
        { inicio: { gt: new Date(0) } },
      ],
    },
  }).then((t: any) => {
    if (!t) return false
    const tFin = new Date(t.inicio.getTime() + t.duracionMinutos * 60000)
    return inicio < tFin && fin > t.inicio
  })
}

app.post('/api/turnos', requireRole(...ADMIN_DATA_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const { pacienteId, especialidadId, obraSocialId, inicio, duracionMinutos = 60, numeroSesion, notas, grupoId } = req.body

  // Un profesional solo puede crear turnos para sí mismo: se ignora cualquier
  // profesionalId enviado por el cliente y se usa el vínculo de sesión.
  let profesionalId = req.body.profesionalId
  if (req.usuario!.rol === RolUsuario.PROFESIONAL) {
    const vinculado = await requireProfesionalVinculado(req, res)
    if (vinculado === null) return
    const propio = await prisma.profesional.findFirst({ where: { id: vinculado, consultorioId } })
    if (!propio || !propio.activo) {
      return res.status(403).json({
        error: 'Tu usuario no está vinculado a un profesional activo. Un administrador debe completar el vínculo para que puedas crear turnos.',
      })
    }
    profesionalId = vinculado
  }

  if (!pacienteId || !profesionalId || !especialidadId || !inicio) return res.status(400).json({ error: 'missing required fields' })

  const inicioDate = new Date(inicio)
  if (Number.isNaN(inicioDate.getTime())) return res.status(400).json({ error: 'invalid inicio' })
  if (!Number.isInteger(duracionMinutos) || duracionMinutos < 15) return res.status(400).json({ error: 'invalid duracionMinutos' })
  if (numeroSesion && Number(numeroSesion) <= 0) return res.status(400).json({ error: 'invalid numeroSesion' })

  try {
    const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
    if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

    const profesional = await prisma.profesional.findFirst({ where: { id: profesionalId, consultorioId } })
    if (!profesional) return res.status(404).json({ error: 'profesional not found in consultorio' })

    if (await especialidadesInvalidasParaConsultorio([Number(especialidadId)], consultorioId)) {
      return res.status(404).json({ error: 'especialidad not found in consultorio' })
    }

    if (obraSocialId) {
      const obra = await prisma.obraSocial.findFirst({ where: { id: obraSocialId, consultorioId } })
      if (!obra) return res.status(404).json({ error: 'obra social not found in consultorio' })
    }

    // La especialidad del turno ya no exige que el profesional la tenga
    // asignada en su ficha: Profesional↔Especialidad es solo organización/
    // filtros/configuración, nunca una restricción de agenda. Las únicas
    // validaciones que quedan son consultorio/aislamiento (arriba).

    let resolvedGrupoId: number | null = null
    if (grupoId) {
      const check = await resolveGrupoParaAsignar(consultorioId, pacienteId, Number(grupoId))
      if (!check.ok) return res.status(check.status).json({ error: check.error })
      resolvedGrupoId = Number(grupoId)
    }

    // `numeroSesion` explícito del cliente siempre gana — el cálculo
    // automático es solo un default cuando no se mandó nada.
    let resolvedNumeroSesion = numeroSesion ? Number(numeroSesion) : null
    if (resolvedGrupoId && !resolvedNumeroSesion) {
      resolvedNumeroSesion = await sesionAutomaticaParaGrupo(consultorioId, pacienteId, resolvedGrupoId)
    }

    // chequear solapamientos
    const conflict = await overlapExists(consultorioId, profesionalId, inicioDate, Number(duracionMinutos))
    if (conflict) return res.status(409).json({ error: 'overlap with existing turno' })

    const turno = await prisma.turno.create({ data: { consultorioId, pacienteId, profesionalId, especialidadId, obraSocialId: obraSocialId || null, grupoId: resolvedGrupoId, inicio: inicioDate, duracionMinutos: Number(duracionMinutos), numeroSesion: resolvedNumeroSesion, notas: notas || null } })

    const result = await prisma.turno.findUnique({ where: { id: turno.id }, include: { paciente: true, profesional: true, especialidad: true, obraSocial: true, grupo: true } })
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: 'failed to create turno' })
  }
})

app.patch(
  '/api/turnos/:turnoId',
  requireRole(...ADMIN_DATA_ROLES),
  async (req, res) => {
    const consultorioId = req.usuario!.consultorioId
    const turnoId = Number(req.params.turnoId)
    if (Number.isNaN(turnoId)) return res.status(400).json({ error: 'invalid id' })

    try {
      const turno = await prisma.turno.findFirst({ where: { id: turnoId, consultorioId } })
      if (!turno) return res.status(404).json({ error: 'turno not found in consultorio' })

      // Un profesional solo puede operar sus propios turnos, y no puede
      // reasignarlos a otro profesional (profesionalId queda fuera de los
      // campos editables para este rol).
      const esProfesional = req.usuario!.rol === RolUsuario.PROFESIONAL
      if (esProfesional) {
        const profesionalId = await requireProfesionalVinculado(req, res)
        if (profesionalId === null) return
        if (turno.profesionalId !== profesionalId) {
          return res.status(403).json({ error: 'No podés modificar turnos de otro profesional' })
        }
      }

      const payload: any = {}
      const fields = ['pacienteId', ...(esProfesional ? [] : ['profesionalId']), 'especialidadId', 'obraSocialId', 'grupoId', 'inicio', 'duracionMinutos', 'numeroSesion', 'notas', 'estado']
      for (const f of fields) if (f in req.body) payload[f] = req.body[f]

      if (payload.inicio) payload.inicio = new Date(payload.inicio)
      if (payload.duracionMinutos) payload.duracionMinutos = Number(payload.duracionMinutos)

      if (payload.especialidadId !== undefined && await especialidadesInvalidasParaConsultorio([Number(payload.especialidadId)], consultorioId)) {
        return res.status(404).json({ error: 'especialidad not found in consultorio' })
      }

      if ('grupoId' in payload) {
        const targetPacienteId = payload.pacienteId ?? turno.pacienteId
        if (payload.grupoId) {
          const check = await resolveGrupoParaAsignar(consultorioId, targetPacienteId, Number(payload.grupoId))
          if (!check.ok) return res.status(check.status).json({ error: check.error })
          payload.grupoId = Number(payload.grupoId)
          // Mismo criterio que el POST: si el cliente no mandó numeroSesion
          // en el mismo request, se recalcula como default al cambiar de
          // diagnóstico — nunca pisa un numeroSesion que sí vino explícito.
          if (!('numeroSesion' in req.body)) {
            payload.numeroSesion = await sesionAutomaticaParaGrupo(consultorioId, targetPacienteId, payload.grupoId, turnoId)
          }
        } else {
          payload.grupoId = null
        }
      }

      // business validations when changing scheduling/professional
      const newProfesionalId = payload.profesionalId ?? turno.profesionalId
      const newInicio = payload.inicio ? new Date(payload.inicio) : turno.inicio
      const newDur = payload.duracionMinutos ?? turno.duracionMinutos

      const conflict = await overlapExists(consultorioId, newProfesionalId, newInicio, Number(newDur), turnoId)
      if (conflict) return res.status(409).json({ error: 'overlap with existing turno' })

      // Al transicionar de estado, se registra automáticamente el timestamp correspondiente.
      // No se aceptan estos timestamps desde el cliente (no están en `fields`).
      if (payload.estado && payload.estado !== turno.estado) {
        const estadosFinales = ['FINALIZADO', 'CANCELADO', 'AUSENTE']
        if (estadosFinales.includes(turno.estado)) {
          return res.status(409).json({ error: 'No se puede modificar un turno ya finalizado, cancelado o ausente' })
        }
        if (payload.estado === 'ATENDIENDO') payload.inicioAtencion = new Date()
        if (payload.estado === 'FINALIZADO') payload.finAtencion = new Date()
        if (payload.estado === 'CANCELADO') payload.canceladoAt = new Date()
      }

      const updated = await prisma.turno.update({ where: { id: turnoId }, data: payload })
      const result = await prisma.turno.findUnique({ where: { id: updated.id }, include: { paciente: true, profesional: true, especialidad: true, obraSocial: true, grupo: true } })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: 'failed to update turno' })
    }
  },
)

// EVOLUCIONES
// Contenido clínico: solo administrador y profesional. Recepción y supervisor no acceden.
app.use('/api/evoluciones/:evolucionId/imagenes', evolucionImagenesRoutes)

app.get('/api/evoluciones', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = req.query.pacienteId ? Number(req.query.pacienteId) : undefined

  const where: any = { consultorioId, activo: true }
  if (pacienteId) where.pacienteId = pacienteId

  const evoluciones = await prisma.evolucion.findMany({ where, include: { profesional: true, grupo: true, imagenes: true } })
  res.json(evoluciones.map(evolucionParaCliente))
})

// Un grupo solo se puede asignar si es del mismo paciente (nunca cross-
// paciente/consultorio).
async function resolveGrupoParaAsignar(consultorioId: number, pacienteId: number, grupoId: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const grupo = await prisma.grupoEvolucion.findFirst({ where: { id: grupoId, consultorioId, pacienteId } })
  if (!grupo) return { ok: false, status: 404, error: 'grupo not found for this paciente' }
  return { ok: true }
}

// "Sesión X de Y": X es siempre count(turnos FINALIZADO del mismo paciente+
// grupo, sin contar el propio turno si se está editando) + 1 — nunca
// count(Evolucion)+1, que se desincroniza fácil (una evolución puede
// cargarse sin turno, o un turno puede tener más de una evolución). Ni
// CANCELADO ni AUSENTE cuentan como sesión realizada: mismo criterio que
// `sesionesRealizadas` en estadisticasService.ts (solo FINALIZADO). Es un
// valor prospectivo/default al crear o cambiar de diagnóstico — queda
// guardado en `numeroSesion` y sigue siendo editable a mano después,
// nunca recalculado por detrás sin que el usuario lo pida.
async function sesionAutomaticaParaGrupo(consultorioId: number, pacienteId: number, grupoId: number, excludeTurnoId?: number): Promise<number> {
  const completados = await prisma.turno.count({
    where: {
      consultorioId,
      pacienteId,
      grupoId,
      estado: 'FINALIZADO',
      NOT: excludeTurnoId ? { id: excludeTurnoId } : undefined,
    },
  })
  return completados + 1
}

app.post('/api/evoluciones', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const { pacienteId, turnoId, grupoId } = req.body
  if (!pacienteId) return res.status(400).json({ error: 'missing required fields' })

  // El HTML nunca se confía tal cual del cliente (aunque ya lo haya
  // sanitizado con DOMPurify en el editor) — se vuelve a sanitizar acá
  // contra la misma allowlist antes de persistir. `contenido` (texto plano)
  // se deriva del HTML ya sanitizado cuando hay formato aplicado, para que
  // nunca queden desincronizados; si no hay formato, sigue siendo el texto
  // plano de siempre (compatibilidad total con el flujo existente).
  let contenidoHtml: string | null = null
  let contenido: string = req.body.contenido || ''
  if (req.body.contenidoHtml) {
    contenidoHtml = sanitizeRichText(String(req.body.contenidoHtml))
    contenido = stripToPlainText(contenidoHtml) || contenido
  }
  if (!contenido.trim()) return res.status(400).json({ error: 'missing required fields' })

  // Autoría automática: el profesionalId sale siempre del vínculo del usuario
  // autenticado, nunca del cliente — Administrador incluido, ya no se acepta
  // un profesionalId arbitrario en el body.
  const profesionalId = await requireProfesionalVinculado(req, res)
  if (profesionalId === null) return

  try {
    const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
    if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })
    const profesional = await prisma.profesional.findFirst({ where: { id: profesionalId, consultorioId, activo: true } })
    if (!profesional) return res.status(404).json({ error: 'profesional not found in consultorio' })

    if (grupoId) {
      const check = await resolveGrupoParaAsignar(consultorioId, pacienteId, Number(grupoId))
      if (!check.ok) return res.status(check.status).json({ error: check.error })
    }

    const ev = await prisma.evolucion.create({
      data: { consultorioId, pacienteId, profesionalId, turnoId: turnoId || null, contenido, contenidoHtml, grupoId: grupoId || null },
      include: { profesional: true, grupo: true, imagenes: true },
    })
    res.status(201).json(evolucionParaCliente(ev))
  } catch (err) {
    // El detalle real (excepción/SQL de Prisma) va solo al log del server —
    // nunca al cliente, para no filtrar stack traces ni detalles internos.
    console.error('failed to create evolucion', err)
    res.status(500).json({ error: 'No se pudo guardar la evolución. Volvé a intentar.' })
  }
})

// Editar evolución: igual criterio que turnos (PATCH /turnos/:id) — el
// profesional solo edita las propias, administrador cualquiera del consultorio.
app.patch('/api/evoluciones/:evolucionId', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const evolucionId = Number(req.params.evolucionId)
  if (Number.isNaN(evolucionId)) return res.status(400).json({ error: 'invalid id' })

  const contenidoEnviado = 'contenido' in req.body || 'contenidoHtml' in req.body
  const grupoIdEnviado = 'grupoId' in req.body
  if (!contenidoEnviado && !grupoIdEnviado) return res.status(400).json({ error: 'nothing to update' })

  // Mismo criterio que el POST: el HTML se vuelve a sanitizar siempre acá,
  // nunca se confía en el que mandó el cliente; `contenido` se deriva del
  // HTML sanitizado cuando hay formato, para que no queden desincronizados.
  let contenido: string | undefined
  let contenidoHtml: string | null | undefined
  if (contenidoEnviado) {
    if ('contenidoHtml' in req.body && req.body.contenidoHtml) {
      contenidoHtml = sanitizeRichText(String(req.body.contenidoHtml))
      contenido = stripToPlainText(contenidoHtml) || req.body.contenido || ''
    } else if ('contenidoHtml' in req.body) {
      // contenidoHtml enviado vacío/null explícito: se está quitando el formato.
      contenidoHtml = null
      contenido = req.body.contenido
    } else {
      // No se tocó el formato, solo el texto plano.
      contenido = req.body.contenido
    }
    if (!contenido || !String(contenido).trim()) return res.status(400).json({ error: 'contenido required' })
  }

  const propioProfesionalId = await requireProfesionalVinculado(req, res)
  if (propioProfesionalId === null) return

  try {
    const evolucion = await prisma.evolucion.findFirst({ where: { id: evolucionId, consultorioId, activo: true } })
    if (!evolucion) return res.status(404).json({ error: 'evolucion not found in consultorio' })

    if (req.usuario!.rol === RolUsuario.PROFESIONAL && evolucion.profesionalId !== propioProfesionalId) {
      return res.status(403).json({ error: 'No podés editar evoluciones de otro profesional' })
    }

    const payload: any = {}
    if (contenido !== undefined) payload.contenido = contenido
    if (contenidoHtml !== undefined) payload.contenidoHtml = contenidoHtml
    if (grupoIdEnviado) {
      const grupoId = req.body.grupoId
      if (grupoId) {
        const check = await resolveGrupoParaAsignar(consultorioId, evolucion.pacienteId, Number(grupoId))
        if (!check.ok) return res.status(check.status).json({ error: check.error })
        payload.grupoId = Number(grupoId)
      } else {
        payload.grupoId = null
      }
    }

    const updated = await prisma.evolucion.update({ where: { id: evolucionId }, data: payload, include: { profesional: true, grupo: true, imagenes: true } })
    res.json(evolucionParaCliente(updated))
  } catch (err) {
    console.error('failed to update evolucion', err)
    res.status(500).json({ error: 'No se pudo guardar los cambios de la evolución. Volvé a intentar.' })
  }
})

// Borrado lógico: mismo criterio de permisos que PATCH (el profesional solo
// borra las propias, administrador cualquiera del consultorio). Se conserva
// la fila (activo: false) para no perder historial clínico/auditoría.
app.delete('/api/evoluciones/:evolucionId', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const evolucionId = Number(req.params.evolucionId)
  if (Number.isNaN(evolucionId)) return res.status(400).json({ error: 'invalid id' })

  const propioProfesionalId = await requireProfesionalVinculado(req, res)
  if (propioProfesionalId === null) return

  try {
    const evolucion = await prisma.evolucion.findFirst({ where: { id: evolucionId, consultorioId, activo: true } })
    if (!evolucion) return res.status(404).json({ error: 'evolucion not found in consultorio' })

    if (req.usuario!.rol === RolUsuario.PROFESIONAL && evolucion.profesionalId !== propioProfesionalId) {
      return res.status(403).json({ error: 'No podés eliminar evoluciones de otro profesional' })
    }

    await prisma.evolucion.update({ where: { id: evolucionId }, data: { activo: false } })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: 'failed to delete evolucion' })
  }
})

// GRUPOS DE EVOLUCIÓN
// Organización puramente visual de evoluciones (ej. "Lumbalgia") — nunca un
// Tratamiento/diagnóstico formal. Mismos roles que Evoluciones. Colores:
// misma paleta ya usada para Especialidad (frontend/src/utils/specialtyColors.ts),
// duplicada acá a propósito (es chica) para poder validarla en el backend.
const GRUPO_EVOLUCION_COLOR_TOKENS = [
  'var(--appointment-purple)',
  'var(--appointment-teal)',
  'var(--appointment-red)',
  'var(--appointment-amber)',
  'var(--appointment-sky)',
  'var(--appointment-pink)',
]

app.get('/api/pacientes/:pacienteId/grupos-evolucion', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const grupos = await prisma.grupoEvolucion.findMany({
    where: { consultorioId, pacienteId },
    orderBy: { createdAt: 'desc' },
  })
  res.json(grupos)
})

app.post('/api/pacientes/:pacienteId/grupos-evolucion', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const nombre = String(req.body.nombre || '').trim()
  const color = String(req.body.color || '')
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })
  if (!GRUPO_EVOLUCION_COLOR_TOKENS.includes(color)) return res.status(400).json({ error: 'color inválido' })

  // Cantidad de sesiones planificadas: opcional, entero positivo. Sin ella
  // (caso normal, comportamiento sin cambios) el grupo sigue siendo una
  // agrupación puramente visual, sin "Sesión X de Y" en ningún turno.
  let cantidadSesionesPlanificadas: number | null = null
  if (req.body.cantidadSesionesPlanificadas !== undefined && req.body.cantidadSesionesPlanificadas !== null && req.body.cantidadSesionesPlanificadas !== '') {
    const cantidad = Number(req.body.cantidadSesionesPlanificadas)
    if (!Number.isInteger(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'cantidadSesionesPlanificadas debe ser un entero positivo' })
    cantidadSesionesPlanificadas = cantidad
  }

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

  try {
    const grupo = await prisma.grupoEvolucion.create({ data: { consultorioId, pacienteId, nombre, color, cantidadSesionesPlanificadas } })
    res.status(201).json(grupo)
  } catch (err) {
    if (isPrismaUniqueViolation(err)) return res.status(409).json({ error: 'Ya existe un grupo con ese nombre para este paciente' })
    res.status(500).json({ error: 'failed to create grupo de evolución' })
  }
})

app.patch('/api/grupos-evolucion/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const grupo = await prisma.grupoEvolucion.findFirst({ where: { id, consultorioId } })
  if (!grupo) return res.status(404).json({ error: 'grupo not found in consultorio' })

  const payload: any = {}
  if (req.body.nombre !== undefined) {
    const nombre = String(req.body.nombre).trim()
    if (!nombre) return res.status(400).json({ error: 'nombre no puede estar vacío' })
    payload.nombre = nombre
  }
  if (req.body.color !== undefined) {
    if (!GRUPO_EVOLUCION_COLOR_TOKENS.includes(req.body.color)) return res.status(400).json({ error: 'color inválido' })
    payload.color = req.body.color
  }
  if (req.body.cantidadSesionesPlanificadas !== undefined) {
    if (req.body.cantidadSesionesPlanificadas === null || req.body.cantidadSesionesPlanificadas === '') {
      payload.cantidadSesionesPlanificadas = null
    } else {
      const cantidad = Number(req.body.cantidadSesionesPlanificadas)
      if (!Number.isInteger(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'cantidadSesionesPlanificadas debe ser un entero positivo' })
      payload.cantidadSesionesPlanificadas = cantidad
    }
  }

  try {
    const updated = await prisma.grupoEvolucion.update({ where: { id }, data: payload })
    res.json(updated)
  } catch (err) {
    if (isPrismaUniqueViolation(err)) return res.status(409).json({ error: 'Ya existe un grupo con ese nombre para este paciente' })
    res.status(500).json({ error: 'failed to update grupo de evolución' })
  }
})

// Elimina el grupo (nunca las evoluciones): la FK grupoId de Evolucion usa
// onDelete: SetNull, así que las evoluciones ya asignadas quedan "Sin grupo"
// automáticamente sin perder contenido.
app.delete('/api/grupos-evolucion/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const grupo = await prisma.grupoEvolucion.findFirst({ where: { id, consultorioId } })
  if (!grupo) return res.status(404).json({ error: 'grupo not found in consultorio' })

  await prisma.grupoEvolucion.delete({ where: { id } })
  res.status(204).end()
})

// Próxima "Sesión X" para este diagnóstico — el frontend la pide al elegir
// un Diagnóstico en el formulario de Turno, para mostrar el número real de
// una (en vez de un placeholder) antes de guardar. Mismo cálculo que usa el
// backend como default en POST/PATCH /api/turnos — ver sesionAutomaticaParaGrupo.
app.get('/api/grupos-evolucion/:id/proxima-sesion', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const grupo = await prisma.grupoEvolucion.findFirst({ where: { id, consultorioId } })
  if (!grupo) return res.status(404).json({ error: 'grupo not found in consultorio' })

  const numeroSesion = await sesionAutomaticaParaGrupo(consultorioId, grupo.pacienteId, id)
  res.json({ numeroSesion })
})

// FICHA INICIAL
// Contenido clínico: mismo alcance que evoluciones (administrador y profesional).
const FICHA_INICIAL_INCLUDE = {
  profesionalResponsable: true,
  antecedentes: { where: { activo: true }, include: { catalogoItem: true } },
  alergias: { where: { activa: true }, include: { catalogoItem: true } },
  medicaciones: { where: { activa: true } },
  estudios: { where: { activo: true }, include: { profesional: true } },
  alertasCampo: true,
  seccionesEstado: true,
} as const

app.get('/api/pacientes/:pacienteId/ficha-inicial', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

  // No existir ficha todavía es un estado normal, no un error: se devuelve
  // `null` en vez de 404, así el frontend distingue "sin ficha" de "sin acceso".
  const ficha = await prisma.fichaInicial.findUnique({ where: { pacienteId }, include: FICHA_INICIAL_INCLUDE })
  res.json(fichaParaCliente(ficha))
})

// Campos de texto libre de FichaInicial que el profesional puede marcar
// manualmente como alerta clínica (a diferencia de Antecedentes/Medicación,
// son columnas escalares sueltas, no filas de catálogo — ver FichaAlertaCampo
// en el schema). Whitelist deliberadamente chica: no cualquier campo amerita
// alerta (datos puramente administrativos como email/dirección quedan afuera
// a propósito).
const ELIGIBLE_ALERT_FIELDS: Record<string, { seccion: string; label: string }> = {
  motivoConsulta: { seccion: 'MOTIVO', label: 'Motivo de consulta' },
  diagnosticoDerivacion: { seccion: 'MOTIVO', label: 'Diagnóstico de derivación' },
  traumatismosAccidentes: { seccion: 'MOTIVO', label: 'Traumatismos / accidentes' },
  tratamientosPrevios: { seccion: 'MOTIVO', label: 'Tratamientos previos' },
  enfermedadesActuales: { seccion: 'SEGURIDAD', label: 'Enfermedades actuales' },
  dolorSintomas: { seccion: 'DOLOR_FUNCION', label: 'Dolor y síntomas' },
  limitacionesFuncionales: { seccion: 'DOLOR_FUNCION', label: 'Limitaciones funcionales' },
  hallazgosIniciales: { seccion: 'DOLOR_FUNCION', label: 'Hallazgos iniciales' },
  observacionesClinicas: { seccion: 'DOLOR_FUNCION', label: 'Observaciones clínicas' },
  estudiosComplementarios: { seccion: 'ESTUDIOS', label: 'Estudios complementarios' },
}

const FICHA_INICIAL_FIELDS = [
  'motivoConsulta',
  'fechaInicioProblema',
  'diagnosticoDerivacion',
  'objetivoPaciente',
  'antecedentesPersonales',
  'antecedentesFamiliares',
  'cirugias',
  'traumatismosAccidentes',
  'tratamientosPrevios',
  'alergiasEstado',
  'medicacionEstado',
  'enfermedadesActuales',
  'actividadFisica',
  'deportes',
  'ocupacion',
  'limitacionesFuncionales',
  'estudiosComplementarios',
  'dolorSintomas',
  'hallazgosIniciales',
  'observacionesClinicas',
  'tabaquismoEstado',
  'aniosFumador',
  'cigarrillosDiarios',
  'alcoholEstado',
  'sedentarismoEstado',
  'ejercicioMinutosDia',
  'menarcaEstado',
  'edadMenarca',
  'menopausiaEstado',
  'edadMenopausia',
  'gestas',
  'partos',
  'abortos',
  'observacionesGineco',
]

// Subconjunto de FICHA_INICIAL_FIELDS que mapea a un enum de Prisma
// (`EstadoDatoClinico`, nullable) — a diferencia del resto (`String?`), un
// string vacío no es un valor válido y Prisma lo rechaza. El frontend ya no
// debería mandar `''` acá (ver FICHA_ENUM_FIELDS en
// frontend/src/utils/fichaInicial.ts), pero esto es la frontera real de la
// API — nunca confiar solo en que el cliente lo haga bien.
const FICHA_ENUM_FIELDS = new Set([
  'alergiasEstado',
  'medicacionEstado',
  'tabaquismoEstado',
  'alcoholEstado',
  'sedentarismoEstado',
  'menarcaEstado',
  'menopausiaEstado',
])

app.patch('/api/pacientes/:pacienteId/ficha-inicial', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

  // Autoría: cualquier escritura clínica exige un profesional vinculado, sin
  // excepción de rol — Administrador incluido, ya no se autoasigna implícito.
  const profesionalId = await requireProfesionalVinculado(req, res)
  if (profesionalId === null) return

  const payload: any = {}
  for (const f of FICHA_INICIAL_FIELDS) {
    if (!(f in req.body)) continue
    const value = req.body[f]
    payload[f] = FICHA_ENUM_FIELDS.has(f) && value === '' ? null : value
  }
  if (payload.fechaInicioProblema) payload.fechaInicioProblema = new Date(payload.fechaInicioProblema)
  payload.profesionalResponsableId = profesionalId

  try {
    const ficha = await upsertFichaInicial(consultorioId, pacienteId, payload)
    const fresh = await recomputeSeccionesEstado(ficha.id, consultorioId)
    res.json(fichaParaCliente(fresh))
  } catch (err) {
    console.error('failed to save ficha inicial', err)
    res.status(500).json({ error: 'failed to save ficha inicial' })
  }
})

// Bajo escrituras concurrentes sobre una ficha que todavía no existe (por
// ejemplo: el autoguardado de un campo de texto y un PUT de alerta manual
// disparándose casi al mismo tiempo), dos `upsert` pueden evaluar "no
// existe, hay que crear" a la vez — uno choca contra el unique de
// `pacienteId` (P2002). No es un caso raro: es la carrera esperable de
// "upsert" sin lock explícito bajo escrituras concurrentes reales. Se
// resuelve reintentando como `update` puro: para cuando este catch corre,
// la otra escritura ya creó la fila. Bug real encontrado en producción
// (se manifestaba como "failed to save ficha inicial" + pérdida aparente
// de lo recién tipeado, ver también el guard de `pendingRef` en
// `frontend/src/hooks/useFichaInicial.ts`).
async function upsertFichaInicial(consultorioId: number, pacienteId: number, data: Record<string, any>) {
  try {
    return await prisma.fichaInicial.upsert({
      where: { pacienteId },
      create: { consultorioId, pacienteId, ...data },
      update: data,
    })
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return prisma.fichaInicial.update({ where: { pacienteId }, data })
    }
    throw err
  }
}

// Asegura que exista una FichaInicial (BORRADOR, sin campos) para poder
// colgarle antecedentes/alergias/medicación/estudios incluso si el
// profesional todavía no guardó ningún campo narrativo — mismo criterio de
// "upsert implícito, sin paso de creación separado" que ya usa el PATCH de arriba.
// Cada escritura (de cualquier sub-recurso) actualiza el responsable, para
// que refleje quién tocó la ficha por última vez.
async function getOrCreateFichaInicial(consultorioId: number, pacienteId: number, profesionalId: number) {
  return upsertFichaInicial(consultorioId, pacienteId, { profesionalResponsableId: profesionalId })
}

// ALERTAS MANUALES SOBRE CAMPOS DE FICHA INICIAL
// La existencia de la fila FichaAlertaCampo ES la alerta: marcar = upsert
// idempotente, desmarcar = borrar. Mismo criterio de autoría estricta que el
// resto de escritura clínica (requireProfesionalVinculado, sin excepción de rol).
app.put('/api/pacientes/:pacienteId/ficha-inicial/alertas-campo/:campo', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  const campo = String(req.params.campo)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })
  if (!ELIGIBLE_ALERT_FIELDS[campo]) return res.status(400).json({ error: 'campo no elegible para alerta' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

  const ficha = await getOrCreateFichaInicial(consultorioId, pacienteId, autorProfesionalId)
  const alerta = await prisma.fichaAlertaCampo.upsert({
    where: { fichaInicialId_campo: { fichaInicialId: ficha.id, campo } },
    create: { consultorioId, fichaInicialId: ficha.id, campo },
    update: {},
  })
  res.status(201).json(alerta)
})

app.delete('/api/pacientes/:pacienteId/ficha-inicial/alertas-campo/:campo', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  const campo = String(req.params.campo)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

  const ficha = await prisma.fichaInicial.findUnique({ where: { pacienteId } })
  if (ficha) {
    await prisma.fichaAlertaCampo.deleteMany({ where: { fichaInicialId: ficha.id, campo } })
  }
  res.status(204).end()
})

function isPrismaUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 'P2002')
}

function isAnswered(v: string | null | undefined): boolean {
  return v === 'SI' || v === 'NO'
}

// Estado de revisión por sección: se recalcula acá, nunca lo fija el
// cliente. Estudios no participa (pasó a ser una tab general, no una
// sección de la ficha) — su fila en FichaSeccionEstado queda sin usar.
// Una sección pasa a REVISADA en cuanto tiene algún dato cargado (no hace
// falta completarla entera) — empezar a completarla ya cuenta. El estado
// general de la ficha (BORRADOR/COMPLETA) se deriva de que las 5 secciones
// estén REVISADA — tampoco hay un botón manual para eso.
async function recomputeSeccionesEstado(fichaInicialId: number, consultorioId: number, autorProfesionalId?: number) {
  if (autorProfesionalId) {
    await prisma.fichaInicial.update({ where: { id: fichaInicialId }, data: { profesionalResponsableId: autorProfesionalId } })
  }
  const ficha = await prisma.fichaInicial.findUniqueOrThrow({ where: { id: fichaInicialId } })
  const antecedentesCount = await prisma.fichaAntecedente.count({ where: { fichaInicialId, activo: true } })
  const alergiasCount = await prisma.fichaAlergia.count({ where: { fichaInicialId, activa: true } })
  const medicacionesCount = await prisma.fichaMedicacion.count({ where: { fichaInicialId, activa: true } })

  const estados: Record<'MOTIVO' | 'ANTECEDENTES' | 'SEGURIDAD' | 'HABITOS' | 'DOLOR_FUNCION', 'PENDIENTE' | 'REVISADA'> = {
    MOTIVO: Boolean(
      ficha.motivoConsulta?.trim() || ficha.fechaInicioProblema || ficha.diagnosticoDerivacion?.trim()
        || ficha.objetivoPaciente?.trim() || ficha.tratamientosPrevios?.trim() || ficha.traumatismosAccidentes?.trim(),
    ) ? 'REVISADA' : 'PENDIENTE',
    ANTECEDENTES: antecedentesCount > 0 ? 'REVISADA' : 'PENDIENTE',
    SEGURIDAD: Boolean(
      isAnswered(ficha.alergiasEstado) || isAnswered(ficha.medicacionEstado) || ficha.enfermedadesActuales?.trim()
        || alergiasCount > 0 || medicacionesCount > 0,
    ) ? 'REVISADA' : 'PENDIENTE',
    HABITOS: Boolean(
      isAnswered(ficha.tabaquismoEstado) || isAnswered(ficha.alcoholEstado) || isAnswered(ficha.sedentarismoEstado)
        || ficha.actividadFisica?.trim() || ficha.deportes?.trim() || ficha.ocupacion?.trim() || ficha.ejercicioMinutosDia != null,
    ) ? 'REVISADA' : 'PENDIENTE',
    DOLOR_FUNCION: Boolean(
      ficha.dolorSintomas?.trim() || ficha.limitacionesFuncionales?.trim()
        || ficha.hallazgosIniciales?.trim() || ficha.observacionesClinicas?.trim(),
    ) ? 'REVISADA' : 'PENDIENTE',
  }

  for (const [seccion, estado] of Object.entries(estados)) {
    await prisma.fichaSeccionEstado.upsert({
      where: { fichaInicialId_seccion: { fichaInicialId, seccion: seccion as any } },
      create: { consultorioId, fichaInicialId, seccion: seccion as any, estado },
      update: { estado },
    })
  }

  const todasRevisadas = Object.values(estados).every((e) => e === 'REVISADA')
  await prisma.fichaInicial.update({ where: { id: fichaInicialId }, data: { estado: todasRevisadas ? 'COMPLETA' : 'BORRADOR' } })

  return prisma.fichaInicial.findUnique({ where: { id: fichaInicialId }, include: FICHA_INICIAL_INCLUDE })
}

// CATÁLOGO CLÍNICO
// Ítems de sistema (visibles para todos) + ítems personalizados del propio
// consultorio — nunca ítems personalizados de otro consultorio.
app.get('/api/catalogo-clinico', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const categoria = req.query.categoria as string | undefined
  const q = (req.query.q as string | undefined)?.trim()

  const where: any = { activo: true, OR: [{ consultorioId: null }, { consultorioId }] }
  if (categoria) where.categoria = categoria
  if (q) where.nombre = { contains: q }

  const items = await prisma.catalogoClinicoItem.findMany({ where, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] })
  res.json(items)
})

function slugifyCatalogo(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const CATEGORIAS_CATALOGO = ['ANTECEDENTE_PERSONAL', 'ANTECEDENTE_FAMILIAR', 'PROCEDIMIENTO_QUIRURGICO', 'ALERGIA']

// Ítem personalizado del consultorio autenticado. El profesional primero
// busca en /api/catalogo-clinico; esto es solo para cuando no existe.
app.post('/api/catalogo-clinico', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const { categoria, nombre } = req.body
  if (!CATEGORIAS_CATALOGO.includes(categoria) || !String(nombre || '').trim()) {
    return res.status(400).json({ error: 'categoria y nombre son requeridos' })
  }

  const nombreTrim = String(nombre).trim()
  const codigo = slugifyCatalogo(nombreTrim)

  // Duplicado evidente: mismo nombre normalizado ya visible para este
  // consultorio (de sistema o propio), activo, en la misma categoría.
  const existentes = await prisma.catalogoClinicoItem.findMany({
    where: { categoria, activo: true, OR: [{ consultorioId: null }, { consultorioId }] },
  })
  const duplicado = existentes.find((item) => slugifyCatalogo(item.nombre) === codigo)
  if (duplicado) return res.status(409).json({ error: 'Ya existe un ítem con ese nombre en esta categoría', item: duplicado })

  const item = await prisma.catalogoClinicoItem.create({
    data: { categoria, codigo, nombre: nombreTrim, esSistema: false, consultorioId, activo: true },
  })
  res.status(201).json(item)
})

// Renombrar un ítem personalizado propio (nunca uno de sistema ni de otro consultorio).
app.patch('/api/catalogo-clinico/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const item = await prisma.catalogoClinicoItem.findFirst({ where: { id, consultorioId, esSistema: false } })
  if (!item) return res.status(404).json({ error: 'catalogoItem not found in consultorio' })

  const nombreTrim = String(req.body.nombre || '').trim()
  if (!nombreTrim) return res.status(400).json({ error: 'nombre es requerido' })
  const codigo = slugifyCatalogo(nombreTrim)

  const existentes = await prisma.catalogoClinicoItem.findMany({
    where: { categoria: item.categoria, activo: true, OR: [{ consultorioId: null }, { consultorioId }] },
  })
  const duplicado = existentes.find((other) => other.id !== id && slugifyCatalogo(other.nombre) === codigo)
  if (duplicado) return res.status(409).json({ error: 'Ya existe un ítem con ese nombre en esta categoría', item: duplicado })

  const updated = await prisma.catalogoClinicoItem.update({ where: { id }, data: { nombre: nombreTrim, codigo } })
  res.json(updated)
})

// Inactivar un ítem personalizado propio (nunca uno de sistema ni de otro consultorio).
app.delete('/api/catalogo-clinico/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const item = await prisma.catalogoClinicoItem.findFirst({ where: { id, consultorioId, esSistema: false } })
  if (!item) return res.status(404).json({ error: 'catalogoItem not found in consultorio' })

  await prisma.catalogoClinicoItem.update({ where: { id }, data: { activo: false } })
  res.status(204).end()
})

// ANTECEDENTES (personales, familiares y quirúrgicos — misma tabla,
// discriminada por catalogoItem.categoria)
app.post('/api/pacientes/:pacienteId/ficha-inicial/antecedentes', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const { catalogoItemId, estado, detalle, fechaAproximada, edadAproximada, parentesco, esAlertaClinica } = req.body
  if (!catalogoItemId || (estado !== 'SI' && estado !== 'NO')) {
    return res.status(400).json({ error: 'catalogoItemId y estado (SI|NO) son requeridos' })
  }

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

  // Visible = de sistema, o personalizado del propio consultorio — nunca de otro.
  const catalogoItem = await prisma.catalogoClinicoItem.findFirst({
    where: { id: Number(catalogoItemId), activo: true, OR: [{ consultorioId: null }, { consultorioId }] },
  })
  if (!catalogoItem) return res.status(404).json({ error: 'catalogoItem not found' })

  try {
    const ficha = await getOrCreateFichaInicial(consultorioId, pacienteId, autorProfesionalId)
    const data = {
      estado,
      detalle: detalle || null,
      fechaAproximada: fechaAproximada ? new Date(fechaAproximada) : null,
      edadAproximada: edadAproximada ?? null,
      parentesco: parentesco || null,
      esAlertaClinica: Boolean(esAlertaClinica),
      activo: true,
    }
    // `@@unique([fichaInicialId, catalogoItemId])` sigue existiendo aunque el
    // registro esté inactivo (soft-delete) — si el profesional saca un
    // antecedente y lo vuelve a agregar, hay que reactivar esa fila en vez de
    // crear una nueva, o el `create` de abajo choca contra su propio historial.
    // Si la fila existente sigue activa, es un duplicado real → 409.
    const existente = await prisma.fichaAntecedente.findUnique({
      where: { fichaInicialId_catalogoItemId: { fichaInicialId: ficha.id, catalogoItemId: catalogoItem.id } },
    })
    if (existente?.activo) return res.status(409).json({ error: 'Ese antecedente ya está cargado en esta ficha' })
    const antecedente = existente
      ? await prisma.fichaAntecedente.update({ where: { id: existente.id }, data, include: { catalogoItem: true } })
      : await prisma.fichaAntecedente.create({
          data: { consultorioId, fichaInicialId: ficha.id, catalogoItemId: catalogoItem.id, ...data },
          include: { catalogoItem: true },
        })
    await recomputeSeccionesEstado(ficha.id, consultorioId, autorProfesionalId)
    res.status(existente ? 200 : 201).json(antecedente)
  } catch (err) {
    console.error('failed to create antecedente', err)
    res.status(500).json({ error: 'failed to create antecedente' })
  }
})

app.patch('/api/ficha-antecedentes/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const antecedente = await prisma.fichaAntecedente.findFirst({ where: { id, consultorioId } })
  if (!antecedente) return res.status(404).json({ error: 'antecedente not found in consultorio' })

  const { estado, detalle, fechaAproximada, edadAproximada, parentesco, esAlertaClinica } = req.body
  if (estado !== undefined && estado !== 'SI' && estado !== 'NO') {
    return res.status(400).json({ error: 'estado inválido' })
  }

  const payload: any = {}
  if (estado !== undefined) payload.estado = estado
  if (detalle !== undefined) payload.detalle = detalle || null
  if (fechaAproximada !== undefined) payload.fechaAproximada = fechaAproximada ? new Date(fechaAproximada) : null
  if (edadAproximada !== undefined) payload.edadAproximada = edadAproximada
  if (parentesco !== undefined) payload.parentesco = parentesco || null
  if (esAlertaClinica !== undefined) payload.esAlertaClinica = Boolean(esAlertaClinica)

  const updated = await prisma.fichaAntecedente.update({ where: { id }, data: payload, include: { catalogoItem: true } })
  await recomputeSeccionesEstado(antecedente.fichaInicialId, consultorioId, autorProfesionalId)
  res.json(updated)
})

app.delete('/api/ficha-antecedentes/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const antecedente = await prisma.fichaAntecedente.findFirst({ where: { id, consultorioId } })
  if (!antecedente) return res.status(404).json({ error: 'antecedente not found in consultorio' })

  await prisma.fichaAntecedente.update({ where: { id }, data: { activo: false } })
  await recomputeSeccionesEstado(antecedente.fichaInicialId, consultorioId, autorProfesionalId)
  res.status(204).end()
})

// ALERGIAS
app.post('/api/pacientes/:pacienteId/ficha-inicial/alergias', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const { catalogoItemId, nombreLibre, reaccion, gravedad, observaciones } = req.body
  if (!catalogoItemId && !nombreLibre?.trim()) {
    return res.status(400).json({ error: 'catalogoItemId o nombreLibre son requeridos' })
  }

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

  if (catalogoItemId) {
    const catalogoItem = await prisma.catalogoClinicoItem.findFirst({
      where: { id: Number(catalogoItemId), activo: true, categoria: 'ALERGIA', OR: [{ consultorioId: null }, { consultorioId }] },
    })
    if (!catalogoItem) return res.status(404).json({ error: 'catalogoItem not found' })
  }

  const ficha = await getOrCreateFichaInicial(consultorioId, pacienteId, autorProfesionalId)
  const alergia = await prisma.fichaAlergia.create({
    data: {
      consultorioId,
      fichaInicialId: ficha.id,
      catalogoItemId: catalogoItemId ? Number(catalogoItemId) : null,
      nombreLibre: nombreLibre || null,
      reaccion: reaccion || null,
      gravedad: gravedad || null,
      observaciones: observaciones || null,
    },
    include: { catalogoItem: true },
  })
  await recomputeSeccionesEstado(ficha.id, consultorioId, autorProfesionalId)
  res.status(201).json(alergia)
})

app.patch('/api/ficha-alergias/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const alergia = await prisma.fichaAlergia.findFirst({ where: { id, consultorioId } })
  if (!alergia) return res.status(404).json({ error: 'alergia not found in consultorio' })

  const { reaccion, gravedad, observaciones } = req.body
  const payload: any = {}
  if (reaccion !== undefined) payload.reaccion = reaccion || null
  if (gravedad !== undefined) payload.gravedad = gravedad || null
  if (observaciones !== undefined) payload.observaciones = observaciones || null

  const updated = await prisma.fichaAlergia.update({ where: { id }, data: payload, include: { catalogoItem: true } })
  await prisma.fichaInicial.update({ where: { id: alergia.fichaInicialId }, data: { profesionalResponsableId: autorProfesionalId } })
  res.json(updated)
})

app.delete('/api/ficha-alergias/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const alergia = await prisma.fichaAlergia.findFirst({ where: { id, consultorioId } })
  if (!alergia) return res.status(404).json({ error: 'alergia not found in consultorio' })

  await prisma.fichaAlergia.update({ where: { id }, data: { activa: false } })
  await recomputeSeccionesEstado(alergia.fichaInicialId, consultorioId, autorProfesionalId)
  res.status(204).end()
})

// MEDICACIÓN (sin catálogo — nombre es texto libre)
app.post('/api/pacientes/:pacienteId/ficha-inicial/medicacion', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const { nombre, dosis, unidad, frecuencia, via, motivo, observaciones, esAlertaClinica } = req.body
  if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' })

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

  const ficha = await getOrCreateFichaInicial(consultorioId, pacienteId, autorProfesionalId)
  const medicacion = await prisma.fichaMedicacion.create({
    data: {
      consultorioId,
      fichaInicialId: ficha.id,
      nombre,
      dosis: dosis || null,
      unidad: unidad || null,
      frecuencia: frecuencia || null,
      via: via || null,
      motivo: motivo || null,
      observaciones: observaciones || null,
      esAlertaClinica: Boolean(esAlertaClinica),
    },
  })
  await recomputeSeccionesEstado(ficha.id, consultorioId, autorProfesionalId)
  res.status(201).json(medicacion)
})

app.patch('/api/ficha-medicacion/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const medicacion = await prisma.fichaMedicacion.findFirst({ where: { id, consultorioId } })
  if (!medicacion) return res.status(404).json({ error: 'medicacion not found in consultorio' })

  const { nombre, dosis, unidad, frecuencia, via, motivo, observaciones, esAlertaClinica } = req.body
  const payload: any = {}
  if (nombre !== undefined) {
    if (!String(nombre).trim()) return res.status(400).json({ error: 'nombre no puede estar vacío' })
    payload.nombre = nombre
  }
  if (dosis !== undefined) payload.dosis = dosis || null
  if (unidad !== undefined) payload.unidad = unidad || null
  if (frecuencia !== undefined) payload.frecuencia = frecuencia || null
  if (via !== undefined) payload.via = via || null
  if (motivo !== undefined) payload.motivo = motivo || null
  if (observaciones !== undefined) payload.observaciones = observaciones || null
  if (esAlertaClinica !== undefined) payload.esAlertaClinica = Boolean(esAlertaClinica)

  const updated = await prisma.fichaMedicacion.update({ where: { id }, data: payload })
  await prisma.fichaInicial.update({ where: { id: medicacion.fichaInicialId }, data: { profesionalResponsableId: autorProfesionalId } })
  res.json(updated)
})

app.delete('/api/ficha-medicacion/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const medicacion = await prisma.fichaMedicacion.findFirst({ where: { id, consultorioId } })
  if (!medicacion) return res.status(404).json({ error: 'medicacion not found in consultorio' })

  await prisma.fichaMedicacion.update({ where: { id }, data: { activa: false } })
  await recomputeSeccionesEstado(medicacion.fichaInicialId, consultorioId, autorProfesionalId)
  res.status(204).end()
})

// ESTUDIOS COMPLEMENTARIOS (entradas individuales; el campo de texto libre
// `estudiosComplementarios` en FichaInicial se mantiene como nota general)
app.use('/api/ficha-estudios/:id/archivo', estudioArchivoRoutes)

app.post('/api/pacientes/:pacienteId/ficha-inicial/estudios', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const { tipo, fecha, resumen, observaciones } = req.body
  if (!tipo?.trim()) return res.status(400).json({ error: 'tipo es requerido' })

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId, activo: true } })
  if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

  const ficha = await getOrCreateFichaInicial(consultorioId, pacienteId, autorProfesionalId)
  const estudio = await prisma.fichaEstudioComplementario.create({
    data: {
      consultorioId,
      fichaInicialId: ficha.id,
      profesionalId: autorProfesionalId,
      tipo,
      fecha: fecha ? new Date(fecha) : null,
      resumen: resumen || null,
      observaciones: observaciones || null,
    },
    include: { profesional: true },
  })
  res.status(201).json(estudioParaCliente(estudio))
})

app.patch('/api/ficha-estudios/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const estudio = await prisma.fichaEstudioComplementario.findFirst({ where: { id, consultorioId } })
  if (!estudio) return res.status(404).json({ error: 'estudio not found in consultorio' })

  const { tipo, fecha, resumen, observaciones } = req.body
  const payload: any = {}
  if (tipo !== undefined) {
    if (!String(tipo).trim()) return res.status(400).json({ error: 'tipo no puede estar vacío' })
    payload.tipo = tipo
  }
  if (fecha !== undefined) payload.fecha = fecha ? new Date(fecha) : null
  if (resumen !== undefined) payload.resumen = resumen || null
  if (observaciones !== undefined) payload.observaciones = observaciones || null

  const updated = await prisma.fichaEstudioComplementario.update({ where: { id }, data: payload })
  res.json(estudioParaCliente(updated))
})

app.delete('/api/ficha-estudios/:id', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  const estudio = await prisma.fichaEstudioComplementario.findFirst({ where: { id, consultorioId } })
  if (!estudio) return res.status(404).json({ error: 'estudio not found in consultorio' })

  await prisma.fichaEstudioComplementario.update({ where: { id }, data: { activo: false } })
  res.status(204).end()
})

export default app

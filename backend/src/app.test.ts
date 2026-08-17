import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from './app'
import prisma from './prisma'
import { hashPassword } from './auth'
import { RolUsuario, EstadoTurno } from './generated/prisma/client'
import { seedCatalogosGlobales } from './seedCatalogosGlobales'

// Los tests no tienen un BLOB_READ_WRITE_TOKEN real ni acceso de red a
// Vercel Blob — se mockea el módulo para poder probar validación/permisos/
// persistencia del endpoint de imágenes sin depender de esa infraestructura.
// vitest hoistea este vi.mock por encima de los imports de arriba.
let blobStoreCounter = 0
const fakeBlobStore = new Map<string, Buffer>()
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (pathname: string, body: Buffer) => {
    blobStoreCounter += 1
    const finalPathname = `${pathname}-${blobStoreCounter}`
    fakeBlobStore.set(finalPathname, Buffer.isBuffer(body) ? body : Buffer.from(body))
    return { url: `https://blob.test/${finalPathname}`, pathname: finalPathname }
  }),
  del: vi.fn(async (pathname: string) => {
    fakeBlobStore.delete(pathname)
  }),
  // Fake de `get()` con `access: 'private'`: devuelve el mismo buffer que se
  // guardó en `put()`, envuelto en un ReadableStream real — así los tests
  // de las rutas `/contenido` verifican el contenido de punta a punta, sin
  // red ni token real.
  get: vi.fn(async (pathname: string) => {
    const data = fakeBlobStore.get(pathname)
    if (!data) return null
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(data))
        controller.close()
      },
    })
    return {
      statusCode: 200,
      stream,
      headers: new Headers(),
      blob: {
        url: `https://blob.test/${pathname}`,
        downloadUrl: '',
        pathname,
        contentDisposition: '',
        cacheControl: '',
        uploadedAt: new Date(),
        etag: '',
        contentType: 'application/octet-stream',
        size: data.length,
      },
    }
  }),
}))

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = 'Password123'

function loginRequest(email: string, password = PASSWORD) {
  return request(app).post('/auth/login').send({ email, password })
}

function cookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
  if (!cookie) throw new Error('login sin cookie de sesión')
  return cookie.split(';')[0]
}

describe('registro público', () => {
  const email = `admin-${RUN_ID}@registro.test`

  afterAll(async () => {
    const usuario = await prisma.usuario.findUnique({ where: { email } })
    if (usuario) {
      await prisma.usuario.delete({ where: { id: usuario.id } })
      await prisma.consultorio.delete({ where: { id: usuario.consultorioId } })
    }
  })

  it('crea un consultorio y su administrador, ignorando rol/consultorioId enviados por el cliente', async () => {
    const res = await request(app).post('/auth/register').send({
      nombreConsultorio: `Consultorio Registro ${RUN_ID}`,
      nombre: 'Ana',
      apellido: 'Pérez',
      email,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      rol: 'SUPERVISOR',
      consultorioId: 999999,
    })

    expect(res.status).toBe(201)
    expect(res.body.rol).toBe('ADMINISTRADOR')
    expect(res.body.consultorioId).not.toBe(999999)
    expect(res.body).not.toHaveProperty('passwordHash')
  })
})

describe('auth, roles y aislamiento por consultorio', () => {
  let consultorioAId: number
  let consultorioBId: number
  let profesionalAId: number
  let otroProfesionalAId: number
  let profesionalAdminAId: number
  let profesionalBId: number
  let pacienteAId: number
  let pacienteBId: number
  let turnoAId: number
  let especialidadAId: number

  const emails = {
    adminA: `admin-a-${RUN_ID}@test.local`,
    recepcionA: `recepcion-a-${RUN_ID}@test.local`,
    supervisorA: `supervisor-a-${RUN_ID}@test.local`,
    profesionalA: `profesional-a-${RUN_ID}@test.local`,
    profesionalSinVinculo: `profesional-sinvinculo-${RUN_ID}@test.local`,
    inactivo: `inactivo-${RUN_ID}@test.local`,
    adminB: `admin-b-${RUN_ID}@test.local`,
  }

  const cookies: Record<string, string> = {}

  beforeAll(async () => {
    const passwordHash = await hashPassword(PASSWORD)

    const consultorioA = await prisma.consultorio.create({ data: { nombre: `Consultorio A ${RUN_ID}`, slug: `consultorio-a-${RUN_ID}` } })
    const consultorioB = await prisma.consultorio.create({ data: { nombre: `Consultorio B ${RUN_ID}`, slug: `consultorio-b-${RUN_ID}` } })
    consultorioAId = consultorioA.id
    consultorioBId = consultorioB.id

    const especialidad = await prisma.especialidad.create({ data: { consultorioId: consultorioAId, nombre: `Kinesiología ${RUN_ID}`, color: '#fff' } })
    especialidadAId = especialidad.id

    const profesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Prof', apellido: 'Uno' } })
    profesionalAId = profesional.id
    const otroProfesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Prof', apellido: 'Dos' } })
    otroProfesionalAId = otroProfesional.id
    // Autoría clínica: escribir contenido clínico exige un profesional
    // vinculado incluso para Administrador — cada admin de test necesita el suyo.
    const profesionalAdminA = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Prof', apellido: 'AdminA' } })
    profesionalAdminAId = profesionalAdminA.id
    const profesionalB = await prisma.profesional.create({ data: { consultorioId: consultorioBId, nombre: 'Prof', apellido: 'B' } })
    profesionalBId = profesionalB.id

    await prisma.profesionalEspecialidad.create({ data: { consultorioId: consultorioAId, profesionalId: profesionalAId, especialidadId: especialidadAId } })

    const paciente = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'Paciente', apellido: 'A' } })
    pacienteAId = paciente.id
    const pacienteB = await prisma.paciente.create({ data: { consultorioId: consultorioBId, nombre: 'Paciente', apellido: 'B' } })
    pacienteBId = pacienteB.id

    const turno = await prisma.turno.create({
      data: {
        consultorioId: consultorioAId,
        pacienteId: pacienteAId,
        profesionalId: profesionalAId,
        especialidadId: especialidadAId,
        inicio: new Date('2026-08-01T12:00:00.000Z'),
        duracionMinutos: 60,
      },
    })
    turnoAId = turno.id

    await prisma.usuario.createMany({
      data: [
        { consultorioId: consultorioAId, nombre: 'Admin', apellido: 'A', email: emails.adminA, passwordHash, rol: RolUsuario.ADMINISTRADOR, profesionalId: profesionalAdminAId },
        { consultorioId: consultorioAId, nombre: 'Recepcion', apellido: 'A', email: emails.recepcionA, passwordHash, rol: RolUsuario.RECEPCION },
        { consultorioId: consultorioAId, nombre: 'Supervisor', apellido: 'A', email: emails.supervisorA, passwordHash, rol: RolUsuario.SUPERVISOR },
        { consultorioId: consultorioAId, nombre: 'Profesional', apellido: 'A', email: emails.profesionalA, passwordHash, rol: RolUsuario.PROFESIONAL, profesionalId: profesionalAId },
        { consultorioId: consultorioAId, nombre: 'Profesional', apellido: 'SinVinculo', email: emails.profesionalSinVinculo, passwordHash, rol: RolUsuario.PROFESIONAL },
        { consultorioId: consultorioAId, nombre: 'Inactivo', apellido: 'A', email: emails.inactivo, passwordHash, rol: RolUsuario.ADMINISTRADOR, activo: false },
        { consultorioId: consultorioBId, nombre: 'Admin', apellido: 'B', email: emails.adminB, passwordHash, rol: RolUsuario.ADMINISTRADOR, profesionalId: profesionalBId },
      ],
    })

    for (const [key, email] of Object.entries(emails)) {
      if (key === 'inactivo') continue
      const res = await loginRequest(email)
      cookies[key] = cookieFrom(res)
    }
  })

  afterAll(async () => {
    await prisma.turno.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.evolucion.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    // Las tablas hijas de FichaInicial tienen FK ON DELETE RESTRICT: hay que
    // borrarlas antes que la ficha, o el delete de abajo falla.
    await prisma.fichaAntecedente.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.fichaAlergia.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.fichaMedicacion.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.fichaEstudioComplementario.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.fichaSeccionEstado.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.fichaInicial.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    // FichaAlertaCampo se borra en cascada con FichaInicial (onDelete: Cascade).
    await prisma.grupoEvolucion.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.profesionalEspecialidad.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.usuario.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.paciente.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.obraSocial.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.profesional.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.especialidad.deleteMany({ where: { consultorioId: { in: [consultorioAId, consultorioBId] } } })
    await prisma.consultorio.deleteMany({ where: { id: { in: [consultorioAId, consultorioBId] } } })
  })

  it('login con contraseña incorrecta devuelve 401 genérico', async () => {
    const res = await loginRequest(emails.adminA, 'incorrecta')
    expect(res.status).toBe(401)
    expect(res.body.error).not.toMatch(/no existe|not found/i)
  })

  it('login de usuario inactivo devuelve el mismo error genérico', async () => {
    const res = await loginRequest(emails.inactivo)
    expect(res.status).toBe(401)
  })

  it('login válido no expone passwordHash', async () => {
    const res = await loginRequest(emails.adminA)
    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('passwordHash')
  })

  it('/auth/me requiere sesión', async () => {
    const res = await request(app).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('/auth/me no expone passwordHash', async () => {
    const res = await request(app).get('/auth/me').set('Cookie', cookies.adminA)
    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('passwordHash')
  })

  it('un usuario del consultorio A no puede leer un paciente del consultorio B', async () => {
    const res = await request(app).get(`/api/pacientes/${pacienteBId}`).set('Cookie', cookies.adminA)
    expect(res.status).toBe(404)
  })

  it('la lista de pacientes del consultorio A no incluye pacientes del consultorio B', async () => {
    const res = await request(app).get('/api/pacientes').set('Cookie', cookies.adminA)
    expect(res.status).toBe(200)
    expect(res.body.some((p: any) => p.id === pacienteBId)).toBe(false)
  })

  it('recepción puede editar fecha de nacimiento, dirección y número de afiliado del paciente', async () => {
    const res = await request(app)
      .patch(`/api/pacientes/${pacienteAId}`)
      .set('Cookie', cookies.recepcionA)
      .send({ fechaNacimiento: '1990-05-20', direccion: 'Calle Falsa 123', numeroAfiliado: 'AF-001' })

    expect(res.status).toBe(200)
    expect(res.body.fechaNacimiento).toMatch(/^1990-05-20/)
    expect(res.body.direccion).toBe('Calle Falsa 123')
    expect(res.body.numeroAfiliado).toBe('AF-001')
  })

  it('enviar fechaNacimiento vacío la limpia (null)', async () => {
    const res = await request(app)
      .patch(`/api/pacientes/${pacienteAId}`)
      .set('Cookie', cookies.adminA)
      .send({ fechaNacimiento: '' })

    expect(res.status).toBe(200)
    expect(res.body.fechaNacimiento).toBeNull()
  })

  it('un usuario del consultorio A no puede editar un paciente del consultorio B', async () => {
    const res = await request(app)
      .patch(`/api/pacientes/${pacienteBId}`)
      .set('Cookie', cookies.adminA)
      .send({ nombre: 'Hackeado' })

    expect(res.status).toBe(404)
  })

  it('recepción no puede crear una evolución', async () => {
    const res = await request(app)
      .post('/api/evoluciones')
      .set('Cookie', cookies.recepcionA)
      .send({ pacienteId: pacienteAId, profesionalId: profesionalAId, contenido: 'texto clínico' })
    expect(res.status).toBe(403)
  })

  it('recepción no puede leer evoluciones', async () => {
    const res = await request(app).get('/api/evoluciones').set('Cookie', cookies.recepcionA)
    expect(res.status).toBe(403)
  })

  it('supervisor puede modificar turnos del propio consultorio (dato administrativo, no clínico)', async () => {
    const res = await request(app).patch(`/api/turnos/${turnoAId}`).set('Cookie', cookies.supervisorA).send({ notas: 'intento' })
    expect(res.status).toBe(200)
  })

  it('profesional puede operar su propio turno', async () => {
    const res = await request(app)
      .patch(`/api/turnos/${turnoAId}`)
      .set('Cookie', cookies.profesionalA)
      .send({ estado: 'ATENDIENDO' })
    expect(res.status).toBe(200)
    expect(res.body.estado).toBe('ATENDIENDO')
  })

  it('profesional no puede modificar el turno de otro profesional', async () => {
    const otroTurno = await prisma.turno.create({
      data: {
        consultorioId: consultorioAId,
        pacienteId: pacienteAId,
        profesionalId: otroProfesionalAId,
        especialidadId: especialidadAId,
        inicio: new Date('2026-08-01T15:00:00.000Z'),
        duracionMinutos: 60,
      },
    })

    const res = await request(app).patch(`/api/turnos/${otroTurno.id}`).set('Cookie', cookies.profesionalA).send({ notas: 'no debería poder' })
    expect(res.status).toBe(403)

    await prisma.turno.delete({ where: { id: otroTurno.id } })
  })

  it('profesional sin vínculo a un Profesional recibe un error controlado, no acceso total', async () => {
    const res = await request(app).patch(`/api/turnos/${turnoAId}`).set('Cookie', cookies.profesionalSinVinculo).send({ notas: 'x' })
    expect(res.status).toBe(403)
  })

  it('un profesional sin la especialidad asignada en su ficha igual puede recibir un turno con esa especialidad', async () => {
    // otroProfesionalAId no tiene ninguna especialidad asignada (solo
    // profesionalAId tiene especialidadAId en el fixture de este describe).
    const sinEspecialidad = await prisma.profesionalEspecialidad.count({ where: { profesionalId: otroProfesionalAId } })
    expect(sinEspecialidad).toBe(0)

    const res = await request(app)
      .post('/api/turnos')
      .set('Cookie', cookies.adminA)
      .send({
        pacienteId: pacienteAId,
        profesionalId: otroProfesionalAId,
        especialidadId: especialidadAId,
        inicio: '2026-08-01T20:00:00.000Z',
        duracionMinutos: 30,
      })
    expect(res.status).toBe(201)
    expect(res.body.profesionalId).toBe(otroProfesionalAId)
    expect(res.body.especialidadId).toBe(especialidadAId)

    await prisma.turno.delete({ where: { id: res.body.id } })
  })

  it('rechaza crear un turno con una especialidad de otro consultorio', async () => {
    const especialidadB = await prisma.especialidad.create({ data: { consultorioId: consultorioBId, nombre: `Especialidad Turno B ${RUN_ID}`, color: '#222' } })

    const res = await request(app)
      .post('/api/turnos')
      .set('Cookie', cookies.adminA)
      .send({
        pacienteId: pacienteAId,
        profesionalId: profesionalAId,
        especialidadId: especialidadB.id,
        inicio: '2026-08-01T21:00:00.000Z',
        duracionMinutos: 30,
      })
    expect(res.status).toBe(404)

    await prisma.especialidad.delete({ where: { id: especialidadB.id } })
  })

  it('rechaza crear un turno con un profesional de otro consultorio', async () => {
    const res = await request(app)
      .post('/api/turnos')
      .set('Cookie', cookies.adminA)
      .send({
        pacienteId: pacienteAId,
        profesionalId: profesionalBId,
        especialidadId: especialidadAId,
        inicio: '2026-08-01T22:00:00.000Z',
        duracionMinutos: 30,
      })
    expect(res.status).toBe(404)
  })

  it('la misma regla aplica al editar: se puede cambiar a una especialidad que el profesional no tiene asignada', async () => {
    const turno = await prisma.turno.create({
      data: {
        consultorioId: consultorioAId,
        pacienteId: pacienteAId,
        profesionalId: otroProfesionalAId,
        especialidadId: especialidadAId,
        inicio: new Date('2026-08-02T15:00:00.000Z'),
        duracionMinutos: 30,
      },
    })

    const otraEspecialidad = await prisma.especialidad.create({ data: { consultorioId: consultorioAId, nombre: `Otra Especialidad ${RUN_ID}`, color: '#654321' } })

    const res = await request(app)
      .patch(`/api/turnos/${turno.id}`)
      .set('Cookie', cookies.adminA)
      .send({ especialidadId: otraEspecialidad.id })
    expect(res.status).toBe(200)
    expect(res.body.especialidadId).toBe(otraEspecialidad.id)

    await prisma.turno.delete({ where: { id: turno.id } })
    await prisma.especialidad.delete({ where: { id: otraEspecialidad.id } })
  })

  it('profesional crea un turno para sí mismo aunque envíe el profesionalId de otro profesional', async () => {
    const res = await request(app)
      .post('/api/turnos')
      .set('Cookie', cookies.profesionalA)
      .send({
        pacienteId: pacienteAId,
        profesionalId: otroProfesionalAId,
        especialidadId: especialidadAId,
        inicio: '2026-08-01T18:00:00.000Z',
        duracionMinutos: 30,
      })
    expect(res.status).toBe(201)
    expect(res.body.profesionalId).toBe(profesionalAId)

    await prisma.turno.delete({ where: { id: res.body.id } })
  })

  it('profesional sin vínculo activo no puede crear turnos', async () => {
    const res = await request(app)
      .post('/api/turnos')
      .set('Cookie', cookies.profesionalSinVinculo)
      .send({
        pacienteId: pacienteAId,
        profesionalId: profesionalAId,
        especialidadId: especialidadAId,
        inicio: '2026-08-01T19:00:00.000Z',
        duracionMinutos: 30,
      })
    expect(res.status).toBe(403)
  })

  it('profesional no puede reasignar su propio turno a otro profesional', async () => {
    const res = await request(app)
      .patch(`/api/turnos/${turnoAId}`)
      .set('Cookie', cookies.profesionalA)
      .send({ profesionalId: otroProfesionalAId, notas: 'intento de reasignar' })
    expect(res.status).toBe(200)
    expect(res.body.profesionalId).toBe(profesionalAId)
    expect(res.body.notas).toBe('intento de reasignar')
  })

  it('administrador puede gestionar recursos de su propio consultorio', async () => {
    const res = await request(app)
      .post('/api/pacientes')
      .set('Cookie', cookies.adminA)
      .send({
        nombre: 'Nuevo',
        apellido: 'Paciente',
        fechaNacimiento: '1995-04-10',
        direccion: 'Av. Siempre Viva 742',
        numeroAfiliado: 'AF-999',
      })
    expect(res.status).toBe(201)
    expect(res.body.consultorioId).toBe(consultorioAId)
    expect(res.body.fechaNacimiento).toMatch(/^1995-04-10/)
    expect(res.body.direccion).toBe('Av. Siempre Viva 742')
    expect(res.body.numeroAfiliado).toBe('AF-999')

    await prisma.paciente.delete({ where: { id: res.body.id } })
  })

  it('desactivar un paciente (baja lógica) lo saca del listado sin borrar el registro', async () => {
    const created = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'Baja', apellido: 'Logica' } })

    const patchRes = await request(app)
      .patch(`/api/pacientes/${created.id}`)
      .set('Cookie', cookies.adminA)
      .send({ activo: false })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.activo).toBe(false)

    const listRes = await request(app).get('/api/pacientes').set('Cookie', cookies.adminA)
    expect(listRes.body.some((p: any) => p.id === created.id)).toBe(false)

    const getRes = await request(app).get(`/api/pacientes/${created.id}`).set('Cookie', cookies.adminA)
    expect(getRes.status).toBe(200)

    await prisma.paciente.delete({ where: { id: created.id } })
  })

  describe('evoluciones: edición', () => {
    it('profesional puede editar su propia evolución', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'contenido original' })
      expect(created.status).toBe(201)

      const res = await request(app)
        .patch(`/api/evoluciones/${created.body.id}`)
        .set('Cookie', cookies.profesionalA)
        .send({ contenido: 'contenido editado' })
      expect(res.status).toBe(200)
      expect(res.body.contenido).toBe('contenido editado')
    })

    it('profesional no puede editar una evolución de otro profesional', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'de profesionalA' })
      expect(created.status).toBe(201)

      const passwordHash = await hashPassword(PASSWORD)
      const otroEmail = `otro-profesional-${RUN_ID}@test.local`
      await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'Otro', apellido: 'Prof', email: otroEmail, passwordHash, rol: RolUsuario.PROFESIONAL, profesionalId: otroProfesionalAId },
      })
      const otroCookie = cookieFrom(await loginRequest(otroEmail))

      const res = await request(app)
        .patch(`/api/evoluciones/${created.body.id}`)
        .set('Cookie', otroCookie)
        .send({ contenido: 'intento ajeno' })
      expect(res.status).toBe(403)
    })

    it('administrador puede editar cualquier evolución del consultorio', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'para editar por admin' })
      expect(created.status).toBe(201)

      const res = await request(app)
        .patch(`/api/evoluciones/${created.body.id}`)
        .set('Cookie', cookies.adminA)
        .send({ contenido: 'editado por admin' })
      expect(res.status).toBe(200)
      expect(res.body.contenido).toBe('editado por admin')
    })
  })

  describe('evoluciones: imágenes', () => {
    const fakeImage = () => Buffer.from('fake-image-bytes')

    it('profesional sube una imagen a su propia evolución', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'con imagen' })
      expect(created.status).toBe(201)

      const res = await request(app)
        .post(`/api/evoluciones/${created.body.id}/imagenes`)
        .set('Cookie', cookies.profesionalA)
        .attach('imagenes', fakeImage(), { filename: 'foto.jpg', contentType: 'image/jpeg' })
      expect(res.status).toBe(201)
      expect(res.body).toHaveLength(1)
      // Nunca la URL cruda de Vercel Blob (privado) — solo la ruta propia
      // que sirve el contenido después de validar permisos.
      expect(res.body[0].url).toBe(`/api/evoluciones/${created.body.id}/imagenes/${res.body[0].id}/contenido`)
      expect(res.body[0].mimeType).toBe('image/jpeg')
      expect(res.body[0]).not.toHaveProperty('pathname')

      const list = await request(app).get('/api/evoluciones').set('Cookie', cookies.adminA).query({ pacienteId: pacienteAId })
      const leida = list.body.find((e: any) => e.id === created.body.id)
      expect(leida.imagenes).toHaveLength(1)
      expect(leida.imagenes[0]).not.toHaveProperty('pathname')

      // El contenido servido por la ruta propia es el mismo que se subió.
      const contenido = await request(app).get(res.body[0].url).set('Cookie', cookies.profesionalA)
      expect(contenido.status).toBe(200)
      expect(contenido.headers['content-type']).toContain('image/jpeg')
      expect(contenido.body.equals(fakeImage())).toBe(true)

      await prisma.evolucion.delete({ where: { id: created.body.id } })
    })

    it('no se puede ver el contenido de una imagen de otro consultorio', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'con imagen privada' })
      expect(created.status).toBe(201)

      const uploaded = await request(app)
        .post(`/api/evoluciones/${created.body.id}/imagenes`)
        .set('Cookie', cookies.profesionalA)
        .attach('imagenes', fakeImage(), { filename: 'foto.jpg', contentType: 'image/jpeg' })
      expect(uploaded.status).toBe(201)

      const res = await request(app).get(uploaded.body[0].url).set('Cookie', cookies.adminB)
      expect(res.status).toBe(404)

      await prisma.evolucion.delete({ where: { id: created.body.id } })
    })

    it('rechaza un tipo de archivo no permitido (400)', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'con adjunto invalido' })
      expect(created.status).toBe(201)

      const res = await request(app)
        .post(`/api/evoluciones/${created.body.id}/imagenes`)
        .set('Cookie', cookies.profesionalA)
        .attach('imagenes', fakeImage(), { filename: 'doc.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(400)

      await prisma.evolucion.delete({ where: { id: created.body.id } })
    })

    it('rechaza superar el máximo de 5 imágenes por evolución', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'ya con 5 imagenes' })
      expect(created.status).toBe(201)

      await prisma.evolucionImagen.createMany({
        data: Array.from({ length: 5 }, (_, i) => ({
          consultorioId: consultorioAId,
          pacienteId: pacienteAId,
          evolucionId: created.body.id,
          pathname: `existing-${i}`,
          nombreOriginal: `existing-${i}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 100,
        })),
      })

      const res = await request(app)
        .post(`/api/evoluciones/${created.body.id}/imagenes`)
        .set('Cookie', cookies.profesionalA)
        .attach('imagenes', fakeImage(), { filename: 'sexta.jpg', contentType: 'image/jpeg' })
      expect(res.status).toBe(400)

      await prisma.evolucionImagen.deleteMany({ where: { evolucionId: created.body.id } })
      await prisma.evolucion.delete({ where: { id: created.body.id } })
    })

    it('profesional no puede agregar imágenes a evoluciones de otro profesional', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'de profesionalA' })
      expect(created.status).toBe(201)

      // Reutiliza el usuario vinculado a otroProfesionalAId que ya crea el
      // describe('evoluciones: edición') de arriba (profesionalId es
      // 1:1 con Usuario, así que no se puede crear un segundo vínculo).
      const otroCookie = cookieFrom(await loginRequest(`otro-profesional-${RUN_ID}@test.local`))

      const res = await request(app)
        .post(`/api/evoluciones/${created.body.id}/imagenes`)
        .set('Cookie', otroCookie)
        .attach('imagenes', fakeImage(), { filename: 'foto.jpg', contentType: 'image/jpeg' })
      expect(res.status).toBe(403)

      await prisma.evolucion.delete({ where: { id: created.body.id } })
    })

    it('administrador puede eliminar una imagen de cualquier evolución del consultorio', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'para borrar imagen' })
      expect(created.status).toBe(201)

      const uploaded = await request(app)
        .post(`/api/evoluciones/${created.body.id}/imagenes`)
        .set('Cookie', cookies.profesionalA)
        .attach('imagenes', fakeImage(), { filename: 'foto.jpg', contentType: 'image/jpeg' })
      expect(uploaded.status).toBe(201)
      const imagenId = uploaded.body[0].id

      const del = await request(app)
        .delete(`/api/evoluciones/${created.body.id}/imagenes/${imagenId}`)
        .set('Cookie', cookies.adminA)
      expect(del.status).toBe(204)

      const remaining = await prisma.evolucionImagen.findUnique({ where: { id: imagenId } })
      expect(remaining).toBeNull()

      await prisma.evolucion.delete({ where: { id: created.body.id } })
    })

    it('no se puede subir imágenes a una evolución de otro consultorio', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'de consultorio A' })
      expect(created.status).toBe(201)

      const res = await request(app)
        .post(`/api/evoluciones/${created.body.id}/imagenes`)
        .set('Cookie', cookies.adminB)
        .attach('imagenes', fakeImage(), { filename: 'foto.jpg', contentType: 'image/jpeg' })
      expect(res.status).toBe(404)

      await prisma.evolucion.delete({ where: { id: created.body.id } })
    })
  })

  describe('grupos de evolución', () => {
    it('crea un grupo y lo asigna a una evolución nueva', async () => {
      const grupoRes = await request(app)
        .post(`/api/pacientes/${pacienteAId}/grupos-evolucion`)
        .set('Cookie', cookies.profesionalA)
        .send({ nombre: 'Lumbalgia', color: 'var(--appointment-purple)' })
      expect(grupoRes.status).toBe(201)

      const evolucionRes = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'sesión 1', grupoId: grupoRes.body.id })
      expect(evolucionRes.status).toBe(201)
      expect(evolucionRes.body.grupoId).toBe(grupoRes.body.id)
      expect(evolucionRes.body.grupo.nombre).toBe('Lumbalgia')

      await prisma.evolucion.delete({ where: { id: evolucionRes.body.id } })
      await prisma.grupoEvolucion.delete({ where: { id: grupoRes.body.id } })
    })

    it('rechaza un nombre duplicado (activo) para el mismo paciente', async () => {
      const first = await request(app)
        .post(`/api/pacientes/${pacienteAId}/grupos-evolucion`)
        .set('Cookie', cookies.profesionalA)
        .send({ nombre: 'Cervicalgia', color: 'var(--appointment-teal)' })
      expect(first.status).toBe(201)

      const dup = await request(app)
        .post(`/api/pacientes/${pacienteAId}/grupos-evolucion`)
        .set('Cookie', cookies.profesionalA)
        .send({ nombre: 'Cervicalgia', color: 'var(--appointment-teal)' })
      expect(dup.status).toBe(409)

      await prisma.grupoEvolucion.delete({ where: { id: first.body.id } })
    })

    it('rechaza un color fuera de la paleta permitida', async () => {
      const res = await request(app)
        .post(`/api/pacientes/${pacienteAId}/grupos-evolucion`)
        .set('Cookie', cookies.profesionalA)
        .send({ nombre: 'Color inválido', color: '#ff00ff' })
      expect(res.status).toBe(400)
    })

    it('no permite asignar un grupo de otro paciente (cross-paciente)', async () => {
      const grupoDeB = await prisma.grupoEvolucion.create({
        data: { consultorioId: consultorioBId, pacienteId: pacienteBId, nombre: `Grupo B ${RUN_ID}`, color: 'var(--appointment-red)' },
      })

      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'intento cross-paciente', grupoId: grupoDeB.id })
      expect(res.status).toBe(404)

      await prisma.grupoEvolucion.delete({ where: { id: grupoDeB.id } })
    })

    it('no permite asignar un grupo de otro consultorio (cross-consultorio)', async () => {
      const grupoDeB = await prisma.grupoEvolucion.create({
        data: { consultorioId: consultorioBId, pacienteId: pacienteBId, nombre: `Otro consultorio ${RUN_ID}`, color: 'var(--appointment-red)' },
      })

      const res = await request(app)
        .patch(`/api/grupos-evolucion/${grupoDeB.id}`)
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Hackeado' })
      expect(res.status).toBe(404)

      await prisma.grupoEvolucion.delete({ where: { id: grupoDeB.id } })
    })

    it('eliminar un grupo no borra las evoluciones ya asignadas: quedan sin grupo', async () => {
      const grupo = await request(app)
        .post(`/api/pacientes/${pacienteAId}/grupos-evolucion`)
        .set('Cookie', cookies.profesionalA)
        .send({ nombre: 'Rehabilitación postoperatoria', color: 'var(--appointment-amber)' })
      expect(grupo.status).toBe(201)

      const evolucion = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'sesión pre-eliminación', grupoId: grupo.body.id })
      expect(evolucion.status).toBe(201)

      const deleteRes = await request(app).delete(`/api/grupos-evolucion/${grupo.body.id}`).set('Cookie', cookies.adminA)
      expect(deleteRes.status).toBe(204)

      const evolucionSigueViva = await prisma.evolucion.findUnique({ where: { id: evolucion.body.id } })
      expect(evolucionSigueViva).not.toBeNull()
      expect(evolucionSigueViva?.activo).toBe(true)
      expect(evolucionSigueViva?.grupoId).toBeNull()

      const nuevaEvolucion = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'intento post-eliminación', grupoId: grupo.body.id })
      expect(nuevaEvolucion.status).toBe(404)

      await prisma.evolucion.delete({ where: { id: evolucion.body.id } })
    })

    it('una evolución sin grupo sigue siendo válida', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'sin grupo asignado' })
      expect(res.status).toBe(201)
      expect(res.body.grupoId).toBeNull()

      await prisma.evolucion.delete({ where: { id: res.body.id } })
    })
  })

  describe('evoluciones: contenido largo (regresión — VARCHAR(191) por default)', () => {
    // `contenido` era `String` sin `@db.Text` en el schema (VARCHAR(191) por
    // default de Prisma en MySQL) — una nota clínica real de más de 191
    // caracteres hacía fallar el INSERT en la base con un 500 genérico, sin
    // loguear la excepción real. Ver migración `20260817145447_evolucion_contenido_text`.
    it('contenido corto se guarda normalmente', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'Prueba corta' })
      expect(res.status).toBe(201)
      expect(res.body.contenido).toBe('Prueba corta')

      await prisma.evolucion.delete({ where: { id: res.body.id } })
    })

    it('contenido de varios miles de caracteres se guarda completo, sin truncar', async () => {
      const largo = 'Evolución clínica extensa. '.repeat(300) // ~8400 caracteres, bien por encima de 191
      expect(largo.length).toBeGreaterThan(5000)

      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: largo })
      expect(res.status).toBe(201)
      expect(res.body.contenido).toBe(largo)
      expect(res.body.contenido.length).toBe(largo.length)

      const fetched = await prisma.evolucion.findUniqueOrThrow({ where: { id: res.body.id } })
      expect(fetched.contenido).toBe(largo)

      await prisma.evolucion.delete({ where: { id: res.body.id } })
    })

    it('contenidoHtml largo con formato se sanitiza y guarda completo', async () => {
      const parrafo = '<p><b>Dolor</b> <i>persistente</i> en zona <u>lumbar</u>, evoluciona favorablemente. </p>'
      const largoHtml = parrafo.repeat(80) // varios miles de caracteres
      expect(largoHtml.length).toBeGreaterThan(5000)

      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'placeholder', contenidoHtml: largoHtml })
      expect(res.status).toBe(201)
      expect(res.body.contenidoHtml).toBe(largoHtml)
      expect(res.body.contenidoHtml).not.toMatch(/script|onclick|javascript:/i)
      expect(res.body.contenido.length).toBeGreaterThan(191)

      await prisma.evolucion.delete({ where: { id: res.body.id } })
    })

    it('crea con Diagnóstico y contenido largo a la vez', async () => {
      const grupo = await request(app)
        .post(`/api/pacientes/${pacienteAId}/grupos-evolucion`)
        .set('Cookie', cookies.profesionalA)
        .send({ nombre: `Diagnostico largo ${RUN_ID}`, color: 'var(--appointment-teal)' })
      expect(grupo.status).toBe(201)

      const largo = 'Seguimiento kinésico detallado. '.repeat(200)
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: largo, grupoId: grupo.body.id })
      expect(res.status).toBe(201)
      expect(res.body.contenido.length).toBe(largo.length)
      expect(res.body.grupoId).toBe(grupo.body.id)

      await prisma.evolucion.delete({ where: { id: res.body.id } })
      await prisma.grupoEvolucion.delete({ where: { id: grupo.body.id } })
    })

    it('crea sin Diagnóstico y contenido largo', async () => {
      const largo = 'Nota extensa sin diagnóstico asociado. '.repeat(150)
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: largo })
      expect(res.status).toBe(201)
      expect(res.body.grupoId).toBeNull()
      expect(res.body.contenido.length).toBe(largo.length)

      await prisma.evolucion.delete({ where: { id: res.body.id } })
    })

    it('edita una evolución agregándole contenido largo, y la lectura posterior no lo trunca', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'corta al principio' })
      expect(created.status).toBe(201)

      const largo = 'Actualización extensa de la evolución tras varias sesiones. '.repeat(150)
      const edited = await request(app)
        .patch(`/api/evoluciones/${created.body.id}`)
        .set('Cookie', cookies.profesionalA)
        .send({ contenido: largo })
      expect(edited.status).toBe(200)
      expect(edited.body.contenido.length).toBe(largo.length)

      const read = await request(app).get('/api/evoluciones').set('Cookie', cookies.adminA).query({ pacienteId: pacienteAId })
      const leida = read.body.find((e: any) => e.id === created.body.id)
      expect(leida.contenido).toBe(largo)

      await prisma.evolucion.delete({ where: { id: created.body.id } })
    })
  })

  describe('evoluciones: formato rico (HTML sanitizado)', () => {
    it('crea una evolución con negrita/cursiva/subrayado y deriva el texto plano', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'placeholder', contenidoHtml: '<p><b>Dolor</b> <i>leve</i>, <u>mejora</u></p>' })
      expect(res.status).toBe(201)
      expect(res.body.contenidoHtml).toBe('<p><b>Dolor</b> <i>leve</i>, <u>mejora</u></p>')
      expect(res.body.contenido).toBe('Dolor leve, mejora')

      await prisma.evolucion.delete({ where: { id: res.body.id } })
    })

    it('nunca confía en el HTML del cliente: sanitiza scripts/atributos aunque el cliente diga que ya lo hizo', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({
          pacienteId: pacienteAId,
          contenido: 'placeholder',
          contenidoHtml: '<script>alert(1)</script><b onclick="alert(1)" style="color:red">bold</b><a href="javascript:x">link</a>',
        })
      expect(res.status).toBe(201)
      expect(res.body.contenidoHtml).not.toMatch(/script|onclick|javascript:/i)
      expect(res.body.contenidoHtml).toBe('<b>bold</b>link')
      expect(res.body.contenido).toBe('boldlink')

      await prisma.evolucion.delete({ where: { id: res.body.id } })
    })

    it('sin contenidoHtml, se comporta exactamente igual que antes (texto plano, compatibilidad)', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'nota sin formato' })
      expect(res.status).toBe(201)
      expect(res.body.contenido).toBe('nota sin formato')
      expect(res.body.contenidoHtml).toBeNull()

      await prisma.evolucion.delete({ where: { id: res.body.id } })
    })

    it('edita una evolución agregando formato, y también puede quitarlo', async () => {
      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'texto original' })
      expect(created.body.contenidoHtml).toBeNull()

      const withFormat = await request(app)
        .patch(`/api/evoluciones/${created.body.id}`)
        .set('Cookie', cookies.profesionalA)
        .send({ contenido: 'placeholder', contenidoHtml: '<b>texto con formato</b>' })
      expect(withFormat.status).toBe(200)
      expect(withFormat.body.contenidoHtml).toBe('<b>texto con formato</b>')
      expect(withFormat.body.contenido).toBe('texto con formato')

      const withoutFormat = await request(app)
        .patch(`/api/evoluciones/${created.body.id}`)
        .set('Cookie', cookies.profesionalA)
        .send({ contenido: 'de vuelta a texto plano', contenidoHtml: '' })
      expect(withoutFormat.status).toBe(200)
      expect(withoutFormat.body.contenidoHtml).toBeNull()
      expect(withoutFormat.body.contenido).toBe('de vuelta a texto plano')

      await prisma.evolucion.delete({ where: { id: created.body.id } })
    })

    it('editar solo el grupo (sin tocar contenido) no borra el formato existente', async () => {
      const grupo = await request(app)
        .post(`/api/pacientes/${pacienteAId}/grupos-evolucion`)
        .set('Cookie', cookies.profesionalA)
        .send({ nombre: `Grupo rich text ${RUN_ID}`, color: 'var(--appointment-sky)' })
      expect(grupo.status).toBe(201)

      const created = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'placeholder', contenidoHtml: '<b>importante</b>' })
      expect(created.body.contenidoHtml).toBe('<b>importante</b>')

      const patched = await request(app)
        .patch(`/api/evoluciones/${created.body.id}`)
        .set('Cookie', cookies.profesionalA)
        .send({ grupoId: grupo.body.id })
      expect(patched.status).toBe(200)
      expect(patched.body.grupoId).toBe(grupo.body.id)
      expect(patched.body.contenidoHtml).toBe('<b>importante</b>')
      expect(patched.body.contenido).toBe('importante')

      await prisma.evolucion.delete({ where: { id: created.body.id } })
      await prisma.grupoEvolucion.delete({ where: { id: grupo.body.id } })
    })

    it('un contenidoHtml que sanitiza a vacío (solo contenido malicioso) rechaza con 400, no guarda vacío', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenidoHtml: '<script>alert(1)</script>' })
      expect(res.status).toBe(400)
    })
  })

  describe('alertas manuales de campos de ficha inicial', () => {
    it('marca y desmarca una alerta de un campo elegible', async () => {
      const putRes = await request(app)
        .put(`/api/pacientes/${pacienteAId}/ficha-inicial/alertas-campo/dolorSintomas`)
        .set('Cookie', cookies.profesionalA)
        .send({})
      expect(putRes.status).toBe(201)

      const fichaRes = await request(app).get(`/api/pacientes/${pacienteAId}/ficha-inicial`).set('Cookie', cookies.profesionalA)
      expect(fichaRes.body.alertasCampo.some((a: any) => a.campo === 'dolorSintomas')).toBe(true)

      const delRes = await request(app)
        .delete(`/api/pacientes/${pacienteAId}/ficha-inicial/alertas-campo/dolorSintomas`)
        .set('Cookie', cookies.profesionalA)
      expect(delRes.status).toBe(204)

      const fichaRes2 = await request(app).get(`/api/pacientes/${pacienteAId}/ficha-inicial`).set('Cookie', cookies.profesionalA)
      expect(fichaRes2.body.alertasCampo.some((a: any) => a.campo === 'dolorSintomas')).toBe(false)
    })

    it('rechaza un campo fuera de la whitelist', async () => {
      const res = await request(app)
        .put(`/api/pacientes/${pacienteAId}/ficha-inicial/alertas-campo/email`)
        .set('Cookie', cookies.profesionalA)
        .send({})
      expect(res.status).toBe(400)
    })

    it('no permite marcar alertas en un paciente de otro consultorio', async () => {
      const res = await request(app)
        .put(`/api/pacientes/${pacienteBId}/ficha-inicial/alertas-campo/dolorSintomas`)
        .set('Cookie', cookies.profesionalA)
        .send({})
      expect(res.status).toBe(404)
    })

    it('un profesional sin vínculo no puede marcar alertas', async () => {
      const res = await request(app)
        .put(`/api/pacientes/${pacienteAId}/ficha-inicial/alertas-campo/dolorSintomas`)
        .set('Cookie', cookies.profesionalSinVinculo)
        .send({})
      expect(res.status).toBe(403)
    })

    // Regresión: marcar una alerta y guardar un campo de texto casi al mismo
    // tiempo, sobre una ficha que todavía no existe, podía hacer que dos
    // `upsert` compitieran por crearla — uno chocaba contra el unique de
    // `pacienteId` (P2002) y el endpoint devolvía 500 "failed to save ficha
    // inicial" (bug real, ver upsertFichaInicial en app.ts). Paciente nuevo
    // acá a propósito, para garantizar que no exista ficha previa.
    it('marcar una alerta y guardar texto en paralelo sobre una ficha nueva no falla (regresión de concurrencia)', async () => {
      const pacienteNuevo = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'Concurrencia', apellido: 'Test' } })

      const [putRes, patchRes] = await Promise.all([
        request(app)
          .put(`/api/pacientes/${pacienteNuevo.id}/ficha-inicial/alertas-campo/dolorSintomas`)
          .set('Cookie', cookies.profesionalA)
          .send({}),
        request(app)
          .patch(`/api/pacientes/${pacienteNuevo.id}/ficha-inicial`)
          .set('Cookie', cookies.profesionalA)
          .send({ motivoConsulta: 'Dolor lumbar de 2 semanas' }),
      ])

      expect(putRes.status).toBe(201)
      expect(patchRes.status).toBe(200)

      const fichaRes = await request(app).get(`/api/pacientes/${pacienteNuevo.id}/ficha-inicial`).set('Cookie', cookies.profesionalA)
      expect(fichaRes.body.motivoConsulta).toBe('Dolor lumbar de 2 semanas')
      expect(fichaRes.body.alertasCampo.some((a: any) => a.campo === 'dolorSintomas')).toBe(true)

      await prisma.fichaAlertaCampo.deleteMany({ where: { fichaInicialId: fichaRes.body.id } })
      await prisma.fichaSeccionEstado.deleteMany({ where: { fichaInicialId: fichaRes.body.id } })
      await prisma.fichaInicial.delete({ where: { pacienteId: pacienteNuevo.id } })
      await prisma.paciente.delete({ where: { id: pacienteNuevo.id } })
    })
  })

  describe('ficha inicial', () => {
    it('se puede crear en borrador con guardado parcial', async () => {
      const res = await request(app)
        .patch(`/api/pacientes/${pacienteAId}/ficha-inicial`)
        .set('Cookie', cookies.profesionalA)
        .send({ motivoConsulta: 'Dolor lumbar' })
      expect(res.status).toBe(200)
      expect(res.body.estado).toBe('BORRADOR')
      expect(res.body.motivoConsulta).toBe('Dolor lumbar')
      expect(res.body.profesionalResponsable.id).toBe(profesionalAId)
    })

    it('el estado de la ficha no se puede fijar manualmente: un estado arbitrario del cliente se ignora', async () => {
      await request(app)
        .patch(`/api/pacientes/${pacienteAId}/ficha-inicial`)
        .set('Cookie', cookies.profesionalA)
        .send({ antecedentesPersonales: 'Sin antecedentes relevantes' })

      const res = await request(app)
        .patch(`/api/pacientes/${pacienteAId}/ficha-inicial`)
        .set('Cookie', cookies.profesionalA)
        .send({ estado: 'COMPLETA' })
      expect(res.status).toBe(200)
      expect(res.body.estado).toBe('BORRADOR')
      expect(res.body.antecedentesPersonales).toBe('Sin antecedentes relevantes')
    })

    // Regresión: el form del frontend manda TODOS los campos en cada
    // autoguardado, incluidos los enum (`alergiasEstado` y afines) todavía
    // sin tocar — que llegaban como `''`. Prisma rechaza `''` para un enum
    // (solo acepta SI/NO/NO_INFORMA o ausencia de valor), así que el primer
    // autoguardado de cualquier campo de una ficha nueva rompía con
    // "failed to save ficha inicial" (bug real, encontrado con un click-through
    // real del formulario — los tests de arriba nunca mandaban el payload
    // completo, solo los campos puntuales que cada uno probaba).
    it('un string vacío en un campo enum (alergiasEstado y afines) no rompe el guardado — se normaliza a null', async () => {
      const pacienteNuevo = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'Enum', apellido: 'Vacio' } })

      const res = await request(app)
        .patch(`/api/pacientes/${pacienteNuevo.id}/ficha-inicial`)
        .set('Cookie', cookies.profesionalA)
        .send({
          motivoConsulta: 'Dolor lumbar de dos semanas',
          alergiasEstado: '',
          medicacionEstado: '',
          tabaquismoEstado: '',
          alcoholEstado: '',
          sedentarismoEstado: '',
          menarcaEstado: '',
          menopausiaEstado: '',
        })

      expect(res.status).toBe(200)
      expect(res.body.motivoConsulta).toBe('Dolor lumbar de dos semanas')
      expect(res.body.alergiasEstado).toBeNull()
      expect(res.body.tabaquismoEstado).toBeNull()

      await prisma.fichaSeccionEstado.deleteMany({ where: { fichaInicialId: res.body.id } })
      await prisma.fichaInicial.delete({ where: { pacienteId: pacienteNuevo.id } })
      await prisma.paciente.delete({ where: { id: pacienteNuevo.id } })
    })

    it('un paciente sin ficha devuelve null, no 404', async () => {
      const res = await request(app).get(`/api/pacientes/${pacienteBId}/ficha-inicial`).set('Cookie', cookies.adminB)
      expect(res.status).toBe(200)
      expect(res.body).toBeNull()
    })

    it('recepción no puede leer ni editar la ficha inicial', async () => {
      const getRes = await request(app).get(`/api/pacientes/${pacienteAId}/ficha-inicial`).set('Cookie', cookies.recepcionA)
      expect(getRes.status).toBe(403)

      const patchRes = await request(app)
        .patch(`/api/pacientes/${pacienteAId}/ficha-inicial`)
        .set('Cookie', cookies.recepcionA)
        .send({ motivoConsulta: 'no debería poder' })
      expect(patchRes.status).toBe(403)
    })

    it('un consultorio no puede acceder a la ficha inicial de un paciente de otro consultorio', async () => {
      const res = await request(app).get(`/api/pacientes/${pacienteBId}/ficha-inicial`).set('Cookie', cookies.adminA)
      expect(res.status).toBe(404)
    })

    describe('catálogo clínico y registros estructurados', () => {
      let hta: { id: number }
      let diabetes: { id: number }
      let apendicectomia: { id: number }
      let penicilina: { id: number }

      // No depende de que `npm run seed` ya haya corrido: sembramos acá los
      // 4 ítems concretos que estos tests necesitan (mismo upsert idempotente
      // que usa el seed real, sobre la misma tabla de catálogo global).
      beforeAll(async () => {
        // No se puede usar `upsert` con un where compuesto que incluya
        // `consultorioId: null` (mismo motivo que en seedCatalogoClinico.ts):
        // findFirst + create/update a mano.
        const upsertItem = async (categoria: string, codigo: string, nombre: string, orden = 0) => {
          const existente = await prisma.catalogoClinicoItem.findFirst({ where: { consultorioId: null, categoria: categoria as any, codigo } })
          if (existente) return existente
          return prisma.catalogoClinicoItem.create({ data: { categoria: categoria as any, codigo, nombre, orden, esSistema: true } })
        }

        hta = await upsertItem('ANTECEDENTE_PERSONAL', 'hta', 'HTA')
        diabetes = await upsertItem('ANTECEDENTE_FAMILIAR', 'diabetes', 'Diabetes')
        apendicectomia = await upsertItem('PROCEDIMIENTO_QUIRURGICO', 'apendicectomia', 'Apendicectomía')
        penicilina = await upsertItem('ALERGIA', 'penicilina', 'Penicilina')
      })

      it('el catálogo clínico se puede listar y filtrar por categoría', async () => {
        const res = await request(app)
          .get('/api/catalogo-clinico?categoria=ANTECEDENTE_FAMILIAR')
          .set('Cookie', cookies.adminA)
        expect(res.status).toBe(200)
        expect(res.body.length).toBeGreaterThan(0)
        expect(res.body.every((item: { categoria: string }) => item.categoria === 'ANTECEDENTE_FAMILIAR')).toBe(true)
      })

      it('agrega un antecedente personal, familiar con parentesco y quirúrgico, y no permite duplicarlos', async () => {
        const personal = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.profesionalA)
          .send({ catalogoItemId: hta.id, estado: 'SI', detalle: 'Controlada' })
        expect(personal.status).toBe(201)
        expect(personal.body.estado).toBe('SI')
        expect(personal.body.catalogoItem.codigo).toBe('hta')

        const duplicado = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.profesionalA)
          .send({ catalogoItemId: hta.id, estado: 'SI' })
        expect(duplicado.status).toBe(409)

        const familiar = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.profesionalA)
          .send({ catalogoItemId: diabetes.id, estado: 'SI', parentesco: 'Madre' })
        expect(familiar.status).toBe(201)
        expect(familiar.body.parentesco).toBe('Madre')

        const quirurgico = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.profesionalA)
          .send({ catalogoItemId: apendicectomia.id, estado: 'SI', fechaAproximada: '2015-01-01' })
        expect(quirurgico.status).toBe(201)

        const edit = await request(app)
          .patch(`/api/ficha-antecedentes/${personal.body.id}`)
          .set('Cookie', cookies.adminA)
          .send({ estado: 'NO' })
        expect(edit.status).toBe(200)
        expect(edit.body.estado).toBe('NO')

        const del = await request(app).delete(`/api/ficha-antecedentes/${familiar.body.id}`).set('Cookie', cookies.adminA)
        expect(del.status).toBe(204)

        const ficha = await request(app).get(`/api/pacientes/${pacienteAId}/ficha-inicial`).set('Cookie', cookies.adminA)
        // El antecedente borrado (soft-delete) no debe aparecer entre los activos.
        expect(ficha.body.antecedentes.some((a: { id: number }) => a.id === familiar.body.id)).toBe(false)
        expect(ficha.body.antecedentes.some((a: { id: number }) => a.id === quirurgico.body.id)).toBe(true)
      })

      it('agrega una alergia del catálogo y una libre, con reacción/gravedad/observaciones', async () => {
        const conocida = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/alergias`)
          .set('Cookie', cookies.profesionalA)
          .send({ catalogoItemId: penicilina.id, reaccion: 'Erupción', gravedad: 'MODERADA' })
        expect(conocida.status).toBe(201)
        expect(conocida.body.catalogoItem.codigo).toBe('penicilina')

        const libre = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/alergias`)
          .set('Cookie', cookies.profesionalA)
          .send({ nombreLibre: 'Polen', observaciones: 'Estacional' })
        expect(libre.status).toBe(201)
        expect(libre.body.nombreLibre).toBe('Polen')

        const sinNombre = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/alergias`)
          .set('Cookie', cookies.profesionalA)
          .send({})
        expect(sinNombre.status).toBe(400)

        const del = await request(app).delete(`/api/ficha-alergias/${libre.body.id}`).set('Cookie', cookies.adminA)
        expect(del.status).toBe(204)
      })

      it('agrega, edita y elimina medicación (sin catálogo)', async () => {
        const create = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/medicacion`)
          .set('Cookie', cookies.profesionalA)
          .send({ nombre: 'Losartán', dosis: '50', unidad: 'mg', frecuencia: 'Cada 24 h' })
        expect(create.status).toBe(201)

        const edit = await request(app)
          .patch(`/api/ficha-medicacion/${create.body.id}`)
          .set('Cookie', cookies.adminA)
          .send({ dosis: '100' })
        expect(edit.status).toBe(200)
        expect(edit.body.dosis).toBe('100')

        const del = await request(app).delete(`/api/ficha-medicacion/${create.body.id}`).set('Cookie', cookies.adminA)
        expect(del.status).toBe(204)

        const sinNombre = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/medicacion`)
          .set('Cookie', cookies.profesionalA)
          .send({})
        expect(sinNombre.status).toBe(400)
      })

      it('agrega un estudio complementario', async () => {
        const create = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/estudios`)
          .set('Cookie', cookies.profesionalA)
          .send({ tipo: 'Radiografía lumbar', resumen: 'Sin hallazgos' })
        expect(create.status).toBe(201)
        expect(create.body.tipo).toBe('Radiografía lumbar')
      })

      it('recepción no puede leer ni escribir antecedentes/alergias/medicación', async () => {
        const post = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.recepcionA)
          .send({ catalogoItemId: hta.id, estado: 'SI' })
        expect(post.status).toBe(403)

        const catalogo = await request(app).get('/api/catalogo-clinico').set('Cookie', cookies.recepcionA)
        expect(catalogo.status).toBe(403)
      })

      it('no se puede acceder a un antecedente/alergia de otro consultorio', async () => {
        const propio = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.profesionalA)
          .send({ catalogoItemId: hta.id, estado: 'NO' })
        // Puede chocar con el ya creado en un test anterior de este mismo describe;
        // si es así, no afecta el propósito de este test (aislamiento entre consultorios).
        const antecedenteId = propio.status === 201 ? propio.body.id : (await prisma.fichaAntecedente.findFirstOrThrow({ where: { consultorioId: consultorioAId, catalogoItemId: hta.id } })).id

        const res = await request(app).patch(`/api/ficha-antecedentes/${antecedenteId}`).set('Cookie', cookies.adminB).send({ estado: 'NO' })
        expect(res.status).toBe(404)
      })

      it('el estado de cada sección y el estado general de la ficha se calculan automáticamente', async () => {
        const parcial = await request(app)
          .patch(`/api/pacientes/${pacienteBId}/ficha-inicial`)
          .set('Cookie', cookies.adminB)
          .send({ motivoConsulta: 'Dolor de hombro' })
        expect(parcial.status).toBe(200)
        const seccionEstado = (body: any, seccion: string) => body.seccionesEstado.find((s: any) => s.seccion === seccion)?.estado
        // Empezar a completar una sección ya cuenta como revisada — no hace
        // falta llenarla entera.
        expect(seccionEstado(parcial.body, 'MOTIVO')).toBe('REVISADA')
        expect(seccionEstado(parcial.body, 'SEGURIDAD')).toBe('PENDIENTE')
        expect(parcial.body.estado).toBe('BORRADOR')

        await request(app)
          .patch(`/api/pacientes/${pacienteBId}/ficha-inicial`)
          .set('Cookie', cookies.adminB)
          .send({
            diagnosticoDerivacion: 'Derivado por traumatólogo',
            alergiasEstado: 'NO',
            medicacionEstado: 'NO',
            tabaquismoEstado: 'NO',
            alcoholEstado: 'NO',
            sedentarismoEstado: 'NO',
            dolorSintomas: 'Dolor 5/10 al elevar el brazo',
          })

        await request(app)
          .post(`/api/pacientes/${pacienteBId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.adminB)
          .send({ catalogoItemId: hta.id, estado: 'NO' })

        const final = await request(app).get(`/api/pacientes/${pacienteBId}/ficha-inicial`).set('Cookie', cookies.adminB)
        expect(final.body.estado).toBe('COMPLETA')
        expect(seccionEstado(final.body, 'MOTIVO')).toBe('REVISADA')
        expect(seccionEstado(final.body, 'ANTECEDENTES')).toBe('REVISADA')
        expect(seccionEstado(final.body, 'SEGURIDAD')).toBe('REVISADA')
        expect(seccionEstado(final.body, 'HABITOS')).toBe('REVISADA')
        expect(seccionEstado(final.body, 'DOLOR_FUNCION')).toBe('REVISADA')
      })

      it('una sección se marca revisada apenas se carga un solo dato, sin necesidad de completarla entera', async () => {
        const res = await request(app)
          .patch(`/api/pacientes/${pacienteAId}/ficha-inicial`)
          .set('Cookie', cookies.profesionalA)
          .send({ ocupacion: 'Docente' })
        const seccionEstado = (body: any, seccion: string) => body.seccionesEstado.find((s: any) => s.seccion === seccion)?.estado
        expect(seccionEstado(res.body, 'HABITOS')).toBe('REVISADA')
      })

      it('agregar una alergia o medicación cuenta para Seguridad clínica, sin necesidad de tocar los selects de sí/no', async () => {
        const alergia = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/alergias`)
          .set('Cookie', cookies.profesionalA)
          .send({ nombreLibre: 'Alergia sin catálogo' })
        expect(alergia.status).toBe(201)

        const ficha = await request(app).get(`/api/pacientes/${pacienteAId}/ficha-inicial`).set('Cookie', cookies.profesionalA)
        const seccionEstado = (body: any, seccion: string) => body.seccionesEstado.find((s: any) => s.seccion === seccion)?.estado
        expect(seccionEstado(ficha.body, 'SEGURIDAD')).toBe('REVISADA')
      })

      it('no existe forma de fijar manualmente el estado de una sección', async () => {
        const res = await request(app)
          .patch(`/api/pacientes/${pacienteAId}/ficha-inicial/secciones/MOTIVO`)
          .set('Cookie', cookies.profesionalA)
          .send({ estado: 'REVISADA' })
        expect(res.status).toBe(404)
      })
    })

    describe('catálogo personalizado por consultorio', () => {
      let hta: { id: number }

      beforeAll(async () => {
        hta = (await prisma.catalogoClinicoItem.findFirst({ where: { consultorioId: null, codigo: 'hta' } }))!
      })

      it('un consultorio crea un antecedente personalizado, lo puede buscar, y el otro consultorio no lo ve', async () => {
        const create = await request(app)
          .post('/api/catalogo-clinico')
          .set('Cookie', cookies.profesionalA)
          .send({ categoria: 'ANTECEDENTE_PERSONAL', nombre: `Migraña crónica ${RUN_ID}` })
        expect(create.status).toBe(201)
        expect(create.body.esSistema).toBe(false)
        expect(create.body.consultorioId).toBe(consultorioAId)

        const buscaA = await request(app).get(`/api/catalogo-clinico?categoria=ANTECEDENTE_PERSONAL&q=Migraña`).set('Cookie', cookies.adminA)
        expect(buscaA.body.some((item: any) => item.id === create.body.id)).toBe(true)

        const buscaB = await request(app).get(`/api/catalogo-clinico?categoria=ANTECEDENTE_PERSONAL&q=Migraña`).set('Cookie', cookies.adminB)
        expect(buscaB.body.some((item: any) => item.id === create.body.id)).toBe(false)

        // Consultorio B no puede usarlo aunque conozca el id.
        const usoB = await request(app)
          .post(`/api/pacientes/${pacienteBId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.adminB)
          .send({ catalogoItemId: create.body.id, estado: 'SI' })
        expect(usoB.status).toBe(404)
      })

      it('dos consultorios pueden tener cada uno su propio ítem personalizado con el mismo nombre, sin chocar', async () => {
        const nombre = `Antecedente compartido ${RUN_ID}`
        const createA = await request(app)
          .post('/api/catalogo-clinico')
          .set('Cookie', cookies.adminA)
          .send({ categoria: 'PROCEDIMIENTO_QUIRURGICO', nombre })
        expect(createA.status).toBe(201)

        const createB = await request(app)
          .post('/api/catalogo-clinico')
          .set('Cookie', cookies.adminB)
          .send({ categoria: 'PROCEDIMIENTO_QUIRURGICO', nombre })
        expect(createB.status).toBe(201)
        expect(createB.body.id).not.toBe(createA.body.id)
      })

      it('no permite duplicar un ítem personalizado dentro del mismo consultorio y categoría', async () => {
        const nombre = `Antecedente duplicado ${RUN_ID}`
        const first = await request(app)
          .post('/api/catalogo-clinico')
          .set('Cookie', cookies.adminA)
          .send({ categoria: 'ANTECEDENTE_FAMILIAR', nombre })
        expect(first.status).toBe(201)

        const second = await request(app)
          .post('/api/catalogo-clinico')
          .set('Cookie', cookies.adminA)
          .send({ categoria: 'ANTECEDENTE_FAMILIAR', nombre })
        expect(second.status).toBe(409)
      })

      it('no se puede modificar ni inactivar un ítem de sistema', async () => {
        const del = await request(app).delete(`/api/catalogo-clinico/${hta.id}`).set('Cookie', cookies.adminA)
        expect(del.status).toBe(404)
        const rename = await request(app).patch(`/api/catalogo-clinico/${hta.id}`).set('Cookie', cookies.adminA).send({ nombre: 'HTA renombrada' })
        expect(rename.status).toBe(404)
      })

      it('se puede renombrar un ítem personalizado propio, pero no el de otro consultorio', async () => {
        const create = await request(app)
          .post('/api/catalogo-clinico')
          .set('Cookie', cookies.adminA)
          .send({ categoria: 'ANTECEDENTE_PERSONAL', nombre: `Renombrable ${RUN_ID}` })
        expect(create.status).toBe(201)

        const renameOtro = await request(app)
          .patch(`/api/catalogo-clinico/${create.body.id}`)
          .set('Cookie', cookies.adminB)
          .send({ nombre: 'Intento ajeno' })
        expect(renameOtro.status).toBe(404)

        const rename = await request(app)
          .patch(`/api/catalogo-clinico/${create.body.id}`)
          .set('Cookie', cookies.adminA)
          .send({ nombre: `Renombrado ${RUN_ID}` })
        expect(rename.status).toBe(200)
        expect(rename.body.nombre).toBe(`Renombrado ${RUN_ID}`)
      })

      it('se puede volver a agregar un antecedente que se había quitado antes (reactiva la fila, no choca con el historial)', async () => {
        const item = await request(app)
          .post('/api/catalogo-clinico')
          .set('Cookie', cookies.adminA)
          .send({ categoria: 'ANTECEDENTE_PERSONAL', nombre: `Reactivable ${RUN_ID}` })
        expect(item.status).toBe(201)

        const primero = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.profesionalA)
          .send({ catalogoItemId: item.body.id, estado: 'SI' })
        expect(primero.status).toBe(201)

        const quitar = await request(app).delete(`/api/ficha-antecedentes/${primero.body.id}`).set('Cookie', cookies.profesionalA)
        expect(quitar.status).toBe(204)

        const segunda = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.profesionalA)
          .send({ catalogoItemId: item.body.id, estado: 'SI' })
        expect(segunda.status).toBe(200)
        expect(segunda.body.id).toBe(primero.body.id)
        expect(segunda.body.activo).toBe(true)
      })

      it('un ítem personalizado inactivo conserva los registros históricos pero no aparece en nuevas búsquedas', async () => {
        const create = await request(app)
          .post('/api/catalogo-clinico')
          .set('Cookie', cookies.adminA)
          .send({ categoria: 'ALERGIA', nombre: `Alergia a inactivar ${RUN_ID}` })
        expect(create.status).toBe(201)

        const usada = await request(app)
          .post(`/api/pacientes/${pacienteAId}/ficha-inicial/alergias`)
          .set('Cookie', cookies.profesionalA)
          .send({ catalogoItemId: create.body.id })
        expect(usada.status).toBe(201)

        const deactivate = await request(app).delete(`/api/catalogo-clinico/${create.body.id}`).set('Cookie', cookies.adminA)
        expect(deactivate.status).toBe(204)

        const buscaDespues = await request(app).get(`/api/catalogo-clinico?categoria=ALERGIA&q=inactivar`).set('Cookie', cookies.adminA)
        expect(buscaDespues.body.some((item: any) => item.id === create.body.id)).toBe(false)

        const ficha = await request(app).get(`/api/pacientes/${pacienteAId}/ficha-inicial`).set('Cookie', cookies.adminA)
        expect(ficha.body.alergias.some((a: any) => a.id === usada.body.id)).toBe(true)
      })

      it('recepción no puede crear ítems de catálogo personalizados', async () => {
        const res = await request(app)
          .post('/api/catalogo-clinico')
          .set('Cookie', cookies.recepcionA)
          .send({ categoria: 'ANTECEDENTE_PERSONAL', nombre: 'No debería poder' })
        expect(res.status).toBe(403)
      })
    })

    describe('alertas clínicas (esAlertaClinica)', () => {
      let apendicectomia: { id: number }
      let diabetes: { id: number }

      beforeAll(async () => {
        apendicectomia = (await prisma.catalogoClinicoItem.findFirst({ where: { consultorioId: null, codigo: 'apendicectomia' } }))!
        diabetes = (await prisma.catalogoClinicoItem.findFirst({ where: { consultorioId: null, codigo: 'diabetes' } }))!
      })

      it('un antecedente o medicación se puede marcar como alerta clínica', async () => {
        const antecedente = await request(app)
          .post(`/api/pacientes/${pacienteBId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.adminB)
          .send({ catalogoItemId: apendicectomia.id, estado: 'SI', esAlertaClinica: true })
        expect(antecedente.status).toBe(201)
        expect(antecedente.body.esAlertaClinica).toBe(true)

        const medicacion = await request(app)
          .post(`/api/pacientes/${pacienteBId}/ficha-inicial/medicacion`)
          .set('Cookie', cookies.adminB)
          .send({ nombre: 'Warfarina', esAlertaClinica: true })
        expect(medicacion.status).toBe(201)
        expect(medicacion.body.esAlertaClinica).toBe(true)

        const ficha = await request(app).get(`/api/pacientes/${pacienteBId}/ficha-inicial`).set('Cookie', cookies.adminB)
        expect(ficha.body.antecedentes.find((a: any) => a.id === antecedente.body.id).esAlertaClinica).toBe(true)
        expect(ficha.body.medicaciones.find((m: any) => m.id === medicacion.body.id).esAlertaClinica).toBe(true)
      })

      it('por defecto un antecedente o medicación nuevos no son alerta clínica', async () => {
        const antecedente = await request(app)
          .post(`/api/pacientes/${pacienteBId}/ficha-inicial/antecedentes`)
          .set('Cookie', cookies.adminB)
          .send({ catalogoItemId: diabetes.id, estado: 'NO' })
        expect(antecedente.body.esAlertaClinica).toBe(false)
      })
    })
  })

  describe('turno: transiciones de estado', () => {
    it('no duplica el timestamp de inicio ni reinicia el timer al reenviar el mismo estado', async () => {
      const turno = await prisma.turno.create({
        data: { consultorioId: consultorioAId, pacienteId: pacienteAId, profesionalId: profesionalAId, especialidadId: especialidadAId, inicio: new Date('2026-08-01T16:00:00.000Z'), duracionMinutos: 60 },
      })

      const first = await request(app).patch(`/api/turnos/${turno.id}`).set('Cookie', cookies.profesionalA).send({ estado: 'ATENDIENDO' })
      expect(first.status).toBe(200)
      expect(first.body.inicioAtencion).toBeTruthy()

      const second = await request(app).patch(`/api/turnos/${turno.id}`).set('Cookie', cookies.profesionalA).send({ estado: 'ATENDIENDO' })
      expect(second.status).toBe(200)
      expect(second.body.inicioAtencion).toBe(first.body.inicioAtencion)

      await prisma.turno.delete({ where: { id: turno.id } })
    })

    it('no permite reabrir un turno cancelado', async () => {
      const turno = await prisma.turno.create({
        data: { consultorioId: consultorioAId, pacienteId: pacienteAId, profesionalId: profesionalAId, especialidadId: especialidadAId, inicio: new Date('2026-08-01T17:00:00.000Z'), duracionMinutos: 60, estado: EstadoTurno.CANCELADO },
      })

      const res = await request(app).patch(`/api/turnos/${turno.id}`).set('Cookie', cookies.profesionalA).send({ estado: 'ATENDIENDO' })
      expect(res.status).toBe(409)

      await prisma.turno.delete({ where: { id: turno.id } })
    })

    it('no permite reiniciar un turno ya finalizado', async () => {
      const turno = await prisma.turno.create({
        data: { consultorioId: consultorioAId, pacienteId: pacienteAId, profesionalId: profesionalAId, especialidadId: especialidadAId, inicio: new Date('2026-08-01T18:00:00.000Z'), duracionMinutos: 60, estado: EstadoTurno.FINALIZADO },
      })

      const res = await request(app).patch(`/api/turnos/${turno.id}`).set('Cookie', cookies.profesionalA).send({ estado: 'ATENDIENDO' })
      expect(res.status).toBe(409)

      await prisma.turno.delete({ where: { id: turno.id } })
    })
  })

  it('se puede crear una evolución asociada a un turno', async () => {
    const res = await request(app)
      .post('/api/evoluciones')
      .set('Cookie', cookies.profesionalA)
      .send({ pacienteId: pacienteAId, turnoId: turnoAId, contenido: 'evolución con turno asociado' })
    expect(res.status).toBe(201)
    expect(res.body.turnoId).toBe(turnoAId)
  })

  it('supervisor no puede leer evoluciones ni la ficha inicial', async () => {
    const evolucionesRes = await request(app).get('/api/evoluciones').set('Cookie', cookies.supervisorA)
    expect(evolucionesRes.status).toBe(403)

    const fichaRes = await request(app).get(`/api/pacientes/${pacienteAId}/ficha-inicial`).set('Cookie', cookies.supervisorA)
    expect(fichaRes.status).toBe(403)
  })

  describe('permisos administrativos ampliados: pacientes y turnos', () => {
    it('los cuatro roles pueden editar datos administrativos del paciente del propio consultorio', async () => {
      for (const cookie of [cookies.adminA, cookies.recepcionA, cookies.profesionalA, cookies.supervisorA]) {
        const res = await request(app)
          .patch(`/api/pacientes/${pacienteAId}`)
          .set('Cookie', cookie)
          .send({ telefono: '11-0000-0000' })
        expect(res.status).toBe(200)
      }
    })

    it('los cuatro roles pueden editar turnos del propio consultorio', async () => {
      for (const cookie of [cookies.adminA, cookies.recepcionA, cookies.profesionalA, cookies.supervisorA]) {
        const res = await request(app)
          .patch(`/api/turnos/${turnoAId}`)
          .set('Cookie', cookie)
          .send({ notas: `nota de ${cookie.slice(0, 4)}` })
        expect(res.status).toBe(200)
      }
    })

    it('ningún rol edita pacientes ni turnos de otro consultorio', async () => {
      const pacienteRes = await request(app).patch(`/api/pacientes/${pacienteBId}`).set('Cookie', cookies.adminA).send({ telefono: '1' })
      expect(pacienteRes.status).toBe(404)
    })

    it('el contenido clínico sigue restringido aunque se amplíen los permisos administrativos', async () => {
      const res = await request(app).get('/api/evoluciones').set('Cookie', cookies.supervisorA)
      expect(res.status).toBe(403)
    })
  })

  describe('autoría clínica: el profesionalId sale del vínculo del usuario, nunca del cliente', () => {
    it('un usuario sin profesional vinculado no puede crear una evolución', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalSinVinculo)
        .send({ pacienteId: pacienteAId, contenido: 'no debería poder' })
      expect(res.status).toBe(403)
    })

    it('un profesionalId enviado por el cliente se ignora: se usa el del usuario autenticado', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalA)
        .send({ pacienteId: pacienteAId, contenido: 'autoría automática', profesionalId: otroProfesionalAId })
      expect(res.status).toBe(201)
      expect(res.body.profesionalId).toBe(profesionalAId)
    })

    it('un usuario sin profesional vinculado sí puede leer evoluciones y ficha inicial si su rol lo permite', async () => {
      const evolucionesRes = await request(app).get('/api/evoluciones').set('Cookie', cookies.profesionalSinVinculo)
      expect(evolucionesRes.status).toBe(200)
      const fichaRes = await request(app).get(`/api/pacientes/${pacienteAId}/ficha-inicial`).set('Cookie', cookies.profesionalSinVinculo)
      expect(fichaRes.status).toBe(200)
    })

    it('un usuario sin profesional vinculado no puede editar la ficha inicial', async () => {
      const res = await request(app)
        .patch(`/api/pacientes/${pacienteAId}/ficha-inicial`)
        .set('Cookie', cookies.profesionalSinVinculo)
        .send({ motivoConsulta: 'no debería poder' })
      expect(res.status).toBe(403)
    })

    it('la ficha inicial registra el profesional responsable automáticamente, Administrador incluido', async () => {
      const res = await request(app)
        .patch(`/api/pacientes/${pacienteAId}/ficha-inicial`)
        .set('Cookie', cookies.adminA)
        .send({ objetivoPaciente: 'autoría de administrador' })
      expect(res.status).toBe(200)
      expect(res.body.profesionalResponsableId).toBe(profesionalAdminAId)
    })

    it('un usuario sin profesional vinculado no puede crear un estudio complementario', async () => {
      const res = await request(app)
        .post(`/api/pacientes/${pacienteAId}/ficha-inicial/estudios`)
        .set('Cookie', cookies.profesionalSinVinculo)
        .send({ tipo: 'RX' })
      expect(res.status).toBe(403)
    })

    it('un estudio complementario registra al profesional autor automáticamente', async () => {
      const res = await request(app)
        .post(`/api/pacientes/${pacienteAId}/ficha-inicial/estudios`)
        .set('Cookie', cookies.profesionalA)
        .send({ tipo: 'RMN' })
      expect(res.status).toBe(201)
      expect(res.body.profesionalId).toBe(profesionalAId)
    })
  })

  describe('estudios: archivo adjunto', () => {
    const fakeFile = () => Buffer.from('fake-pdf-bytes')

    async function crearEstudio() {
      const res = await request(app)
        .post(`/api/pacientes/${pacienteAId}/ficha-inicial/estudios`)
        .set('Cookie', cookies.profesionalA)
        .send({ tipo: 'RX' })
      expect(res.status).toBe(201)
      return res.body.id as number
    }

    it('sube un archivo, sirve el contenido y no expone archivoPathname', async () => {
      const estudioId = await crearEstudio()

      const res = await request(app)
        .post(`/api/ficha-estudios/${estudioId}/archivo`)
        .set('Cookie', cookies.profesionalA)
        .attach('archivo', fakeFile(), { filename: 'rx.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(201)
      expect(res.body.archivoUrl).toBe(`/api/ficha-estudios/${estudioId}/archivo/contenido`)
      expect(res.body).not.toHaveProperty('archivoPathname')

      const contenido = await request(app).get(res.body.archivoUrl).set('Cookie', cookies.adminA)
      expect(contenido.status).toBe(200)
      expect(contenido.headers['content-type']).toContain('application/pdf')
      expect(contenido.body.equals(fakeFile())).toBe(true)

      const ficha = await request(app).get(`/api/pacientes/${pacienteAId}/ficha-inicial`).set('Cookie', cookies.adminA)
      const estudioEnFicha = ficha.body.estudios.find((e: any) => e.id === estudioId)
      expect(estudioEnFicha.archivoUrl).toBe(res.body.archivoUrl)
      expect(estudioEnFicha).not.toHaveProperty('archivoPathname')

      await prisma.fichaEstudioComplementario.delete({ where: { id: estudioId } })
    })

    it('rechaza un formato no permitido (400)', async () => {
      const estudioId = await crearEstudio()

      const res = await request(app)
        .post(`/api/ficha-estudios/${estudioId}/archivo`)
        .set('Cookie', cookies.profesionalA)
        .attach('archivo', fakeFile(), { filename: 'nota.txt', contentType: 'text/plain' })
      expect(res.status).toBe(400)

      await prisma.fichaEstudioComplementario.delete({ where: { id: estudioId } })
    })

    it('un usuario sin profesional vinculado no puede subir el archivo', async () => {
      const estudioId = await crearEstudio()

      const res = await request(app)
        .post(`/api/ficha-estudios/${estudioId}/archivo`)
        .set('Cookie', cookies.profesionalSinVinculo)
        .attach('archivo', fakeFile(), { filename: 'rx.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(403)

      await prisma.fichaEstudioComplementario.delete({ where: { id: estudioId } })
    })

    it('no se puede subir ni ver el archivo de un estudio de otro consultorio', async () => {
      const estudioId = await crearEstudio()

      const subida = await request(app)
        .post(`/api/ficha-estudios/${estudioId}/archivo`)
        .set('Cookie', cookies.adminB)
        .attach('archivo', fakeFile(), { filename: 'rx.pdf', contentType: 'application/pdf' })
      expect(subida.status).toBe(404)

      await request(app)
        .post(`/api/ficha-estudios/${estudioId}/archivo`)
        .set('Cookie', cookies.profesionalA)
        .attach('archivo', fakeFile(), { filename: 'rx.pdf', contentType: 'application/pdf' })

      const lectura = await request(app).get(`/api/ficha-estudios/${estudioId}/archivo/contenido`).set('Cookie', cookies.adminB)
      expect(lectura.status).toBe(404)

      await prisma.fichaEstudioComplementario.delete({ where: { id: estudioId } })
    })

    it('reemplaza el archivo existente y lo elimina', async () => {
      const estudioId = await crearEstudio()

      const primero = await request(app)
        .post(`/api/ficha-estudios/${estudioId}/archivo`)
        .set('Cookie', cookies.profesionalA)
        .attach('archivo', fakeFile(), { filename: 'v1.pdf', contentType: 'application/pdf' })
      expect(primero.status).toBe(201)

      const segundo = await request(app)
        .post(`/api/ficha-estudios/${estudioId}/archivo`)
        .set('Cookie', cookies.profesionalA)
        .attach('archivo', Buffer.from('otro contenido'), { filename: 'v2.pdf', contentType: 'application/pdf' })
      expect(segundo.status).toBe(201)

      const del = await request(app).delete(`/api/ficha-estudios/${estudioId}/archivo`).set('Cookie', cookies.profesionalA)
      expect(del.status).toBe(204)

      const despues = await request(app).get(`/api/ficha-estudios/${estudioId}/archivo/contenido`).set('Cookie', cookies.adminA)
      expect(despues.status).toBe(404)

      await prisma.fichaEstudioComplementario.delete({ where: { id: estudioId } })
    })
  })

  describe('vínculo Usuario-Profesional desde el lado Profesional', () => {
    it('un administrador vincula un profesional a un usuario existente', async () => {
      const profesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Nuevo', apellido: 'Prof' } })
      const usuario = await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'Suelto', apellido: 'Usuario', email: `suelto-${RUN_ID}@test.local`, passwordHash: await hashPassword(PASSWORD), rol: RolUsuario.RECEPCION },
      })

      const res = await request(app)
        .patch(`/api/profesionales/${profesional.id}`)
        .set('Cookie', cookies.adminA)
        .send({ usuarioId: usuario.id })
      expect(res.status).toBe(200)
      expect(res.body.usuario?.id).toBe(usuario.id)

      const refetched = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } })
      expect(refetched.profesionalId).toBe(profesional.id)

      await prisma.usuario.delete({ where: { id: usuario.id } })
      await prisma.profesional.delete({ where: { id: profesional.id } })
    })

    it('no se vincula a un usuario de otro consultorio', async () => {
      const profesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Otro', apellido: 'Prof2' } })
      const usuarioB = await prisma.usuario.findUniqueOrThrow({ where: { email: emails.adminB } })

      const res = await request(app)
        .patch(`/api/profesionales/${profesional.id}`)
        .set('Cookie', cookies.adminA)
        .send({ usuarioId: usuarioB.id })
      expect(res.status).toBe(404)

      await prisma.profesional.delete({ where: { id: profesional.id } })
    })

    it('reasignar el usuario vinculado desvincula al anterior y vincula al nuevo, en una transacción', async () => {
      const profesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Reasignable', apellido: 'Prof' } })
      const usuarioViejo = await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'Viejo', apellido: 'Vinculo', email: `viejo-${RUN_ID}@test.local`, passwordHash: await hashPassword(PASSWORD), rol: RolUsuario.RECEPCION, profesionalId: profesional.id },
      })
      const usuarioNuevo = await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'Nuevo', apellido: 'Vinculo', email: `nuevovinculo-${RUN_ID}@test.local`, passwordHash: await hashPassword(PASSWORD), rol: RolUsuario.RECEPCION },
      })

      const res = await request(app)
        .patch(`/api/profesionales/${profesional.id}`)
        .set('Cookie', cookies.adminA)
        .send({ usuarioId: usuarioNuevo.id })
      expect(res.status).toBe(200)

      const viejoRefetched = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioViejo.id } })
      expect(viejoRefetched.profesionalId).toBeNull()
      const nuevoRefetched = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioNuevo.id } })
      expect(nuevoRefetched.profesionalId).toBe(profesional.id)

      await prisma.usuario.deleteMany({ where: { id: { in: [usuarioViejo.id, usuarioNuevo.id] } } })
      await prisma.profesional.delete({ where: { id: profesional.id } })
    })

    it('no se puede vincular un profesional a un usuario que ya tiene otro profesional vinculado (409)', async () => {
      const profesionalX = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'X', apellido: 'Prof' } })
      const profesionalY = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Y', apellido: 'Prof' } })
      const usuario = await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'Doble', apellido: 'Intento', email: `doble-${RUN_ID}@test.local`, passwordHash: await hashPassword(PASSWORD), rol: RolUsuario.RECEPCION, profesionalId: profesionalX.id },
      })

      const res = await request(app)
        .patch(`/api/profesionales/${profesionalY.id}`)
        .set('Cookie', cookies.adminA)
        .send({ usuarioId: usuario.id })
      expect(res.status).toBe(409)

      await prisma.usuario.delete({ where: { id: usuario.id } })
      await prisma.profesional.deleteMany({ where: { id: { in: [profesionalX.id, profesionalY.id] } } })
    })

    it('usuarioId: null desvincula', async () => {
      const profesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Desvinculable', apellido: 'Prof' } })
      const usuario = await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'Se', apellido: 'Desvincula', email: `sedesvincula-${RUN_ID}@test.local`, passwordHash: await hashPassword(PASSWORD), rol: RolUsuario.RECEPCION, profesionalId: profesional.id },
      })

      const res = await request(app)
        .patch(`/api/profesionales/${profesional.id}`)
        .set('Cookie', cookies.adminA)
        .send({ usuarioId: null })
      expect(res.status).toBe(200)

      const refetched = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } })
      expect(refetched.profesionalId).toBeNull()

      await prisma.usuario.delete({ where: { id: usuario.id } })
      await prisma.profesional.delete({ where: { id: profesional.id } })
    })

    it('un usuario no administrador recibe 403 al intentar vincular desde Profesionales', async () => {
      const res = await request(app)
        .patch(`/api/profesionales/${profesionalAId}`)
        .set('Cookie', cookies.profesionalA)
        .send({ usuarioId: null })
      expect(res.status).toBe(403)
    })
  })

  describe('desvincular Usuario-Profesional', () => {
    it('desvincular preserva el historial clínico existente pero bloquea nuevas escrituras', async () => {
      const profesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Historial', apellido: 'Prof' } })
      const usuario = await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'Con', apellido: 'Historial', email: `conhistorial-${RUN_ID}@test.local`, passwordHash: await hashPassword(PASSWORD), rol: RolUsuario.PROFESIONAL, profesionalId: profesional.id },
      })
      const loginRes = await loginRequest(`conhistorial-${RUN_ID}@test.local`)
      const cookie = cookieFrom(loginRes)

      const evolucion = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookie)
        .send({ pacienteId: pacienteAId, contenido: 'antes de desvincular' })
      expect(evolucion.status).toBe(201)

      const unlink = await request(app).patch(`/api/usuarios/${usuario.id}`).set('Cookie', cookies.adminA).send({ profesionalId: null })
      expect(unlink.status).toBe(200)

      const historico = await request(app).get('/api/evoluciones').set('Cookie', cookies.adminA)
      expect(historico.body.some((e: any) => e.id === evolucion.body.id)).toBe(true)

      const nuevaEvolucion = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookie)
        .send({ pacienteId: pacienteAId, contenido: 'después de desvincular' })
      expect(nuevaEvolucion.status).toBe(403)

      await prisma.evolucion.delete({ where: { id: evolucion.body.id } })
      await prisma.usuario.delete({ where: { id: usuario.id } })
      await prisma.profesional.delete({ where: { id: profesional.id } })
    })
  })

  describe('creación automática de Profesional al crear/editar Usuario PROFESIONAL', () => {
    it('crear un Usuario PROFESIONAL sin profesionalId crea y vincula un Profesional con el mismo nombre/apellido', async () => {
      const res = await request(app)
        .post('/api/usuarios')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Auto', apellido: `Creado${RUN_ID}`, email: `auto-creado-${RUN_ID}@test.local`, password: PASSWORD, rol: 'PROFESIONAL' })
      expect(res.status).toBe(201)
      expect(res.body.profesionalId).not.toBeNull()

      const profesional = await prisma.profesional.findUniqueOrThrow({ where: { id: res.body.profesionalId } })
      expect(profesional.nombre).toBe('Auto')
      expect(profesional.apellido).toBe(`Creado${RUN_ID}`)
      expect(profesional.consultorioId).toBe(consultorioAId)

      await prisma.usuario.delete({ where: { id: res.body.id } })
      await prisma.profesional.delete({ where: { id: profesional.id } })
    })

    it('crear un Usuario de otro rol no crea Profesional', async () => {
      const res = await request(app)
        .post('/api/usuarios')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Sin', apellido: `Auto${RUN_ID}`, email: `sin-auto-${RUN_ID}@test.local`, password: PASSWORD, rol: 'RECEPCION' })
      expect(res.status).toBe(201)
      expect(res.body.profesionalId).toBeNull()

      await prisma.usuario.delete({ where: { id: res.body.id } })
    })

    it('crear un Usuario PROFESIONAL con profesionalId explícito no crea uno nuevo (no duplica)', async () => {
      const profesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Ya', apellido: `Existe${RUN_ID}` } })
      const res = await request(app)
        .post('/api/usuarios')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Con', apellido: `Vinculo${RUN_ID}`, email: `con-vinculo-${RUN_ID}@test.local`, password: PASSWORD, rol: 'PROFESIONAL', profesionalId: profesional.id })
      expect(res.status).toBe(201)
      expect(res.body.profesionalId).toBe(profesional.id)

      const totalConEseNombre = await prisma.profesional.count({ where: { consultorioId: consultorioAId, nombre: 'Con' } })
      expect(totalConEseNombre).toBe(0)

      await prisma.usuario.delete({ where: { id: res.body.id } })
      await prisma.profesional.delete({ where: { id: profesional.id } })
    })

    it('cambiar el rol de un Usuario existente a PROFESIONAL crea un Profesional si no tenía', async () => {
      const usuario = await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'Cambia', apellido: `Rol${RUN_ID}`, email: `cambia-rol-${RUN_ID}@test.local`, passwordHash: await hashPassword(PASSWORD), rol: RolUsuario.RECEPCION },
      })
      const res = await request(app)
        .patch(`/api/usuarios/${usuario.id}`)
        .set('Cookie', cookies.adminA)
        .send({ rol: 'PROFESIONAL' })
      expect(res.status).toBe(200)
      expect(res.body.profesionalId).not.toBeNull()

      const profesional = await prisma.profesional.findUniqueOrThrow({ where: { id: res.body.profesionalId } })
      expect(profesional.nombre).toBe('Cambia')

      await prisma.usuario.delete({ where: { id: usuario.id } })
      await prisma.profesional.delete({ where: { id: profesional.id } })
    })

    it('cambiar el rol de PROFESIONAL a otro rol no borra ni desvincula el Profesional', async () => {
      const profesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Se', apellido: `Queda${RUN_ID}` } })
      const usuario = await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'De', apellido: `Vuelta${RUN_ID}`, email: `de-vuelta-${RUN_ID}@test.local`, passwordHash: await hashPassword(PASSWORD), rol: RolUsuario.PROFESIONAL, profesionalId: profesional.id },
      })
      const res = await request(app)
        .patch(`/api/usuarios/${usuario.id}`)
        .set('Cookie', cookies.adminA)
        .send({ rol: 'RECEPCION' })
      expect(res.status).toBe(200)

      const refetched = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } })
      expect(refetched.profesionalId).toBe(profesional.id)
      const profesionalSigueExistiendo = await prisma.profesional.findUnique({ where: { id: profesional.id } })
      expect(profesionalSigueExistiendo).not.toBeNull()

      await prisma.usuario.delete({ where: { id: usuario.id } })
      await prisma.profesional.delete({ where: { id: profesional.id } })
    })

    it('un email duplicado hace rollback: no queda un Profesional huérfano', async () => {
      const antesCount = await prisma.profesional.count({ where: { consultorioId: consultorioAId } })
      const res = await request(app)
        .post('/api/usuarios')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Falla', apellido: `Rollback${RUN_ID}`, email: emails.adminA, password: PASSWORD, rol: 'PROFESIONAL' })
      expect(res.status).toBe(409)

      const despuesCount = await prisma.profesional.count({ where: { consultorioId: consultorioAId } })
      expect(despuesCount).toBe(antesCount)
    })
  })

  describe('Crear Profesional: vincular Usuario también en el alta', () => {
    it('crea el profesional y lo vincula al usuario elegido, en la misma operación', async () => {
      const usuario = await prisma.usuario.create({
        data: { consultorioId: consultorioAId, nombre: 'Para', apellido: `Vincular${RUN_ID}`, email: `para-vincular-${RUN_ID}@test.local`, passwordHash: await hashPassword(PASSWORD), rol: RolUsuario.RECEPCION },
      })
      const res = await request(app)
        .post('/api/profesionales')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Nuevo', apellido: `ConUsuario${RUN_ID}`, usuarioId: usuario.id })
      expect(res.status).toBe(201)
      expect(res.body.usuario?.id).toBe(usuario.id)

      const refetched = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } })
      expect(refetched.profesionalId).toBe(res.body.id)

      await prisma.usuario.delete({ where: { id: usuario.id } })
      await prisma.profesional.delete({ where: { id: res.body.id } })
    })

    it('rechaza vincular un usuario de otro consultorio', async () => {
      const usuarioB = await prisma.usuario.findUniqueOrThrow({ where: { email: emails.adminB } })
      const res = await request(app)
        .post('/api/profesionales')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Cross', apellido: `Consultorio${RUN_ID}`, usuarioId: usuarioB.id })
      expect(res.status).toBe(404)
    })

    it('rechaza vincular un usuario ya vinculado a otro profesional (409), sin crear el nuevo profesional', async () => {
      const yaVinculado = await prisma.usuario.findUniqueOrThrow({ where: { email: emails.profesionalA } })
      const antesCount = await prisma.profesional.count({ where: { consultorioId: consultorioAId } })
      const res = await request(app)
        .post('/api/profesionales')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Doble', apellido: `Vinculo${RUN_ID}`, usuarioId: yaVinculado.id })
      expect(res.status).toBe(409)

      const despuesCount = await prisma.profesional.count({ where: { consultorioId: consultorioAId } })
      expect(despuesCount).toBe(antesCount)
    })

    it('crear sin usuarioId sigue siendo válido', async () => {
      const res = await request(app)
        .post('/api/profesionales')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Suelto', apellido: `SinUsuario${RUN_ID}` })
      expect(res.status).toBe(201)
      expect(res.body.usuario).toBeNull()

      await prisma.profesional.delete({ where: { id: res.body.id } })
    })
  })

  describe('Pacientes: Nombre completo (solo nombre es obligatorio)', () => {
    it('crea un paciente solo con nombre, sin apellido (Nombre completo)', async () => {
      const res = await request(app)
        .post('/api/pacientes')
        .set('Cookie', cookies.adminA)
        .send({ nombre: `Maria de los Angeles Perez${RUN_ID}`, apellido: '' })
      expect(res.status).toBe(201)
      expect(res.body.apellido).toBe('')

      await prisma.paciente.delete({ where: { id: res.body.id } })
    })

    it('rechaza crear un paciente sin nombre', async () => {
      const res = await request(app)
        .post('/api/pacientes')
        .set('Cookie', cookies.adminA)
        .send({ apellido: 'SinNombre' })
      expect(res.status).toBe(400)
    })

    it('editar el nombre a vacío se rechaza (400)', async () => {
      const creado = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'ConNombre', apellido: '' } })
      const res = await request(app)
        .patch(`/api/pacientes/${creado.id}`)
        .set('Cookie', cookies.adminA)
        .send({ nombre: '' })
      expect(res.status).toBe(400)

      await prisma.paciente.delete({ where: { id: creado.id } })
    })

    it('crea un paciente solo con nombre y apellido', async () => {
      const res = await request(app)
        .post('/api/pacientes')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Minimo', apellido: `Paciente${RUN_ID}` })
      expect(res.status).toBe(201)
      expect(res.body.documento).toBeNull()
      expect(res.body.fechaNacimiento).toBeNull()
      expect(res.body.telefono).toBeNull()

      await prisma.paciente.delete({ where: { id: res.body.id } })
    })

    it('documento vacío ("") se normaliza a null, no se guarda como string vacío', async () => {
      const res = await request(app)
        .post('/api/pacientes')
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Vacio', apellido: `Documento${RUN_ID}`, documento: '' })
      expect(res.status).toBe(201)
      expect(res.body.documento).toBeNull()

      await prisma.paciente.delete({ where: { id: res.body.id } })
    })

    it('rechaza un documento duplicado dentro del mismo consultorio (409)', async () => {
      const documento = `DUPLICADO-${RUN_ID}`
      const primero = await request(app).post('/api/pacientes').set('Cookie', cookies.adminA).send({ nombre: 'Uno', apellido: 'Doc', documento })
      expect(primero.status).toBe(201)

      const segundo = await request(app).post('/api/pacientes').set('Cookie', cookies.adminA).send({ nombre: 'Dos', apellido: 'Doc', documento })
      expect(segundo.status).toBe(409)

      await prisma.paciente.delete({ where: { id: primero.body.id } })
    })

    it('el mismo documento puede repetirse en otro consultorio', async () => {
      const documento = `MULTI-${RUN_ID}`
      const enA = await request(app).post('/api/pacientes').set('Cookie', cookies.adminA).send({ nombre: 'EnA', apellido: 'Doc', documento })
      expect(enA.status).toBe(201)
      const enB = await request(app).post('/api/pacientes').set('Cookie', cookies.adminB).send({ nombre: 'EnB', apellido: 'Doc', documento })
      expect(enB.status).toBe(201)

      await prisma.paciente.deleteMany({ where: { id: { in: [enA.body.id, enB.body.id] } } })
    })

    it('editar un paciente no exige los campos opcionales', async () => {
      const creado = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'Editar', apellido: 'Simple' } })
      const res = await request(app)
        .patch(`/api/pacientes/${creado.id}`)
        .set('Cookie', cookies.adminA)
        .send({ nombre: 'Editado' })
      expect(res.status).toBe(200)
      expect(res.body.nombre).toBe('Editado')

      await prisma.paciente.delete({ where: { id: creado.id } })
    })

    it('PATCH con documento="" lo normaliza a null', async () => {
      const creado = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'Con', apellido: 'Documento', documento: `TEMP-${RUN_ID}` } })
      const res = await request(app)
        .patch(`/api/pacientes/${creado.id}`)
        .set('Cookie', cookies.adminA)
        .send({ documento: '' })
      expect(res.status).toBe(200)
      expect(res.body.documento).toBeNull()

      await prisma.paciente.delete({ where: { id: creado.id } })
    })
  })

  describe('Pacientes: foto', () => {
    const fakePhoto = () => Buffer.from('fake-avatar-bytes')

    it('sube una foto, la sirve y no expone fotoPathname en ningún response de paciente', async () => {
      const creado = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'ConFoto', apellido: '' } })

      const res = await request(app)
        .post(`/api/pacientes/${creado.id}/foto`)
        .set('Cookie', cookies.recepcionA)
        .attach('foto', fakePhoto(), { filename: 'avatar.png', contentType: 'image/png' })
      expect(res.status).toBe(201)
      expect(res.body.fotoUrl).toBe(`/api/pacientes/${creado.id}/foto/contenido`)

      const contenido = await request(app).get(res.body.fotoUrl).set('Cookie', cookies.profesionalA)
      expect(contenido.status).toBe(200)
      expect(contenido.body.equals(fakePhoto())).toBe(true)

      const get = await request(app).get(`/api/pacientes/${creado.id}`).set('Cookie', cookies.adminA)
      expect(get.body.fotoUrl).toBe(`/api/pacientes/${creado.id}/foto/contenido`)
      expect(get.body).not.toHaveProperty('fotoPathname')
      expect(get.body).not.toHaveProperty('fotoMimeType')

      await prisma.paciente.delete({ where: { id: creado.id } })
    })

    it('no se puede subir ni ver la foto de un paciente de otro consultorio', async () => {
      const creado = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'Aislado', apellido: '' } })

      const subida = await request(app)
        .post(`/api/pacientes/${creado.id}/foto`)
        .set('Cookie', cookies.adminB)
        .attach('foto', fakePhoto(), { filename: 'avatar.png', contentType: 'image/png' })
      expect(subida.status).toBe(404)

      const lectura = await request(app).get(`/api/pacientes/${creado.id}/foto/contenido`).set('Cookie', cookies.adminB)
      expect(lectura.status).toBe(404)

      await prisma.paciente.delete({ where: { id: creado.id } })
    })

    it('sin foto, GET /contenido devuelve 404 y el paciente no tiene fotoUrl', async () => {
      const creado = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'SinFoto', apellido: '' } })

      const get = await request(app).get(`/api/pacientes/${creado.id}`).set('Cookie', cookies.adminA)
      expect(get.body.fotoUrl).toBeNull()

      const lectura = await request(app).get(`/api/pacientes/${creado.id}/foto/contenido`).set('Cookie', cookies.adminA)
      expect(lectura.status).toBe(404)

      await prisma.paciente.delete({ where: { id: creado.id } })
    })

    it('elimina la foto', async () => {
      const creado = await prisma.paciente.create({ data: { consultorioId: consultorioAId, nombre: 'ParaBorrar', apellido: '' } })
      await request(app)
        .post(`/api/pacientes/${creado.id}/foto`)
        .set('Cookie', cookies.adminA)
        .attach('foto', fakePhoto(), { filename: 'avatar.png', contentType: 'image/png' })

      const del = await request(app).delete(`/api/pacientes/${creado.id}/foto`).set('Cookie', cookies.adminA)
      expect(del.status).toBe(204)

      const get = await request(app).get(`/api/pacientes/${creado.id}`).set('Cookie', cookies.adminA)
      expect(get.body.fotoUrl).toBeNull()

      await prisma.paciente.delete({ where: { id: creado.id } })
    })
  })

  describe('Usuario: foto de perfil (propia)', () => {
    const fakePhoto = () => Buffer.from('fake-user-avatar-bytes')

    it('sube su propia foto, la sirve, y GET /auth/me la refleja sin exponer fotoPathname', async () => {
      const res = await request(app)
        .post('/api/usuarios/me/foto')
        .set('Cookie', cookies.profesionalA)
        .attach('foto', fakePhoto(), { filename: 'yo.png', contentType: 'image/png' })
      expect(res.status).toBe(201)
      expect(res.body.fotoUrl).toBe('/api/usuarios/me/foto/contenido')

      const contenido = await request(app).get('/api/usuarios/me/foto/contenido').set('Cookie', cookies.profesionalA)
      expect(contenido.status).toBe(200)
      expect(contenido.body.equals(fakePhoto())).toBe(true)

      const me = await request(app).get('/auth/me').set('Cookie', cookies.profesionalA)
      expect(me.body.fotoUrl).toBe('/api/usuarios/me/foto/contenido')
      expect(me.body).not.toHaveProperty('fotoPathname')

      await request(app).delete('/api/usuarios/me/foto').set('Cookie', cookies.profesionalA)
    })

    it('la ruta "me" nunca expone la foto de otro usuario', async () => {
      await request(app)
        .post('/api/usuarios/me/foto')
        .set('Cookie', cookies.profesionalA)
        .attach('foto', fakePhoto(), { filename: 'yo.png', contentType: 'image/png' })

      // adminA (usuario distinto, sin foto propia todavía) pide "su" foto —
      // por diseño la ruta no acepta un id, así que jamás puede terminar
      // viendo la de profesionalA.
      const res = await request(app).get('/api/usuarios/me/foto/contenido').set('Cookie', cookies.adminA)
      expect(res.status).toBe(404)

      await request(app).delete('/api/usuarios/me/foto').set('Cookie', cookies.profesionalA)
    })

    it('elimina su propia foto', async () => {
      await request(app)
        .post('/api/usuarios/me/foto')
        .set('Cookie', cookies.recepcionA)
        .attach('foto', fakePhoto(), { filename: 'yo.png', contentType: 'image/png' })

      const del = await request(app).delete('/api/usuarios/me/foto').set('Cookie', cookies.recepcionA)
      expect(del.status).toBe(204)

      const me = await request(app).get('/auth/me').set('Cookie', cookies.recepcionA)
      expect(me.body.fotoUrl).toBeNull()
    })
  })

  describe('Configuración', () => {
    describe('permisos', () => {
      it('profesional, recepción y supervisor reciben 403 en GET /api/usuarios', async () => {
        for (const cookie of [cookies.profesionalA, cookies.recepcionA, cookies.supervisorA]) {
          const res = await request(app).get('/api/usuarios').set('Cookie', cookie)
          expect(res.status).toBe(403)
        }
      })

      it('un administrador de otro consultorio no ve los usuarios del consultorio A', async () => {
        const res = await request(app).get('/api/usuarios').set('Cookie', cookies.adminB)
        expect(res.status).toBe(200)
        expect(res.body.some((u: any) => u.email === emails.adminA)).toBe(false)
      })

      it('recepción no puede editar el consultorio', async () => {
        const res = await request(app).patch('/api/consultorio').set('Cookie', cookies.recepcionA).send({ nombre: 'Hackeado' })
        expect(res.status).toBe(403)
      })
    })

    describe('usuarios', () => {
      let creadoId: number

      afterAll(async () => {
        if (creadoId) await prisma.usuario.deleteMany({ where: { id: creadoId } })
      })

      it('crea un usuario sin exponer passwordHash', async () => {
        const res = await request(app)
          .post('/api/usuarios')
          .set('Cookie', cookies.adminA)
          .send({ nombre: 'Nueva', apellido: 'Recepcionista', email: `nueva-${RUN_ID}@test.local`, password: PASSWORD, rol: 'RECEPCION' })

        expect(res.status).toBe(201)
        expect(res.body).not.toHaveProperty('passwordHash')
        expect(res.body.consultorioId ?? consultorioAId).toBeTruthy()
        creadoId = res.body.id
      })

      it('rechaza email duplicado con 409', async () => {
        const res = await request(app)
          .post('/api/usuarios')
          .set('Cookie', cookies.adminA)
          .send({ nombre: 'Duplicado', apellido: 'Test', email: emails.recepcionA, password: PASSWORD, rol: 'RECEPCION' })
        expect(res.status).toBe(409)
      })

      it('crea un usuario profesional vinculado a un profesional del mismo consultorio', async () => {
        // Profesional propio de este test (no reutiliza otroProfesionalAId: otro test
        // de este mismo archivo lo deja vinculado de forma permanente hasta el afterAll).
        const profesionalLibre = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Libre', apellido: 'Test' } })

        const res = await request(app)
          .post('/api/usuarios')
          .set('Cookie', cookies.adminA)
          .send({
            nombre: 'Vinculado',
            apellido: 'Test',
            email: `vinculado-${RUN_ID}@test.local`,
            password: PASSWORD,
            rol: 'PROFESIONAL',
            profesionalId: profesionalLibre.id,
          })
        expect(res.status).toBe(201)
        expect(res.body.profesionalId).toBe(profesionalLibre.id)

        await prisma.usuario.delete({ where: { id: res.body.id } })
        await prisma.profesional.delete({ where: { id: profesionalLibre.id } })
      })

      it('rechaza vincular un profesional de otro consultorio', async () => {
        const profesionalB = await prisma.profesional.create({ data: { consultorioId: consultorioBId, nombre: 'Prof', apellido: 'B' } })

        const res = await request(app)
          .post('/api/usuarios')
          .set('Cookie', cookies.adminA)
          .send({
            nombre: 'Cross',
            apellido: 'Test',
            email: `cross-${RUN_ID}@test.local`,
            password: PASSWORD,
            rol: 'PROFESIONAL',
            profesionalId: profesionalB.id,
          })
        expect(res.status).toBe(404)

        await prisma.profesional.delete({ where: { id: profesionalB.id } })
      })

      it('permite vincular un profesional a un usuario que no es rol PROFESIONAL (ej. Administrador autor clínico)', async () => {
        const profesionalLibre = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Libre', apellido: 'ParaVincular' } })
        const res = await request(app)
          .post('/api/usuarios')
          .set('Cookie', cookies.adminA)
          .send({
            nombre: 'Admin',
            apellido: 'ConProfesional',
            email: `adminconprof-${RUN_ID}@test.local`,
            password: PASSWORD,
            rol: 'RECEPCION',
            profesionalId: profesionalLibre.id,
          })
        expect(res.status).toBe(201)
        expect(res.body.profesionalId).toBe(profesionalLibre.id)
      })

      it('impide inactivar al último administrador activo', async () => {
        const res = await request(app)
          .patch(`/api/usuarios/${(await prisma.usuario.findUniqueOrThrow({ where: { email: emails.adminA } })).id}`)
          .set('Cookie', cookies.adminA)
          .send({ activo: false })
        expect(res.status).toBe(409)
      })

      it('impide cambiarle el rol al último administrador activo', async () => {
        const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: emails.adminA } })
        const res = await request(app)
          .patch(`/api/usuarios/${admin.id}`)
          .set('Cookie', cookies.adminA)
          .send({ rol: 'RECEPCION' })
        expect(res.status).toBe(409)
      })

      it('inactivar un usuario le impide loguear después', async () => {
        const created = await request(app)
          .post('/api/usuarios')
          .set('Cookie', cookies.adminA)
          .send({ nombre: 'Baja', apellido: 'Usuario', email: `baja-${RUN_ID}@test.local`, password: PASSWORD, rol: 'RECEPCION' })

        const patchRes = await request(app).patch(`/api/usuarios/${created.body.id}`).set('Cookie', cookies.adminA).send({ activo: false })
        expect(patchRes.status).toBe(200)
        expect(patchRes.body.activo).toBe(false)

        const loginRes = await loginRequest(`baja-${RUN_ID}@test.local`)
        expect(loginRes.status).toBe(401)

        await prisma.usuario.delete({ where: { id: created.body.id } })
      })
    })

    describe('listados con ?estado=todos', () => {
      let profesionalInactivoId: number

      beforeAll(async () => {
        const inactivo = await prisma.profesional.create({
          data: { consultorioId: consultorioAId, nombre: 'Inactivo', apellido: 'Prof', activo: false },
        })
        profesionalInactivoId = inactivo.id
      })

      afterAll(async () => {
        await prisma.profesional.delete({ where: { id: profesionalInactivoId } })
      })

      it('sin el query param, solo trae profesionales activos', async () => {
        const res = await request(app).get('/api/profesionales').set('Cookie', cookies.adminA)
        expect(res.body.some((p: any) => p.id === profesionalInactivoId)).toBe(false)
      })

      it('con ?estado=todos, un administrador también ve los inactivos', async () => {
        const res = await request(app).get('/api/profesionales?estado=todos').set('Cookie', cookies.adminA)
        expect(res.body.some((p: any) => p.id === profesionalInactivoId)).toBe(true)
      })

      it('?estado=todos no tiene efecto para roles no administradores', async () => {
        const res = await request(app).get('/api/profesionales?estado=todos').set('Cookie', cookies.recepcionA)
        expect(res.body.some((p: any) => p.id === profesionalInactivoId)).toBe(false)
      })

      it('el listado de profesionales incluye especialidades y usuario vinculado', async () => {
        const res = await request(app).get('/api/profesionales').set('Cookie', cookies.adminA)
        const conEspecialidad = res.body.find((p: any) => p.id === profesionalAId)
        expect(conEspecialidad.especialidades.some((pe: any) => pe.especialidadId === especialidadAId)).toBe(true)
        expect(conEspecialidad.usuario.email).toBe(emails.profesionalA)
      })
    })

    describe('asignación de especialidades a profesionales', () => {
      it('crea un profesional con especialidades asignadas', async () => {
        const res = await request(app)
          .post('/api/profesionales')
          .set('Cookie', cookies.adminA)
          .send({ nombre: 'Con', apellido: 'Especialidad', especialidadIds: [especialidadAId] })
        expect(res.status).toBe(201)
        expect(res.body.especialidades.map((pe: any) => pe.especialidadId)).toEqual([especialidadAId])

        await prisma.profesionalEspecialidad.deleteMany({ where: { profesionalId: res.body.id } })
        await prisma.profesional.delete({ where: { id: res.body.id } })
      })

      it('rechaza especialidades de otro consultorio al crear', async () => {
        const especialidadB = await prisma.especialidad.create({ data: { consultorioId: consultorioBId, nombre: `Especialidad B ${RUN_ID}`, color: '#000' } })

        const res = await request(app)
          .post('/api/profesionales')
          .set('Cookie', cookies.adminA)
          .send({ nombre: 'Cross', apellido: 'Especialidad', especialidadIds: [especialidadB.id] })
        expect(res.status).toBe(404)

        await prisma.especialidad.delete({ where: { id: especialidadB.id } })
      })

      it('reemplaza el set de especialidades de un profesional al editar', async () => {
        const especialidadExtra = await prisma.especialidad.create({ data: { consultorioId: consultorioAId, nombre: `Extra ${RUN_ID}`, color: '#111' } })
        const profesional = await prisma.profesional.create({
          data: { consultorioId: consultorioAId, nombre: 'Editable', apellido: 'Prof', especialidades: { create: { consultorioId: consultorioAId, especialidadId: especialidadAId } } },
        })

        const res = await request(app)
          .patch(`/api/profesionales/${profesional.id}`)
          .set('Cookie', cookies.adminA)
          .send({ especialidadIds: [especialidadExtra.id] })

        expect(res.status).toBe(200)
        expect(res.body.especialidades.map((pe: any) => pe.especialidadId)).toEqual([especialidadExtra.id])

        await prisma.profesionalEspecialidad.deleteMany({ where: { profesionalId: profesional.id } })
        await prisma.profesional.delete({ where: { id: profesional.id } })
        await prisma.especialidad.delete({ where: { id: especialidadExtra.id } })
      })
    })

    describe('especialidades y obras sociales', () => {
      it('el listado de especialidades incluye cantidad de profesionales asociados', async () => {
        const res = await request(app).get('/api/especialidades').set('Cookie', cookies.adminA)
        const especialidad = res.body.find((e: any) => e.id === especialidadAId)
        expect(especialidad._count.profesionales).toBeGreaterThanOrEqual(1)
      })

      it('el listado de obras sociales incluye cantidad de pacientes asociados', async () => {
        const obra = await prisma.obraSocial.create({ data: { consultorioId: consultorioAId, nombre: `OS Config ${RUN_ID}` } })
        await prisma.paciente.update({ where: { id: pacienteAId }, data: { obraSocialId: obra.id } })

        const res = await request(app).get('/api/obras-sociales').set('Cookie', cookies.adminA)
        const encontrada = res.body.find((o: any) => o.id === obra.id)
        expect(encontrada._count.pacientes).toBe(1)

        await prisma.paciente.update({ where: { id: pacienteAId }, data: { obraSocialId: null } })
      })
    })

    describe('eliminación segura', () => {
      it('elimina físicamente un profesional sin turnos ni evoluciones', async () => {
        const profesional = await prisma.profesional.create({ data: { consultorioId: consultorioAId, nombre: 'Sin', apellido: 'Historial' } })

        const res = await request(app).delete(`/api/profesionales/${profesional.id}`).set('Cookie', cookies.adminA)
        expect(res.status).toBe(204)

        const found = await prisma.profesional.findUnique({ where: { id: profesional.id } })
        expect(found).toBeNull()
      })

      it('no elimina un profesional con turnos: responde 409 y conserva el historial', async () => {
        const res = await request(app).delete(`/api/profesionales/${profesionalAId}`).set('Cookie', cookies.adminA)
        expect(res.status).toBe(409)

        const stillThere = await prisma.profesional.findUnique({ where: { id: profesionalAId } })
        expect(stillThere).not.toBeNull()
        const turno = await prisma.turno.findUnique({ where: { id: turnoAId } })
        expect(turno).not.toBeNull()
      })

      it('elimina físicamente una especialidad sin profesionales ni turnos asociados', async () => {
        const especialidad = await prisma.especialidad.create({ data: { consultorioId: consultorioAId, nombre: `Sin uso ${RUN_ID}`, color: '#222' } })

        const res = await request(app).delete(`/api/especialidades/${especialidad.id}`).set('Cookie', cookies.adminA)
        expect(res.status).toBe(204)

        const found = await prisma.especialidad.findUnique({ where: { id: especialidad.id } })
        expect(found).toBeNull()
      })

      it('no elimina una especialidad con profesionales o turnos asociados: responde 409', async () => {
        const res = await request(app).delete(`/api/especialidades/${especialidadAId}`).set('Cookie', cookies.adminA)
        expect(res.status).toBe(409)

        const stillThere = await prisma.especialidad.findUnique({ where: { id: especialidadAId } })
        expect(stillThere).not.toBeNull()
      })

      it('elimina físicamente una obra social sin pacientes ni turnos asociados', async () => {
        const obra = await prisma.obraSocial.create({ data: { consultorioId: consultorioAId, nombre: `Sin uso OS ${RUN_ID}` } })

        const res = await request(app).delete(`/api/obras-sociales/${obra.id}`).set('Cookie', cookies.adminA)
        expect(res.status).toBe(204)

        const found = await prisma.obraSocial.findUnique({ where: { id: obra.id } })
        expect(found).toBeNull()
      })

      it('no elimina una obra social asociada a pacientes: responde 409', async () => {
        const obra = await prisma.obraSocial.create({ data: { consultorioId: consultorioAId, nombre: `Con pacientes ${RUN_ID}` } })
        await prisma.paciente.update({ where: { id: pacienteAId }, data: { obraSocialId: obra.id } })

        const res = await request(app).delete(`/api/obras-sociales/${obra.id}`).set('Cookie', cookies.adminA)
        expect(res.status).toBe(409)

        await prisma.paciente.update({ where: { id: pacienteAId }, data: { obraSocialId: null } })
        await prisma.obraSocial.delete({ where: { id: obra.id } })
      })

      it('otro consultorio no puede eliminar un profesional ajeno (404, aislamiento)', async () => {
        const res = await request(app).delete(`/api/profesionales/${profesionalAId}`).set('Cookie', cookies.adminB)
        expect(res.status).toBe(404)

        const stillThere = await prisma.profesional.findUnique({ where: { id: profesionalAId } })
        expect(stillThere).not.toBeNull()
      })
    })

    it('un administrador puede editar los datos generales del consultorio', async () => {
      const res = await request(app)
        .patch('/api/consultorio')
        .set('Cookie', cookies.adminA)
        .send({ telefono: '11-4444-5555', ciudad: 'CABA' })
      expect(res.status).toBe(200)
      expect(res.body.telefono).toBe('11-4444-5555')
      expect(res.body.ciudad).toBe('CABA')
    })

    it('rechaza una zona horaria inválida', async () => {
      const res = await request(app)
        .patch('/api/consultorio')
        .set('Cookie', cookies.adminA)
        .send({ zonaHoraria: 'No/Existe' })
      expect(res.status).toBe(400)
    })
  })
})

describe('catálogo global/custom, paciente archivado y profesional inactivo/eliminado', () => {
  let consultorioId: number
  let otherConsultorioId: number
  let especialidadCustomId: number
  let pacienteId: number
  let profesionalConHistorialId: number
  let turnoFuturoId: number
  let turnoPasadoId: number
  let especialidadGlobalId: number

  const emails = {
    admin: `catalogo-admin-${RUN_ID}@test.local`,
    otherAdmin: `catalogo-other-admin-${RUN_ID}@test.local`,
    profesionalVinculado: `catalogo-prof-${RUN_ID}@test.local`,
  }
  const cookies: Record<string, string> = {}

  beforeAll(async () => {
    const passwordHash = await hashPassword(PASSWORD)

    const consultorio = await prisma.consultorio.create({ data: { nombre: `Consultorio Catalogo ${RUN_ID}`, slug: `consultorio-catalogo-${RUN_ID}` } })
    consultorioId = consultorio.id
    const otherConsultorio = await prisma.consultorio.create({ data: { nombre: `Consultorio Catalogo B ${RUN_ID}`, slug: `consultorio-catalogo-b-${RUN_ID}` } })
    otherConsultorioId = otherConsultorio.id

    const especialidadCustom = await prisma.especialidad.create({ data: { consultorioId, nombre: `Custom Especialidad ${RUN_ID}`, color: '#123456' } })
    especialidadCustomId = especialidadCustom.id

    await seedCatalogosGlobales()
    const especialidadGlobal = await prisma.especialidad.findFirst({ where: { consultorioId: null, esSistema: true } })
    if (!especialidadGlobal) throw new Error('seed de especialidades globales no corrió')
    especialidadGlobalId = especialidadGlobal.id

    const profesionalConHistorial = await prisma.profesional.create({ data: { consultorioId, nombre: 'Prof', apellido: `ConHistorial${RUN_ID}` } })
    profesionalConHistorialId = profesionalConHistorial.id
    await prisma.profesionalEspecialidad.create({ data: { consultorioId, profesionalId: profesionalConHistorialId, especialidadId: especialidadGlobalId } })

    const paciente = await prisma.paciente.create({ data: { consultorioId, nombre: 'Paciente', apellido: `Archivar${RUN_ID}` } })
    pacienteId = paciente.id

    const enUnaHora = new Date(Date.now() + 60 * 60 * 1000)
    const turnoFuturo = await prisma.turno.create({
      data: { consultorioId, pacienteId, profesionalId: profesionalConHistorialId, especialidadId: especialidadGlobalId, inicio: enUnaHora, duracionMinutos: 60 },
    })
    turnoFuturoId = turnoFuturo.id

    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000)
    const turnoPasado = await prisma.turno.create({
      data: {
        consultorioId, pacienteId, profesionalId: profesionalConHistorialId, especialidadId: especialidadGlobalId,
        inicio: haceUnaHora, duracionMinutos: 60, estado: EstadoTurno.FINALIZADO,
      },
    })
    turnoPasadoId = turnoPasado.id

    await prisma.usuario.createMany({
      data: [
        { consultorioId, nombre: 'Admin', apellido: 'Catalogo', email: emails.admin, passwordHash, rol: RolUsuario.ADMINISTRADOR },
        { consultorioId: otherConsultorioId, nombre: 'Admin', apellido: 'Otro', email: emails.otherAdmin, passwordHash, rol: RolUsuario.ADMINISTRADOR },
        { consultorioId, nombre: 'Profesional', apellido: 'ConHistorial', email: emails.profesionalVinculado, passwordHash, rol: RolUsuario.PROFESIONAL, profesionalId: profesionalConHistorialId },
      ],
    })

    for (const [key, email] of Object.entries(emails)) {
      const loginRes = await loginRequest(email)
      cookies[key] = cookieFrom(loginRes)
    }
  })

  afterAll(async () => {
    await prisma.turno.deleteMany({ where: { consultorioId: { in: [consultorioId, otherConsultorioId] } } })
    await prisma.profesionalEspecialidad.deleteMany({ where: { consultorioId: { in: [consultorioId, otherConsultorioId] } } })
    await prisma.usuario.deleteMany({ where: { consultorioId: { in: [consultorioId, otherConsultorioId] } } })
    await prisma.paciente.deleteMany({ where: { consultorioId: { in: [consultorioId, otherConsultorioId] } } })
    await prisma.profesional.deleteMany({ where: { consultorioId: { in: [consultorioId, otherConsultorioId] } } })
    await prisma.especialidad.deleteMany({ where: { id: especialidadCustomId } })
    await prisma.consultorioEspecialidadOculta.deleteMany({ where: { consultorioId: { in: [consultorioId, otherConsultorioId] } } })
    await prisma.consultorio.deleteMany({ where: { id: { in: [consultorioId, otherConsultorioId] } } })
  })

  describe('catálogo global/custom de especialidades', () => {
    it('el consultorio ve las especialidades globales y sus propias custom', async () => {
      const res = await request(app).get('/api/especialidades').set('Cookie', cookies.admin)
      expect(res.status).toBe(200)
      const nombres = res.body.map((e: any) => e.nombre)
      expect(nombres).toContain('Kinesiología general')
      expect(nombres).toContain(`Custom Especialidad ${RUN_ID}`)
    })

    it('no ve especialidades custom de otro consultorio', async () => {
      const res = await request(app).get('/api/especialidades').set('Cookie', cookies.otherAdmin)
      const nombres = res.body.map((e: any) => e.nombre)
      expect(nombres).not.toContain(`Custom Especialidad ${RUN_ID}`)
    })

    it('no puede editar una especialidad global (403)', async () => {
      const res = await request(app).patch(`/api/especialidades/${especialidadGlobalId}`).set('Cookie', cookies.admin).send({ color: '#000000' })
      expect(res.status).toBe(403)
    })

    it('no puede eliminar una especialidad global (403)', async () => {
      const res = await request(app).delete(`/api/especialidades/${especialidadGlobalId}`).set('Cookie', cookies.admin)
      expect(res.status).toBe(403)
    })

    it('ocultar una especialidad global solo afecta al propio consultorio, es idempotente y se puede restaurar', async () => {
      const hideRes = await request(app).post(`/api/especialidades/${especialidadGlobalId}/ocultar`).set('Cookie', cookies.admin)
      expect(hideRes.status).toBe(204)

      const ownList = await request(app).get('/api/especialidades').set('Cookie', cookies.admin)
      expect(ownList.body.map((e: any) => e.id)).not.toContain(especialidadGlobalId)

      const otherList = await request(app).get('/api/especialidades').set('Cookie', cookies.otherAdmin)
      expect(otherList.body.map((e: any) => e.id)).toContain(especialidadGlobalId)

      const hideAgain = await request(app).post(`/api/especialidades/${especialidadGlobalId}/ocultar`).set('Cookie', cookies.admin)
      expect(hideAgain.status).toBe(204)

      const restoreRes = await request(app).delete(`/api/especialidades/${especialidadGlobalId}/ocultar`).set('Cookie', cookies.admin)
      expect(restoreRes.status).toBe(204)

      const restoredList = await request(app).get('/api/especialidades').set('Cookie', cookies.admin)
      expect(restoredList.body.map((e: any) => e.id)).toContain(especialidadGlobalId)
    })

    // Bug real: una especialidad global (consultorioId: null) es visible y
    // seleccionable en el frontend, pero la validación de asignación
    // comparaba `especialidad.consultorioId === consultorioId` — eso excluye
    // a todas las globales y devuelve "no pertenece al consultorio" para
    // algo que el propio backend ofrece como válido. Ver
    // especialidadesInvalidasParaConsultorio en app.ts.
    it('una especialidad global puede asignarse a un profesional (antes fallaba con "no pertenece al consultorio")', async () => {
      const res = await request(app)
        .post('/api/profesionales')
        .set('Cookie', cookies.admin)
        .send({ nombre: 'Global', apellido: `Asignable${RUN_ID}`, especialidadIds: [especialidadGlobalId] })
      expect(res.status).toBe(201)
      expect(res.body.especialidades.map((pe: any) => pe.especialidadId)).toContain(especialidadGlobalId)

      await prisma.profesionalEspecialidad.deleteMany({ where: { profesionalId: res.body.id } })
      await prisma.profesional.delete({ where: { id: res.body.id } })
    })

    it('un turno puede crearse con una especialidad global', async () => {
      const profesionalConGlobal = await prisma.profesional.create({ data: { consultorioId, nombre: 'Turno', apellido: `Global${RUN_ID}` } })
      await prisma.profesionalEspecialidad.create({ data: { consultorioId, profesionalId: profesionalConGlobal.id, especialidadId: especialidadGlobalId } })

      const res = await request(app)
        .post('/api/turnos')
        .set('Cookie', cookies.admin)
        .send({
          pacienteId,
          profesionalId: profesionalConGlobal.id,
          especialidadId: especialidadGlobalId,
          inicio: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          duracionMinutos: 30,
        })
      expect(res.status).toBe(201)

      await prisma.turno.delete({ where: { id: res.body.id } })
      await prisma.profesionalEspecialidad.deleteMany({ where: { profesionalId: profesionalConGlobal.id } })
      await prisma.profesional.delete({ where: { id: profesionalConGlobal.id } })
    })

    it('una especialidad custom de otro consultorio no puede asignarse a un profesional', async () => {
      const especialidadOtro = await prisma.especialidad.create({ data: { consultorioId: otherConsultorioId, nombre: `Otro Custom ${RUN_ID}`, color: '#111111' } })
      const res = await request(app)
        .post('/api/profesionales')
        .set('Cookie', cookies.admin)
        .send({ nombre: 'Cross', apellido: `Especialidad${RUN_ID}`, especialidadIds: [especialidadOtro.id] })
      expect(res.status).toBe(404)

      await prisma.especialidad.delete({ where: { id: especialidadOtro.id } })
    })
  })

  describe('seeds globales', () => {
    it('sembrar dos veces no duplica y deja exactamente 5 especialidades y 5 obras sociales globales', async () => {
      await seedCatalogosGlobales()
      await seedCatalogosGlobales()
      const especialidades = await prisma.especialidad.findMany({ where: { consultorioId: null, esSistema: true } })
      const obras = await prisma.obraSocial.findMany({ where: { consultorioId: null, esSistema: true } })
      expect(especialidades.length).toBe(5)
      expect(obras.length).toBe(5)
    })
  })

  describe('eliminación lógica de paciente', () => {
    it('archivar un paciente cancela sus turnos futuros y conserva los pasados', async () => {
      const res = await request(app).patch(`/api/pacientes/${pacienteId}`).set('Cookie', cookies.admin).send({ activo: false })
      expect(res.status).toBe(200)
      expect(res.body.activo).toBe(false)

      const futuro = await prisma.turno.findUnique({ where: { id: turnoFuturoId } })
      expect(futuro?.estado).toBe('CANCELADO')
      expect(futuro?.notas ?? '').toContain('archivado')

      const pasado = await prisma.turno.findUnique({ where: { id: turnoPasadoId } })
      expect(pasado?.estado).toBe('FINALIZADO')
    })

    it('no permite crear una nueva evolución para un paciente archivado', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalVinculado)
        .send({ pacienteId, contenido: 'no debería poder' })
      expect(res.status).toBe(404)
    })

    it('reactivar el paciente permite volver a operar con normalidad', async () => {
      const res = await request(app).patch(`/api/pacientes/${pacienteId}`).set('Cookie', cookies.admin).send({ activo: true })
      expect(res.status).toBe(200)
      expect(res.body.activo).toBe(true)
    })
  })

  describe('profesional inactivo y eliminado', () => {
    it('archivar (eliminar) un profesional con historial lo saca del listado pero conserva turnos y evoluciones', async () => {
      const res = await request(app).post(`/api/profesionales/${profesionalConHistorialId}/archivar`).set('Cookie', cookies.admin)
      expect(res.status).toBe(204)

      const listRes = await request(app).get('/api/profesionales?estado=todos').set('Cookie', cookies.admin)
      expect(listRes.body.map((p: any) => p.id)).not.toContain(profesionalConHistorialId)

      const turno = await prisma.turno.findUnique({ where: { id: turnoFuturoId } })
      expect(turno).not.toBeNull()
    })

    it('un usuario vinculado a un profesional archivado ya no puede registrar evoluciones (autoría bloqueada)', async () => {
      const res = await request(app)
        .post('/api/evoluciones')
        .set('Cookie', cookies.profesionalVinculado)
        .send({ pacienteId, contenido: 'no debería poder autoría' })
      expect(res.status).toBe(403)
    })

    it('restaurar el profesional archivado lo devuelve a los listados de inactivos', async () => {
      const res = await request(app).delete(`/api/profesionales/${profesionalConHistorialId}/archivar`).set('Cookie', cookies.admin)
      expect(res.status).toBe(204)

      const listRes = await request(app).get('/api/profesionales?estado=todos').set('Cookie', cookies.admin)
      expect(listRes.body.map((p: any) => p.id)).toContain(profesionalConHistorialId)
    })
  })
})

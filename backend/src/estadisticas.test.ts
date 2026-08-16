import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app'
import prisma from './prisma'
import { hashPassword } from './auth'
import { RolUsuario } from './generated/prisma/client'

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = 'Password123'

function loginRequest(email: string) {
  return request(app).post('/auth/login').send({ email, password: PASSWORD })
}

function cookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
  if (!cookie) throw new Error('login sin cookie de sesión')
  return cookie.split(';')[0]
}

describe('estadísticas', () => {
  let consultorioId: number
  let otroConsultorioId: number
  let profesionalAId: number
  let profesionalBId: number
  let pacienteAId: number
  let pacienteBId: number
  const cookies: Record<string, string> = {}

  // El rango cubre tanto los turnos fijos de 2027 como "ahora" (createdAt
  // real de los pacientes creados en el setup), sin superar MAX_RANGO_DIAS.
  const DESDE = '2026-06-01T00:00:00.000Z'
  const HASTA = '2027-01-10T23:59:59.999Z'

  beforeAll(async () => {
    const passwordHash = await hashPassword(PASSWORD)

    const consultorio = await prisma.consultorio.create({ data: { nombre: `Consultorio Stats ${RUN_ID}`, slug: `stats-${RUN_ID}` } })
    consultorioId = consultorio.id
    const otroConsultorio = await prisma.consultorio.create({ data: { nombre: `Consultorio Stats Otro ${RUN_ID}`, slug: `stats-otro-${RUN_ID}` } })
    otroConsultorioId = otroConsultorio.id

    const especialidad = await prisma.especialidad.create({ data: { consultorioId, nombre: `Kinesiología ${RUN_ID}`, color: 'var(--appointment-purple)' } })

    const profA = await prisma.profesional.create({ data: { consultorioId, nombre: 'Prof', apellido: 'A' } })
    profesionalAId = profA.id
    const profB = await prisma.profesional.create({ data: { consultorioId, nombre: 'Prof', apellido: 'B' } })
    profesionalBId = profB.id

    const pacA = await prisma.paciente.create({ data: { consultorioId, nombre: 'Paciente', apellido: 'A' } })
    pacienteAId = pacA.id
    const pacB = await prisma.paciente.create({ data: { consultorioId, nombre: 'Paciente', apellido: 'B' } })
    pacienteBId = pacB.id

    const turno = (overrides: Partial<Parameters<typeof prisma.turno.create>[0]['data']>) =>
      prisma.turno.create({
        data: {
          consultorioId,
          pacienteId: pacienteAId,
          profesionalId: profesionalAId,
          especialidadId: especialidad.id,
          duracionMinutos: 30,
          inicio: new Date('2027-01-02T10:00:00.000Z'),
          estado: 'ASIGNADO',
          ...overrides,
        },
      })

    // t1, t2: profA + pacienteA, FINALIZADO (2 sesiones del mismo paciente)
    await turno({ inicio: new Date('2027-01-02T10:00:00.000Z'), estado: 'FINALIZADO' })
    await turno({ inicio: new Date('2027-01-03T10:00:00.000Z'), estado: 'FINALIZADO' })
    // t3: profA + pacienteB, AUSENTE
    await turno({ pacienteId: pacienteBId, inicio: new Date('2027-01-04T10:00:00.000Z'), estado: 'AUSENTE' })
    // t4: profA + pacienteA, CANCELADO
    await turno({ inicio: new Date('2027-01-05T10:00:00.000Z'), estado: 'CANCELADO' })
    // t5: profB + pacienteB, FINALIZADO
    await turno({ profesionalId: profesionalBId, pacienteId: pacienteBId, inicio: new Date('2027-01-06T10:00:00.000Z'), estado: 'FINALIZADO' })
    // t6: fuera del rango de fechas — no debe contarse
    await turno({ inicio: new Date('2026-01-02T10:00:00.000Z'), estado: 'FINALIZADO' })

    // Turno de otro consultorio, mismas fechas — no debe filtrarse acá.
    const profesionalOtro = await prisma.profesional.create({ data: { consultorioId: otroConsultorioId, nombre: 'Prof', apellido: 'Otro' } })
    const especialidadOtro = await prisma.especialidad.create({ data: { consultorioId: otroConsultorioId, nombre: 'Otra', color: 'var(--appointment-teal)' } })
    const pacienteOtro = await prisma.paciente.create({ data: { consultorioId: otroConsultorioId, nombre: 'Paciente', apellido: 'Otro' } })
    await prisma.turno.create({
      data: {
        consultorioId: otroConsultorioId,
        pacienteId: pacienteOtro.id,
        profesionalId: profesionalOtro.id,
        especialidadId: especialidadOtro.id,
        duracionMinutos: 30,
        inicio: new Date('2027-01-02T10:00:00.000Z'),
        estado: 'FINALIZADO',
      },
    })

    const emails = {
      admin: `stats-admin-${RUN_ID}@test.local`,
      recepcion: `stats-recepcion-${RUN_ID}@test.local`,
      profA: `stats-profa-${RUN_ID}@test.local`,
    }
    await prisma.usuario.createMany({
      data: [
        { consultorioId, nombre: 'Admin', apellido: 'Stats', email: emails.admin, passwordHash, rol: RolUsuario.ADMINISTRADOR },
        { consultorioId, nombre: 'Recepcion', apellido: 'Stats', email: emails.recepcion, passwordHash, rol: RolUsuario.RECEPCION },
        { consultorioId, nombre: 'Profesional', apellido: 'A', email: emails.profA, passwordHash, rol: RolUsuario.PROFESIONAL, profesionalId: profesionalAId },
      ],
    })
    for (const [key, email] of Object.entries(emails)) {
      cookies[key] = cookieFrom(await loginRequest(email))
    }
  })

  afterAll(async () => {
    await prisma.turno.deleteMany({ where: { consultorioId: { in: [consultorioId, otroConsultorioId] } } })
    await prisma.usuario.deleteMany({ where: { consultorioId: { in: [consultorioId, otroConsultorioId] } } })
    await prisma.paciente.deleteMany({ where: { consultorioId: { in: [consultorioId, otroConsultorioId] } } })
    await prisma.profesional.deleteMany({ where: { consultorioId: { in: [consultorioId, otroConsultorioId] } } })
    await prisma.especialidad.deleteMany({ where: { consultorioId: { in: [consultorioId, otroConsultorioId] } } })
    await prisma.consultorio.deleteMany({ where: { id: { in: [consultorioId, otroConsultorioId] } } })
  })

  it('requiere desde y hasta', async () => {
    const res = await request(app).get('/api/estadisticas/resumen').set('Cookie', cookies.admin)
    expect(res.status).toBe(400)
  })

  it('rechaza un rango personalizado mayor al máximo permitido', async () => {
    const res = await request(app)
      .get('/api/estadisticas/resumen')
      .query({ desde: '2020-01-01T00:00:00.000Z', hasta: '2027-01-01T00:00:00.000Z' })
      .set('Cookie', cookies.admin)
    expect(res.status).toBe(400)
  })

  it('recepción no tiene acceso por default', async () => {
    const res = await request(app)
      .get('/api/estadisticas/resumen')
      .query({ desde: DESDE, hasta: HASTA })
      .set('Cookie', cookies.recepcion)
    expect(res.status).toBe(403)
  })

  it('calcula KPIs, aislado por consultorio y sin turnos fuera de rango', async () => {
    const res = await request(app)
      .get('/api/estadisticas/resumen')
      .query({ desde: DESDE, hasta: HASTA })
      .set('Cookie', cookies.admin)
    expect(res.status).toBe(200)

    const { kpis, estados, porProfesional, resumenProfesionales } = res.body
    expect(kpis.turnos).toBe(5) // t1..t5, ni t6 (fuera de rango) ni el de otro consultorio
    expect(kpis.sesionesRealizadas).toBe(3) // t1, t2, t5
    expect(kpis.pacientesAtendidos).toBe(2) // pacienteA (t1,t2) + pacienteB (t5)
    expect(kpis.ausentismo).toEqual({ porcentaje: 25, cantidad: 1, denominador: 4 }) // 1 ausente / (3 finalizados + 1 ausente)
    expect(kpis.cancelaciones).toEqual({ porcentaje: 20, cantidad: 1 })
    expect(kpis.pacientesNuevos).toBe(2) // pacienteA + pacienteB creados en el período de setup (createdAt = ahora)
    expect(kpis.promedioSesionesPorPaciente).toBe(1.5) // 3 sesiones / 2 pacientes

    const estadoCancelado = estados.find((e: any) => e.estado === 'CANCELADO')
    expect(estadoCancelado.cantidad).toBe(1)
    const estadoAsignado = estados.find((e: any) => e.estado === 'ASIGNADO')
    expect(estadoAsignado.cantidad).toBe(0) // estado sin turnos en el rango sigue presente, en 0 (no NaN/undefined)

    expect(porProfesional[0]).toMatchObject({ profesionalId: profesionalAId, finalizados: 2 })

    const resumenA = resumenProfesionales.find((r: any) => r.profesionalId === profesionalAId)
    expect(resumenA).toMatchObject({ turnos: 4, finalizados: 2, ausentes: 1, cancelados: 1, pacientesUnicos: 1 })
    const resumenB = resumenProfesionales.find((r: any) => r.profesionalId === profesionalBId)
    expect(resumenB).toMatchObject({ turnos: 1, finalizados: 1, ausentes: 0, cancelados: 0, pacientesUnicos: 1 })
  })

  it('un profesional solo ve sus propios datos, incluso si pide otro profesionalId por query', async () => {
    const res = await request(app)
      .get('/api/estadisticas/resumen')
      .query({ desde: DESDE, hasta: HASTA, profesionalId: profesionalBId })
      .set('Cookie', cookies.profA)
    expect(res.status).toBe(200)
    expect(res.body.kpis.turnos).toBe(4) // t1..t4, nunca los de profB
    expect(res.body.porProfesional).toEqual([])
    expect(res.body.resumenProfesionales).toEqual([])
  })

  it('un período sin turnos no da NaN, devuelve ceros y arrays vacíos', async () => {
    const res = await request(app)
      .get('/api/estadisticas/resumen')
      .query({ desde: '2030-01-01T00:00:00.000Z', hasta: '2030-01-05T00:00:00.000Z' })
      .set('Cookie', cookies.admin)
    expect(res.status).toBe(200)
    expect(res.body.kpis.turnos).toBe(0)
    expect(res.body.kpis.ausentismo.porcentaje).toBeNull()
    expect(res.body.kpis.promedioSesionesPorPaciente).toBeNull()
    expect(res.body.porProfesional).toEqual([])
    expect(res.body.serieTemporal.every((b: any) => Number.isFinite(b.turnos) && Number.isFinite(b.finalizados))).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { selectSesionesPlan, buildSesionesPlanDocument, slugifyForFilename, buildSesionesPlanFilename } from './sesionesPlan'
import type { EstadoTurno, Turno } from '../types/domain'

const NOW_ISO = '2026-09-04T15:00:00.000Z' // viernes 04/09/2026, 12:00 en Buenos Aires (UTC-3)
const TZ = 'America/Argentina/Buenos_Aires'
const ALL_ESTADOS: EstadoTurno[] = ['ASIGNADO', 'EN_ESPERA', 'ATENDIENDO', 'FINALIZADO', 'AUSENTE', 'CANCELADO', 'REPROGRAMADO']

function selectUpcomingSesiones(turnos: Turno[], nowIso: string) {
  // Mismo criterio que usaba la vieja selección por default ("no cancelado
  // + futuro"), ahora expresado como filtros explícitos — para reusar los
  // casos de test existentes sin reescribirlos todos.
  const from = nowIso.slice(0, 10)
  return selectSesionesPlan(turnos, {
    from,
    estados: ALL_ESTADOS.filter((estado) => estado !== 'CANCELADO'),
    timeZone: TZ,
  })
}

function makeTurno(overrides: Partial<Turno> & { id: number; inicio: string }): Turno {
  return {
    consultorioId: 1,
    pacienteId: 1,
    profesionalId: 1,
    especialidadId: 1,
    duracionMinutos: 60,
    estado: 'ASIGNADO',
    numeroSesion: null,
    paciente: { id: 1, consultorioId: 1, nombre: 'Nicolás', apellido: 'Zotalis', activo: true },
    profesional: { id: 1, consultorioId: 1, nombre: 'Matías', apellido: 'Delevic', activo: true },
    especialidad: { id: 1, consultorioId: 1, esSistema: false, nombre: 'Kinesiología general', color: '#7c3aed', activo: true },
    ...overrides,
  }
}

describe('selectUpcomingSesiones', () => {
  it('incluye turnos futuros', () => {
    const turno = makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z' })
    expect(selectUpcomingSesiones([turno], NOW_ISO)).toHaveLength(1)
  })

  it('excluye turnos pasados', () => {
    const turno = makeTurno({ id: 1, inicio: '2026-09-03T14:00:00.000Z' })
    expect(selectUpcomingSesiones([turno], NOW_ISO)).toHaveLength(0)
  })

  it('excluye CANCELADO aunque sea futuro', () => {
    const turno = makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z', estado: 'CANCELADO' })
    expect(selectUpcomingSesiones([turno], NOW_ISO)).toHaveLength(0)
  })

  it('incluye un turno exactamente en el instante actual', () => {
    const turno = makeTurno({ id: 1, inicio: NOW_ISO })
    expect(selectUpcomingSesiones([turno], NOW_ISO)).toHaveLength(1)
  })

  it('ordena por fecha/hora ascendente', () => {
    const turnos = [
      makeTurno({ id: 1, inicio: '2026-09-10T14:00:00.000Z' }),
      makeTurno({ id: 2, inicio: '2026-09-05T14:00:00.000Z' }),
      makeTurno({ id: 3, inicio: '2026-09-07T14:00:00.000Z' }),
    ]
    const result = selectUpcomingSesiones(turnos, NOW_ISO)
    expect(result.map((r) => r.inicio)).toEqual([
      '2026-09-05T14:00:00.000Z',
      '2026-09-07T14:00:00.000Z',
      '2026-09-10T14:00:00.000Z',
    ])
  })

  it('turnos individuales y de una serie recurrente (serieId) coexisten sin distinción', () => {
    const turnos = [
      makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z', serieId: null }),
      makeTurno({ id: 2, inicio: '2026-09-06T14:00:00.000Z', serieId: 9, ordenEnSerie: 3 }),
    ]
    expect(selectUpcomingSesiones(turnos, NOW_ISO)).toHaveLength(2)
  })

  it('una ocurrencia de serie reprogramada usa su inicio real persistido, no una fecha recalculada', () => {
    // Ocurrencia que "debería" haber sido el 06/09 según el patrón semanal,
    // pero se movió a mano al 08/09 — selectUpcomingSesiones nunca mira
    // SerieTurno, solo turno.inicio.
    const turno = makeTurno({ id: 1, inicio: '2026-09-08T14:00:00.000Z', serieId: 9, ordenEnSerie: 3 })
    const result = selectUpcomingSesiones([turno], NOW_ISO)
    expect(result[0].inicio).toBe('2026-09-08T14:00:00.000Z')
  })

  it('mantiene el numeroSesion real, nunca lo recalcula por posición', () => {
    const turnos = [
      makeTurno({ id: 1, inicio: '2026-09-10T14:00:00.000Z', numeroSesion: 5 }),
      makeTurno({ id: 2, inicio: '2026-09-05T14:00:00.000Z', numeroSesion: 3 }),
    ]
    const result = selectUpcomingSesiones(turnos, NOW_ISO)
    // El primero en el orden cronológico es numeroSesion 3, no "sesión 1".
    expect(result.map((r) => r.numeroSesion)).toEqual([3, 5])
  })

  it('un hueco de numeración (sesión cancelada) no se corrige ni renumera', () => {
    const turnos = [
      makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z', numeroSesion: 3 }),
      makeTurno({ id: 2, inicio: '2026-09-12T14:00:00.000Z', numeroSesion: 5 }),
    ]
    const result = selectUpcomingSesiones(turnos, NOW_ISO)
    expect(result.map((r) => r.numeroSesion)).toEqual([3, 5])
  })

  it('sin numeroSesion, queda null (nunca se inventa un número)', () => {
    const turno = makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z', numeroSesion: null })
    expect(selectUpcomingSesiones([turno], NOW_ISO)[0].numeroSesion).toBeNull()
  })

  it('sin próximas sesiones, devuelve un array vacío', () => {
    expect(selectUpcomingSesiones([], NOW_ISO)).toEqual([])
  })
})

describe('selectSesionesPlan', () => {
  it('selección inicial (solo ASIGNADO) excluye otros estados', () => {
    const turnos = [
      makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z', estado: 'ASIGNADO' }),
      makeTurno({ id: 2, inicio: '2026-09-06T14:00:00.000Z', estado: 'FINALIZADO' }),
      makeTurno({ id: 3, inicio: '2026-09-07T14:00:00.000Z', estado: 'REPROGRAMADO' }),
    ]
    const result = selectSesionesPlan(turnos, { estados: ['ASIGNADO'], timeZone: TZ })
    expect(result).toHaveLength(1)
  })

  it('REPROGRAMADO es un estado seleccionable como cualquier otro', () => {
    const turno = makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z', estado: 'REPROGRAMADO' })
    expect(selectSesionesPlan([turno], { estados: ['REPROGRAMADO'], timeZone: TZ })).toHaveLength(1)
  })

  it('sin estados seleccionados, no devuelve nada', () => {
    const turno = makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z' })
    expect(selectSesionesPlan([turno], { estados: [], timeZone: TZ })).toEqual([])
  })

  it('rango de fecha Desde/Hasta es inclusive, en la zona del consultorio', () => {
    const turnos = [
      makeTurno({ id: 1, inicio: '2026-09-04T14:00:00.000Z' }), // 04/09 11:00 ARG
      makeTurno({ id: 2, inicio: '2026-09-10T14:00:00.000Z' }), // 10/09 11:00 ARG
      makeTurno({ id: 3, inicio: '2026-09-15T14:00:00.000Z' }), // 15/09 11:00 ARG
    ]
    const result = selectSesionesPlan(turnos, { from: '2026-09-04', to: '2026-09-10', estados: ALL_ESTADOS, timeZone: TZ })
    expect(result.map((r) => r.inicio)).toEqual(['2026-09-04T14:00:00.000Z', '2026-09-10T14:00:00.000Z'])
  })

  it('sin rango de fecha, no restringe por fecha', () => {
    const turnos = [
      makeTurno({ id: 1, inicio: '2020-01-01T14:00:00.000Z' }),
      makeTurno({ id: 2, inicio: '2030-01-01T14:00:00.000Z' }),
    ]
    expect(selectSesionesPlan(turnos, { estados: ALL_ESTADOS, timeZone: TZ })).toHaveLength(2)
  })

  it('filtra por especialidad cuando se especifica un id', () => {
    const turnos = [
      makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z', especialidadId: 1 }),
      makeTurno({ id: 2, inicio: '2026-09-06T14:00:00.000Z', especialidadId: 2 }),
    ]
    const result = selectSesionesPlan(turnos, { estados: ALL_ESTADOS, especialidadId: 2, timeZone: TZ })
    expect(result).toHaveLength(1)
    expect(result[0].inicio).toBe('2026-09-06T14:00:00.000Z')
  })

  it('especialidadId null/undefined incluye todas las especialidades', () => {
    const turnos = [
      makeTurno({ id: 1, inicio: '2026-09-05T14:00:00.000Z', especialidadId: 1 }),
      makeTurno({ id: 2, inicio: '2026-09-06T14:00:00.000Z', especialidadId: 2 }),
    ]
    expect(selectSesionesPlan(turnos, { estados: ALL_ESTADOS, timeZone: TZ })).toHaveLength(2)
  })
})

describe('buildSesionesPlanDocument', () => {
  it('usa la fecha/hora de la zona horaria del consultorio, no UTC crudo', () => {
    // 2026-09-04T23:30:00Z es todavía 04/09 en UTC, pero ya 04/09 20:30 en
    // Buenos Aires (UTC-3) — no cruza el día en este caso puntual; se prueba
    // el caso real que sí cruza: 2026-09-05T02:00:00Z es 05/09 en UTC pero
    // 04/09 23:00 en Buenos Aires (UTC-3) — un día distinto.
    const doc = buildSesionesPlanDocument({
      patientName: 'Nicolás Zotalis',
      consultorioName: 'IAFS Center',
      sesiones: [{
        numeroSesion: 1,
        inicio: '2026-09-05T02:00:00.000Z',
        duracionMinutos: 60,
        profesionalDisplay: 'Matías Delevic',
        especialidadNombre: 'Kinesiología general',
      }],
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    // En UTC sería "Sábado 05/09" — en la zona del consultorio es "Viernes 04/09".
    expect(doc.rows[0].weekdayDate).toBe('Viernes 04/09')
    expect(doc.rows[0].hora).toBe('23:00 hs')
  })

  it('arma el label de sesión con fallback cuando no hay numeroSesion', () => {
    const doc = buildSesionesPlanDocument({
      patientName: 'Nicolás Zotalis',
      consultorioName: 'IAFS Center',
      sesiones: [{
        numeroSesion: null,
        inicio: '2026-09-05T14:00:00.000Z',
        duracionMinutos: 60,
        profesionalDisplay: 'Matías Delevic',
        especialidadNombre: 'Kinesiología general',
      }],
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    expect(doc.rows[0].numeroSesionLabel).toBe('Sesión')
  })

  it('incluye nombre de paciente y consultorio en el documento', () => {
    const doc = buildSesionesPlanDocument({
      patientName: 'Nicolás Zotalis',
      consultorioName: 'IAFS Center',
      sesiones: [],
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    expect(doc.patientName).toBe('Nicolás Zotalis')
    expect(doc.consultorioName).toBe('IAFS Center')
  })
})

describe('slugifyForFilename / buildSesionesPlanFilename', () => {
  it('saca acentos y espacios', () => {
    expect(slugifyForFilename('Nicolás Zotalis')).toBe('nicolas-zotalis')
  })

  it('arma el nombre de archivo completo', () => {
    expect(buildSesionesPlanFilename('Nicolás Zotalis', '2026-09-04')).toBe('plan-sesiones-nicolas-zotalis-2026-09-04.pdf')
  })
})

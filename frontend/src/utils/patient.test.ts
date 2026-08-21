import { describe, it, expect } from 'vitest'
import { patientFullName, ultimaAtencionFinalizada } from './patient'

describe('patientFullName', () => {
  it('nombre completo nuevo (todo en `nombre`, `apellido` vacío)', () => {
    expect(patientFullName({ nombre: 'María de los Ángeles Pérez', apellido: '' })).toBe('María de los Ángeles Pérez')
  })

  it('paciente viejo (nombre + apellido separados)', () => {
    expect(patientFullName({ nombre: 'Juan', apellido: 'Gómez' })).toBe('Juan Gómez')
  })

  it('colapsa espacios extra cuando apellido está vacío', () => {
    expect(patientFullName({ nombre: 'Juan', apellido: '' })).toBe('Juan')
  })

  it('paciente null/undefined devuelve string vacío', () => {
    expect(patientFullName(null)).toBe('')
    expect(patientFullName(undefined)).toBe('')
  })
})

describe('ultimaAtencionFinalizada', () => {
  it('ignora un ASIGNADO más reciente que el último FINALIZADO', () => {
    const turnos = [
      { estado: 'FINALIZADO', inicio: '2026-08-01T10:00:00.000Z' },
      { estado: 'ASIGNADO', inicio: '2026-08-20T10:00:00.000Z' },
    ]
    expect(ultimaAtencionFinalizada(turnos)?.inicio).toBe('2026-08-01T10:00:00.000Z')
  })

  it('ignora un CANCELADO más reciente que el último FINALIZADO', () => {
    const turnos = [
      { estado: 'FINALIZADO', inicio: '2026-08-01T10:00:00.000Z' },
      { estado: 'CANCELADO', inicio: '2026-08-20T10:00:00.000Z' },
    ]
    expect(ultimaAtencionFinalizada(turnos)?.inicio).toBe('2026-08-01T10:00:00.000Z')
  })

  it('elige el FINALIZADO más reciente entre varios', () => {
    const turnos = [
      { estado: 'FINALIZADO', inicio: '2026-08-01T10:00:00.000Z' },
      { estado: 'FINALIZADO', inicio: '2026-08-15T10:00:00.000Z' },
      { estado: 'FINALIZADO', inicio: '2026-08-10T10:00:00.000Z' },
    ]
    expect(ultimaAtencionFinalizada(turnos)?.inicio).toBe('2026-08-15T10:00:00.000Z')
  })

  it('sin ningún FINALIZADO devuelve null', () => {
    expect(ultimaAtencionFinalizada([{ estado: 'ASIGNADO', inicio: '2026-08-01T10:00:00.000Z' }])).toBeNull()
    expect(ultimaAtencionFinalizada([])).toBeNull()
  })
})

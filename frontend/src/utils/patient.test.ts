import { describe, it, expect } from 'vitest'
import { patientFullName } from './patient'

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

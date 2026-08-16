import { describe, it, expect } from 'vitest'
import { parseDisplayDate, formatDisplayDate, calculateAge, toDateInputValue } from './dateFormat'

describe('parseDisplayDate', () => {
  it('parsea dd/mm/aaaa', () => {
    expect(parseDisplayDate('06/08/2026')).toBe('2026-08-06')
  })

  it('parsea d/m/aaaa (sin ceros a la izquierda)', () => {
    expect(parseDisplayDate('6/8/2026')).toBe('2026-08-06')
  })

  it('rechaza un día que no existe (31 de febrero)', () => {
    expect(parseDisplayDate('31/02/2026')).toBeNull()
  })

  it('rechaza un mes inválido', () => {
    expect(parseDisplayDate('12/13/2026')).toBeNull()
  })

  it('rechaza día 0', () => {
    expect(parseDisplayDate('00/12/2026')).toBeNull()
  })

  it('acepta el 29 de febrero en año bisiesto', () => {
    expect(parseDisplayDate('29/02/2024')).toBe('2024-02-29')
  })

  it('rechaza el 29 de febrero en año no bisiesto', () => {
    expect(parseDisplayDate('29/02/2026')).toBeNull()
  })

  it('rechaza texto que no tiene forma de fecha', () => {
    expect(parseDisplayDate('no es una fecha')).toBeNull()
    expect(parseDisplayDate('')).toBeNull()
  })
})

describe('formatDisplayDate', () => {
  it('formatea YYYY-MM-DD a dd/mm/aaaa', () => {
    expect(formatDisplayDate('2026-08-06')).toBe('06/08/2026')
  })

  it('toma solo el prefijo de fecha de un ISO datetime', () => {
    expect(formatDisplayDate('2026-08-06T12:00:00.000Z')).toBe('06/08/2026')
  })

  it('devuelve vacío para valores vacíos', () => {
    expect(formatDisplayDate('')).toBe('')
    expect(formatDisplayDate(null)).toBe('')
    expect(formatDisplayDate(undefined)).toBe('')
  })
})

describe('parseDisplayDate + formatDisplayDate: ida y vuelta', () => {
  it('normaliza 6/8/2026 a 06/08/2026 pasando por YYYY-MM-DD', () => {
    const iso = parseDisplayDate('6/8/2026')
    expect(iso).not.toBeNull()
    expect(formatDisplayDate(iso)).toBe('06/08/2026')
  })
})

describe('toDateInputValue + formatDisplayDate: fecha de nacimiento no cambia de día por UTC', () => {
  it('una fecha de nacimiento guardada como medianoche UTC muestra el mismo día calendario', () => {
    // Como la guarda el backend: new Date('2000-01-15') -> medianoche UTC.
    const storedIso = new Date('2000-01-15').toISOString()
    const dateInputValue = toDateInputValue(storedIso)
    expect(dateInputValue).toBe('2000-01-15')
    expect(formatDisplayDate(dateInputValue)).toBe('15/01/2000')
  })
})

describe('calculateAge', () => {
  it('calcula la edad leyendo la fecha de nacimiento en UTC, no en hora local', () => {
    // Medianoche UTC de un 15 de enero — en cualquier huso horario, sigue
    // siendo "15 de enero" como fecha de nacimiento (no un día antes).
    const birthIso = new Date(Date.UTC(2000, 0, 15)).toISOString()
    const age = calculateAge(birthIso)
    expect(age).not.toBeNull()

    const today = new Date()
    let expected = today.getFullYear() - 2000
    const hadBirthday = today.getMonth() > 0 || (today.getMonth() === 0 && today.getDate() >= 15)
    if (!hadBirthday) expected -= 1
    expect(age).toBe(expected)
  })

  it('devuelve null para un valor vacío o inválido', () => {
    expect(calculateAge(null)).toBeNull()
    expect(calculateAge(undefined)).toBeNull()
    expect(calculateAge('no-es-fecha')).toBeNull()
  })
})

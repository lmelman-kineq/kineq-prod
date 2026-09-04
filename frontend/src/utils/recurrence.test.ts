import { describe, it, expect } from 'vitest'
import {
  addDaysToDateString,
  generateRecurrenceDates,
  buildSerieFechasInicio,
  weekdayLabel,
  ordinalOfWeekdayInMonth,
  ordinalLabel,
  monthlyRecurrenceLabel,
  generateMonthlyOrdinalDates,
  buildMonthlySerieFechasInicio,
} from './recurrence'

describe('weekdayLabel', () => {
  it('identifica el lunes 07/09/2026', () => {
    expect(weekdayLabel('2026-09-07')).toBe('lunes')
  })
})

describe('addDaysToDateString', () => {
  it('suma días cruzando de mes', () => {
    expect(addDaysToDateString('2026-01-28', 7)).toBe('2026-02-04')
  })

  it('suma días cruzando de año', () => {
    expect(addDaysToDateString('2026-12-30', 5)).toBe('2027-01-04')
  })
})

describe('generateRecurrenceDates', () => {
  it('genera 10 fechas semanales consecutivas, todas el mismo día de la semana', () => {
    const fechas = generateRecurrenceDates('2026-09-07', 1, 10)
    expect(fechas).toHaveLength(10)
    expect(fechas[0]).toBe('2026-09-07')
    expect(fechas[9]).toBe('2026-11-09')
    fechas.forEach((f) => expect(weekdayLabel(f)).toBe('lunes'))
  })

  it('genera fechas cada 2 semanas', () => {
    const fechas = generateRecurrenceDates('2026-09-01', 2, 3)
    expect(fechas).toEqual(['2026-09-01', '2026-09-15', '2026-09-29'])
  })

  it('la cantidad total incluye la primera ocurrencia (no cantidad+1)', () => {
    expect(generateRecurrenceDates('2026-01-05', 1, 5)).toHaveLength(5)
  })
})

describe('buildSerieFechasInicio', () => {
  it('convierte cada ocurrencia a UTC según la zona del consultorio', () => {
    const fechas = buildSerieFechasInicio('2026-09-07', '10:00', 1, 3, 'America/Argentina/Buenos_Aires')
    expect(fechas).toEqual([
      '2026-09-07T13:00:00.000Z',
      '2026-09-14T13:00:00.000Z',
      '2026-09-21T13:00:00.000Z',
    ])
  })
})

describe('ordinalOfWeekdayInMonth / ordinalLabel / monthlyRecurrenceLabel', () => {
  it('04/09/2026 es el primer viernes de septiembre', () => {
    expect(weekdayLabel('2026-09-04')).toBe('viernes')
    expect(ordinalOfWeekdayInMonth('2026-09-04')).toBe(1)
    expect(monthlyRecurrenceLabel('2026-09-04')).toBe('Todos los meses, el primer viernes')
  })

  it('18/09/2026 es el tercer viernes de septiembre', () => {
    expect(ordinalOfWeekdayInMonth('2026-09-18')).toBe(3)
    expect(monthlyRecurrenceLabel('2026-09-18')).toBe('Todos los meses, el tercer viernes')
  })

  it('ordinalLabel cubre 1 a 5', () => {
    expect(['primer', 'segundo', 'tercer', 'cuarto', 'quinto'].map((_, i) => ordinalLabel(i + 1))).toEqual([
      'primer', 'segundo', 'tercer', 'cuarto', 'quinto',
    ])
  })
})

describe('generateMonthlyOrdinalDates', () => {
  it('genera 4 fechas mensuales, siempre el primer viernes de cada mes calendario', () => {
    const fechas = generateMonthlyOrdinalDates('2026-09-04', 4)
    expect(fechas).toEqual(['2026-09-04', '2026-10-02', '2026-11-06', '2026-12-04'])
    fechas.forEach((f) => {
      expect(weekdayLabel(f)).toBe('viernes')
      expect(ordinalOfWeekdayInMonth(f)).toBe(1)
    })
  })

  it('el tercer viernes de cada mes (a partir del 18/09/2026)', () => {
    expect(generateMonthlyOrdinalDates('2026-09-18', 3)).toEqual(['2026-09-18', '2026-10-16', '2026-11-20'])
  })

  it('quinto viernes: salta los meses que no tienen esa 5ta ocurrencia, nunca reinterpreta como "último viernes"', () => {
    // 2026-01-30 es el 5to viernes de enero; febrero/marzo/abril 2026 no
    // tienen 5to viernes — la siguiente ocurrencia real es 2026-05-29.
    const fechas = generateMonthlyOrdinalDates('2026-01-30', 3)
    expect(fechas).toEqual(['2026-01-30', '2026-05-29', '2026-07-31'])
    fechas.forEach((f) => expect(ordinalOfWeekdayInMonth(f)).toBe(5))
  })

  it('la cantidad total generada siempre es exacta, incluso cruzando meses sin la ocurrencia', () => {
    expect(generateMonthlyOrdinalDates('2026-01-30', 5)).toHaveLength(5)
  })
})

describe('buildMonthlySerieFechasInicio', () => {
  it('convierte cada ocurrencia mensual a UTC según la zona del consultorio', () => {
    const fechas = buildMonthlySerieFechasInicio('2026-09-04', '10:00', 3, 'America/Argentina/Buenos_Aires')
    expect(fechas).toEqual([
      '2026-09-04T13:00:00.000Z',
      '2026-10-02T13:00:00.000Z',
      '2026-11-06T13:00:00.000Z',
    ])
  })
})

import { describe, it, expect } from 'vitest'
import {
  getWeekStart,
  getWeekDates,
  addMonthsToDateString,
  getMonthStart,
  getMonthGridDates,
  getYearMonths,
  navigateDate,
} from './calendarRange'

describe('getWeekStart / getWeekDates', () => {
  it('viernes 04/09/2026 → la semana empieza el lunes 31/08/2026', () => {
    expect(getWeekStart('2026-09-04')).toBe('2026-08-31')
  })

  it('un lunes es el inicio de su propia semana', () => {
    expect(getWeekStart('2026-08-31')).toBe('2026-08-31')
  })

  it('getWeekDates devuelve 7 fechas consecutivas lunes a domingo', () => {
    expect(getWeekDates('2026-09-04')).toEqual([
      '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
      '2026-09-04', '2026-09-05', '2026-09-06',
    ])
  })
})

describe('addMonthsToDateString', () => {
  it('suma meses preservando el día', () => {
    expect(addMonthsToDateString('2026-01-15', 2)).toBe('2026-03-15')
  })

  it('clamp al último día real si el mes destino es más corto', () => {
    expect(addMonthsToDateString('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('cruza de año hacia adelante y hacia atrás', () => {
    expect(addMonthsToDateString('2026-11-15', 2)).toBe('2027-01-15')
    expect(addMonthsToDateString('2026-01-15', -2)).toBe('2025-11-15')
  })
})

describe('getMonthStart / getMonthGridDates', () => {
  it('getMonthStart da el primer día del mes', () => {
    expect(getMonthStart('2026-09-18')).toBe('2026-09-01')
  })

  it('la grilla de septiembre 2026 empieza en semana completa y es múltiplo de 7', () => {
    const grid = getMonthGridDates('2026-09-04')
    expect(grid.length % 7).toBe(0)
    // 01/09/2026 es martes → la grilla arranca el lunes anterior, 31/08.
    expect(grid[0]).toBe('2026-08-31')
    expect(grid).toContain('2026-09-01')
    expect(grid).toContain('2026-09-30')
    // La última fecha de la grilla es domingo (cierra la última semana completa).
    const last = grid[grid.length - 1]
    expect(new Date(`${last}T00:00:00Z`).getUTCDay()).toBe(0)
  })
})

describe('getYearMonths', () => {
  it('devuelve los 12 meses del año de la fecha dada', () => {
    const months = getYearMonths('2026-09-04')
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ year: 2026, month: 1 })
    expect(months[11]).toEqual({ year: 2026, month: 12 })
  })
})

describe('navigateDate', () => {
  it('day: +-1 día', () => {
    expect(navigateDate('2026-09-04', 'day', 1)).toBe('2026-09-05')
    expect(navigateDate('2026-09-04', 'day', -1)).toBe('2026-09-03')
  })

  it('week: +-7 días', () => {
    expect(navigateDate('2026-09-04', 'week', 1)).toBe('2026-09-11')
    expect(navigateDate('2026-09-04', 'week', -1)).toBe('2026-08-28')
  })

  it('month: +-1 mes calendario', () => {
    expect(navigateDate('2026-01-31', 'month', 1)).toBe('2026-02-28')
  })

  it('year: +-1 año', () => {
    expect(navigateDate('2026-09-04', 'year', 1)).toBe('2027-09-04')
    expect(navigateDate('2026-09-04', 'year', -1)).toBe('2025-09-04')
  })
})

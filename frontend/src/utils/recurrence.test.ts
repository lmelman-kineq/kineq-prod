import { describe, it, expect } from 'vitest'
import {
  addDaysToDateString,
  generateRecurrenceDates,
  buildSerieFechasInicio,
  weekdayLabel,
  weekdayShortLabel,
  weekdayFullLabel,
  ordinalOfWeekdayInMonth,
  ordinalLabel,
  monthlyRecurrenceLabel,
  generateMonthlyOrdinalDates,
  buildMonthlySerieFechasInicio,
  generateEveryNDaysDates,
  generateWeeklyMultiDayDates,
  generateEveryNMonthsDates,
  generateEveryNYearsDates,
  generateCustomRecurrenceDates,
  buildCustomSerieFechasInicio,
  customRecurrenceSummary,
  WEEKDAYS_MONDAY_FIRST,
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

describe('weekdayShortLabel / weekdayFullLabel / WEEKDAYS_MONDAY_FIRST', () => {
  it('los chips se muestran en orden L M X J V S D', () => {
    expect(WEEKDAYS_MONDAY_FIRST.map(weekdayShortLabel)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
  })

  it('weekdayFullLabel no depende de una fecha', () => {
    expect(WEEKDAYS_MONDAY_FIRST.map(weekdayFullLabel)).toEqual(['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'])
  })
})

describe('generateEveryNDaysDates (Personalizado, unidad día)', () => {
  it('cada 3 días, 4 ocurrencias', () => {
    expect(generateEveryNDaysDates('2026-09-04', 3, 4)).toEqual(['2026-09-04', '2026-09-07', '2026-09-10', '2026-09-13'])
  })
})

describe('generateWeeklyMultiDayDates (Personalizado, unidad semana, múltiples días)', () => {
  it('cada 1 semana, lunes y viernes, desde un viernes — orden estrictamente cronológico', () => {
    // Ejemplo literal del pedido: fecha inicial viernes 04/09/2026, lunes+viernes, cantidad 5.
    const fechas = generateWeeklyMultiDayDates('2026-09-04', 1, [1, 5], 5)
    expect(fechas).toEqual(['2026-09-04', '2026-09-07', '2026-09-11', '2026-09-14', '2026-09-18'])
  })

  it('nunca genera ocurrencias anteriores a la fecha inicial', () => {
    // Fecha inicial un miércoles; días elegidos lunes+viernes — el lunes de
    // esa misma semana ya pasó, así que la primera ocurrencia real es el
    // viernes de esa semana, no el lunes anterior a la fecha inicial.
    const fechas = generateWeeklyMultiDayDates('2026-09-09', 1, [1, 5], 3)
    expect(fechas[0]).toBe('2026-09-11')
    fechas.forEach((f) => expect(f >= '2026-09-09').toBe(true))
  })

  it('si la fecha inicial coincide con un día elegido, es la primera ocurrencia', () => {
    const fechas = generateWeeklyMultiDayDates('2026-09-07', 1, [1, 3, 5], 3)
    expect(fechas[0]).toBe('2026-09-07')
  })

  it('cada 2 semanas, dos días seleccionados', () => {
    const fechas = generateWeeklyMultiDayDates('2026-09-01', 2, [2, 4], 4) // martes y jueves
    expect(fechas).toEqual(['2026-09-01', '2026-09-03', '2026-09-15', '2026-09-17'])
  })
})

describe('generateEveryNMonthsDates / generateEveryNYearsDates (Personalizado)', () => {
  it('cada mes, mismo día del mes', () => {
    expect(generateEveryNMonthsDates('2026-01-15', 1, 3)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })

  it('clamp al último día del mes cuando el mes destino es más corto (31 → 28/29)', () => {
    const fechas = generateEveryNMonthsDates('2026-01-31', 1, 3)
    expect(fechas).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('cada año, misma fecha', () => {
    expect(generateEveryNYearsDates('2026-09-04', 1, 3)).toEqual(['2026-09-04', '2027-09-04', '2028-09-04'])
  })
})

describe('generateCustomRecurrenceDates (dispatcher)', () => {
  it('despacha unidad DIA', () => {
    expect(generateCustomRecurrenceDates('2026-09-04', { intervalo: 2, unidad: 'DIA' }, 3)).toEqual(['2026-09-04', '2026-09-06', '2026-09-08'])
  })

  it('despacha unidad SEMANA con diasSemana', () => {
    expect(generateCustomRecurrenceDates('2026-09-04', { intervalo: 1, unidad: 'SEMANA', diasSemana: [1, 5] }, 3)).toEqual(['2026-09-04', '2026-09-07', '2026-09-11'])
  })
})

describe('buildCustomSerieFechasInicio', () => {
  it('convierte cada ocurrencia personalizada a UTC según la zona del consultorio', () => {
    const fechas = buildCustomSerieFechasInicio('2026-09-04', '10:00', { intervalo: 1, unidad: 'SEMANA', diasSemana: [1, 5] }, 3, 'America/Argentina/Buenos_Aires')
    expect(fechas).toEqual([
      '2026-09-04T13:00:00.000Z',
      '2026-09-07T13:00:00.000Z',
      '2026-09-11T13:00:00.000Z',
    ])
  })
})

describe('customRecurrenceSummary', () => {
  it('día', () => {
    expect(customRecurrenceSummary({ intervalo: 1, unidad: 'DIA' })).toBe('Cada día')
    expect(customRecurrenceSummary({ intervalo: 3, unidad: 'DIA' })).toBe('Cada 3 días')
  })

  it('semana con uno o más días, en orden L-D sin importar el orden de entrada', () => {
    expect(customRecurrenceSummary({ intervalo: 1, unidad: 'SEMANA', diasSemana: [5, 1] })).toBe('Cada semana, lunes y viernes')
    expect(customRecurrenceSummary({ intervalo: 2, unidad: 'SEMANA', diasSemana: [4, 2] })).toBe('Cada 2 semanas, martes y jueves')
  })

  it('mes y año', () => {
    expect(customRecurrenceSummary({ intervalo: 1, unidad: 'MES' })).toBe('Cada mes')
    expect(customRecurrenceSummary({ intervalo: 1, unidad: 'ANIO' })).toBe('Cada año')
  })
})

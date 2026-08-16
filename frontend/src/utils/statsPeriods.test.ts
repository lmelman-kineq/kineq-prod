import { describe, it, expect } from 'vitest'
import { rangoParaPreset } from './statsPeriods'

// "Hoy" fijo para que los tests no dependan de cuándo se corren.
const HOY = new Date(2026, 7, 14) // 14/08/2026 (mes 0-indexed)

describe('rangoParaPreset', () => {
  it('ultimos7: incluye hoy y los 6 días anteriores', () => {
    expect(rangoParaPreset('ultimos7', HOY)).toEqual({ desde: '2026-08-08', hasta: '2026-08-14' })
  })

  it('ultimos30: incluye hoy y los 29 días anteriores', () => {
    expect(rangoParaPreset('ultimos30', HOY)).toEqual({ desde: '2026-07-16', hasta: '2026-08-14' })
  })

  it('esteMes: primer día del mes actual hasta hoy', () => {
    expect(rangoParaPreset('esteMes', HOY)).toEqual({ desde: '2026-08-01', hasta: '2026-08-14' })
  })

  it('mesAnterior: primer y último día del mes calendario anterior', () => {
    expect(rangoParaPreset('mesAnterior', HOY)).toEqual({ desde: '2026-07-01', hasta: '2026-07-31' })
  })

  it('mesAnterior cruza el límite de año (enero -> diciembre del año anterior)', () => {
    const enero = new Date(2026, 0, 15)
    expect(rangoParaPreset('mesAnterior', enero)).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' })
  })

  it('esteAnio: 1 de enero hasta hoy', () => {
    expect(rangoParaPreset('esteAnio', HOY)).toEqual({ desde: '2026-01-01', hasta: '2026-08-14' })
  })

  it('ultimos3meses: hasta siempre es hoy, desde siempre es antes de hasta', () => {
    const { desde, hasta } = rangoParaPreset('ultimos3meses', HOY)
    expect(hasta).toBe('2026-08-14')
    expect(desde < hasta).toBe(true)
  })
})

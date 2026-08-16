import { describe, it, expect } from 'vitest'
import { computeFichaCompletionStatus, fichaFormFromFicha, buildFichaPayload, fichaSeccionesResumen } from './fichaInicial'

describe('computeFichaCompletionStatus', () => {
  it('está pendiente cuando ningún campo tiene valor', () => {
    expect(computeFichaCompletionStatus(fichaFormFromFicha(null))).toBe('pendiente')
  })

  it('está parcial apenas se llena un solo campo', () => {
    const form = fichaFormFromFicha(null)
    form.motivoConsulta = 'Dolor lumbar'

    expect(computeFichaCompletionStatus(form)).toBe('parcial')
  })

  it('está completa solo cuando todos los campos tienen valor', () => {
    const form = fichaFormFromFicha(null)
    for (const field of Object.keys(form)) form[field] = 'x'

    expect(computeFichaCompletionStatus(form)).toBe('completa')
  })
})

describe('buildFichaPayload', () => {
  it('convierte los campos numéricos de string a number', () => {
    const form = fichaFormFromFicha(null)
    form.gestas = '2'
    form.ejercicioMinutosDia = '30'

    const payload = buildFichaPayload(form) as Record<string, unknown>
    expect(payload.gestas).toBe(2)
    expect(payload.ejercicioMinutosDia).toBe(30)
  })

  it('omite campos numéricos vacíos en vez de mandar NaN', () => {
    const form = fichaFormFromFicha(null)
    const payload = buildFichaPayload(form) as Record<string, unknown>
    expect(payload).not.toHaveProperty('gestas')
    expect(payload).not.toHaveProperty('edadMenarca')
  })

  it('omite fechaInicioProblema cuando está vacía', () => {
    const form = fichaFormFromFicha(null)
    const payload = buildFichaPayload(form) as Record<string, unknown>
    expect(payload).not.toHaveProperty('fechaInicioProblema')
  })

  it('incluye fechaInicioProblema cuando tiene valor', () => {
    const form = fichaFormFromFicha(null)
    form.fechaInicioProblema = '2026-01-15'
    const payload = buildFichaPayload(form) as Record<string, unknown>
    expect(payload.fechaInicioProblema).toBe('2026-01-15')
  })
})

describe('fichaSeccionesResumen', () => {
  it('cuenta 0 de 5 cuando no hay secciones', () => {
    expect(fichaSeccionesResumen(undefined)).toEqual({ revisadas: 0, total: 5 })
  })

  it('cuenta solo las secciones en estado REVISADA', () => {
    const secciones = [
      { id: 1, consultorioId: 1, fichaInicialId: 1, seccion: 'MOTIVO' as const, estado: 'REVISADA' as const, updatedAt: '' },
      { id: 2, consultorioId: 1, fichaInicialId: 1, seccion: 'ANTECEDENTES' as const, estado: 'EN_PROGRESO' as const, updatedAt: '' },
      { id: 3, consultorioId: 1, fichaInicialId: 1, seccion: 'SEGURIDAD' as const, estado: 'REVISADA' as const, updatedAt: '' },
    ]
    expect(fichaSeccionesResumen(secciones)).toEqual({ revisadas: 2, total: 5 })
  })

  it('no cuenta la sección ESTUDIOS (ya no forma parte de la Ficha Inicial)', () => {
    const secciones = [
      { id: 1, consultorioId: 1, fichaInicialId: 1, seccion: 'ESTUDIOS' as const, estado: 'REVISADA' as const, updatedAt: '' },
    ]
    expect(fichaSeccionesResumen(secciones)).toEqual({ revisadas: 0, total: 5 })
  })
})

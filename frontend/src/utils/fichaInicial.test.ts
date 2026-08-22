import { describe, it, expect } from 'vitest'
import { computeFichaCompletionStatus, fichaFormFromFicha, buildFichaPayload, fichaSeccionesResumen, fichaHasAnyClinicalData } from './fichaInicial'
import type { FichaInicial } from '../types/domain'

function fichaCon(fields: Partial<FichaInicial>): FichaInicial {
  return { id: 1, consultorioId: 1, pacienteId: 1, estado: 'BORRADOR', createdAt: '', updatedAt: '', ...fields } as FichaInicial
}

describe('computeFichaCompletionStatus', () => {
  it('está pendiente cuando ningún campo tiene valor', () => {
    expect(computeFichaCompletionStatus(fichaFormFromFicha(null))).toBe('pendiente')
  })

  it('está parcial apenas se llena un solo campo', () => {
    const form = fichaFormFromFicha(null)
    form.actividadFisica = 'Fútbol'

    expect(computeFichaCompletionStatus(form)).toBe('parcial')
  })

  it('está completa solo cuando todos los campos tienen valor', () => {
    const form = fichaFormFromFicha(null)
    for (const field of Object.keys(form)) form[field] = 'x'

    expect(computeFichaCompletionStatus(form)).toBe('completa')
  })

  it('los campos de "Motivo y contexto" (sección eliminada de la UI) ya no cuentan para el cálculo', () => {
    // Si siguieran contando, ninguna ficha nueva podría llegar a "completa"
    // — esos campos ya no tienen ningún input desde donde llenarlos.
    const form = fichaFormFromFicha(null)
    const motivoFields = ['motivoConsulta', 'fechaInicioProblema', 'diagnosticoDerivacion', 'objetivoPaciente', 'tratamientosPrevios', 'traumatismosAccidentes']
    for (const field of motivoFields) expect(form).not.toHaveProperty(field)
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

})

describe('fichaSeccionesResumen', () => {
  it('cuenta 0 de 4 cuando no hay secciones', () => {
    expect(fichaSeccionesResumen(undefined)).toEqual({ revisadas: 0, total: 4 })
  })

  it('cuenta solo las secciones en estado REVISADA', () => {
    const secciones = [
      { id: 1, consultorioId: 1, fichaInicialId: 1, seccion: 'ANTECEDENTES' as const, estado: 'EN_PROGRESO' as const, updatedAt: '' },
      { id: 2, consultorioId: 1, fichaInicialId: 1, seccion: 'SEGURIDAD' as const, estado: 'REVISADA' as const, updatedAt: '' },
    ]
    expect(fichaSeccionesResumen(secciones)).toEqual({ revisadas: 1, total: 4 })
  })

  it('no cuenta la sección MOTIVO (se fusionó con Antecedentes, ya no es una sección propia)', () => {
    const secciones = [
      { id: 1, consultorioId: 1, fichaInicialId: 1, seccion: 'MOTIVO' as const, estado: 'REVISADA' as const, updatedAt: '' },
    ]
    expect(fichaSeccionesResumen(secciones)).toEqual({ revisadas: 0, total: 4 })
  })

  it('no cuenta la sección ESTUDIOS (ya no forma parte de la Ficha Inicial)', () => {
    const secciones = [
      { id: 1, consultorioId: 1, fichaInicialId: 1, seccion: 'ESTUDIOS' as const, estado: 'REVISADA' as const, updatedAt: '' },
    ]
    expect(fichaSeccionesResumen(secciones)).toEqual({ revisadas: 0, total: 4 })
  })
})

describe('fichaHasAnyClinicalData (alerta "Ficha inicial pendiente")', () => {
  const emptyForm = fichaFormFromFicha(null)

  it('ficha inexistente y form vacío → sin datos', () => {
    expect(fichaHasAnyClinicalData(null, emptyForm)).toBe(false)
  })

  it('ficha con solo metadata/defaults (sin listas, form vacío) → sin datos', () => {
    const ficha = fichaCon({ antecedentes: [], alergias: [], medicaciones: [], estudios: [] })
    expect(fichaHasAnyClinicalData(ficha, emptyForm)).toBe(false)
  })

  it('un antecedente cargado → hay datos', () => {
    const ficha = fichaCon({ antecedentes: [{ id: 1 }] as FichaInicial['antecedentes'] })
    expect(fichaHasAnyClinicalData(ficha, emptyForm)).toBe(true)
  })

  it('una alergia cargada → hay datos', () => {
    const ficha = fichaCon({ alergias: [{ id: 1 }] as FichaInicial['alergias'] })
    expect(fichaHasAnyClinicalData(ficha, emptyForm)).toBe(true)
  })

  it('una medicación cargada → hay datos', () => {
    const ficha = fichaCon({ medicaciones: [{ id: 1 }] as FichaInicial['medicaciones'] })
    expect(fichaHasAnyClinicalData(ficha, emptyForm)).toBe(true)
  })

  it('un estudio complementario cargado → hay datos', () => {
    const ficha = fichaCon({ estudios: [{ id: 1 }] as FichaInicial['estudios'] })
    expect(fichaHasAnyClinicalData(ficha, emptyForm)).toBe(true)
  })

  it('un campo escalar clínico (hábito/dolor/seguridad) completado → hay datos', () => {
    const form = { ...emptyForm, actividadFisica: 'Fútbol' }
    expect(fichaHasAnyClinicalData(null, form)).toBe(true)
  })
})

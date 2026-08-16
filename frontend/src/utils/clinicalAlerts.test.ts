import { describe, it, expect } from 'vitest'
import { computeAlertasClinicas, groupAntecedentesPositivos } from './clinicalAlerts'
import type { FichaAntecedente, FichaInicial } from '../types/domain'

function antecedente(overrides: Partial<FichaAntecedente> & { id: number; categoria: FichaAntecedente['catalogoItem']['categoria']; nombre: string }): FichaAntecedente {
  const { id, categoria, nombre, ...rest } = overrides
  return {
    id,
    consultorioId: 1,
    fichaInicialId: 1,
    catalogoItemId: overrides.id,
    estado: 'SI',
    esAlertaClinica: false,
    activo: true,
    createdAt: '',
    updatedAt: '',
    catalogoItem: { id: overrides.id, categoria, codigo: nombre, nombre, activo: true, esSistema: true, orden: 0 },
    ...rest,
  }
}

function ficha(overrides: Partial<FichaInicial>): FichaInicial {
  return {
    id: 1,
    consultorioId: 1,
    pacienteId: 1,
    estado: 'BORRADOR',
    alergias: [],
    antecedentes: [],
    medicaciones: [],
    estudios: [],
    seccionesEstado: [],
    ...overrides,
  } as FichaInicial
}

describe('groupAntecedentesPositivos', () => {
  it('agrupa por categoría (Personales/Familiares/Quirúrgicos)', () => {
    const groups = groupAntecedentesPositivos([
      antecedente({ id: 1, categoria: 'ANTECEDENTE_PERSONAL', nombre: 'HTA' }),
      antecedente({ id: 2, categoria: 'ANTECEDENTE_FAMILIAR', nombre: 'Diabetes' }),
      antecedente({ id: 3, categoria: 'PROCEDIMIENTO_QUIRURGICO', nombre: 'Apendicectomía' }),
    ])
    expect(groups.map((g) => g.key)).toEqual(['ANTECEDENTE_PERSONAL', 'ANTECEDENTE_FAMILIAR', 'PROCEDIMIENTO_QUIRURGICO'])
  })

  it('excluye categorías sin ítems positivos (nunca un grupo vacío)', () => {
    const groups = groupAntecedentesPositivos([antecedente({ id: 1, categoria: 'ANTECEDENTE_PERSONAL', nombre: 'HTA' })])
    expect(groups).toHaveLength(1)
  })

  it('excluye antecedentes con estado NO', () => {
    const groups = groupAntecedentesPositivos([antecedente({ id: 1, categoria: 'ANTECEDENTE_PERSONAL', nombre: 'HTA', estado: 'NO' })])
    expect(groups).toHaveLength(0)
  })

  it('ordena los marcados como alerta clínica primero, dentro de la misma categoría', () => {
    const groups = groupAntecedentesPositivos([
      antecedente({ id: 1, categoria: 'ANTECEDENTE_PERSONAL', nombre: 'HTA', esAlertaClinica: false }),
      antecedente({ id: 2, categoria: 'ANTECEDENTE_PERSONAL', nombre: 'Diabetes', esAlertaClinica: true }),
    ])
    expect(groups[0].items.map((i) => i.id)).toEqual([2, 1])
  })

  it('con lista vacía o undefined devuelve sin grupos', () => {
    expect(groupAntecedentesPositivos(undefined)).toEqual([])
    expect(groupAntecedentesPositivos([])).toEqual([])
  })
})

describe('computeAlertasClinicas', () => {
  it('sin ficha: información pendiente (no se puede afirmar que no hay alertas)', () => {
    expect(computeAlertasClinicas(null).estado).toBe('pendiente')
  })

  it('secciones relevantes no revisadas y sin datos: información pendiente', () => {
    expect(computeAlertasClinicas(ficha({})).estado).toBe('pendiente')
  })

  it('secciones relevantes revisadas y sin datos: sin alertas activas', () => {
    const f = ficha({
      seccionesEstado: [
        { id: 1, consultorioId: 1, fichaInicialId: 1, seccion: 'SEGURIDAD', estado: 'REVISADA', updatedAt: '' },
        { id: 2, consultorioId: 1, fichaInicialId: 1, seccion: 'ANTECEDENTES', estado: 'REVISADA', updatedAt: '' },
      ],
    })
    expect(computeAlertasClinicas(f).estado).toBe('sin-alertas')
  })

  it('una alergia activa cuenta como alerta sin necesidad de flag explícito', () => {
    const f = ficha({ alergias: [{ id: 1, consultorioId: 1, fichaInicialId: 1, activa: true, createdAt: '', updatedAt: '' }] })
    const result = computeAlertasClinicas(f)
    expect(result.estado).toBe('activa')
    expect(result.total).toBe(1)
  })

  it('un antecedente positivo sin esAlertaClinica NO cuenta como alerta', () => {
    const f = ficha({ antecedentes: [antecedente({ id: 1, categoria: 'ANTECEDENTE_PERSONAL', nombre: 'HTA', esAlertaClinica: false })] })
    expect(computeAlertasClinicas(f).total).toBe(0)
  })

  it('un antecedente positivo con esAlertaClinica SÍ cuenta como alerta', () => {
    const f = ficha({ antecedentes: [antecedente({ id: 1, categoria: 'ANTECEDENTE_PERSONAL', nombre: 'HTA', esAlertaClinica: true })] })
    expect(computeAlertasClinicas(f).total).toBe(1)
  })

  it('un antecedente marcado como alerta pero con estado NO no cuenta (no está confirmado)', () => {
    const f = ficha({ antecedentes: [antecedente({ id: 1, categoria: 'ANTECEDENTE_PERSONAL', nombre: 'HTA', estado: 'NO', esAlertaClinica: true })] })
    expect(computeAlertasClinicas(f).total).toBe(0)
  })

  it('una medicación con esAlertaClinica cuenta como alerta', () => {
    const f = ficha({
      medicaciones: [{ id: 1, consultorioId: 1, fichaInicialId: 1, nombre: 'Warfarina', esAlertaClinica: true, activa: true, createdAt: '', updatedAt: '' }],
    })
    expect(computeAlertasClinicas(f).total).toBe(1)
  })

  it('una medicación sin esAlertaClinica no cuenta', () => {
    const f = ficha({
      medicaciones: [{ id: 1, consultorioId: 1, fichaInicialId: 1, nombre: 'Ibuprofeno', esAlertaClinica: false, activa: true, createdAt: '', updatedAt: '' }],
    })
    expect(computeAlertasClinicas(f).total).toBe(0)
  })

  it('suma alergias + antecedentes-alerta + medicación-alerta en el total', () => {
    const f = ficha({
      alergias: [{ id: 1, consultorioId: 1, fichaInicialId: 1, activa: true, createdAt: '', updatedAt: '' }],
      antecedentes: [antecedente({ id: 2, categoria: 'ANTECEDENTE_PERSONAL', nombre: 'HTA', esAlertaClinica: true })],
      medicaciones: [{ id: 3, consultorioId: 1, fichaInicialId: 1, nombre: 'Warfarina', esAlertaClinica: true, activa: true, createdAt: '', updatedAt: '' }],
    })
    expect(computeAlertasClinicas(f).total).toBe(3)
  })

  it('una alerta manual de campo (otrasAlertas) cuenta en el total y se expone en el resultado', () => {
    const f = ficha({
      alertasCampo: [{ id: 1, consultorioId: 1, fichaInicialId: 1, campo: 'dolorSintomas', createdAt: '' }],
    })
    const result = computeAlertasClinicas(f)
    expect(result.estado).toBe('activa')
    expect(result.total).toBe(1)
    expect(result.otrasAlertas).toHaveLength(1)
    expect(result.otrasAlertas[0].campo).toBe('dolorSintomas')
  })

  it('sin alertasCampo (undefined) no rompe y cuenta 0', () => {
    const f = ficha({})
    expect(computeAlertasClinicas(f).otrasAlertas).toEqual([])
  })
})

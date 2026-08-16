import { describe, it, expect } from 'vitest'
import { layoutTurnos, type TurnoLayoutInput } from './turnoLayout'

function turno(id: number, start: number, end: number): TurnoLayoutInput {
  return { id, startMinutes: start, endMinutes: end }
}

describe('layoutTurnos', () => {
  it('caso A: dos turnos con el mismo horario van en dos columnas', () => {
    const result = layoutTurnos([turno(1, 600, 660), turno(2, 600, 660)])
    expect(result.get(1)!.columns).toBe(2)
    expect(result.get(2)!.columns).toBe(2)
    expect(new Set([result.get(1)!.column, result.get(2)!.column])).toEqual(new Set([0, 1]))
  })

  it('caso A: tres turnos con el mismo horario van en tres columnas', () => {
    const result = layoutTurnos([turno(1, 600, 660), turno(2, 600, 660), turno(3, 600, 660)])
    expect(result.get(1)!.columns).toBe(3)
    expect(result.get(2)!.columns).toBe(3)
    expect(result.get(3)!.columns).toBe(3)
    expect(new Set([result.get(1)!.column, result.get(2)!.column, result.get(3)!.column])).toEqual(new Set([0, 1, 2]))
  })

  it('caso B: superposición parcial usa dos columnas y B se corre a la derecha', () => {
    // A: 10:00-11:00, B: 10:30-11:30
    const result = layoutTurnos([turno(1, 600, 660), turno(2, 630, 690)])
    expect(result.get(1)!.columns).toBe(2)
    expect(result.get(1)!.column).toBe(0)
    expect(result.get(2)!.column).toBe(1)
  })

  it('turnos consecutivos (fin = inicio siguiente) no se consideran superpuestos', () => {
    // A: 9:00-10:00, B: 10:00-11:00 (intervalos semiabiertos)
    const result = layoutTurnos([turno(1, 540, 600), turno(2, 600, 660)])
    expect(result.get(1)!.columns).toBe(1)
    expect(result.get(2)!.columns).toBe(1)
    expect(result.get(1)!.column).toBe(0)
    expect(result.get(2)!.column).toBe(0)
  })

  it('caso C/D: grupo encadenado se procesa completo y reutiliza columnas liberadas', () => {
    // A: 9:00-10:00, B: 9:30-10:30, C: 10:00-11:00
    // A y C no chocan directamente, pero están en el mismo grupo vía B.
    const result = layoutTurnos([turno(1, 540, 600), turno(2, 570, 630), turno(3, 600, 660)])
    expect(result.get(1)!.columns).toBe(2)
    expect(result.get(2)!.columns).toBe(2)
    expect(result.get(3)!.columns).toBe(2)
    // B nunca puede compartir columna con A ni con C (los solapa a ambos).
    expect(result.get(2)!.column).not.toBe(result.get(1)!.column)
    expect(result.get(2)!.column).not.toBe(result.get(3)!.column)
    // C reutiliza la columna que A dejó libre a las 10:00.
    expect(result.get(3)!.column).toBe(result.get(1)!.column)
  })

  it('turnos sin ninguna superposición quedan todos en una sola columna', () => {
    const result = layoutTurnos([turno(1, 480, 540), turno(2, 600, 660), turno(3, 720, 780)])
    expect(result.get(1)!.columns).toBe(1)
    expect(result.get(2)!.columns).toBe(1)
    expect(result.get(3)!.columns).toBe(1)
  })

  it('desempata por fin descendente y luego por id cuando el inicio es igual', () => {
    // Mismo inicio, fines distintos: no cambia la cantidad de columnas, pero
    // el orden de asignación debe ser determinístico (no dependiente del
    // orden de entrada).
    const resultA = layoutTurnos([turno(5, 600, 630), turno(2, 600, 660)])
    const resultB = layoutTurnos([turno(2, 600, 660), turno(5, 600, 630)])
    expect(resultA.get(2)!.column).toBe(resultB.get(2)!.column)
    expect(resultA.get(5)!.column).toBe(resultB.get(5)!.column)
  })
})

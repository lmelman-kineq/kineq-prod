import { describe, expect, it } from 'vitest'
import { calcularNumerosSesion, type TurnoParaNumerar } from './sesionesPack'

let nextId = 1
function turno(fecha: string, extra: Partial<TurnoParaNumerar> = {}): TurnoParaNumerar {
  return { id: nextId++, grupoId: 1, inicio: new Date(`${fecha}T12:00:00Z`), estado: 'ASIGNADO', esSesionConsulta: false, ...extra }
}

describe('calcularNumerosSesion', () => {
  it('numera por fecha, no por orden de creación (un turno intercalado corre a los siguientes)', () => {
    const a = turno('2026-03-01')
    const c = turno('2026-03-15')
    const b = turno('2026-03-08') // creado último, pero va en el medio
    const n = calcularNumerosSesion([a, c, b], 60)
    expect([n.get(a.id), n.get(b.id), n.get(c.id)]).toEqual([1, 2, 3])
  })

  it('un hueco mayor al corte arranca un pack nuevo del mismo diagnóstico', () => {
    const a = turno('2026-01-10')
    const b = turno('2026-01-17')
    const c = turno('2026-07-01')
    const n = calcularNumerosSesion([a, b, c], 60)
    expect([n.get(a.id), n.get(b.id), n.get(c.id)]).toEqual([1, 2, 1])
  })

  it('"Comienzo de módulo" reinicia la numeración aunque no haya hueco, y los siguientes siguen desde ahí', () => {
    const a = turno('2026-03-01')
    const b = turno('2026-03-08')
    const c = turno('2026-03-15', { inicioModulo: true })
    const d = turno('2026-03-22')
    const n = calcularNumerosSesion([a, b, c, d], 60)
    expect([n.get(a.id), n.get(b.id), n.get(c.id), n.get(d.id)]).toEqual([1, 2, 1, 2])
  })

  it('cada diagnóstico (y "sin diagnóstico") numera por separado', () => {
    const lumbar = turno('2026-01-10', { grupoId: 1 })
    const cervical = turno('2026-01-11', { grupoId: 2 })
    const sinDx = turno('2026-01-12', { grupoId: null })
    const lumbar2 = turno('2026-01-13', { grupoId: 1 })
    const n = calcularNumerosSesion([lumbar, cervical, sinDx, lumbar2], 60)
    expect([n.get(lumbar.id), n.get(cervical.id), n.get(sinDx.id), n.get(lumbar2.id)]).toEqual([1, 1, 1, 2])
  })

  it('cancelado, reprogramado y consulta no consumen número; ausente sí', () => {
    const a = turno('2026-02-01')
    const cancelado = turno('2026-02-02', { estado: 'CANCELADO' })
    const reprogramado = turno('2026-02-03', { estado: 'REPROGRAMADO' })
    const consulta = turno('2026-02-04', { esSesionConsulta: true })
    const ausente = turno('2026-02-05', { estado: 'AUSENTE' })
    const b = turno('2026-02-06')
    const n = calcularNumerosSesion([a, cancelado, reprogramado, consulta, ausente, b], 60)
    expect([n.get(a.id), n.get(cancelado.id), n.get(reprogramado.id), n.get(consulta.id), n.get(ausente.id), n.get(b.id)]).toEqual([1, null, null, null, 2, 3])
  })
})

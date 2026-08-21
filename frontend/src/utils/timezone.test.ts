import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  getTimezoneOffsetLabel,
  isValidTimeZone,
  zonedTimeToUtcIso,
  utcIsoToZonedParts,
  todayInTimeZone,
  todayDateInTimeZone,
} from './timezone'

describe('TIMEZONE_OPTIONS', () => {
  it('incluye Buenos Aires primero (default del consultorio)', () => {
    expect(TIMEZONE_OPTIONS[0].zone).toBe(DEFAULT_TIMEZONE)
    expect(DEFAULT_TIMEZONE).toBe('America/Argentina/Buenos_Aires')
  })

  it('incluye UTC', () => {
    expect(TIMEZONE_OPTIONS.some((option) => option.zone === 'UTC')).toBe(true)
  })

  it('todas las zonas son identificadores IANA válidos', () => {
    for (const { zone } of TIMEZONE_OPTIONS) {
      expect(isValidTimeZone(zone)).toBe(true)
    }
  })
})

describe('isValidTimeZone', () => {
  it('rechaza una zona inexistente', () => {
    expect(isValidTimeZone('No/Existe')).toBe(false)
  })
})

describe('getTimezoneOffsetLabel', () => {
  it('calcula el offset de Buenos Aires (UTC-03, sin horario de verano)', () => {
    expect(getTimezoneOffsetLabel('America/Argentina/Buenos_Aires')).toBe('UTC-3')
  })

  it('calcula el offset de UTC', () => {
    const label = getTimezoneOffsetLabel('UTC')
    expect(label === 'UTC' || label === 'UTC±00' || label === 'UTC+0').toBe(true)
  })
})

describe('zonedTimeToUtcIso / utcIsoToZonedParts', () => {
  it('interpreta 10:00 en Buenos Aires (UTC-3) como 13:00 UTC', () => {
    const iso = zonedTimeToUtcIso('2026-08-06', '10:00', 'America/Argentina/Buenos_Aires')
    expect(iso).toBe('2026-08-06T13:00:00.000Z')
  })

  it('hace el camino inverso: un instante UTC vuelve a la misma hora de pared en Buenos Aires', () => {
    const parts = utcIsoToZonedParts('2026-08-06T13:00:00.000Z', 'America/Argentina/Buenos_Aires')
    expect(parts).toEqual({ date: '2026-08-06', time: '10:00' })
  })

  it('ida y vuelta preserva la hora elegida sin importar la zona', () => {
    const zones = ['UTC', 'America/Argentina/Buenos_Aires', 'Asia/Tokyo', 'Pacific/Auckland']
    for (const zone of zones) {
      const iso = zonedTimeToUtcIso('2026-03-15', '09:30', zone)
      const parts = utcIsoToZonedParts(iso, zone)
      expect(parts).toEqual({ date: '2026-03-15', time: '09:30' })
    }
  })

  it('un turno guardado en una zona distinta a UTC no cambia de día al mostrarse en esa misma zona', () => {
    // 23:30 en Buenos Aires es 02:30 del día siguiente en UTC — el bug que
    // se evita es mostrar el turno "un día después" si se lee con
    // getters locales del navegador en vez de con la zona del consultorio.
    const iso = zonedTimeToUtcIso('2026-08-06', '23:30', 'America/Argentina/Buenos_Aires')
    expect(iso).toBe('2026-08-07T02:30:00.000Z')
    const parts = utcIsoToZonedParts(iso, 'America/Argentina/Buenos_Aires')
    expect(parts).toEqual({ date: '2026-08-06', time: '23:30' })
  })
})

describe('todayInTimeZone', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('domingo 23:30 hora Argentina sigue siendo domingo (aunque en UTC ya sea lunes)', () => {
    // 2026-08-09 es domingo. 23:30 ART = 2026-08-10T02:30:00Z (lunes en UTC)
    // — el bug era mostrar "lunes" en el mini calendario de Home usando
    // getters locales del navegador (o UTC) en vez de la zona del consultorio.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T02:30:00.000Z'))
    expect(todayInTimeZone('America/Argentina/Buenos_Aires')).toBe('2026-08-09')
  })

  it('lunes 00:30 hora Argentina ya es lunes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T03:30:00.000Z')) // 00:30 ART del lunes
    expect(todayInTimeZone('America/Argentina/Buenos_Aires')).toBe('2026-08-10')
  })

  it('el mismo instante da un día distinto en una zona horaria distinta', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T02:30:00.000Z'))
    expect(todayInTimeZone('Asia/Tokyo')).toBe('2026-08-10')
    expect(todayInTimeZone('America/Argentina/Buenos_Aires')).toBe('2026-08-09')
  })
})

describe('todayDateInTimeZone', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('devuelve un Date cuyo año/mes/día locales coinciden con todayInTimeZone (mismo día que se resalta en el mini calendario)', () => {
    // Mismo instante que el caso "domingo 23:30 ART sigue domingo" de
    // arriba: en UTC (o en la zona del navegador si difiere de Argentina)
    // ya sería lunes. Antes, la grilla del mini calendario se armaba con
    // `new Date()` (hora del navegador) mientras el resaltado de "hoy"
    // comparaba contra la zona del consultorio — dos marcos horarios
    // distintos que podían señalar días distintos. Este helper ancla el
    // punto de partida de la grilla a la misma zona que el resaltado.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T02:30:00.000Z'))
    const date = todayDateInTimeZone('America/Argentina/Buenos_Aires')
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`).toBe('2026-08-09')
  })
})

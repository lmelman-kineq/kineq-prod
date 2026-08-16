// Presets de período para Estadísticas. Devuelven fechas "YYYY-MM-DD"
// (sin hora) — la conversión a límites de día completo la hace
// `normalizeDateBoundary` en services/api.ts, igual que ya hace el filtro de
// fecha de Turnos (mismo criterio de zona horaria "de pared" del navegador).
export type PeriodoPreset = 'ultimos7' | 'ultimos30' | 'esteMes' | 'mesAnterior' | 'ultimos3meses' | 'esteAnio' | 'personalizado'

export const PERIODO_PRESETS: Array<{ key: PeriodoPreset; label: string }> = [
  { key: 'ultimos7', label: 'Últimos 7 días' },
  { key: 'ultimos30', label: 'Últimos 30 días' },
  { key: 'esteMes', label: 'Este mes' },
  { key: 'mesAnterior', label: 'Mes anterior' },
  { key: 'ultimos3meses', label: 'Últimos 3 meses' },
  { key: 'esteAnio', label: 'Este año' },
  { key: 'personalizado', label: 'Personalizado' },
]

export const DEFAULT_PERIODO_PRESET: PeriodoPreset = 'ultimos30'

function toDateStr(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Rango {desde, hasta} para un preset, salvo 'personalizado' (no calculable acá). */
export function rangoParaPreset(preset: Exclude<PeriodoPreset, 'personalizado'>, hoy: Date = new Date()): { desde: string; hasta: string } {
  const hastaStr = toDateStr(hoy)
  switch (preset) {
    case 'ultimos7':
      return { desde: toDateStr(addDays(hoy, -6)), hasta: hastaStr }
    case 'ultimos30':
      return { desde: toDateStr(addDays(hoy, -29)), hasta: hastaStr }
    case 'esteMes':
      return { desde: toDateStr(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: hastaStr }
    case 'mesAnterior': {
      const primerDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      const ultimoDiaMesAnterior = addDays(primerDiaMesActual, -1)
      const primerDiaMesAnterior = new Date(ultimoDiaMesAnterior.getFullYear(), ultimoDiaMesAnterior.getMonth(), 1)
      return { desde: toDateStr(primerDiaMesAnterior), hasta: toDateStr(ultimoDiaMesAnterior) }
    }
    case 'ultimos3meses':
      return { desde: toDateStr(new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate() + 1)), hasta: hastaStr }
    case 'esteAnio':
      return { desde: toDateStr(new Date(hoy.getFullYear(), 0, 1)), hasta: hastaStr }
  }
}

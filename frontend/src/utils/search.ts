// Ignora tildes/diacríticos al comparar términos de búsqueda (ej. "Nuñez"
// matchea "nunez") — mismo patrón normalize('NFD') que ya usaba statusClass
// en turnoStatus.ts, extraído acá para reusar en los filtros de búsqueda.
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

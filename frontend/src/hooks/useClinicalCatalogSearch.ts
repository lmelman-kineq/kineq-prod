import { useEffect, useState, type KeyboardEvent } from 'react'
import * as api from '../services/api'
import type { CatalogoClinicoItem, CategoriaCatalogoClinico } from '../types/domain'

/**
 * Autocomplete de catálogo clínico (antecedentes/alergias) compartido entre
 * ClinicalAntecedentesSection y FichaAllergyList: al enfocar un input vacío
 * muestra todos los resultados disponibles del catálogo de la categoría
 * (sin pegarle de nuevo a la API en cada focus — se trae una sola vez por
 * categoría, con scroll interno en el contenedor); al escribir, filtra con
 * el mismo endpoint con debounce.
 */
export function useClinicalCatalogSearch(categoria: CategoriaCatalogoClinico, excludeIds: Set<number>) {
  const [query, setQuery] = useState('')
  const [topItems, setTopItems] = useState<CatalogoClinicoItem[]>([])
  const [results, setResults] = useState<CatalogoClinicoItem[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  useEffect(() => {
    let cancelled = false
    api.getCatalogoClinico(categoria).then((items) => {
      if (!cancelled) setTopItems(items)
    })
    return () => {
      cancelled = true
    }
  }, [categoria])

  useEffect(() => {
    if (!query.trim()) return undefined
    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearching(true)
      api.getCatalogoClinico(categoria, query.trim())
        .then((items) => { if (!cancelled) setResults(items) })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [categoria, query])

  const trimmed = query.trim()
  const options = trimmed
    ? results
    : topItems.filter((item) => !excludeIds.has(item.id))

  function onFocus() {
    setOpen(true)
    setHighlightedIndex(-1)
  }

  function close() {
    setOpen(false)
    setHighlightedIndex(-1)
  }

  function reset() {
    setQuery('')
    close()
  }

  function onKeyDown(event: KeyboardEvent, onSelect: (item: CatalogoClinicoItem) => void) {
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      setHighlightedIndex((current) => Math.min(current + 1, options.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => Math.max(current - 1, 0))
      return
    }
    if (event.key === 'Enter' && highlightedIndex >= 0 && options[highlightedIndex]) {
      event.preventDefault()
      onSelect(options[highlightedIndex])
    }
  }

  return {
    query,
    setQuery,
    open,
    searching,
    options,
    highlightedIndex,
    onFocus,
    onKeyDown,
    close,
    reset,
  }
}

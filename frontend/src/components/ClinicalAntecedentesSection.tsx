import { useEffect, useMemo, useRef, useState, type SVGProps } from 'react'
import * as api from '../services/api'
import type { CatalogoClinicoItem, FichaAntecedente, FichaAntecedenteInput } from '../types/domain'
import { useClinicalCatalogSearch } from '../hooks/useClinicalCatalogSearch'
import DateInput from './DateInput'

type Categoria = 'ANTECEDENTE_PERSONAL' | 'ANTECEDENTE_FAMILIAR' | 'PROCEDIMIENTO_QUIRURGICO'

const CATEGORIAS: { key: Categoria; label: string }[] = [
  { key: 'ANTECEDENTE_PERSONAL', label: 'Personales' },
  { key: 'ANTECEDENTE_FAMILIAR', label: 'Familiares' },
  { key: 'PROCEDIMIENTO_QUIRURGICO', label: 'Quirúrgicos' },
]

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  )
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  )
}

function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 3l9 16H3l9-16Z" />
      <path d="M12 10v4" />
      <path d="M12 17.5v.01" />
    </svg>
  )
}

type Props = {
  antecedentes: FichaAntecedente[]
  onAdd: (data: FichaAntecedenteInput) => Promise<void>
  onUpdate: (id: number, data: Partial<FichaAntecedenteInput>) => Promise<void>
  onRemove: (id: number) => Promise<void>
  /** Navegación desde una alerta clínica: cambia a esta categoría cuando `focusToken` cambia. */
  focusCategoria?: Categoria
  focusToken?: number
}

export default function ClinicalAntecedentesSection({ antecedentes, onAdd, onUpdate, onRemove, focusCategoria, focusToken }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('ANTECEDENTE_PERSONAL')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{ detalle: string; fechaAproximada: string; edadAproximada: string; parentesco: string; esAlertaClinica: boolean }>({
    detalle: '',
    fechaAproximada: '',
    edadAproximada: '',
    parentesco: '',
    esAlertaClinica: false,
  })
  // Menú compacto "⋮" de acciones en mobile (alerta/editar/eliminar juntas en
  // un popover en vez de 3 botones sueltos que rompen la fila con nombres
  // largos) — visible solo ≤820px vía CSS, oculto en desktop/tablet.
  const [mobileActionsMenu, setMobileActionsMenu] = useState<{ antecedenteId: number; x: number; y: number } | null>(null)
  const mobileActionsMenuRef = useRef<HTMLDivElement | null>(null)

  // Todos los relevados de la categoría (SI + NO) — se lo pasamos entero al
  // catálogo completo, que necesita ver los NO para poder mostrarlos como
  // "No" (no solo "Sin relevar") y permitir volver a marcarlos SI.
  const categoriaAntecedentes = useMemo(
    () => antecedentes.filter((a) => a.catalogoItem.categoria === categoria),
    [antecedentes, categoria],
  )
  const takenItemIds = useMemo(() => new Set(categoriaAntecedentes.map((a) => a.catalogoItemId)), [categoriaAntecedentes])
  // Listado visible de la ficha: solo confirmados (SI). Los descartados (NO)
  // siguen existiendo y son editables desde "Ver todos", pero no forman
  // parte del resumen clínico visible al profesional.
  const visibleAntecedentes = useMemo(
    () => categoriaAntecedentes.filter((a) => a.estado === 'SI'),
    [categoriaAntecedentes],
  )

  const search = useClinicalCatalogSearch(categoria, takenItemIds)
  const { query, setQuery, options: results, searching, open: dropdownOpen } = search

  const selectCategoria = (next: Categoria) => {
    setCategoria(next)
    search.reset()
  }

  // Navegación desde una alerta clínica (click en "Antecedente · X" del
  // popup de Alertas clínicas): cambia a la categoría del antecedente de
  // origen. Depende de `focusToken`, no de `focusCategoria`, para que
  // clickear dos veces la misma categoría siga disparando el efecto.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (focusCategoria) setCategoria(focusCategoria)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken])

  useEffect(() => {
    if (!mobileActionsMenu) return undefined
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (mobileActionsMenuRef.current && !mobileActionsMenuRef.current.contains(event.target as Node)) setMobileActionsMenu(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileActionsMenu(null) }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileActionsMenu])

  const quickAdd = async (item: CatalogoClinicoItem) => {
    search.reset()
    await onAdd({ catalogoItemId: item.id, estado: 'SI' })
  }

  const createAndAdd = async () => {
    const nombre = query.trim()
    if (!nombre) return
    setCreating(true)
    setCreateError(null)
    try {
      const item = await api.createCatalogoClinicoItem(categoria, nombre)
      await quickAdd(item)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear el antecedente.')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (antecedente: FichaAntecedente) => {
    setEditingId(antecedente.id)
    setEditForm({
      detalle: antecedente.detalle ?? '',
      fechaAproximada: antecedente.fechaAproximada ? antecedente.fechaAproximada.slice(0, 10) : '',
      edadAproximada: antecedente.edadAproximada != null ? String(antecedente.edadAproximada) : '',
      parentesco: antecedente.parentesco ?? '',
      esAlertaClinica: antecedente.esAlertaClinica,
    })
  }

  const saveEdit = async () => {
    if (editingId === null) return
    await onUpdate(editingId, {
      detalle: editForm.detalle || undefined,
      fechaAproximada: editForm.fechaAproximada || undefined,
      edadAproximada: editForm.edadAproximada ? Number(editForm.edadAproximada) : undefined,
      parentesco: editForm.parentesco || undefined,
      esAlertaClinica: editForm.esAlertaClinica,
    })
    setEditingId(null)
  }

  return (
    <div className="antecedentes-section">
      {/* "Ver todos" desapareció como botón separado — la categoría misma
          (antes solo un toggle) ahora abre el catálogo completo al click,
          un paso menos para llegar a lo mismo. Sigue seleccionando la
          categoría (para el buscador/lista rápida de abajo), solo que
          ahora también abre el mismo drawer que antes abría "Ver todos". */}
      <div className="antecedentes-categorias" role="tablist" aria-label="Tipo de antecedente">
        {CATEGORIAS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={categoria === c.key}
            className={`antecedentes-categoria-button antecedentes-categoria-button--clickable${categoria === c.key ? ' antecedentes-categoria-button--active' : ''}`}
            onClick={() => {
              selectCategoria(c.key)
              setDrawerOpen(true)
            }}
          >
            {c.label}
            <span className="antecedentes-categoria-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      <div className="antecedentes-search">
        <SearchIcon className="antecedentes-search-icon" />
        <input
          type="text"
          placeholder="Buscar antecedente para agregar..."
          value={query}
          onFocus={search.onFocus}
          onBlur={search.close}
          onChange={(event) => { setQuery(event.target.value); search.onFocus() }}
          onKeyDown={(event) => search.onKeyDown(event, (item) => { void quickAdd(item) })}
        />
        {dropdownOpen ? (
          <div className="antecedentes-search-results">
            {searching ? (
              <p className="antecedentes-search-empty">Buscando...</p>
            ) : results.length === 0 && query.trim() ? (
              <button type="button" disabled={creating} onMouseDown={(event) => event.preventDefault()} onClick={() => { void createAndAdd() }}>
                {creating ? 'Creando...' : `+ Agregar "${query.trim()}"`}
              </button>
            ) : results.length === 0 ? (
              <p className="antecedentes-search-empty">No se encontraron resultados</p>
            ) : (
              results.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={index === search.highlightedIndex ? 'antecedentes-search-result--highlighted' : undefined}
                  disabled={takenItemIds.has(item.id)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { void quickAdd(item) }}
                >
                  {item.nombre}
                  {takenItemIds.has(item.id) ? <span> · ya cargado</span> : null}
                </button>
              ))
            )}
          </div>
        ) : null}
        {createError ? <p className="evolution-form-error">{createError}</p> : null}
      </div>

      {visibleAntecedentes.length === 0 ? (
        <p className="patient-detail-note">Sin antecedentes relevantes cargados en esta categoría.</p>
      ) : (
        <div className="antecedentes-list">
          {visibleAntecedentes.map((a) => (
            <div key={a.id} id={`antecedente-row-${a.id}`} className="antecedentes-item">
              {editingId === a.id ? (
                <div className="antecedentes-edit-form">
                  <div className="antecedentes-edit-row">
                    {categoria === 'ANTECEDENTE_FAMILIAR' ? (
                      <input
                        type="text"
                        placeholder="Parentesco (ej. Madre)"
                        value={editForm.parentesco}
                        onChange={(event) => setEditForm((current) => ({ ...current, parentesco: event.target.value }))}
                      />
                    ) : null}
                    <input
                      type="text"
                      placeholder="Detalle"
                      value={editForm.detalle}
                      onChange={(event) => setEditForm((current) => ({ ...current, detalle: event.target.value }))}
                    />
                    {categoria === 'PROCEDIMIENTO_QUIRURGICO' ? (
                      <DateInput
                        value={editForm.fechaAproximada}
                        onChange={(fechaAproximada) => setEditForm((current) => ({ ...current, fechaAproximada }))}
                      />
                    ) : (
                      <input
                        type="number"
                        placeholder="Edad aprox."
                        min={0}
                        value={editForm.edadAproximada}
                        onChange={(event) => setEditForm((current) => ({ ...current, edadAproximada: event.target.value }))}
                      />
                    )}
                  </div>
                  <label className="antecedentes-alerta-checkbox">
                    <input
                      type="checkbox"
                      checked={editForm.esAlertaClinica}
                      onChange={(event) => setEditForm((current) => ({ ...current, esAlertaClinica: event.target.checked }))}
                    />
                    <span>Marcar como alerta clínica</span>
                  </label>
                  <div className="evolution-edit-actions">
                    <button type="button" className="secondary-button" onClick={() => setEditingId(null)}>Cancelar</button>
                    <button type="button" className="primary-button" onClick={() => { void saveEdit() }}>Guardar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="antecedentes-item-info">
                    <strong>
                      {a.catalogoItem.nombre}
                      {a.esAlertaClinica ? <span className="clinical-alert-flag" title="Alerta clínica"> ⚠</span> : null}
                    </strong>
                    <span>
                      {a.estado === 'SI' ? 'Confirmado' : 'Descartado'}
                      {a.parentesco ? ` · ${a.parentesco}` : ''}
                      {a.detalle ? ` · ${a.detalle}` : ''}
                      {a.edadAproximada != null ? ` · ${a.edadAproximada} años` : ''}
                      {a.fechaAproximada ? ` · ${a.fechaAproximada.slice(0, 10)}` : ''}
                    </span>
                  </div>
                  <div className="config-row-actions antecedentes-item-actions--desktop">
                    <button
                      type="button"
                      className={`config-icon-button${a.esAlertaClinica ? ' config-icon-button--alerta-activa' : ''}`}
                      aria-label={a.esAlertaClinica ? 'Quitar de alertas clínicas' : 'Marcar como alerta clínica'}
                      title={a.esAlertaClinica ? 'Quitar de alertas clínicas' : 'Marcar como alerta clínica'}
                      onClick={() => { void onUpdate(a.id, { esAlertaClinica: !a.esAlertaClinica }) }}
                    >
                      <AlertIcon />
                    </button>
                    <button type="button" className="config-icon-button" aria-label="Editar antecedente" title="Editar" onClick={() => startEdit(a)}>
                      <EditIcon />
                    </button>
                    <button type="button" className="config-icon-button config-icon-button--danger" aria-label="Quitar antecedente" title="Quitar" onClick={() => { void onRemove(a.id) }}>
                      <TrashIcon />
                    </button>
                  </div>
                  <div className="antecedentes-item-actions--mobile">
                    <button
                      type="button"
                      className="config-icon-button"
                      aria-label="Más acciones"
                      aria-haspopup="true"
                      aria-expanded={mobileActionsMenu?.antecedenteId === a.id}
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        const menuWidth = 190
                        setMobileActionsMenu((current) =>
                          current?.antecedenteId === a.id
                            ? null
                            : { antecedenteId: a.id, x: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)), y: rect.bottom + 6 },
                        )
                      }}
                    >
                      <MoreIcon />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {mobileActionsMenu ? (() => {
        const target = visibleAntecedentes.find((a) => a.id === mobileActionsMenu.antecedenteId)
        if (!target) return null
        return (
          <div className="context-menu" ref={mobileActionsMenuRef} style={{ top: mobileActionsMenu.y, left: mobileActionsMenu.x }}>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => { void onUpdate(target.id, { esAlertaClinica: !target.esAlertaClinica }); setMobileActionsMenu(null) }}
            >
              {target.esAlertaClinica ? 'Quitar de alertas clínicas' : 'Marcar como alerta clínica'}
            </button>
            <button type="button" className="context-menu-item" onClick={() => { startEdit(target); setMobileActionsMenu(null) }}>
              Editar
            </button>
            <button
              type="button"
              className="context-menu-item context-menu-item--danger"
              onClick={() => { void onRemove(target.id); setMobileActionsMenu(null) }}
            >
              Quitar antecedente
            </button>
          </div>
        )
      })() : null}

      {drawerOpen ? (
        <CatalogoCompletoDrawer
          categoria={categoria}
          categoriaLabel={CATEGORIAS.find((c) => c.key === categoria)?.label ?? ''}
          antecedentes={categoriaAntecedentes}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}
    </div>
  )
}

type DrawerFilter = 'todos' | 'relevados' | 'positivos'

function CatalogoCompletoDrawer({
  categoria,
  categoriaLabel,
  antecedentes,
  onAdd,
  onUpdate,
  onRemove,
  onClose,
}: {
  categoria: Categoria
  categoriaLabel: string
  antecedentes: FichaAntecedente[]
  onAdd: (data: FichaAntecedenteInput) => Promise<void>
  onUpdate: (id: number, data: Partial<FichaAntecedenteInput>) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onClose: () => void
}) {
  const [items, setItems] = useState<CatalogoClinicoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DrawerFilter>('todos')
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [itemError, setItemError] = useState<string | null>(null)

  const reload = () => api.getCatalogoClinico(categoria).then(setItems)

  useEffect(() => {
    let cancelled = false
    api.getCatalogoClinico(categoria).then((result) => { if (!cancelled) setItems(result) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [categoria])

  const startRename = (item: CatalogoClinicoItem) => {
    setEditingItemId(item.id)
    setEditingName(item.nombre)
    setItemError(null)
  }

  const saveRename = async () => {
    if (editingItemId === null || !editingName.trim()) return
    try {
      await api.updateCatalogoClinicoItem(editingItemId, editingName.trim())
      setEditingItemId(null)
      await reload()
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'No se pudo renombrar el ítem.')
    }
  }

  const removeItem = async (item: CatalogoClinicoItem) => {
    try {
      await api.deleteCatalogoClinicoItem(item.id)
      await reload()
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'No se pudo quitar el ítem.')
    }
  }

  const byItemId = useMemo(() => new Map(antecedentes.map((a) => [a.catalogoItemId, a])), [antecedentes])

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      if (term && !item.nombre.toLowerCase().includes(term)) return false
      const registro = byItemId.get(item.id)
      if (filter === 'relevados') return Boolean(registro)
      if (filter === 'positivos') return registro?.estado === 'SI'
      return true
    })
  }, [items, search, filter, byItemId])

  const setEstado = async (item: CatalogoClinicoItem, estado: 'SI' | 'NO' | null) => {
    const registro = byItemId.get(item.id)
    if (estado === null) {
      if (registro) await onRemove(registro.id)
      return
    }
    if (registro) await onUpdate(registro.id, { estado })
    else await onAdd({ catalogoItemId: item.id, estado })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card catalogo-drawer">
        <div className="modal-header">
          <div className="modal-header-title">
            <div>
              <h3>Catálogo completo · {categoriaLabel}</h3>
              <p>Marcá Sí/No para dejar constancia explícita, o Sin relevar para quitarlo.</p>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={onClose}>&times;</button>
        </div>

        <div className="catalogo-drawer-filters">
          <input
            type="text"
            placeholder="Buscar en el catálogo..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="catalogo-drawer-filter-tabs">
            {(['todos', 'relevados', 'positivos'] as DrawerFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`catalogo-drawer-filter-tab${filter === f ? ' catalogo-drawer-filter-tab--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'todos' ? 'Todos' : f === 'relevados' ? 'Relevados' : 'Positivos'}
              </button>
            ))}
          </div>
        </div>

        {itemError ? <p className="evolution-form-error">{itemError}</p> : null}

        <div className="catalogo-drawer-list">
          {loading ? (
            <p>Cargando catálogo...</p>
          ) : visibleItems.length === 0 ? (
            <p className="patient-detail-note">Sin resultados.</p>
          ) : (
            visibleItems.map((item) => {
              const registro = byItemId.get(item.id)
              const estado = registro?.estado ?? null
              return (
                <div key={item.id} className="catalogo-drawer-row">
                  {editingItemId === item.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') void saveRename() }}
                    />
                  ) : (
                    <span>{item.nombre}</span>
                  )}
                  <div className="catalogo-drawer-row-actions">
                    {!item.esSistema ? (
                      editingItemId === item.id ? (
                        <>
                          <button type="button" className="config-icon-button" aria-label="Guardar" title="Guardar" onClick={() => { void saveRename() }}>
                            <CheckIcon />
                          </button>
                          <button type="button" className="config-icon-button" aria-label="Cancelar" title="Cancelar" onClick={() => setEditingItemId(null)}>
                            &times;
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="config-icon-button" aria-label="Renombrar ítem" title="Renombrar" onClick={() => startRename(item)}>
                            <EditIcon />
                          </button>
                          <button type="button" className="config-icon-button config-icon-button--danger" aria-label="Quitar ítem" title="Quitar del catálogo" onClick={() => { void removeItem(item) }}>
                            <TrashIcon />
                          </button>
                        </>
                      )
                    ) : null}
                    <div className="catalogo-drawer-toggle">
                      <button type="button" className={estado === 'SI' ? 'active' : ''} onClick={() => { void setEstado(item, 'SI') }}>Sí</button>
                      <button type="button" className={estado === 'NO' ? 'active' : ''} onClick={() => { void setEstado(item, 'NO') }}>No</button>
                      <button type="button" className={estado === null ? 'active' : ''} onClick={() => { void setEstado(item, null) }}>Sin relevar</button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

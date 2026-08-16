import { useMemo, useState, type SVGProps } from 'react'
import * as api from '../services/api'
import type { CatalogoClinicoItem, FichaAlergia, FichaAlergiaInput, GravedadAlergia } from '../types/domain'
import { useClinicalCatalogSearch } from '../hooks/useClinicalCatalogSearch'

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

const GRAVEDAD_LABELS: Record<GravedadAlergia, string> = { LEVE: 'Leve', MODERADA: 'Moderada', GRAVE: 'Grave' }

type Props = {
  alergias: FichaAlergia[]
  onAdd: (data: FichaAlergiaInput) => Promise<void>
  onUpdate: (id: number, data: Partial<FichaAlergiaInput>) => Promise<void>
  onRemove: (id: number) => Promise<void>
}

export default function FichaAllergyList({ alergias, onAdd, onUpdate, onRemove }: Props) {
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ reaccion: '', gravedad: '' as GravedadAlergia | '', observaciones: '' })

  const takenItemIds = useMemo(() => new Set(alergias.map((a) => a.catalogoItemId).filter((id): id is number => id != null)), [alergias])

  const search = useClinicalCatalogSearch('ALERGIA', takenItemIds)
  const { query, setQuery, options: results, open: dropdownOpen } = search

  const addKnown = async (item: CatalogoClinicoItem) => {
    search.reset()
    await onAdd({ catalogoItemId: item.id })
  }

  const addNew = async () => {
    const nombre = query.trim()
    if (!nombre) return
    setCreating(true)
    setCreateError(null)
    try {
      const item = await api.createCatalogoClinicoItem('ALERGIA', nombre)
      search.reset()
      await onAdd({ catalogoItemId: item.id })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear la alergia.')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (alergia: FichaAlergia) => {
    setEditingId(alergia.id)
    setForm({ reaccion: alergia.reaccion ?? '', gravedad: alergia.gravedad ?? '', observaciones: alergia.observaciones ?? '' })
  }

  const saveEdit = async () => {
    if (editingId === null) return
    await onUpdate(editingId, {
      reaccion: form.reaccion || undefined,
      gravedad: form.gravedad || undefined,
      observaciones: form.observaciones || undefined,
    })
    setEditingId(null)
  }

  return (
    <div className="antecedentes-section">
      <div className="antecedentes-search">
        <input
          type="text"
          placeholder="Buscar alergia conocida o escribir una nueva..."
          value={query}
          onFocus={search.onFocus}
          onBlur={search.close}
          onChange={(event) => { setQuery(event.target.value); search.onFocus() }}
          onKeyDown={(event) => search.onKeyDown(event, (item) => { void addKnown(item) })}
        />
        {dropdownOpen ? (
          <div className="antecedentes-search-results">
            {results.length === 0 && !query.trim() ? (
              <p className="antecedentes-search-empty">No se encontraron resultados</p>
            ) : (
              results.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={index === search.highlightedIndex ? 'antecedentes-search-result--highlighted' : undefined}
                  disabled={takenItemIds.has(item.id)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { void addKnown(item) }}
                >
                  {item.nombre}{takenItemIds.has(item.id) ? <span> · ya cargada</span> : null}
                </button>
              ))
            )}
            {query.trim() ? (
              <button
                type="button"
                className="antecedentes-search-free"
                disabled={creating}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { void addNew() }}
              >
                {creating ? 'Creando...' : `+ Agregar alergia "${query.trim()}"`}
              </button>
            ) : null}
          </div>
        ) : null}
        {createError ? <p className="evolution-form-error">{createError}</p> : null}
      </div>

      {alergias.length === 0 ? (
        <p className="patient-detail-note">Sin alergias registradas.</p>
      ) : (
        <div className="antecedentes-list">
          {alergias.map((alergia) => (
            <div key={alergia.id} id={`alergia-row-${alergia.id}`} className="antecedentes-item">
              {editingId === alergia.id ? (
                <div className="antecedentes-edit-form">
                  <div className="antecedentes-edit-row">
                    <input
                      type="text"
                      placeholder="Reacción"
                      value={form.reaccion}
                      onChange={(event) => setForm((current) => ({ ...current, reaccion: event.target.value }))}
                    />
                    <select
                      value={form.gravedad}
                      onChange={(event) => setForm((current) => ({ ...current, gravedad: event.target.value as GravedadAlergia }))}
                    >
                      <option value="">Gravedad sin especificar</option>
                      <option value="LEVE">Leve</option>
                      <option value="MODERADA">Moderada</option>
                      <option value="GRAVE">Grave</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Observaciones"
                      value={form.observaciones}
                      onChange={(event) => setForm((current) => ({ ...current, observaciones: event.target.value }))}
                    />
                  </div>
                  <div className="evolution-edit-actions">
                    <button type="button" className="secondary-button" onClick={() => setEditingId(null)}>Cancelar</button>
                    <button type="button" className="primary-button" onClick={() => { void saveEdit() }}>Guardar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="antecedentes-item-info">
                    <strong>{alergia.catalogoItem?.nombre ?? alergia.nombreLibre}</strong>
                    <span>
                      {alergia.reaccion ? alergia.reaccion : 'Sin reacción registrada'}
                      {alergia.gravedad ? ` · ${GRAVEDAD_LABELS[alergia.gravedad]}` : ''}
                      {alergia.observaciones ? ` · ${alergia.observaciones}` : ''}
                    </span>
                  </div>
                  <div className="config-row-actions">
                    <button type="button" className="config-icon-button" aria-label="Editar alergia" title="Editar" onClick={() => startEdit(alergia)}>
                      <EditIcon />
                    </button>
                    <button type="button" className="config-icon-button config-icon-button--danger" aria-label="Quitar alergia" title="Quitar" onClick={() => { void onRemove(alergia.id) }}>
                      <TrashIcon />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

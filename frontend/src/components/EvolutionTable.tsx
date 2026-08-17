import { Fragment, useState, type SVGProps } from 'react'
import type { Evolucion, GrupoEvolucion } from '../types/domain'
import { formatDateTime } from '../utils/dateFormat'
import { professionalName } from '../utils/professional'
import RichTextEditor from './RichTextEditor'
import EvolucionContent from './EvolucionContent'
import EvolucionImages from './EvolucionImages'
import DiagnosticoSelect from './DiagnosticoSelect'

export function GrupoChip({ grupo }: { grupo: GrupoEvolucion | null | undefined }) {
  if (!grupo) return <span className="grupo-evolucion-chip grupo-evolucion-chip--none">Sin diagnóstico</span>
  return (
    <span className="grupo-evolucion-chip">
      <span className="grupo-evolucion-dot" style={{ backgroundColor: grupo.color }} aria-hidden="true" />
      {grupo.nombre}
    </span>
  )
}

export function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  )
}

type EvolutionTableProps = {
  evoluciones: Evolucion[]
  canEdit: (evolucion: Evolucion) => boolean
  editingId: number | null
  editingText: string
  editingHtml?: string
  onStartEdit: (evolucion: Evolucion) => void
  onCancelEdit: () => void
  onChangeEditingText: (text: string) => void
  onChangeEditingHtml?: (html: string, plainText: string) => void
  onSaveEdit: () => void
  onDelete: (evolucion: Evolucion) => void
  saving: boolean
  error: string | null
  emptyTitle?: string
  emptyHint?: string
  grupos?: GrupoEvolucion[]
  editingGrupoId?: number | null
  onChangeEditingGrupoId?: (id: number | null) => void
  onCreateGrupo?: (nombre: string) => Promise<GrupoEvolucion>
  onAddImages?: (evolucion: Evolucion, files: File[]) => void
  onRemoveImage?: (evolucion: Evolucion, imagenId: number) => void
  imagesUploading?: boolean
  imagesError?: string | null
}

export default function EvolutionTable({
  evoluciones,
  canEdit,
  editingId,
  editingText,
  editingHtml = '',
  onStartEdit,
  onCancelEdit,
  onChangeEditingText,
  onChangeEditingHtml,
  onSaveEdit,
  onDelete,
  saving,
  error,
  emptyTitle = 'Sin evoluciones registradas.',
  emptyHint = 'Las notas clínicas del paciente van a aparecer acá.',
  grupos = [],
  editingGrupoId = null,
  onChangeEditingGrupoId,
  onCreateGrupo,
  onAddImages,
  onRemoveImage,
  imagesUploading,
  imagesError,
}: EvolutionTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (evoluciones.length === 0) {
    return (
      <div className="turnos-table-message">
        <strong>{emptyTitle}</strong>
        <span>{emptyHint}</span>
      </div>
    )
  }

  const toggleExpand = (id: number) => {
    setExpandedId((current) => (current === id ? null : id))
    if (editingId !== null && editingId !== id) onCancelEdit()
  }

  const startEdit = (evolucion: Evolucion) => {
    setExpandedId(evolucion.id)
    onStartEdit(evolucion)
  }

  return (
    <div className="turnos-table-scroll">
      <table className="turnos-table evolution-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Profesional</th>
            <th>Diagnóstico</th>
            <th>Resumen</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {evoluciones.map((evolucion) => {
            const isExpanded = expandedId === evolucion.id
            const isEditing = editingId === evolucion.id
            const wasEdited = new Date(evolucion.updatedAt).getTime() !== new Date(evolucion.createdAt).getTime()

            return (
              <Fragment key={evolucion.id}>
                <tr
                  className="evolution-row"
                  tabIndex={0}
                  onClick={() => toggleExpand(evolucion.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleExpand(evolucion.id)
                    }
                  }}
                >
                  <td>
                    {formatDateTime(evolucion.createdAt)}
                    {wasEdited ? <span className="evolution-edited-tag"> · editada</span> : null}
                  </td>
                  <td data-label="Profesional">{professionalName(evolucion.profesional)}</td>
                  <td data-label="Diagnóstico"><GrupoChip grupo={evolucion.grupo} /></td>
                  <td className="evolution-resumen-cell" data-label="Resumen"><span>{evolucion.contenido}</span></td>
                  <td className="turnos-actions-cell config-row-actions">
                    {canEdit(evolucion) ? (
                      <button
                        type="button"
                        className="config-icon-button"
                        aria-label="Editar evolución"
                        title="Editar evolución"
                        onClick={(event) => {
                          event.stopPropagation()
                          startEdit(evolucion)
                        }}
                      >
                        <EditIcon />
                      </button>
                    ) : null}
                    {canEdit(evolucion) ? (
                      <button
                        type="button"
                        className="config-icon-button config-icon-button--danger"
                        aria-label="Eliminar evolución"
                        title="Eliminar evolución"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDelete(evolucion)
                        }}
                      >
                        <TrashIcon />
                      </button>
                    ) : null}
                  </td>
                </tr>

                {isExpanded ? (
                  <tr className="evolution-expanded-row">
                    <td colSpan={5}>
                      <div className="evolution-expanded-content">
                        {isEditing ? (
                          <div className="evolution-edit-form">
                            {onChangeEditingHtml ? (
                              <RichTextEditor
                                html={editingHtml}
                                onChange={(html, plainText) => {
                                  onChangeEditingHtml(html, plainText)
                                  onChangeEditingText(plainText)
                                }}
                              />
                            ) : (
                              <textarea rows={4} value={editingText} onChange={(event) => onChangeEditingText(event.target.value)} />
                            )}
                            <div className="evolution-form-fields-row">
                              {onChangeEditingGrupoId && onCreateGrupo ? (
                                <DiagnosticoSelect
                                  grupos={grupos}
                                  value={editingGrupoId ?? ''}
                                  onChange={(id) => onChangeEditingGrupoId(id === '' ? null : id)}
                                  onCreate={onCreateGrupo}
                                />
                              ) : null}
                              <EvolucionImages
                                items={(evolucion.imagenes ?? []).map((img) => ({ key: String(img.id), url: img.url, name: img.nombreOriginal }))}
                                onAdd={onAddImages ? (files) => onAddImages(evolucion, files) : undefined}
                                onRemove={onRemoveImage ? (key) => onRemoveImage(evolucion, Number(key)) : undefined}
                                disabled={imagesUploading}
                                error={imagesError}
                              />
                            </div>
                            {error ? <p className="evolution-form-error">{error}</p> : null}
                            <div className="evolution-edit-actions">
                              <button type="button" className="secondary-button" onClick={onCancelEdit}>
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="primary-button"
                                disabled={!editingText.trim() || saving}
                                onClick={onSaveEdit}
                              >
                                {saving ? 'Guardando...' : 'Guardar cambios'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <EvolucionContent evolucion={evolucion} />
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

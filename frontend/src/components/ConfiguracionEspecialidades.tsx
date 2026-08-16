import { useEffect, useMemo, useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { Especialidad } from '../types/domain'
import ConfigSectionHeader from './ConfigSectionHeader'
import ConfigRowActions from './ConfigRowActions'
import EspecialidadFormModal from './EspecialidadFormModal'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

type ConfiguracionEspecialidadesProps = {
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

export default function ConfiguracionEspecialidades({ onRequestConfirm }: ConfiguracionEspecialidadesProps) {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [mostrarOcultas, setMostrarOcultas] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Especialidad | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadEspecialidades() {
      setLoading(true)
      setError(null)
      try {
        const result = await api.getEspecialidades(true, mostrarOcultas)
        if (!cancelled) setEspecialidades(result)
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, 'No se pudieron cargar las especialidades.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadEspecialidades()
    return () => {
      cancelled = true
    }
  }, [refreshKey, mostrarOcultas])

  const visibleEspecialidades = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return especialidades
    return especialidades.filter((especialidad) => especialidad.nombre.toLowerCase().includes(term))
  }, [especialidades, search])

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEdit = (especialidad: Especialidad) => {
    if (especialidad.esSistema) return
    setEditing(especialidad)
    setFormOpen(true)
  }

  const tieneHistorial = (especialidad: Especialidad) =>
    !!especialidad._count && (especialidad._count.profesionales > 0 || especialidad._count.turnos > 0)

  const ocultarEspecialidad = (especialidad: Especialidad) => {
    onRequestConfirm({
      title: 'Ocultar especialidad predeterminada',
      description: 'Esta especialidad dejará de estar disponible en tu consultorio, pero seguirá existiendo en Kineq.',
      confirmLabel: 'Ocultar',
      cancelLabel: 'Cancelar',
      destructive: false,
      onConfirm: () => {
        void (async () => {
          try {
            await api.ocultarEspecialidad(especialidad.id)
            setRefreshKey((key) => key + 1)
          } catch (hideError) {
            setError(getErrorMessage(hideError, 'No se pudo ocultar la especialidad.'))
          }
        })()
      },
    })
  }

  const restaurarEspecialidad = async (especialidad: Especialidad) => {
    try {
      await api.restaurarEspecialidad(especialidad.id)
      setRefreshKey((key) => key + 1)
    } catch (restoreError) {
      setError(getErrorMessage(restoreError, 'No se pudo restaurar la especialidad.'))
    }
  }

  const eliminarEspecialidad = (especialidad: Especialidad) => {
    if (especialidad.esSistema) {
      ocultarEspecialidad(especialidad)
      return
    }

    const bloqueado = tieneHistorial(especialidad)

    if (bloqueado) {
      onRequestConfirm({
        title: 'No se puede eliminar',
        description: especialidad.activo
          ? 'Esta especialidad está asociada a profesionales o turnos. No puede eliminarse definitivamente porque forma parte del historial. Podés desactivarla para que deje de aparecer como opción para nuevos turnos.'
          : 'Esta especialidad está asociada a profesionales o turnos. No puede eliminarse definitivamente porque forma parte del historial. Ya está desactivada.',
        confirmLabel: especialidad.activo ? 'Desactivar' : 'Entendido',
        cancelLabel: 'Cerrar',
        destructive: false,
        onConfirm: !especialidad.activo
          ? () => {}
          : () => {
              void (async () => {
                try {
                  await api.patchEspecialidad(especialidad.id, { activo: false })
                  setRefreshKey((key) => key + 1)
                } catch (toggleError) {
                  setError(getErrorMessage(toggleError, 'No se pudo desactivar la especialidad.'))
                }
              })()
            },
      })
      return
    }

    onRequestConfirm({
      title: 'Eliminar especialidad',
      description: `Se va a eliminar "${especialidad.nombre}" de forma permanente. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await api.deleteEspecialidad(especialidad.id)
            setRefreshKey((key) => key + 1)
          } catch (deleteError) {
            setError(getErrorMessage(deleteError, 'No se pudo eliminar la especialidad.'))
          }
        })()
      },
    })
  }

  return (
    <div>
      <ConfigSectionHeader
        title="Especialidades"
        description="Tipos de atención que ofrece el consultorio."
        action={<button type="button" className="new-turn-button" onClick={openCreate}>+ Nueva especialidad</button>}
      />

      <div className="config-filters-row">
        <input
          type="text"
          className="patients-search-input"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="checkbox-field config-filters-checkbox">
          <input type="checkbox" checked={mostrarOcultas} onChange={(event) => setMostrarOcultas(event.target.checked)} />
          Mostrar ocultas
        </label>
      </div>

      {error ? <p className="evolution-form-error">{error}</p> : null}

      {loading ? (
        <p>Cargando especialidades...</p>
      ) : visibleEspecialidades.length === 0 ? (
        <div className="turnos-table-message">
          <strong>No hay especialidades para mostrar.</strong>
          <span>Creá la primera para poder asignarla a turnos y profesionales.</span>
        </div>
      ) : (
        <div className="turnos-table-scroll">
          <table className="turnos-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Profesionales asociados</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visibleEspecialidades.map((especialidad) => (
                <tr
                  key={especialidad.id}
                  tabIndex={especialidad.esSistema ? -1 : 0}
                  onClick={() => openEdit(especialidad)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openEdit(especialidad)
                    }
                  }}
                >
                  <td>
                    <span className="turnos-specialty-cell">
                      <span className="turnos-specialty-dot" style={{ backgroundColor: especialidad.color }} />
                      <strong>{especialidad.nombre}</strong>
                      {especialidad.esSistema ? <span className="config-badge-global">Predeterminada</span> : null}
                    </span>
                  </td>
                  <td data-label="Profesionales asociados">{especialidad._count?.profesionales ?? 0}</td>
                  <td data-label="Estado">
                    {especialidad.oculta ? (
                      <span className="turnos-status-pill turnos-status-pill--cancelado">Oculta</span>
                    ) : (
                      <span className={`turnos-status-pill ${especialidad.activo ? 'turnos-status-pill--finalizado' : 'turnos-status-pill--cancelado'}`}>
                        {especialidad.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    )}
                  </td>
                  <td className="turnos-actions-cell config-row-actions" onClick={(event) => event.stopPropagation()}>
                    {especialidad.oculta ? (
                      <button type="button" className="secondary-button" onClick={() => { void restaurarEspecialidad(especialidad) }}>
                        Restaurar
                      </button>
                    ) : (
                      <ConfigRowActions
                        variant="delete"
                        onEdit={() => openEdit(especialidad)}
                        onDelete={() => eliminarEspecialidad(especialidad)}
                        editDisabled={especialidad.esSistema}
                        editLabel={especialidad.esSistema ? 'Predeterminada, no editable' : 'Editar'}
                        deleteLabel={especialidad.esSistema ? 'Ocultar' : 'Eliminar'}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <EspecialidadFormModal
          especialidad={editing}
          onRequestConfirm={onRequestConfirm}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            setRefreshKey((key) => key + 1)
          }}
        />
      ) : null}
    </div>
  )
}

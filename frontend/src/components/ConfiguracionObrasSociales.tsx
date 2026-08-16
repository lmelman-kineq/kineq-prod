import { useEffect, useMemo, useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { ObraSocial } from '../types/domain'
import ConfigSectionHeader from './ConfigSectionHeader'
import ConfigRowActions from './ConfigRowActions'
import ObraSocialFormModal from './ObraSocialFormModal'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

type ConfiguracionObrasSocialesProps = {
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

export default function ConfiguracionObrasSociales({ onRequestConfirm }: ConfiguracionObrasSocialesProps) {
  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [mostrarOcultas, setMostrarOcultas] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ObraSocial | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadObrasSociales() {
      setLoading(true)
      setError(null)
      try {
        const result = await api.getObrasSociales(true, mostrarOcultas)
        if (!cancelled) setObrasSociales(result)
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, 'No se pudieron cargar las obras sociales.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadObrasSociales()
    return () => {
      cancelled = true
    }
  }, [refreshKey, mostrarOcultas])

  const visibleObrasSociales = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return obrasSociales
    return obrasSociales.filter((obraSocial) => obraSocial.nombre.toLowerCase().includes(term))
  }, [obrasSociales, search])

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEdit = (obraSocial: ObraSocial) => {
    if (obraSocial.esSistema) return
    setEditing(obraSocial)
    setFormOpen(true)
  }

  const tieneHistorial = (obraSocial: ObraSocial) =>
    !!obraSocial._count && (obraSocial._count.pacientes > 0 || obraSocial._count.turnos > 0)

  const ocultarObraSocial = (obraSocial: ObraSocial) => {
    onRequestConfirm({
      title: 'Ocultar obra social predeterminada',
      description: 'Esta obra social dejará de estar disponible en tu consultorio, pero seguirá existiendo en Kineq.',
      confirmLabel: 'Ocultar',
      cancelLabel: 'Cancelar',
      destructive: false,
      onConfirm: () => {
        void (async () => {
          try {
            await api.ocultarObraSocial(obraSocial.id)
            setRefreshKey((key) => key + 1)
          } catch (hideError) {
            setError(getErrorMessage(hideError, 'No se pudo ocultar la obra social.'))
          }
        })()
      },
    })
  }

  const restaurarObraSocial = async (obraSocial: ObraSocial) => {
    try {
      await api.restaurarObraSocial(obraSocial.id)
      setRefreshKey((key) => key + 1)
    } catch (restoreError) {
      setError(getErrorMessage(restoreError, 'No se pudo restaurar la obra social.'))
    }
  }

  const eliminarObraSocial = (obraSocial: ObraSocial) => {
    if (obraSocial.esSistema) {
      ocultarObraSocial(obraSocial)
      return
    }

    const bloqueado = tieneHistorial(obraSocial)

    if (bloqueado) {
      onRequestConfirm({
        title: 'No se puede eliminar',
        description: obraSocial.activo
          ? 'Esta obra social está asociada a pacientes. No puede eliminarse definitivamente porque forma parte de información histórica. Podés desactivarla para que deje de aparecer como opción para nuevos pacientes.'
          : 'Esta obra social está asociada a pacientes. No puede eliminarse definitivamente porque forma parte de información histórica. Ya está desactivada.',
        confirmLabel: obraSocial.activo ? 'Desactivar' : 'Entendido',
        cancelLabel: 'Cerrar',
        destructive: false,
        onConfirm: !obraSocial.activo
          ? () => {}
          : () => {
              void (async () => {
                try {
                  await api.patchObraSocial(obraSocial.id, { activo: false })
                  setRefreshKey((key) => key + 1)
                } catch (toggleError) {
                  setError(getErrorMessage(toggleError, 'No se pudo desactivar la obra social.'))
                }
              })()
            },
      })
      return
    }

    onRequestConfirm({
      title: 'Eliminar obra social',
      description: `Se va a eliminar "${obraSocial.nombre}" de forma permanente. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await api.deleteObraSocial(obraSocial.id)
            setRefreshKey((key) => key + 1)
          } catch (deleteError) {
            setError(getErrorMessage(deleteError, 'No se pudo eliminar la obra social.'))
          }
        })()
      },
    })
  }

  return (
    <div>
      <ConfigSectionHeader
        title="Obras sociales"
        description="Coberturas administradas por el consultorio."
        action={<button type="button" className="new-turn-button" onClick={openCreate}>+ Nueva obra social</button>}
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
        <p>Cargando obras sociales...</p>
      ) : visibleObrasSociales.length === 0 ? (
        <div className="turnos-table-message">
          <strong>No hay obras sociales para mostrar.</strong>
          <span>Creá la primera para poder asociarla a pacientes.</span>
        </div>
      ) : (
        <div className="turnos-table-scroll">
          <table className="turnos-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Pacientes asociados</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visibleObrasSociales.map((obraSocial) => (
                <tr
                  key={obraSocial.id}
                  tabIndex={obraSocial.esSistema ? -1 : 0}
                  onClick={() => openEdit(obraSocial)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openEdit(obraSocial)
                    }
                  }}
                >
                  <td>
                    <strong>{obraSocial.nombre}</strong>
                    {obraSocial.esSistema ? <span className="config-badge-global">Predeterminada</span> : null}
                  </td>
                  <td data-label="Pacientes asociados">{obraSocial._count?.pacientes ?? 0}</td>
                  <td data-label="Estado">
                    {obraSocial.oculta ? (
                      <span className="turnos-status-pill turnos-status-pill--cancelado">Oculta</span>
                    ) : (
                      <span className={`turnos-status-pill ${obraSocial.activo ? 'turnos-status-pill--finalizado' : 'turnos-status-pill--cancelado'}`}>
                        {obraSocial.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    )}
                  </td>
                  <td className="turnos-actions-cell config-row-actions" onClick={(event) => event.stopPropagation()}>
                    {obraSocial.oculta ? (
                      <button type="button" className="secondary-button" onClick={() => { void restaurarObraSocial(obraSocial) }}>
                        Restaurar
                      </button>
                    ) : (
                      <ConfigRowActions
                        variant="delete"
                        onEdit={() => openEdit(obraSocial)}
                        onDelete={() => eliminarObraSocial(obraSocial)}
                        editDisabled={obraSocial.esSistema}
                        editLabel={obraSocial.esSistema ? 'Predeterminada, no editable' : 'Editar'}
                        deleteLabel={obraSocial.esSistema ? 'Ocultar' : 'Eliminar'}
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
        <ObraSocialFormModal
          obraSocial={editing}
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

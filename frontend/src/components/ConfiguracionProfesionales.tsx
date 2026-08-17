import { useEffect, useMemo, useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { Especialidad, Profesional, Usuario } from '../types/domain'
import ConfigSectionHeader from './ConfigSectionHeader'
import ConfigRowActions from './ConfigRowActions'
import ProfesionalFormModal from './ProfesionalFormModal'
import { useAuth } from '../auth/AuthContext'
import { professionalFullName } from '../utils/professional'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

type ConfiguracionProfesionalesProps = {
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
  // Sin esto, un profesional recién creado/editado/eliminado acá no se
  // reflejaba en el selector de Profesional de Turnos (App.tsx) hasta un
  // reload completo de la página.
  onProfesionalesChanged?: () => void
}

export default function ConfiguracionProfesionales({ onRequestConfirm, onProfesionalesChanged }: ConfiguracionProfesionalesProps) {
  const { refreshUser } = useAuth()
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingProfesional, setEditingProfesional] = useState<Profesional | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadProfesionales() {
      setLoading(true)
      setError(null)
      try {
        const [profesionalesResult, especialidadesResult, usuariosResult] = await Promise.all([
          api.getProfesionales(true),
          api.getEspecialidades(),
          api.getUsuarios(),
        ])
        if (cancelled) return
        setProfesionales(profesionalesResult)
        setEspecialidades(especialidadesResult)
        setUsuarios(usuariosResult)
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, 'No se pudieron cargar los profesionales.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadProfesionales()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const usuariosDisponibles = useMemo(
    () => usuarios.filter((u) => u.activo !== false && (!u.profesionalId || u.profesionalId === editingProfesional?.id)),
    [usuarios, editingProfesional],
  )

  const visibleProfesionales = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return profesionales
    return profesionales.filter((profesional) => professionalFullName(profesional).toLowerCase().includes(term))
  }, [profesionales, search])

  const openCreate = () => {
    setEditingProfesional(undefined)
    setFormOpen(true)
  }

  const openEdit = (profesional: Profesional) => {
    setEditingProfesional(profesional)
    setFormOpen(true)
  }

  const tieneHistorial = (profesional: Profesional) =>
    !!profesional._count && (profesional._count.turnos > 0 || profesional._count.evoluciones > 0)

  const eliminarProfesional = (profesional: Profesional) => {
    const bloqueado = tieneHistorial(profesional)

    // Con historial no se puede borrar físicamente (el historial clínico se
    // conserva siempre): se archiva en su lugar — deja de aparecer en
    // Configuración y en cualquier select operativo, sin tocar turnos ni
    // evoluciones. Distinto de "Inactivo" (editable desde el formulario,
    // sigue apareciendo en la tabla) — Eliminado lo saca por completo.
    if (bloqueado) {
      onRequestConfirm({
        title: 'Eliminar profesional',
        description: 'Este profesional tiene turnos o registros clínicos asociados. No puede eliminarse definitivamente. Se conservará su historial, pero dejará de aparecer en Configuración y en nuevas asignaciones.',
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        destructive: true,
        onConfirm: () => {
          void (async () => {
            try {
              await api.archivarProfesional(profesional.id)
              setRefreshKey((key) => key + 1)
            } catch (archiveError) {
              setError(getErrorMessage(archiveError, 'No se pudo eliminar el profesional.'))
            }
          })()
        },
      })
      return
    }

    onRequestConfirm({
      title: 'Eliminar profesional',
      description: `Se va a eliminar a ${professionalFullName(profesional)} de forma permanente. Esta acción no se puede deshacer.${
        profesional.usuario ? ' Su usuario vinculado no se elimina, solo se desvincula.' : ''
      }`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await api.deleteProfesional(profesional.id)
            setRefreshKey((key) => key + 1)
            onProfesionalesChanged?.()
          } catch (deleteError) {
            setError(getErrorMessage(deleteError, 'No se pudo eliminar el profesional.'))
          }
        })()
      },
    })
  }

  return (
    <div>
      <ConfigSectionHeader
        title="Profesionales"
        description="Kinesiólogos y terapeutas que atienden en el consultorio."
        action={<button type="button" className="new-turn-button" onClick={openCreate}>+ Nuevo profesional</button>}
      />

      <div className="config-filters-row">
        <input
          type="text"
          className="patients-search-input"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? <p className="evolution-form-error">{error}</p> : null}

      {loading ? (
        <p>Cargando profesionales...</p>
      ) : visibleProfesionales.length === 0 ? (
        <div className="turnos-table-message">
          <strong>No hay profesionales para mostrar.</strong>
          <span>Probá con otra búsqueda o creá el primero.</span>
        </div>
      ) : (
        <div className="turnos-table-scroll">
          <table className="turnos-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Título</th>
                <th>Matrícula</th>
                <th>Especialidades</th>
                <th>Usuario vinculado</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visibleProfesionales.map((profesional) => (
                <tr
                  key={profesional.id}
                  tabIndex={0}
                  onClick={() => openEdit(profesional)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openEdit(profesional)
                    }
                  }}
                >
                  <td><strong>{professionalFullName(profesional)}</strong></td>
                  <td data-label="Título">{profesional.titulo || '—'}</td>
                  <td data-label="Matrícula">{profesional.matricula || '—'}</td>
                  <td data-label="Especialidades">
                    {profesional.especialidades?.length ? (
                      <div className="config-badge-list">
                        {profesional.especialidades.map((pe) => (
                          <span key={pe.especialidadId} className="turnos-specialty-cell">
                            <span className="turnos-specialty-dot" style={{ backgroundColor: pe.especialidad?.color }} />
                            {pe.especialidad?.nombre}
                          </span>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                  <td data-label="Usuario vinculado">{profesional.usuario ? profesional.usuario.email : 'Sin usuario'}</td>
                  <td data-label="Estado">
                    <span className={`turnos-status-pill ${profesional.activo ? 'turnos-status-pill--finalizado' : 'turnos-status-pill--cancelado'}`}>
                      {profesional.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="turnos-actions-cell config-row-actions" onClick={(event) => event.stopPropagation()}>
                    <ConfigRowActions variant="delete" onEdit={() => openEdit(profesional)} onDelete={() => eliminarProfesional(profesional)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <ProfesionalFormModal
          profesional={editingProfesional}
          especialidades={especialidades}
          usuariosDisponibles={usuariosDisponibles}
          onRequestConfirm={onRequestConfirm}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            setRefreshKey((key) => key + 1)
            void refreshUser()
            onProfesionalesChanged?.()
          }}
        />
      ) : null}
    </div>
  )
}

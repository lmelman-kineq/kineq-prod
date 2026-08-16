import { useEffect, useMemo, useState } from 'react'
import * as api from '../services/api'
import type { ConfirmDialogOptions } from '../App'
import type { Profesional, RolUsuario, Usuario } from '../types/domain'
import ConfigSectionHeader from './ConfigSectionHeader'
import ConfigRowActions from './ConfigRowActions'
import UsuarioFormModal from './UsuarioFormModal'
import { formatDateOnly } from '../utils/dateFormat'
import { useAuth } from '../auth/AuthContext'

const ROL_LABELS: Record<RolUsuario, string> = {
  ADMINISTRADOR: 'Administrador',
  PROFESIONAL: 'Profesional',
  RECEPCION: 'Recepción',
  SUPERVISOR: 'Supervisor',
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

type ConfiguracionUsuariosProps = {
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

export default function ConfiguracionUsuarios({ onRequestConfirm }: ConfiguracionUsuariosProps) {
  const { refreshUser } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [rolFilter, setRolFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingUsuario, setEditingUsuario] = useState<Usuario | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadUsuarios() {
      setLoading(true)
      setError(null)
      try {
        const [usuariosResult, profesionalesResult] = await Promise.all([api.getUsuarios(), api.getProfesionales()])
        if (cancelled) return
        setUsuarios(usuariosResult)
        setProfesionales(profesionalesResult)
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, 'No se pudieron cargar los usuarios.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadUsuarios()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const profesionalesDisponibles = useMemo(
    () => profesionales.filter((p) => !p.usuario || p.usuario.id === editingUsuario?.id),
    [profesionales, editingUsuario],
  )

  // Mismo criterio que el backend (quedariaSinAdministrador): administradores
  // activos del consultorio, sin importar el filtro/búsqueda visible en la
  // tabla — se calcula sobre `usuarios` completo, no sobre `visibleUsuarios`.
  const activeAdminCount = useMemo(
    () => usuarios.filter((u) => u.rol === 'ADMINISTRADOR' && u.activo).length,
    [usuarios],
  )
  const esUltimoAdminActivo = (usuario: Usuario) => usuario.rol === 'ADMINISTRADOR' && usuario.activo && activeAdminCount <= 1

  const visibleUsuarios = useMemo(() => {
    const term = search.trim().toLowerCase()
    return usuarios.filter((usuario) => {
      const fullName = `${usuario.nombre} ${usuario.apellido} ${usuario.email}`.toLowerCase()
      if (term && !fullName.includes(term)) return false
      if (rolFilter && usuario.rol !== rolFilter) return false
      if (estadoFilter === 'activo' && !usuario.activo) return false
      if (estadoFilter === 'inactivo' && usuario.activo) return false
      return true
    })
  }, [usuarios, search, rolFilter, estadoFilter])

  const openCreate = () => {
    setEditingUsuario(undefined)
    setFormOpen(true)
  }

  const openEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario)
    setFormOpen(true)
  }

  const toggleEstado = (usuario: Usuario) => {
    const activar = !usuario.activo

    if (!activar && esUltimoAdminActivo(usuario)) {
      onRequestConfirm({
        title: 'No se puede desactivar',
        description: 'No podés desactivar al último administrador del consultorio. Asigná o activá otro administrador antes de continuar.',
        confirmLabel: 'Entendido',
        cancelLabel: 'Cerrar',
        destructive: false,
        onConfirm: () => {},
      })
      return
    }

    onRequestConfirm({
      title: activar ? 'Activar usuario' : 'Desactivar usuario',
      description: activar
        ? `${usuario.nombre} ${usuario.apellido} va a poder iniciar sesión de nuevo.`
        : `${usuario.nombre} ${usuario.apellido} deja de poder iniciar sesión. Su historial se conserva.`,
      confirmLabel: activar ? 'Activar' : 'Desactivar',
      cancelLabel: 'Cancelar',
      destructive: !activar,
      onConfirm: () => {
        void (async () => {
          try {
            await api.patchUsuario(usuario.id, { activo: activar })
            setRefreshKey((key) => key + 1)
            void refreshUser()
          } catch (toggleError) {
            setError(getErrorMessage(toggleError, 'No se pudo actualizar el estado del usuario.'))
          }
        })()
      },
    })
  }

  return (
    <div>
      <ConfigSectionHeader
        title="Usuarios"
        description="Cuentas con acceso al sistema."
        action={<button type="button" className="new-turn-button" onClick={openCreate}>+ Nuevo usuario</button>}
      />

      <div className="config-filters-row">
        <input
          type="text"
          className="patients-search-input"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={rolFilter} onChange={(event) => setRolFilter(event.target.value)}>
          <option value="">Todos los roles</option>
          {Object.entries(ROL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={estadoFilter} onChange={(event) => setEstadoFilter(event.target.value)}>
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
      </div>

      {error ? <p className="evolution-form-error">{error}</p> : null}

      {loading ? (
        <p>Cargando usuarios...</p>
      ) : visibleUsuarios.length === 0 ? (
        <div className="turnos-table-message">
          <strong>No hay usuarios para mostrar.</strong>
          <span>Probá con otra búsqueda o quitá los filtros.</span>
        </div>
      ) : (
        <div className="turnos-table-scroll">
          <table className="turnos-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Profesional vinculado</th>
                <th>Alta</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visibleUsuarios.map((usuario) => (
                <tr
                  key={usuario.id}
                  tabIndex={0}
                  onClick={() => openEdit(usuario)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openEdit(usuario)
                    }
                  }}
                >
                  <td><strong>{usuario.nombre} {usuario.apellido}</strong></td>
                  <td data-label="Email">{usuario.email}</td>
                  <td data-label="Rol">{ROL_LABELS[usuario.rol]}</td>
                  <td data-label="Profesional vinculado">{usuario.profesional ? `${usuario.profesional.nombre} ${usuario.profesional.apellido}` : '—'}</td>
                  <td data-label="Alta">{usuario.createdAt ? formatDateOnly(usuario.createdAt) : '—'}</td>
                  <td data-label="Estado">
                    <span className={`turnos-status-pill ${usuario.activo ? 'turnos-status-pill--finalizado' : 'turnos-status-pill--cancelado'}`}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="turnos-actions-cell config-row-actions" onClick={(event) => event.stopPropagation()}>
                    <ConfigRowActions
                      active={!!usuario.activo}
                      onEdit={() => openEdit(usuario)}
                      onToggleActive={() => toggleEstado(usuario)}
                      toggleDisabled={esUltimoAdminActivo(usuario)}
                      toggleTitle={esUltimoAdminActivo(usuario) ? 'Es el último administrador activo' : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <UsuarioFormModal
          usuario={editingUsuario}
          profesionalesDisponibles={profesionalesDisponibles}
          onRequestConfirm={onRequestConfirm}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            setRefreshKey((key) => key + 1)
            void refreshUser()
          }}
        />
      ) : null}
    </div>
  )
}

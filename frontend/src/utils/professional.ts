type ProfesionalNameInput = {
  titulo?: string | null
  nombre: string
  apellido: string
  activo?: boolean
  deletedAt?: string | null
}

/**
 * Nombre para mostrar de un profesional en vistas históricas (turnos,
 * evoluciones, ficha inicial): un profesional archivado o inactivo
 * conserva su autoría — nunca se reemplaza por "Sin profesional" — pero se
 * marca con un sufijo para que quede claro que ya no está operativo.
 */
export function professionalName(profesional: ProfesionalNameInput | null | undefined) {
  if (!profesional) return 'Profesional no disponible'
  const base = `${profesional.titulo ? `${profesional.titulo} ` : ''}${profesional.nombre} ${profesional.apellido}`
  if (profesional.deletedAt) return `${base} (Eliminado)`
  if (profesional.activo === false) return `${base} (Inactivo)`
  return base
}

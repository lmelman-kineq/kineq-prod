type ProfesionalNameInput = {
  titulo?: string | null
  nombre: string
  apellido: string
  activo?: boolean
  deletedAt?: string | null
}

// Nombre completo se ingresa como un solo campo (ver ProfesionalFormModal.tsx)
// y se guarda en `nombre`, dejando `apellido` vacío — mismo criterio que
// patientFullName() en utils/patient.ts. Sin título ni sufijos de estado:
// es el valor "crudo" que se edita, no el que se muestra en listados.
export function professionalFullName(profesional: { nombre: string; apellido: string } | null | undefined) {
  if (!profesional) return ''
  return `${profesional.nombre} ${profesional.apellido}`.replace(/\s+/g, ' ').trim()
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

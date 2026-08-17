type PatientAvatarProps = {
  nombre: string
  apellido: string
  size?: 'md' | 'lg' | 'xl'
}

function initialsOf(nombre: string, apellido: string) {
  // Pacientes nuevos guardan el nombre completo en `nombre` y dejan
  // `apellido` vacío (ver utils/patient.ts) — sin apellido, tomamos la
  // primera y la última palabra del nombre completo en su lugar.
  if (!apellido.trim()) {
    const words = nombre.trim().split(/\s+/).filter(Boolean)
    const first = words[0]?.charAt(0) ?? ''
    const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
    return `${first}${last}`.toUpperCase() || '?'
  }
  const first = nombre.trim().charAt(0)
  const last = apellido.trim().charAt(0)
  return `${first}${last}`.toUpperCase() || '?'
}

export default function PatientAvatar({ nombre, apellido, size = 'md' }: PatientAvatarProps) {
  return (
    <div className={`patient-avatar patient-avatar--${size}`} aria-hidden="true">
      {initialsOf(nombre, apellido)}
    </div>
  )
}

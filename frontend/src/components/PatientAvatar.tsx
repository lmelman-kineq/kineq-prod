type PatientAvatarProps = {
  nombre: string
  apellido: string
  size?: 'md' | 'lg' | 'xl'
}

function initialsOf(nombre: string, apellido: string) {
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

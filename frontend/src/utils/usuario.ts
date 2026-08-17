type UsuarioNameInput = {
  nombre: string
  apellido: string
}

// Nombre completo se ingresa como un solo campo (ver UsuarioFormModal.tsx) y
// se guarda en `nombre`, dejando `apellido` vacío — mismo criterio que
// patientFullName() / professionalFullName(). Único lugar que arma el nombre
// para mostrar, así funciona igual para cuentas viejas (nombre + apellido) y
// nuevas (todo en nombre).
export function userFullName(usuario: UsuarioNameInput | null | undefined) {
  if (!usuario) return ''
  return `${usuario.nombre} ${usuario.apellido}`.replace(/\s+/g, ' ').trim()
}

type PatientNameInput = {
  nombre: string
  apellido: string
}

// Nombre completo se ingresa como un solo campo (ver PatientFormModal.tsx /
// FormFields.tsx) y se guarda en `nombre`, dejando `apellido` vacío — no hay
// migración de schema, así que pacientes viejos siguen teniendo ambos
// campos. Esta función es el único lugar que arma el nombre para mostrar,
// así funciona igual para datos viejos (nombre + apellido) y nuevos (todo en
// nombre).
export function patientFullName(patient: PatientNameInput | null | undefined) {
  if (!patient) return ''
  return `${patient.nombre} ${patient.apellido}`.replace(/\s+/g, ' ').trim()
}

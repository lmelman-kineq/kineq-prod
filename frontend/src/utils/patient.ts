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

type TurnoForUltimaAtencion = { estado: string; inicio: string }

// "Última atención" es el turno FINALIZADO más reciente — nunca el próximo
// agendado, el último creado ni cualquier otro estado (ASIGNADO/CANCELADO/
// AUSENTE no cuentan como una atención real). Extraído a función pura para
// poder testearlo sin montar el componente.
export function ultimaAtencionFinalizada<T extends TurnoForUltimaAtencion>(turnos: T[]): T | null {
  const finalizados = turnos.filter((turno) => turno.estado === 'FINALIZADO')
  return finalizados.slice().sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())[0] ?? null
}

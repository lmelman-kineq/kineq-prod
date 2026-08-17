// Mismo criterio que estudioSerializer.ts: el frontend nunca recibe
// `fotoPathname` (clave interna del blob privado), solo `fotoUrl` — la ruta
// propia que sirve el contenido tras validar consultorio (ver
// pacienteFotoRoutes.ts).
export function pacienteParaCliente<T extends { id: number; fotoPathname: string | null; fotoMimeType?: string | null }>(paciente: T) {
  const { fotoPathname, fotoMimeType, ...rest } = paciente
  return { ...rest, fotoUrl: fotoPathname ? `/api/pacientes/${paciente.id}/foto/contenido` : null }
}

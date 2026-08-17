// El frontend nunca recibe `archivoPathname` (clave interna del blob
// privado) — solo `archivoUrl`, la ruta propia que sirve el contenido tras
// validar consultorio/permisos (ver estudioArchivoRoutes.ts). Compartido
// entre app.ts (ficha inicial completa, alta/edición de estudio) y
// estudioArchivoRoutes.ts (subir/reemplazar archivo) para no tener dos
// versiones de este mapeo.
export function estudioParaCliente<T extends { id: number; archivoPathname: string | null }>(estudio: T) {
  const { archivoPathname, ...rest } = estudio
  return { ...rest, archivoUrl: archivoPathname ? `/api/ficha-estudios/${estudio.id}/archivo/contenido` : null }
}

export function fichaParaCliente<T extends { estudios: Array<{ id: number; archivoPathname: string | null }> } | null>(ficha: T) {
  if (!ficha) return ficha
  return { ...ficha, estudios: ficha.estudios.map(estudioParaCliente) }
}

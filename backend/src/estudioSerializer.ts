type EstudioArchivoRow = {
  id: number
  estudioId: number
  nombreOriginal: string
  mimeType: string
  sizeBytes: number
  createdAt: Date
}

// El frontend nunca recibe `pathname` (clave interna del blob privado) —
// solo la ruta propia que sirve el contenido tras validar consultorio/
// permisos (ver estudioArchivoRoutes.ts). Mismo criterio que
// evolucionImagenSerializer.ts.
export function archivoParaCliente(archivo: EstudioArchivoRow) {
  return {
    id: archivo.id,
    estudioId: archivo.estudioId,
    nombreOriginal: archivo.nombreOriginal,
    mimeType: archivo.mimeType,
    sizeBytes: archivo.sizeBytes,
    createdAt: archivo.createdAt,
    url: `/api/ficha-estudios/${archivo.estudioId}/archivos/${archivo.id}/contenido`,
  }
}

// `archivoPathname`/`archivoNombreOriginal`/`archivoMimeType`/`archivoSizeBytes`
// son las 4 columnas deprecadas (ver schema.prisma) — nunca se exponen al
// cliente, que solo conoce la relación `archivos` (múltiples archivos).
export function estudioParaCliente<T extends { archivoPathname: string | null; archivos?: EstudioArchivoRow[] }>(estudio: T) {
  const { archivoPathname, archivoNombreOriginal, archivoMimeType, archivoSizeBytes, archivos, ...rest } = estudio as T & {
    archivoNombreOriginal?: string | null
    archivoMimeType?: string | null
    archivoSizeBytes?: number | null
  }
  return { ...rest, archivos: (archivos ?? []).map(archivoParaCliente) }
}

export function fichaParaCliente<T extends { estudios: Array<{ archivoPathname: string | null; archivos?: EstudioArchivoRow[] }> } | null>(ficha: T) {
  if (!ficha) return ficha
  return { ...ficha, estudios: ficha.estudios.map(estudioParaCliente) }
}

type EvolucionImagenRow = {
  id: number
  evolucionId: number
  nombreOriginal: string
  mimeType: string
  sizeBytes: number
  createdAt: Date
}

// El frontend nunca recibe la URL de Vercel Blob ni el `pathname` interno —
// solo la ruta propia que sirve el contenido tras validar permisos (ver
// evolucionImagenesRoutes.ts). Compartido entre esa ruta y app.ts (donde
// Evolucion se serializa con `imagenes: true` en GET/POST/PATCH) para no
// tener dos versiones de este mapeo.
export function imagenParaCliente(imagen: EvolucionImagenRow) {
  return {
    id: imagen.id,
    evolucionId: imagen.evolucionId,
    nombreOriginal: imagen.nombreOriginal,
    mimeType: imagen.mimeType,
    sizeBytes: imagen.sizeBytes,
    createdAt: imagen.createdAt,
    url: `/api/evoluciones/${imagen.evolucionId}/imagenes/${imagen.id}/contenido`,
  }
}

export function evolucionParaCliente<T extends { imagenes?: EvolucionImagenRow[] }>(evolucion: T) {
  if (!evolucion.imagenes) return evolucion
  return { ...evolucion, imagenes: evolucion.imagenes.map(imagenParaCliente) }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imagenParaCliente = imagenParaCliente;
exports.evolucionParaCliente = evolucionParaCliente;
// El frontend nunca recibe la URL de Vercel Blob ni el `pathname` interno —
// solo la ruta propia que sirve el contenido tras validar permisos (ver
// evolucionImagenesRoutes.ts). Compartido entre esa ruta y app.ts (donde
// Evolucion se serializa con `imagenes: true` en GET/POST/PATCH) para no
// tener dos versiones de este mapeo.
function imagenParaCliente(imagen) {
    return {
        id: imagen.id,
        evolucionId: imagen.evolucionId,
        nombreOriginal: imagen.nombreOriginal,
        mimeType: imagen.mimeType,
        sizeBytes: imagen.sizeBytes,
        createdAt: imagen.createdAt,
        url: `/api/evoluciones/${imagen.evolucionId}/imagenes/${imagen.id}/contenido`,
    };
}
function evolucionParaCliente(evolucion) {
    if (!evolucion.imagenes)
        return evolucion;
    return { ...evolucion, imagenes: evolucion.imagenes.map(imagenParaCliente) };
}
//# sourceMappingURL=evolucionImagenSerializer.js.map
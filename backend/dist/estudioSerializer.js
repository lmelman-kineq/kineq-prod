"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archivoParaCliente = archivoParaCliente;
exports.estudioParaCliente = estudioParaCliente;
exports.fichaParaCliente = fichaParaCliente;
// El frontend nunca recibe `pathname` (clave interna del blob privado) —
// solo la ruta propia que sirve el contenido tras validar consultorio/
// permisos (ver estudioArchivoRoutes.ts). Mismo criterio que
// evolucionImagenSerializer.ts.
function archivoParaCliente(archivo) {
    return {
        id: archivo.id,
        estudioId: archivo.estudioId,
        nombreOriginal: archivo.nombreOriginal,
        mimeType: archivo.mimeType,
        sizeBytes: archivo.sizeBytes,
        createdAt: archivo.createdAt,
        url: `/api/ficha-estudios/${archivo.estudioId}/archivos/${archivo.id}/contenido`,
    };
}
// `archivoPathname`/`archivoNombreOriginal`/`archivoMimeType`/`archivoSizeBytes`
// son las 4 columnas deprecadas (ver schema.prisma) — nunca se exponen al
// cliente, que solo conoce la relación `archivos` (múltiples archivos).
function estudioParaCliente(estudio) {
    const { archivoPathname, archivoNombreOriginal, archivoMimeType, archivoSizeBytes, archivos, ...rest } = estudio;
    return { ...rest, archivos: (archivos ?? []).map(archivoParaCliente) };
}
function fichaParaCliente(ficha) {
    if (!ficha)
        return ficha;
    return { ...ficha, estudios: ficha.estudios.map(estudioParaCliente) };
}
//# sourceMappingURL=estudioSerializer.js.map
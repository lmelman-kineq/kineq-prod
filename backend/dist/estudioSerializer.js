"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estudioParaCliente = estudioParaCliente;
exports.fichaParaCliente = fichaParaCliente;
// El frontend nunca recibe `archivoPathname` (clave interna del blob
// privado) — solo `archivoUrl`, la ruta propia que sirve el contenido tras
// validar consultorio/permisos (ver estudioArchivoRoutes.ts). Compartido
// entre app.ts (ficha inicial completa, alta/edición de estudio) y
// estudioArchivoRoutes.ts (subir/reemplazar archivo) para no tener dos
// versiones de este mapeo.
function estudioParaCliente(estudio) {
    const { archivoPathname, ...rest } = estudio;
    return { ...rest, archivoUrl: archivoPathname ? `/api/ficha-estudios/${estudio.id}/archivo/contenido` : null };
}
function fichaParaCliente(ficha) {
    if (!ficha)
        return ficha;
    return { ...ficha, estudios: ficha.estudios.map(estudioParaCliente) };
}
//# sourceMappingURL=estudioSerializer.js.map
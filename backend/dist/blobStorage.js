"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToBlob = uploadToBlob;
exports.deleteFromBlob = deleteFromBlob;
exports.streamBlobToResponse = streamBlobToResponse;
const stream_1 = require("stream");
const blob_1 = require("@vercel/blob");
// Capa compartida sobre Vercel Blob para las 4 superficies de archivos
// (imágenes de Evolución, archivo de Estudio, foto de Usuario, foto de
// Paciente) — nunca se llama a `put`/`del`/`get` directamente desde una
// ruta, siempre a través de acá, para no terminar con 4 implementaciones
// ligeramente distintas de subir/borrar/servir un archivo.
//
// `access: 'private'` (no 'public'): un blob público solo está protegido
// por lo impredecible del pathname (`addRandomSuffix`), pero la URL cruda
// sigue siendo servida por cualquiera que la consiga, sin pasar por
// nuestros permisos. Con blobs privados, `get()` exige el mismo token de
// escritura del servidor — el archivo nunca es alcanzable por una URL
// suelta. El frontend nunca recibe la URL de Vercel Blob: solo el
// `pathname`, que cada ruta expone detrás de un endpoint propio que valida
// consultorio/dueño del recurso y recién ahí llama a `streamBlob`.
async function uploadToBlob(pathname, buffer, mimeType) {
    const blob = await (0, blob_1.put)(pathname, buffer, {
        access: 'private',
        addRandomSuffix: true,
        contentType: mimeType,
    });
    return { pathname: blob.pathname };
}
async function deleteFromBlob(pathname) {
    try {
        await (0, blob_1.del)(pathname);
    }
    catch (err) {
        // Si el blob ya no existe o el borrado falla, igual dejamos que el
        // caller borre la referencia en la base — no queremos un archivo
        // "atascado" por un error transitorio del storage.
        console.error('failed to delete blob', err);
    }
}
// Sirve el contenido de un blob privado a través de nuestro propio backend
// — el único punto donde `get()` con el token del servidor se usa. El
// caller ya validó permisos antes de llegar acá.
async function streamBlobToResponse(pathname, res, mimeType, downloadName) {
    const result = await (0, blob_1.get)(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) {
        res.status(404).json({ error: 'archivo no encontrado' });
        return;
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    if (downloadName)
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
    stream_1.Readable.fromWeb(result.stream).pipe(res);
}
//# sourceMappingURL=blobStorage.js.map
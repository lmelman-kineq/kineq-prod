"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const blobStorage_1 = require("./blobStorage");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const router = (0, express_1.Router)();
function pathnameFor(consultorioId, usuarioId, nombreOriginal) {
    return `usuarios/${consultorioId}/${usuarioId}/foto-${nombreOriginal}`;
}
// Foto de perfil: siempre la propia (`req.usuario!.id`), nunca un id
// recibido del cliente — no existe hoy ninguna ruta de autoedición de
// Usuario (PATCH /api/usuarios/:id es solo ADMINISTRADOR), así que esta es
// la única superficie de "edito mis propios datos" y se mantiene acotada a
// la foto, sin abrir edición de otros campos.
//
// Upload directo navegador → Vercel Blob (nunca pasa el archivo por esta
// función): 1) el cliente pide un token acá, 2) sube directo con ese
// token, 3) confirma con /confirm para que quede guardada la referencia.
router.post('/upload-token', async (req, res) => {
    const usuarioId = req.usuario.id;
    const { nombreOriginal, mimeType, sizeBytes } = req.body;
    if (!nombreOriginal || !mimeType)
        return res.status(400).json({ error: 'Faltan datos del archivo.' });
    if (!ALLOWED_MIME_TYPES.includes(mimeType))
        return res.status(400).json({ error: 'Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.' });
    if (typeof sizeBytes === 'number' && sizeBytes > MAX_FILE_SIZE_BYTES) {
        return res.status(400).json({ error: `El archivo debe pesar como máximo ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.` });
    }
    try {
        const usuario = await prisma_1.default.usuario.findUnique({ where: { id: usuarioId } });
        if (!usuario)
            return res.status(404).json({ error: 'usuario not found' });
        const pathname = pathnameFor(usuario.consultorioId, usuarioId, (0, blobStorage_1.withUniqueSuffix)(String(nombreOriginal)));
        const { presignedUrl } = await (0, blobStorage_1.issuePresignedUploadUrl)(pathname, { allowedContentTypes: ALLOWED_MIME_TYPES, maximumSizeInBytes: MAX_FILE_SIZE_BYTES });
        res.json({ presignedUrl, pathname });
    }
    catch (err) {
        console.error('[blob] issue upload url failed', { resource: 'usuario-foto', usuarioId, errorCode: err instanceof Error ? err.name : 'unknown', message: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'No se pudo iniciar la subida. Volvé a intentar.' });
    }
});
router.post('/confirm', async (req, res) => {
    const usuarioId = req.usuario.id;
    const { pathname, mimeType } = req.body;
    if (!pathname || !mimeType)
        return res.status(400).json({ error: 'Faltan datos del archivo.' });
    try {
        const usuario = await prisma_1.default.usuario.findUnique({ where: { id: usuarioId } });
        if (!usuario)
            return res.status(404).json({ error: 'usuario not found' });
        // Defensa en profundidad: el token ya restringía dónde se pudo haber
        // escrito el blob, esto evita además que /confirm acepte metadata de
        // un pathname ajeno.
        const expectedPrefix = `usuarios/${usuario.consultorioId}/${usuarioId}/`;
        if (!String(pathname).startsWith(expectedPrefix))
            return res.status(400).json({ error: 'pathname inválido' });
        if (usuario.fotoPathname)
            await (0, blobStorage_1.deleteFromBlob)(usuario.fotoPathname);
        await prisma_1.default.usuario.update({ where: { id: usuarioId }, data: { fotoPathname: String(pathname), fotoMimeType: String(mimeType) } });
        res.status(201).json({ fotoUrl: '/api/usuarios/me/foto/contenido' });
    }
    catch (err) {
        console.error('failed to confirm usuario foto upload', err);
        res.status(500).json({ error: 'No se pudo guardar la foto. Volvé a intentar.' });
    }
});
router.get('/contenido', async (req, res) => {
    const usuario = await prisma_1.default.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuario?.fotoPathname || !usuario.fotoMimeType)
        return res.status(404).json({ error: 'sin foto' });
    try {
        await (0, blobStorage_1.streamBlobToResponse)(usuario.fotoPathname, res, usuario.fotoMimeType);
    }
    catch (err) {
        console.error('failed to stream usuario foto', err);
        res.status(500).json({ error: 'No se pudo cargar la foto.' });
    }
});
router.delete('/', async (req, res) => {
    const usuarioId = req.usuario.id;
    try {
        const usuario = await prisma_1.default.usuario.findUnique({ where: { id: usuarioId } });
        if (!usuario)
            return res.status(404).json({ error: 'usuario not found' });
        if (!usuario.fotoPathname)
            return res.status(204).end();
        await (0, blobStorage_1.deleteFromBlob)(usuario.fotoPathname);
        await prisma_1.default.usuario.update({ where: { id: usuarioId }, data: { fotoPathname: null, fotoMimeType: null } });
        res.status(204).end();
    }
    catch (err) {
        console.error('failed to delete usuario foto', err);
        res.status(500).json({ error: 'No se pudo eliminar la foto. Volvé a intentar.' });
    }
});
exports.default = router;
//# sourceMappingURL=usuarioFotoRoutes.js.map
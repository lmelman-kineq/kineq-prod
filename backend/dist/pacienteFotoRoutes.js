"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const auth_1 = require("./auth");
const blobStorage_1 = require("./blobStorage");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const router = (0, express_1.Router)({ mergeParams: true });
function pathnameFor(consultorioId, pacienteId, nombreOriginal) {
    return `pacientes/${consultorioId}/${pacienteId}/foto-${nombreOriginal}`;
}
// Foto/avatar del paciente: dato administrativo, mismo criterio de permisos
// que el resto de PATCH /api/pacientes/:id (los cuatro roles pueden
// editarlo, nunca depende de vínculo clínico).
//
// Upload directo navegador → Vercel Blob (nunca pasa el archivo por esta
// función): 1) el cliente pide un token acá, 2) sube directo con ese
// token, 3) confirma con /confirm para que quede guardada la referencia.
router.post('/upload-token', (0, auth_1.requireRole)(...auth_1.ADMIN_DATA_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const pacienteId = Number(req.params.pacienteId);
    if (Number.isNaN(pacienteId))
        return res.status(400).json({ error: 'invalid id' });
    const { nombreOriginal, mimeType, sizeBytes } = req.body;
    if (!nombreOriginal || !mimeType)
        return res.status(400).json({ error: 'Faltan datos del archivo.' });
    if (!ALLOWED_MIME_TYPES.includes(mimeType))
        return res.status(400).json({ error: 'Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.' });
    if (typeof sizeBytes === 'number' && sizeBytes > MAX_FILE_SIZE_BYTES) {
        return res.status(400).json({ error: `El archivo debe pesar como máximo ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.` });
    }
    try {
        const paciente = await prisma_1.default.paciente.findFirst({ where: { id: pacienteId, consultorioId } });
        if (!paciente)
            return res.status(404).json({ error: 'paciente not found in consultorio' });
        const pathname = pathnameFor(consultorioId, pacienteId, (0, blobStorage_1.withUniqueSuffix)(String(nombreOriginal)));
        const { presignedUrl } = await (0, blobStorage_1.issuePresignedUploadUrl)(pathname, { allowedContentTypes: ALLOWED_MIME_TYPES, maximumSizeInBytes: MAX_FILE_SIZE_BYTES });
        res.json({ presignedUrl, pathname });
    }
    catch (err) {
        console.error('[blob] issue upload url failed', { resource: 'paciente-foto', consultorioId, pacienteId, errorCode: err instanceof Error ? err.name : 'unknown', message: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'No se pudo iniciar la subida. Volvé a intentar.' });
    }
});
router.post('/confirm', (0, auth_1.requireRole)(...auth_1.ADMIN_DATA_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const pacienteId = Number(req.params.pacienteId);
    if (Number.isNaN(pacienteId))
        return res.status(400).json({ error: 'invalid id' });
    const { pathname, mimeType } = req.body;
    if (!pathname || !mimeType)
        return res.status(400).json({ error: 'Faltan datos del archivo.' });
    try {
        const paciente = await prisma_1.default.paciente.findFirst({ where: { id: pacienteId, consultorioId } });
        if (!paciente)
            return res.status(404).json({ error: 'paciente not found in consultorio' });
        const expectedPrefix = pathnameFor(consultorioId, pacienteId, '');
        if (!String(pathname).startsWith(expectedPrefix))
            return res.status(400).json({ error: 'pathname inválido' });
        if (paciente.fotoPathname)
            await (0, blobStorage_1.deleteFromBlob)(paciente.fotoPathname);
        await prisma_1.default.paciente.update({ where: { id: pacienteId }, data: { fotoPathname: String(pathname), fotoMimeType: String(mimeType) } });
        res.status(201).json({ fotoUrl: `/api/pacientes/${pacienteId}/foto/contenido` });
    }
    catch (err) {
        console.error('failed to confirm paciente foto upload', err);
        res.status(500).json({ error: 'No se pudo guardar la foto. Volvé a intentar.' });
    }
});
// Lectura: mismo criterio que GET /api/pacientes — todos los roles
// autenticados del consultorio, sin restricción adicional.
router.get('/contenido', async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const pacienteId = Number(req.params.pacienteId);
    if (Number.isNaN(pacienteId))
        return res.status(400).json({ error: 'invalid id' });
    const paciente = await prisma_1.default.paciente.findFirst({ where: { id: pacienteId, consultorioId } });
    if (!paciente?.fotoPathname || !paciente.fotoMimeType)
        return res.status(404).json({ error: 'sin foto' });
    try {
        await (0, blobStorage_1.streamBlobToResponse)(paciente.fotoPathname, res, paciente.fotoMimeType);
    }
    catch (err) {
        console.error('failed to stream paciente foto', err);
        res.status(500).json({ error: 'No se pudo cargar la foto.' });
    }
});
router.delete('/', (0, auth_1.requireRole)(...auth_1.ADMIN_DATA_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const pacienteId = Number(req.params.pacienteId);
    if (Number.isNaN(pacienteId))
        return res.status(400).json({ error: 'invalid id' });
    try {
        const paciente = await prisma_1.default.paciente.findFirst({ where: { id: pacienteId, consultorioId } });
        if (!paciente)
            return res.status(404).json({ error: 'paciente not found in consultorio' });
        if (!paciente.fotoPathname)
            return res.status(204).end();
        await (0, blobStorage_1.deleteFromBlob)(paciente.fotoPathname);
        await prisma_1.default.paciente.update({ where: { id: pacienteId }, data: { fotoPathname: null, fotoMimeType: null } });
        res.status(204).end();
    }
    catch (err) {
        console.error('failed to delete paciente foto', err);
        res.status(500).json({ error: 'No se pudo eliminar la foto. Volvé a intentar.' });
    }
});
exports.default = router;
//# sourceMappingURL=pacienteFotoRoutes.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const auth_1 = require("./auth");
const uploadMiddleware_1 = require("./uploadMiddleware");
const blobStorage_1 = require("./blobStorage");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const uploadHandler = (0, uploadMiddleware_1.createUploadHandler)('foto', {
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    maxFiles: 1,
    formatosLabel: 'imágenes JPG, PNG o WEBP',
});
const router = (0, express_1.Router)({ mergeParams: true });
// Foto/avatar del paciente: dato administrativo, mismo criterio de permisos
// que el resto de PATCH /api/pacientes/:id (los cuatro roles pueden
// editarlo, nunca depende de vínculo clínico).
router.post('/', (0, auth_1.requireRole)(...auth_1.ADMIN_DATA_ROLES), uploadHandler, async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const pacienteId = Number(req.params.pacienteId);
    if (Number.isNaN(pacienteId))
        return res.status(400).json({ error: 'invalid id' });
    const file = req.file;
    if (!file)
        return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    try {
        const paciente = await prisma_1.default.paciente.findFirst({ where: { id: pacienteId, consultorioId } });
        if (!paciente)
            return res.status(404).json({ error: 'paciente not found in consultorio' });
        const blob = await (0, blobStorage_1.uploadToBlob)(`pacientes/${consultorioId}/${pacienteId}/foto-${file.originalname}`, file.buffer, file.mimetype);
        if (paciente.fotoPathname)
            await (0, blobStorage_1.deleteFromBlob)(paciente.fotoPathname);
        await prisma_1.default.paciente.update({ where: { id: pacienteId }, data: { fotoPathname: blob.pathname, fotoMimeType: file.mimetype } });
        res.status(201).json({ fotoUrl: `/api/pacientes/${pacienteId}/foto/contenido` });
    }
    catch (err) {
        console.error('failed to upload paciente foto', err);
        res.status(500).json({ error: 'No se pudo subir la foto. Volvé a intentar.' });
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
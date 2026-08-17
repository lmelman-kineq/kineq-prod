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
const estudioSerializer_1 = require("./estudioSerializer");
// Estudios no tenía antes ningún tipo de archivo soportado (la tab era
// puramente texto) — no hay un límite "actual" que respetar. Se toma un
// máximo razonable, más alto que el de imágenes de Evolución porque acá
// también se aceptan PDF (informes/estudios escaneados).
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const uploadHandler = (0, uploadMiddleware_1.createUploadHandler)('archivo', {
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    maxFiles: 1,
    formatosLabel: 'archivos PDF, JPG, PNG o WEBP',
});
const router = (0, express_1.Router)({ mergeParams: true });
// Mismo criterio de permisos que PATCH/DELETE /api/ficha-estudios/:id: no
// hay restricción de "solo el propio profesional" (a diferencia de
// Evoluciones) — cualquier CLINICAL_ROLES vinculado a un profesional activo
// puede subir/reemplazar/borrar el archivo de cualquier estudio del
// consultorio.
router.post('/', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), uploadHandler, async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const estudioId = Number(req.params.id);
    if (Number.isNaN(estudioId))
        return res.status(400).json({ error: 'invalid id' });
    const file = req.file;
    if (!file)
        return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    const autorProfesionalId = await (0, auth_1.requireProfesionalVinculado)(req, res);
    if (autorProfesionalId === null)
        return;
    try {
        const estudio = await prisma_1.default.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } });
        if (!estudio)
            return res.status(404).json({ error: 'estudio not found in consultorio' });
        const blob = await (0, blobStorage_1.uploadToBlob)(`estudios/${consultorioId}/${estudioId}/${file.originalname}`, file.buffer, file.mimetype);
        if (estudio.archivoPathname)
            await (0, blobStorage_1.deleteFromBlob)(estudio.archivoPathname);
        const updated = await prisma_1.default.fichaEstudioComplementario.update({
            where: { id: estudioId },
            data: {
                archivoPathname: blob.pathname,
                archivoNombreOriginal: file.originalname,
                archivoMimeType: file.mimetype,
                archivoSizeBytes: file.size,
            },
            include: { profesional: true },
        });
        res.status(201).json((0, estudioSerializer_1.estudioParaCliente)(updated));
    }
    catch (err) {
        console.error('failed to upload estudio archivo', err);
        res.status(500).json({ error: 'No se pudo subir el archivo. Volvé a intentar.' });
    }
});
router.get('/contenido', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const estudioId = Number(req.params.id);
    if (Number.isNaN(estudioId))
        return res.status(400).json({ error: 'invalid id' });
    const estudio = await prisma_1.default.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } });
    if (!estudio?.archivoPathname || !estudio.archivoMimeType)
        return res.status(404).json({ error: 'sin archivo' });
    try {
        await (0, blobStorage_1.streamBlobToResponse)(estudio.archivoPathname, res, estudio.archivoMimeType, estudio.archivoNombreOriginal ?? undefined);
    }
    catch (err) {
        console.error('failed to stream estudio archivo', err);
        res.status(500).json({ error: 'No se pudo cargar el archivo.' });
    }
});
router.delete('/', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const estudioId = Number(req.params.id);
    if (Number.isNaN(estudioId))
        return res.status(400).json({ error: 'invalid id' });
    const autorProfesionalId = await (0, auth_1.requireProfesionalVinculado)(req, res);
    if (autorProfesionalId === null)
        return;
    try {
        const estudio = await prisma_1.default.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } });
        if (!estudio)
            return res.status(404).json({ error: 'estudio not found in consultorio' });
        if (!estudio.archivoPathname)
            return res.status(204).end();
        await (0, blobStorage_1.deleteFromBlob)(estudio.archivoPathname);
        await prisma_1.default.fichaEstudioComplementario.update({
            where: { id: estudioId },
            data: { archivoPathname: null, archivoNombreOriginal: null, archivoMimeType: null, archivoSizeBytes: null },
        });
        res.status(204).end();
    }
    catch (err) {
        console.error('failed to delete estudio archivo', err);
        res.status(500).json({ error: 'No se pudo eliminar el archivo. Volvé a intentar.' });
    }
});
exports.default = router;
//# sourceMappingURL=estudioArchivoRoutes.js.map
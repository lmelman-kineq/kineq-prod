"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const blob_1 = require("@vercel/blob");
const prisma_1 = __importDefault(require("./prisma"));
const auth_1 = require("./auth");
const client_1 = require("./generated/prisma/client");
// Mismos límites que le mostramos al usuario en el frontend (ver
// EvolucionImages.tsx): hasta 5 imágenes por evolución, 10MB cada una,
// solo formatos de foto clínica comunes.
const MAX_IMAGES_PER_EVOLUCION = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_IMAGES_PER_EVOLUCION },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.'));
            return;
        }
        cb(null, true);
    },
});
const router = (0, express_1.Router)({ mergeParams: true });
// El binario nunca se guarda en MySQL: `put()` lo sube a Vercel Blob y acá
// solo persistimos la referencia (ver modelo EvolucionImagen). Vercel Blob
// no tiene buckets privados — `addRandomSuffix` (default) es la única
// protección real contra adivinar la URL, así que el pathname nunca incluye
// datos identificables del paciente, solo ids internos.
router.post('/', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), (req, res, next) => {
    upload.array('imagenes', MAX_IMAGES_PER_EVOLUCION)(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: `Cada imagen debe pesar como máximo ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` });
            }
            if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ error: `Como máximo se pueden subir ${MAX_IMAGES_PER_EVOLUCION} imágenes por vez.` });
            }
            return res.status(400).json({ error: 'No se pudieron procesar las imágenes.' });
        }
        if (err)
            return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const evolucionId = Number(req.params.evolucionId);
    if (Number.isNaN(evolucionId))
        return res.status(400).json({ error: 'invalid id' });
    const files = req.files ?? [];
    if (files.length === 0)
        return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    const propioProfesionalId = await (0, auth_1.requireProfesionalVinculado)(req, res);
    if (propioProfesionalId === null)
        return;
    try {
        const evolucion = await prisma_1.default.evolucion.findFirst({ where: { id: evolucionId, consultorioId, activo: true } });
        if (!evolucion)
            return res.status(404).json({ error: 'evolucion not found in consultorio' });
        if (req.usuario.rol === client_1.RolUsuario.PROFESIONAL && evolucion.profesionalId !== propioProfesionalId) {
            return res.status(403).json({ error: 'No podés agregar imágenes a evoluciones de otro profesional' });
        }
        const yaTiene = await prisma_1.default.evolucionImagen.count({ where: { evolucionId } });
        if (yaTiene + files.length > MAX_IMAGES_PER_EVOLUCION) {
            return res.status(400).json({ error: `Esta evolución ya tiene ${yaTiene} imagen(es); como máximo puede tener ${MAX_IMAGES_PER_EVOLUCION}.` });
        }
        const subidas = await Promise.all(files.map(async (file) => {
            const blob = await (0, blob_1.put)(`evoluciones/${consultorioId}/${evolucionId}/${file.originalname}`, file.buffer, {
                access: 'public',
                addRandomSuffix: true,
                contentType: file.mimetype,
            });
            return prisma_1.default.evolucionImagen.create({
                data: {
                    consultorioId,
                    pacienteId: evolucion.pacienteId,
                    evolucionId,
                    url: blob.url,
                    pathname: blob.pathname,
                    nombreOriginal: file.originalname,
                    mimeType: file.mimetype,
                    sizeBytes: file.size,
                },
            });
        }));
        res.status(201).json(subidas);
    }
    catch (err) {
        console.error('failed to upload evolucion imagenes', err);
        res.status(500).json({ error: 'No se pudieron subir las imágenes. Volvé a intentar.' });
    }
});
router.delete('/:imagenId', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const evolucionId = Number(req.params.evolucionId);
    const imagenId = Number(req.params.imagenId);
    if (Number.isNaN(evolucionId) || Number.isNaN(imagenId))
        return res.status(400).json({ error: 'invalid id' });
    const propioProfesionalId = await (0, auth_1.requireProfesionalVinculado)(req, res);
    if (propioProfesionalId === null)
        return;
    try {
        const evolucion = await prisma_1.default.evolucion.findFirst({ where: { id: evolucionId, consultorioId, activo: true } });
        if (!evolucion)
            return res.status(404).json({ error: 'evolucion not found in consultorio' });
        if (req.usuario.rol === client_1.RolUsuario.PROFESIONAL && evolucion.profesionalId !== propioProfesionalId) {
            return res.status(403).json({ error: 'No podés eliminar imágenes de evoluciones de otro profesional' });
        }
        const imagen = await prisma_1.default.evolucionImagen.findFirst({ where: { id: imagenId, evolucionId, consultorioId } });
        if (!imagen)
            return res.status(404).json({ error: 'imagen not found' });
        await (0, blob_1.del)(imagen.pathname).catch((err) => {
            // Si el blob ya no existe (o el borrado falla) igual sacamos la
            // referencia: no queremos dejar la imagen "atascada" en la evolución
            // por un error transitorio del storage.
            console.error('failed to delete blob', err);
        });
        await prisma_1.default.evolucionImagen.delete({ where: { id: imagenId } });
        res.status(204).end();
    }
    catch (err) {
        console.error('failed to delete evolucion imagen', err);
        res.status(500).json({ error: 'No se pudo eliminar la imagen. Volvé a intentar.' });
    }
});
exports.default = router;
//# sourceMappingURL=evolucionImagenesRoutes.js.map
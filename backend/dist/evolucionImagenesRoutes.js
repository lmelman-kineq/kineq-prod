"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const auth_1 = require("./auth");
const client_1 = require("./generated/prisma/client");
const blobStorage_1 = require("./blobStorage");
const evolucionImagenSerializer_1 = require("./evolucionImagenSerializer");
// Mismos límites que le mostramos al usuario en el frontend (ver
// EvolucionImages.tsx): hasta 5 imágenes por evolución, 10MB cada una,
// solo formatos de foto clínica comunes.
const MAX_IMAGES_PER_EVOLUCION = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const router = (0, express_1.Router)({ mergeParams: true });
function pathnameFor(consultorioId, evolucionId, nombreOriginal) {
    return `evoluciones/${consultorioId}/${evolucionId}/${nombreOriginal}`;
}
// Upload directo navegador → Vercel Blob (nunca pasa el archivo por esta
// función): 1) el cliente pide un token por cada imagen acá, 2) sube cada
// una directo con su token, 3) confirma con /confirm para que queden
// guardadas las referencias.
router.post('/upload-tokens', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const evolucionId = Number(req.params.evolucionId);
    if (Number.isNaN(evolucionId))
        return res.status(400).json({ error: 'invalid id' });
    const files = req.body.files ?? [];
    if (files.length === 0)
        return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    for (const f of files) {
        if (!f.nombreOriginal || !f.mimeType)
            return res.status(400).json({ error: 'Faltan datos del archivo.' });
        if (!ALLOWED_MIME_TYPES.includes(f.mimeType))
            return res.status(400).json({ error: 'Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.' });
        if (typeof f.sizeBytes === 'number' && f.sizeBytes > MAX_FILE_SIZE_BYTES) {
            return res.status(400).json({ error: `Cada imagen debe pesar como máximo ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.` });
        }
    }
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
        const items = await Promise.all(files.map(async (f) => {
            const pathname = pathnameFor(consultorioId, evolucionId, f.nombreOriginal);
            const token = await (0, blobStorage_1.issueClientUploadToken)(pathname, { allowedContentTypes: ALLOWED_MIME_TYPES, maximumSizeInBytes: MAX_FILE_SIZE_BYTES });
            return { token, pathname };
        }));
        res.json({ items });
    }
    catch (err) {
        console.error('failed to issue evolucion imagenes upload tokens', err);
        res.status(500).json({ error: 'No se pudo iniciar la subida. Volvé a intentar.' });
    }
});
router.post('/confirm', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const evolucionId = Number(req.params.evolucionId);
    if (Number.isNaN(evolucionId))
        return res.status(400).json({ error: 'invalid id' });
    const items = req.body.items ?? [];
    if (items.length === 0)
        return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    for (const item of items) {
        if (!item.pathname || !item.nombreOriginal || !item.mimeType)
            return res.status(400).json({ error: 'Faltan datos del archivo.' });
    }
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
        const expectedPrefix = pathnameFor(consultorioId, evolucionId, '');
        for (const item of items) {
            if (!String(item.pathname).startsWith(expectedPrefix))
                return res.status(400).json({ error: 'pathname inválido' });
        }
        const yaTiene = await prisma_1.default.evolucionImagen.count({ where: { evolucionId } });
        if (yaTiene + items.length > MAX_IMAGES_PER_EVOLUCION) {
            return res.status(400).json({ error: `Esta evolución ya tiene ${yaTiene} imagen(es); como máximo puede tener ${MAX_IMAGES_PER_EVOLUCION}.` });
        }
        const subidas = await Promise.all(items.map((item) => prisma_1.default.evolucionImagen.create({
            data: {
                consultorioId,
                pacienteId: evolucion.pacienteId,
                evolucionId,
                pathname: String(item.pathname),
                nombreOriginal: String(item.nombreOriginal),
                mimeType: String(item.mimeType),
                sizeBytes: typeof item.sizeBytes === 'number' ? item.sizeBytes : 0,
            },
        })));
        res.status(201).json(subidas.map(evolucionImagenSerializer_1.imagenParaCliente));
    }
    catch (err) {
        console.error('failed to confirm evolucion imagenes upload', err);
        res.status(500).json({ error: 'No se pudieron guardar las imágenes. Volvé a intentar.' });
    }
});
// Único punto que sirve el binario: valida consultorio/paciente/evolución/
// dueño antes de pedirle el contenido a Vercel Blob. La lectura clínica
// (ver el historial de un paciente) ya es más permisiva que la escritura —
// no exige `requireProfesionalVinculado`, mismo criterio que el resto de
// las lecturas de Evoluciones.
router.get('/:imagenId/contenido', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const evolucionId = Number(req.params.evolucionId);
    const imagenId = Number(req.params.imagenId);
    if (Number.isNaN(evolucionId) || Number.isNaN(imagenId))
        return res.status(400).json({ error: 'invalid id' });
    const imagen = await prisma_1.default.evolucionImagen.findFirst({ where: { id: imagenId, evolucionId, consultorioId } });
    if (!imagen)
        return res.status(404).json({ error: 'imagen not found' });
    try {
        await (0, blobStorage_1.streamBlobToResponse)(imagen.pathname, res, imagen.mimeType, imagen.nombreOriginal);
    }
    catch (err) {
        console.error('failed to stream evolucion imagen', err);
        res.status(500).json({ error: 'No se pudo cargar la imagen.' });
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
        await (0, blobStorage_1.deleteFromBlob)(imagen.pathname);
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
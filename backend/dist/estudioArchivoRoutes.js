"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const auth_1 = require("./auth");
const blobStorage_1 = require("./blobStorage");
const estudioSerializer_1 = require("./estudioSerializer");
// Mismos límites que le mostramos al usuario en el frontend (ver
// FichaEstudiosList.tsx): hasta 10 archivos por estudio, 15MB cada uno.
const MAX_ARCHIVOS_PER_ESTUDIO = 10;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const router = (0, express_1.Router)({ mergeParams: true });
function pathnameFor(consultorioId, estudioId, nombreOriginal) {
    return `estudios/${consultorioId}/${estudioId}/${nombreOriginal}`;
}
// Mismo criterio de permisos que PATCH/DELETE /api/ficha-estudios/:id: no
// hay restricción de "solo el propio profesional" (a diferencia de
// Evoluciones) — cualquier CLINICAL_ROLES vinculado a un profesional activo
// puede subir/eliminar archivos de cualquier estudio del consultorio.
//
// Upload directo navegador → Vercel Blob (nunca pasa el archivo por esta
// función): 1) el cliente pide un token por cada archivo acá, 2) sube cada
// uno directo con su token, 3) confirma con /confirm para que queden
// guardadas las referencias. Mismo patrón multi-archivo que
// evolucionImagenesRoutes.ts (`/upload-tokens` plural, con "items"/"files").
router.post('/upload-tokens', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const estudioId = Number(req.params.id);
    if (Number.isNaN(estudioId))
        return res.status(400).json({ error: 'invalid id' });
    const files = req.body.files ?? [];
    if (files.length === 0)
        return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    for (const f of files) {
        if (!f.nombreOriginal || !f.mimeType)
            return res.status(400).json({ error: 'Faltan datos del archivo.' });
        if (!ALLOWED_MIME_TYPES.includes(f.mimeType))
            return res.status(400).json({ error: 'Formato no permitido. Solo se aceptan archivos PDF, JPG, PNG o WEBP.' });
        if (typeof f.sizeBytes === 'number' && f.sizeBytes > MAX_FILE_SIZE_BYTES) {
            return res.status(400).json({ error: `Cada archivo debe pesar como máximo ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.` });
        }
    }
    const autorProfesionalId = await (0, auth_1.requireProfesionalVinculado)(req, res);
    if (autorProfesionalId === null)
        return;
    try {
        const estudio = await prisma_1.default.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } });
        if (!estudio)
            return res.status(404).json({ error: 'estudio not found in consultorio' });
        const yaTiene = await prisma_1.default.estudioArchivo.count({ where: { estudioId } });
        if (yaTiene + files.length > MAX_ARCHIVOS_PER_ESTUDIO) {
            return res.status(400).json({ error: `Este estudio ya tiene ${yaTiene} archivo(s); como máximo puede tener ${MAX_ARCHIVOS_PER_ESTUDIO}.` });
        }
        const items = await Promise.all(files.map(async (f) => {
            const pathname = pathnameFor(consultorioId, estudioId, (0, blobStorage_1.withUniqueSuffix)(f.nombreOriginal));
            const { presignedUrl } = await (0, blobStorage_1.issuePresignedUploadUrl)(pathname, { allowedContentTypes: ALLOWED_MIME_TYPES, maximumSizeInBytes: MAX_FILE_SIZE_BYTES });
            return { presignedUrl, pathname };
        }));
        res.json({ items });
    }
    catch (err) {
        console.error('[blob] issue upload url failed', { resource: 'estudio-archivos', consultorioId, estudioId, errorCode: err instanceof Error ? err.name : 'unknown', message: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'No se pudo iniciar la subida. Volvé a intentar.' });
    }
});
router.post('/confirm', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const estudioId = Number(req.params.id);
    if (Number.isNaN(estudioId))
        return res.status(400).json({ error: 'invalid id' });
    const items = req.body.items ?? [];
    if (items.length === 0)
        return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    for (const item of items) {
        if (!item.pathname || !item.nombreOriginal || !item.mimeType)
            return res.status(400).json({ error: 'Faltan datos del archivo.' });
    }
    const autorProfesionalId = await (0, auth_1.requireProfesionalVinculado)(req, res);
    if (autorProfesionalId === null)
        return;
    try {
        const estudio = await prisma_1.default.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } });
        if (!estudio)
            return res.status(404).json({ error: 'estudio not found in consultorio' });
        const expectedPrefix = pathnameFor(consultorioId, estudioId, '');
        for (const item of items) {
            if (!String(item.pathname).startsWith(expectedPrefix))
                return res.status(400).json({ error: 'pathname inválido' });
        }
        const yaTiene = await prisma_1.default.estudioArchivo.count({ where: { estudioId } });
        if (yaTiene + items.length > MAX_ARCHIVOS_PER_ESTUDIO) {
            return res.status(400).json({ error: `Este estudio ya tiene ${yaTiene} archivo(s); como máximo puede tener ${MAX_ARCHIVOS_PER_ESTUDIO}.` });
        }
        // Atomicidad: si una confirmación individual fallara a mitad de camino,
        // una transacción evita dejar el estudio con "algunos sí, otros no" sin
        // que el usuario se entere — o se guardan todos los items de esta
        // tanda, o ninguno (los blobs ya subidos de los que fallen quedan
        // huérfanos en Blob, aceptable: nunca se muestran porque no llegan a
        // tener fila en MySQL, y no son alcanzables sin su pathname exacto).
        await prisma_1.default.$transaction(items.map((item) => prisma_1.default.estudioArchivo.create({
            data: {
                consultorioId,
                estudioId,
                pathname: String(item.pathname),
                nombreOriginal: String(item.nombreOriginal),
                mimeType: String(item.mimeType),
                sizeBytes: typeof item.sizeBytes === 'number' ? item.sizeBytes : 0,
            },
        })));
        const updated = await prisma_1.default.fichaEstudioComplementario.findFirstOrThrow({
            where: { id: estudioId },
            include: { profesional: true, archivos: true },
        });
        res.status(201).json((0, estudioSerializer_1.estudioParaCliente)(updated));
    }
    catch (err) {
        console.error('failed to confirm estudio archivos upload', err);
        res.status(500).json({ error: 'No se pudieron guardar los archivos. Volvé a intentar.' });
    }
});
// Único punto que sirve el binario: valida consultorio/estudio antes de
// pedirle el contenido a Vercel Blob. Mismo criterio que el resto de las
// lecturas de archivos clínicos (sin exigir vínculo a profesional para leer).
router.get('/:archivoId/contenido', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const estudioId = Number(req.params.id);
    const archivoId = Number(req.params.archivoId);
    if (Number.isNaN(estudioId) || Number.isNaN(archivoId))
        return res.status(400).json({ error: 'invalid id' });
    const archivo = await prisma_1.default.estudioArchivo.findFirst({ where: { id: archivoId, estudioId, consultorioId } });
    if (!archivo)
        return res.status(404).json({ error: 'archivo not found' });
    try {
        await (0, blobStorage_1.streamBlobToResponse)(archivo.pathname, res, archivo.mimeType, archivo.nombreOriginal);
    }
    catch (err) {
        console.error('failed to stream estudio archivo', err);
        res.status(500).json({ error: 'No se pudo cargar el archivo.' });
    }
});
router.delete('/:archivoId', (0, auth_1.requireRole)(...auth_1.CLINICAL_ROLES), async (req, res) => {
    const consultorioId = req.usuario.consultorioId;
    const estudioId = Number(req.params.id);
    const archivoId = Number(req.params.archivoId);
    if (Number.isNaN(estudioId) || Number.isNaN(archivoId))
        return res.status(400).json({ error: 'invalid id' });
    const autorProfesionalId = await (0, auth_1.requireProfesionalVinculado)(req, res);
    if (autorProfesionalId === null)
        return;
    try {
        const estudio = await prisma_1.default.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } });
        if (!estudio)
            return res.status(404).json({ error: 'estudio not found in consultorio' });
        const archivo = await prisma_1.default.estudioArchivo.findFirst({ where: { id: archivoId, estudioId, consultorioId } });
        if (!archivo)
            return res.status(404).json({ error: 'archivo not found' });
        await (0, blobStorage_1.deleteFromBlob)(archivo.pathname);
        await prisma_1.default.estudioArchivo.delete({ where: { id: archivoId } });
        res.status(204).end();
    }
    catch (err) {
        console.error('failed to delete estudio archivo', err);
        res.status(500).json({ error: 'No se pudo eliminar el archivo. Volvé a intentar.' });
    }
});
exports.default = router;
//# sourceMappingURL=estudioArchivoRoutes.js.map
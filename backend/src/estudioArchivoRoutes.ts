import { Router } from 'express'
import prisma from './prisma'
import { CLINICAL_ROLES, requireProfesionalVinculado, requireRole } from './auth'
import { createUploadHandler } from './uploadMiddleware'
import { uploadToBlob, deleteFromBlob, streamBlobToResponse } from './blobStorage'
import { estudioParaCliente } from './estudioSerializer'

// Estudios no tenía antes ningún tipo de archivo soportado (la tab era
// puramente texto) — no hay un límite "actual" que respetar. Se toma un
// máximo razonable, más alto que el de imágenes de Evolución porque acá
// también se aceptan PDF (informes/estudios escaneados).
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

const uploadHandler = createUploadHandler('archivo', {
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  maxSizeBytes: MAX_FILE_SIZE_BYTES,
  maxFiles: 1,
  formatosLabel: 'archivos PDF, JPG, PNG o WEBP',
})

const router = Router({ mergeParams: true })

// Mismo criterio de permisos que PATCH/DELETE /api/ficha-estudios/:id: no
// hay restricción de "solo el propio profesional" (a diferencia de
// Evoluciones) — cualquier CLINICAL_ROLES vinculado a un profesional activo
// puede subir/reemplazar/borrar el archivo de cualquier estudio del
// consultorio.
router.post('/', requireRole(...CLINICAL_ROLES), uploadHandler, async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const estudioId = Number(req.params.id)
  if (Number.isNaN(estudioId)) return res.status(400).json({ error: 'invalid id' })

  const file = req.file as Express.Multer.File | undefined
  if (!file) return res.status(400).json({ error: 'No se recibió ningún archivo.' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  try {
    const estudio = await prisma.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } })
    if (!estudio) return res.status(404).json({ error: 'estudio not found in consultorio' })

    const blob = await uploadToBlob(`estudios/${consultorioId}/${estudioId}/${file.originalname}`, file.buffer, file.mimetype)
    if (estudio.archivoPathname) await deleteFromBlob(estudio.archivoPathname)

    const updated = await prisma.fichaEstudioComplementario.update({
      where: { id: estudioId },
      data: {
        archivoPathname: blob.pathname,
        archivoNombreOriginal: file.originalname,
        archivoMimeType: file.mimetype,
        archivoSizeBytes: file.size,
      },
      include: { profesional: true },
    })
    res.status(201).json(estudioParaCliente(updated))
  } catch (err) {
    console.error('failed to upload estudio archivo', err)
    res.status(500).json({ error: 'No se pudo subir el archivo. Volvé a intentar.' })
  }
})

router.get('/contenido', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const estudioId = Number(req.params.id)
  if (Number.isNaN(estudioId)) return res.status(400).json({ error: 'invalid id' })

  const estudio = await prisma.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } })
  if (!estudio?.archivoPathname || !estudio.archivoMimeType) return res.status(404).json({ error: 'sin archivo' })

  try {
    await streamBlobToResponse(estudio.archivoPathname, res, estudio.archivoMimeType, estudio.archivoNombreOriginal ?? undefined)
  } catch (err) {
    console.error('failed to stream estudio archivo', err)
    res.status(500).json({ error: 'No se pudo cargar el archivo.' })
  }
})

router.delete('/', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const estudioId = Number(req.params.id)
  if (Number.isNaN(estudioId)) return res.status(400).json({ error: 'invalid id' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  try {
    const estudio = await prisma.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } })
    if (!estudio) return res.status(404).json({ error: 'estudio not found in consultorio' })
    if (!estudio.archivoPathname) return res.status(204).end()

    await deleteFromBlob(estudio.archivoPathname)
    await prisma.fichaEstudioComplementario.update({
      where: { id: estudioId },
      data: { archivoPathname: null, archivoNombreOriginal: null, archivoMimeType: null, archivoSizeBytes: null },
    })
    res.status(204).end()
  } catch (err) {
    console.error('failed to delete estudio archivo', err)
    res.status(500).json({ error: 'No se pudo eliminar el archivo. Volvé a intentar.' })
  }
})

export default router

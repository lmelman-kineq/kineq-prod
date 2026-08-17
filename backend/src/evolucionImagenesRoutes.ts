import { Router } from 'express'
import prisma from './prisma'
import { CLINICAL_ROLES, requireProfesionalVinculado, requireRole } from './auth'
import { RolUsuario } from './generated/prisma/client'
import { createUploadHandler } from './uploadMiddleware'
import { uploadToBlob, deleteFromBlob, streamBlobToResponse } from './blobStorage'
import { imagenParaCliente } from './evolucionImagenSerializer'

// Mismos límites que le mostramos al usuario en el frontend (ver
// EvolucionImages.tsx): hasta 5 imágenes por evolución, 10MB cada una,
// solo formatos de foto clínica comunes.
const MAX_IMAGES_PER_EVOLUCION = 5
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const uploadHandler = createUploadHandler('imagenes', {
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  maxSizeBytes: MAX_FILE_SIZE_BYTES,
  maxFiles: MAX_IMAGES_PER_EVOLUCION,
  formatosLabel: 'imágenes JPG, PNG o WEBP',
})

const router = Router({ mergeParams: true })

router.post('/', requireRole(...CLINICAL_ROLES), uploadHandler, async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const evolucionId = Number(req.params.evolucionId)
  if (Number.isNaN(evolucionId)) return res.status(400).json({ error: 'invalid id' })

  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (files.length === 0) return res.status(400).json({ error: 'No se recibió ninguna imagen.' })

  const propioProfesionalId = await requireProfesionalVinculado(req, res)
  if (propioProfesionalId === null) return

  try {
    const evolucion = await prisma.evolucion.findFirst({ where: { id: evolucionId, consultorioId, activo: true } })
    if (!evolucion) return res.status(404).json({ error: 'evolucion not found in consultorio' })

    if (req.usuario!.rol === RolUsuario.PROFESIONAL && evolucion.profesionalId !== propioProfesionalId) {
      return res.status(403).json({ error: 'No podés agregar imágenes a evoluciones de otro profesional' })
    }

    const yaTiene = await prisma.evolucionImagen.count({ where: { evolucionId } })
    if (yaTiene + files.length > MAX_IMAGES_PER_EVOLUCION) {
      return res.status(400).json({ error: `Esta evolución ya tiene ${yaTiene} imagen(es); como máximo puede tener ${MAX_IMAGES_PER_EVOLUCION}.` })
    }

    const subidas = await Promise.all(files.map(async (file) => {
      const blob = await uploadToBlob(`evoluciones/${consultorioId}/${evolucionId}/${file.originalname}`, file.buffer, file.mimetype)
      return prisma.evolucionImagen.create({
        data: {
          consultorioId,
          pacienteId: evolucion.pacienteId,
          evolucionId,
          pathname: blob.pathname,
          nombreOriginal: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      })
    }))

    res.status(201).json(subidas.map(imagenParaCliente))
  } catch (err) {
    console.error('failed to upload evolucion imagenes', err)
    res.status(500).json({ error: 'No se pudieron subir las imágenes. Volvé a intentar.' })
  }
})

// Único punto que sirve el binario: valida consultorio/paciente/evolución/
// dueño antes de pedirle el contenido a Vercel Blob. La lectura clínica
// (ver el historial de un paciente) ya es más permisiva que la escritura —
// no exige `requireProfesionalVinculado`, mismo criterio que el resto de
// las lecturas de Evoluciones.
router.get('/:imagenId/contenido', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const evolucionId = Number(req.params.evolucionId)
  const imagenId = Number(req.params.imagenId)
  if (Number.isNaN(evolucionId) || Number.isNaN(imagenId)) return res.status(400).json({ error: 'invalid id' })

  const imagen = await prisma.evolucionImagen.findFirst({ where: { id: imagenId, evolucionId, consultorioId } })
  if (!imagen) return res.status(404).json({ error: 'imagen not found' })

  try {
    await streamBlobToResponse(imagen.pathname, res, imagen.mimeType, imagen.nombreOriginal)
  } catch (err) {
    console.error('failed to stream evolucion imagen', err)
    res.status(500).json({ error: 'No se pudo cargar la imagen.' })
  }
})

router.delete('/:imagenId', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const evolucionId = Number(req.params.evolucionId)
  const imagenId = Number(req.params.imagenId)
  if (Number.isNaN(evolucionId) || Number.isNaN(imagenId)) return res.status(400).json({ error: 'invalid id' })

  const propioProfesionalId = await requireProfesionalVinculado(req, res)
  if (propioProfesionalId === null) return

  try {
    const evolucion = await prisma.evolucion.findFirst({ where: { id: evolucionId, consultorioId, activo: true } })
    if (!evolucion) return res.status(404).json({ error: 'evolucion not found in consultorio' })

    if (req.usuario!.rol === RolUsuario.PROFESIONAL && evolucion.profesionalId !== propioProfesionalId) {
      return res.status(403).json({ error: 'No podés eliminar imágenes de evoluciones de otro profesional' })
    }

    const imagen = await prisma.evolucionImagen.findFirst({ where: { id: imagenId, evolucionId, consultorioId } })
    if (!imagen) return res.status(404).json({ error: 'imagen not found' })

    await deleteFromBlob(imagen.pathname)
    await prisma.evolucionImagen.delete({ where: { id: imagenId } })

    res.status(204).end()
  } catch (err) {
    console.error('failed to delete evolucion imagen', err)
    res.status(500).json({ error: 'No se pudo eliminar la imagen. Volvé a intentar.' })
  }
})

export default router

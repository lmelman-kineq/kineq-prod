import { Router } from 'express'
import type { Request } from 'express'
import prisma from './prisma'
import { ADMIN_DATA_ROLES, requireRole } from './auth'
import { createUploadHandler } from './uploadMiddleware'
import { uploadToBlob, deleteFromBlob, streamBlobToResponse } from './blobStorage'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const uploadHandler = createUploadHandler('foto', {
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  maxSizeBytes: MAX_FILE_SIZE_BYTES,
  maxFiles: 1,
  formatosLabel: 'imágenes JPG, PNG o WEBP',
})

const router = Router({ mergeParams: true })

// Foto/avatar del paciente: dato administrativo, mismo criterio de permisos
// que el resto de PATCH /api/pacientes/:id (los cuatro roles pueden
// editarlo, nunca depende de vínculo clínico).
router.post('/', requireRole(...ADMIN_DATA_ROLES), uploadHandler, async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const file = req.file as Express.Multer.File | undefined
  if (!file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' })

  try {
    const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId } })
    if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })

    const blob = await uploadToBlob(`pacientes/${consultorioId}/${pacienteId}/foto-${file.originalname}`, file.buffer, file.mimetype)
    if (paciente.fotoPathname) await deleteFromBlob(paciente.fotoPathname)

    await prisma.paciente.update({ where: { id: pacienteId }, data: { fotoPathname: blob.pathname, fotoMimeType: file.mimetype } })
    res.status(201).json({ fotoUrl: `/api/pacientes/${pacienteId}/foto/contenido` })
  } catch (err) {
    console.error('failed to upload paciente foto', err)
    res.status(500).json({ error: 'No se pudo subir la foto. Volvé a intentar.' })
  }
})

// Lectura: mismo criterio que GET /api/pacientes — todos los roles
// autenticados del consultorio, sin restricción adicional.
router.get('/contenido', async (req: Request<{ pacienteId: string }>, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId } })
  if (!paciente?.fotoPathname || !paciente.fotoMimeType) return res.status(404).json({ error: 'sin foto' })

  try {
    await streamBlobToResponse(paciente.fotoPathname, res, paciente.fotoMimeType)
  } catch (err) {
    console.error('failed to stream paciente foto', err)
    res.status(500).json({ error: 'No se pudo cargar la foto.' })
  }
})

router.delete('/', requireRole(...ADMIN_DATA_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const pacienteId = Number(req.params.pacienteId)
  if (Number.isNaN(pacienteId)) return res.status(400).json({ error: 'invalid id' })

  try {
    const paciente = await prisma.paciente.findFirst({ where: { id: pacienteId, consultorioId } })
    if (!paciente) return res.status(404).json({ error: 'paciente not found in consultorio' })
    if (!paciente.fotoPathname) return res.status(204).end()

    await deleteFromBlob(paciente.fotoPathname)
    await prisma.paciente.update({ where: { id: pacienteId }, data: { fotoPathname: null, fotoMimeType: null } })
    res.status(204).end()
  } catch (err) {
    console.error('failed to delete paciente foto', err)
    res.status(500).json({ error: 'No se pudo eliminar la foto. Volvé a intentar.' })
  }
})

export default router

import { Router } from 'express'
import prisma from './prisma'
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

const router = Router()

// Foto de perfil: siempre la propia (`req.usuario!.id`), nunca un id
// recibido del cliente — no existe hoy ninguna ruta de autoedición de
// Usuario (PATCH /api/usuarios/:id es solo ADMINISTRADOR), así que esta es
// la única superficie de "edito mis propios datos" y se mantiene acotada a
// la foto, sin abrir edición de otros campos.
router.post('/', uploadHandler, async (req, res) => {
  const usuarioId = req.usuario!.id
  const file = req.file as Express.Multer.File | undefined
  if (!file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' })

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
    if (!usuario) return res.status(404).json({ error: 'usuario not found' })

    const blob = await uploadToBlob(`usuarios/${usuario.consultorioId}/${usuarioId}/foto-${file.originalname}`, file.buffer, file.mimetype)
    if (usuario.fotoPathname) await deleteFromBlob(usuario.fotoPathname)

    await prisma.usuario.update({ where: { id: usuarioId }, data: { fotoPathname: blob.pathname, fotoMimeType: file.mimetype } })
    res.status(201).json({ fotoUrl: '/api/usuarios/me/foto/contenido' })
  } catch (err) {
    console.error('failed to upload usuario foto', err)
    res.status(500).json({ error: 'No se pudo subir la foto. Volvé a intentar.' })
  }
})

router.get('/contenido', async (req, res) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.id } })
  if (!usuario?.fotoPathname || !usuario.fotoMimeType) return res.status(404).json({ error: 'sin foto' })

  try {
    await streamBlobToResponse(usuario.fotoPathname, res, usuario.fotoMimeType)
  } catch (err) {
    console.error('failed to stream usuario foto', err)
    res.status(500).json({ error: 'No se pudo cargar la foto.' })
  }
})

router.delete('/', async (req, res) => {
  const usuarioId = req.usuario!.id
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
    if (!usuario) return res.status(404).json({ error: 'usuario not found' })
    if (!usuario.fotoPathname) return res.status(204).end()

    await deleteFromBlob(usuario.fotoPathname)
    await prisma.usuario.update({ where: { id: usuarioId }, data: { fotoPathname: null, fotoMimeType: null } })
    res.status(204).end()
  } catch (err) {
    console.error('failed to delete usuario foto', err)
    res.status(500).json({ error: 'No se pudo eliminar la foto. Volvé a intentar.' })
  }
})

export default router

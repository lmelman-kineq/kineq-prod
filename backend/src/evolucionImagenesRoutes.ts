import { Router } from 'express'
import prisma from './prisma'
import { CLINICAL_ROLES, requireProfesionalVinculado, requireRole } from './auth'
import { RolUsuario } from './generated/prisma/client'
import { issuePresignedUploadUrl, withUniqueSuffix, deleteFromBlob, streamBlobToResponse } from './blobStorage'
import { imagenParaCliente } from './evolucionImagenSerializer'

// Mismos límites que le mostramos al usuario en el frontend (ver
// EvolucionImages.tsx): hasta 5 imágenes por evolución, 10MB cada una,
// solo formatos de foto clínica comunes.
const MAX_IMAGES_PER_EVOLUCION = 5
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const router = Router({ mergeParams: true })

function pathnameFor(consultorioId: number, evolucionId: number, nombreOriginal: string) {
  return `evoluciones/${consultorioId}/${evolucionId}/${nombreOriginal}`
}

// Upload directo navegador → Vercel Blob (nunca pasa el archivo por esta
// función): 1) el cliente pide un token por cada imagen acá, 2) sube cada
// una directo con su token, 3) confirma con /confirm para que queden
// guardadas las referencias.
router.post('/upload-tokens', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const evolucionId = Number(req.params.evolucionId)
  if (Number.isNaN(evolucionId)) return res.status(400).json({ error: 'invalid id' })

  const files = (req.body.files as Array<{ nombreOriginal?: string; mimeType?: string; sizeBytes?: number }> | undefined) ?? []
  if (files.length === 0) return res.status(400).json({ error: 'No se recibió ninguna imagen.' })
  for (const f of files) {
    if (!f.nombreOriginal || !f.mimeType) return res.status(400).json({ error: 'Faltan datos del archivo.' })
    if (!ALLOWED_MIME_TYPES.includes(f.mimeType)) return res.status(400).json({ error: 'Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.' })
    if (typeof f.sizeBytes === 'number' && f.sizeBytes > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: `Cada imagen debe pesar como máximo ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.` })
    }
  }

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

    const items = await Promise.all(files.map(async (f) => {
      const pathname = pathnameFor(consultorioId, evolucionId, withUniqueSuffix(f.nombreOriginal!))
      const { presignedUrl } = await issuePresignedUploadUrl(pathname, { allowedContentTypes: ALLOWED_MIME_TYPES, maximumSizeInBytes: MAX_FILE_SIZE_BYTES })
      return { presignedUrl, pathname }
    }))

    res.json({ items })
  } catch (err) {
    console.error('[blob] issue upload url failed', { resource: 'evolucion-imagenes', consultorioId, evolucionId, errorCode: err instanceof Error ? err.name : 'unknown', message: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'No se pudo iniciar la subida. Volvé a intentar.' })
  }
})

router.post('/confirm', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const evolucionId = Number(req.params.evolucionId)
  if (Number.isNaN(evolucionId)) return res.status(400).json({ error: 'invalid id' })

  const items = (req.body.items as Array<{ pathname?: string; nombreOriginal?: string; mimeType?: string; sizeBytes?: number }> | undefined) ?? []
  if (items.length === 0) return res.status(400).json({ error: 'No se recibió ninguna imagen.' })
  for (const item of items) {
    if (!item.pathname || !item.nombreOriginal || !item.mimeType) return res.status(400).json({ error: 'Faltan datos del archivo.' })
  }

  const propioProfesionalId = await requireProfesionalVinculado(req, res)
  if (propioProfesionalId === null) return

  try {
    const evolucion = await prisma.evolucion.findFirst({ where: { id: evolucionId, consultorioId, activo: true } })
    if (!evolucion) return res.status(404).json({ error: 'evolucion not found in consultorio' })

    if (req.usuario!.rol === RolUsuario.PROFESIONAL && evolucion.profesionalId !== propioProfesionalId) {
      return res.status(403).json({ error: 'No podés agregar imágenes a evoluciones de otro profesional' })
    }

    const expectedPrefix = pathnameFor(consultorioId, evolucionId, '')
    for (const item of items) {
      if (!String(item.pathname).startsWith(expectedPrefix)) return res.status(400).json({ error: 'pathname inválido' })
    }

    const yaTiene = await prisma.evolucionImagen.count({ where: { evolucionId } })
    if (yaTiene + items.length > MAX_IMAGES_PER_EVOLUCION) {
      return res.status(400).json({ error: `Esta evolución ya tiene ${yaTiene} imagen(es); como máximo puede tener ${MAX_IMAGES_PER_EVOLUCION}.` })
    }

    const subidas = await Promise.all(items.map((item) => prisma.evolucionImagen.create({
      data: {
        consultorioId,
        pacienteId: evolucion.pacienteId,
        evolucionId,
        pathname: String(item.pathname),
        nombreOriginal: String(item.nombreOriginal),
        mimeType: String(item.mimeType),
        sizeBytes: typeof item.sizeBytes === 'number' ? item.sizeBytes : 0,
      },
    })))

    res.status(201).json(subidas.map(imagenParaCliente))
  } catch (err) {
    console.error('failed to confirm evolucion imagenes upload', err)
    res.status(500).json({ error: 'No se pudieron guardar las imágenes. Volvé a intentar.' })
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

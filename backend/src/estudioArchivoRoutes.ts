import { Router } from 'express'
import prisma from './prisma'
import { CLINICAL_ROLES, requireProfesionalVinculado, requireRole } from './auth'
import { issueClientUploadToken, deleteFromBlob, streamBlobToResponse } from './blobStorage'
import { estudioParaCliente } from './estudioSerializer'

// Estudios no tenía antes ningún tipo de archivo soportado (la tab era
// puramente texto) — no hay un límite "actual" que respetar. Se toma un
// máximo razonable, más alto que el de imágenes de Evolución porque acá
// también se aceptan PDF (informes/estudios escaneados).
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

const router = Router({ mergeParams: true })

function pathnameFor(consultorioId: number, estudioId: number, nombreOriginal: string) {
  return `estudios/${consultorioId}/${estudioId}/${nombreOriginal}`
}

// Mismo criterio de permisos que PATCH/DELETE /api/ficha-estudios/:id: no
// hay restricción de "solo el propio profesional" (a diferencia de
// Evoluciones) — cualquier CLINICAL_ROLES vinculado a un profesional activo
// puede subir/reemplazar/borrar el archivo de cualquier estudio del
// consultorio.
//
// Upload directo navegador → Vercel Blob (nunca pasa el archivo por esta
// función): 1) el cliente pide un token acá, 2) sube directo con ese
// token, 3) confirma con /confirm para que quede guardada la referencia.
router.post('/upload-token', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const estudioId = Number(req.params.id)
  if (Number.isNaN(estudioId)) return res.status(400).json({ error: 'invalid id' })

  const { nombreOriginal, mimeType, sizeBytes } = req.body
  if (!nombreOriginal || !mimeType) return res.status(400).json({ error: 'Faltan datos del archivo.' })
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return res.status(400).json({ error: 'Formato no permitido. Solo se aceptan archivos PDF, JPG, PNG o WEBP.' })
  if (typeof sizeBytes === 'number' && sizeBytes > MAX_FILE_SIZE_BYTES) {
    return res.status(400).json({ error: `El archivo debe pesar como máximo ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.` })
  }

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  try {
    const estudio = await prisma.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } })
    if (!estudio) return res.status(404).json({ error: 'estudio not found in consultorio' })

    const pathname = pathnameFor(consultorioId, estudioId, String(nombreOriginal))
    const token = await issueClientUploadToken(pathname, { allowedContentTypes: ALLOWED_MIME_TYPES, maximumSizeInBytes: MAX_FILE_SIZE_BYTES })
    res.json({ token, pathname })
  } catch (err) {
    console.error('failed to issue estudio archivo upload token', err)
    res.status(500).json({ error: 'No se pudo iniciar la subida. Volvé a intentar.' })
  }
})

router.post('/confirm', requireRole(...CLINICAL_ROLES), async (req, res) => {
  const consultorioId = req.usuario!.consultorioId
  const estudioId = Number(req.params.id)
  if (Number.isNaN(estudioId)) return res.status(400).json({ error: 'invalid id' })

  const { pathname, nombreOriginal, mimeType, sizeBytes } = req.body
  if (!pathname || !nombreOriginal || !mimeType) return res.status(400).json({ error: 'Faltan datos del archivo.' })

  const autorProfesionalId = await requireProfesionalVinculado(req, res)
  if (autorProfesionalId === null) return

  try {
    const estudio = await prisma.fichaEstudioComplementario.findFirst({ where: { id: estudioId, consultorioId } })
    if (!estudio) return res.status(404).json({ error: 'estudio not found in consultorio' })

    const expectedPrefix = pathnameFor(consultorioId, estudioId, '')
    if (!String(pathname).startsWith(expectedPrefix)) return res.status(400).json({ error: 'pathname inválido' })

    if (estudio.archivoPathname) await deleteFromBlob(estudio.archivoPathname)

    const updated = await prisma.fichaEstudioComplementario.update({
      where: { id: estudioId },
      data: {
        archivoPathname: String(pathname),
        archivoNombreOriginal: String(nombreOriginal),
        archivoMimeType: String(mimeType),
        archivoSizeBytes: typeof sizeBytes === 'number' ? sizeBytes : null,
      },
      include: { profesional: true },
    })
    res.status(201).json(estudioParaCliente(updated))
  } catch (err) {
    console.error('failed to confirm estudio archivo upload', err)
    res.status(500).json({ error: 'No se pudo guardar el archivo. Volvé a intentar.' })
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

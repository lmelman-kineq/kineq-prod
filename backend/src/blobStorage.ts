import type { Response } from 'express'
import { Readable } from 'stream'
import { randomUUID } from 'crypto'
import { del, get, issueSignedToken, presignUrl } from '@vercel/blob'

// Una URL presignada de `put` apunta a un pathname exacto y fijo (a
// diferencia del viejo client token, acá no hay `addRandomSuffix` de Vercel
// para evitar colisiones) — cada ruta de upload arma su propio pathname con
// esto para no pisar un archivo existente (ej. subir dos fotos con el mismo
// nombre de archivo original). Va antes del nombre original, nunca lo
// reemplaza, para que el pathname siga siendo legible al inspeccionar el
// store manualmente.
export function withUniqueSuffix(nombreOriginal: string): string {
  return `${randomUUID()}-${nombreOriginal}`
}

// Capa compartida sobre Vercel Blob para las 4 superficies de archivos
// (imágenes de Evolución, archivo de Estudio, foto de Usuario, foto de
// Paciente) — nunca se llama a `put`/`del`/`get`/`issueSignedToken`/
// `presignUrl` directamente desde una ruta, siempre a través de acá.
//
// Autenticación: OIDC del deployment, no un `BLOB_READ_WRITE_TOKEN`
// estático. Conectar un store a un proyecto en Vercel agrega automáticamente
// `BLOB_READ_WRITE_TOKEN_STORE_ID` (el store id) y, en runtime dentro de
// Vercel, cada invocación ya trae `VERCEL_OIDC_TOKEN` sin configuración
// manual — el SDK lo usa solo si se le pasa explícitamente `storeId`
// (nunca implícito). Con eso alcanza: no hace falta generar, rotar ni
// versionar ningún secreto de Blob a mano. `BLOB_READ_WRITE_TOKEN` nunca se
// leyó desde código en este proyecto (confirmado: no había ninguna
// referencia a `process.env.BLOB_READ_WRITE_TOKEN` fuera de esta capa) y
// tampoco estaba configurado en ningún ambiente — esa era la causa real de
// que los uploads siguieran fallando aunque el store ya estuviera conectado.
function getBlobStoreId(): string {
  const storeId = process.env.BLOB_READ_WRITE_TOKEN_STORE_ID
  if (!storeId) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN_STORE_ID no está configurada — conectá el store de Vercel Blob al proyecto (Storage → conectar a kineq-api) para que Vercel la agregue automáticamente.',
    )
  }
  return storeId
}

// Emite una URL de subida (`PUT`) firmada y acotada a un único `pathname`
// exacto — nunca a "cualquier lugar del store". Reemplaza al viejo flujo de
// `generateClientTokenFromReadWriteToken` (client token): mismo objetivo
// (el navegador sube directo a Blob, nunca por esta función Serverless),
// pero con `issueSignedToken` + `presignUrl`, el mecanismo vigente para
// Private Blob + OIDC. Ventaja concreta sobre el flujo viejo: acá `access`
// SÍ es un parámetro explícito de `presignUrl` — a diferencia del client
// token, cuyo tipo no tenía forma de forzar `private` del lado del
// servidor (quedaba como una nota de seguridad sin verificar). Acá el nivel
// de acceso queda firmado en la URL misma, no es una convención del
// navegador.
export async function issuePresignedUploadUrl(
  pathname: string,
  opts: { allowedContentTypes: string[]; maximumSizeInBytes: number },
): Promise<{ presignedUrl: string }> {
  const storeId = getBlobStoreId()
  const validUntil = Date.now() + 10 * 60 * 1000 // 10 minutos — alcanza de sobra para subir un solo archivo, nunca queda una URL de escritura viva más de lo necesario.

  const signedToken = await issueSignedToken({
    storeId,
    pathname,
    operations: ['put'],
    allowedContentTypes: opts.allowedContentTypes,
    maximumSizeInBytes: opts.maximumSizeInBytes,
    validUntil,
  })

  const { presignedUrl } = await presignUrl(signedToken, {
    operation: 'put',
    pathname,
    access: 'private',
    allowedContentTypes: opts.allowedContentTypes,
    maximumSizeInBytes: opts.maximumSizeInBytes,
    // El pathname ya viene armado con su propia unicidad (ver `withUniqueSuffix`
    // en cada ruta de upload) — sin esto, una URL presignada de PUT apunta a
    // un pathname exacto y fijo, así que la unicidad tiene que decidirse acá
    // antes de firmar, no puede delegarse a Vercel como con el `put()` del
    // client token viejo.
    addRandomSuffix: false,
  })

  return { presignedUrl }
}

export async function deleteFromBlob(pathname: string): Promise<void> {
  try {
    await del(pathname, { storeId: getBlobStoreId() })
  } catch (err) {
    // Si el blob ya no existe o el borrado falla, igual dejamos que el
    // caller borre la referencia en la base — no queremos un archivo
    // "atascado" por un error transitorio del storage.
    console.error('[blob] delete failed', { pathname, errorCode: err instanceof Error ? err.name : 'unknown' })
  }
}

// Sirve el contenido de un blob privado a través de nuestro propio backend
// — el único punto donde `get()` se usa. El caller ya validó permisos antes
// de llegar acá.
export async function streamBlobToResponse(pathname: string, res: Response, mimeType: string, downloadName?: string): Promise<void> {
  const result = await get(pathname, { access: 'private', storeId: getBlobStoreId() })
  if (!result || result.statusCode !== 200) {
    res.status(404).json({ error: 'archivo no encontrado' })
    return
  }
  res.setHeader('Content-Type', mimeType)
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
  if (downloadName) res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`)
  Readable.fromWeb(result.stream as unknown as import('stream/web').ReadableStream<Uint8Array>).pipe(res)
}

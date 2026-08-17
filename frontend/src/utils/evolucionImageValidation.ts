export const MAX_EVOLUCION_IMAGES = 5
export const MAX_EVOLUCION_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type FileLike = { type: string; size: number }

// Mismos límites que valida el backend (ver evolucionImagenesRoutes.ts) —
// esto solo adelanta el error en el navegador; el backend nunca confía en
// que el cliente ya validó.
export function validateNewEvolucionImages(existingCount: number, files: FileLike[]): string | null {
  if (existingCount + files.length > MAX_EVOLUCION_IMAGES) {
    return `Como máximo se pueden adjuntar ${MAX_EVOLUCION_IMAGES} imágenes.`
  }
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Solo se aceptan imágenes JPG, PNG o WEBP.'
    }
    if (file.size > MAX_EVOLUCION_IMAGE_SIZE_BYTES) {
      return `Cada imagen debe pesar como máximo ${MAX_EVOLUCION_IMAGE_SIZE_BYTES / (1024 * 1024)}MB.`
    }
  }
  return null
}

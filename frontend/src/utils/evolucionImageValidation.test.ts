import { describe, it, expect } from 'vitest'
import { validateNewEvolucionImages, MAX_EVOLUCION_IMAGES, MAX_EVOLUCION_IMAGE_SIZE_BYTES } from './evolucionImageValidation'

describe('validateNewEvolucionImages', () => {
  it('acepta imágenes válidas dentro del límite', () => {
    expect(validateNewEvolucionImages(0, [{ type: 'image/jpeg', size: 1024 }])).toBeNull()
  })

  it('rechaza superar el máximo de imágenes (sumando las ya existentes)', () => {
    const files = Array.from({ length: 3 }, () => ({ type: 'image/png', size: 1024 }))
    expect(validateNewEvolucionImages(MAX_EVOLUCION_IMAGES - 2, files)).toMatch(/máximo/)
  })

  it('rechaza un tipo de archivo no permitido', () => {
    expect(validateNewEvolucionImages(0, [{ type: 'application/pdf', size: 1024 }])).toMatch(/JPG, PNG o WEBP/)
  })

  it('rechaza un archivo que supera el tamaño máximo', () => {
    expect(validateNewEvolucionImages(0, [{ type: 'image/webp', size: MAX_EVOLUCION_IMAGE_SIZE_BYTES + 1 }])).toMatch(/10MB/)
  })

  it('acepta un archivo exactamente en el límite de tamaño', () => {
    expect(validateNewEvolucionImages(0, [{ type: 'image/webp', size: MAX_EVOLUCION_IMAGE_SIZE_BYTES }])).toBeNull()
  })
})

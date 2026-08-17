import { useEffect, useRef, useState } from 'react'
import { MAX_EVOLUCION_IMAGES, validateNewEvolucionImages } from '../utils/evolucionImageValidation'

export type EvolucionImageItem = { key: string; url: string; name: string }

type EvolucionImagesProps = {
  items: EvolucionImageItem[]
  // Sin onAdd: solo lectura (evolución histórica ya guardada, sin permiso de edición).
  onAdd?: (files: File[]) => void
  onRemove?: (key: string) => void
  disabled?: boolean
  error?: string | null
}

export default function EvolucionImages({ items, onAdd, onRemove, disabled, error }: EvolucionImagesProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [lightboxKey, setLightboxKey] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)

  useEffect(() => {
    if (!lightboxKey) return undefined
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxKey(null)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [lightboxKey])

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || !onAdd) return
    const files = Array.from(fileList)
    const validationError = validateNewEvolucionImages(items.length, files)
    setPickError(validationError)
    if (validationError) return
    onAdd(files)
  }

  const lightboxItem = items.find((item) => item.key === lightboxKey) ?? null

  return (
    <div className="evolucion-images">
      <div className="evolucion-images-grid">
        {items.map((item) => (
          <div key={item.key} className="evolucion-image-thumb">
            <button
              type="button"
              className="evolucion-image-thumb-open"
              onClick={() => setLightboxKey(item.key)}
              aria-label={`Ver imagen ${item.name}`}
            >
              <img src={item.url} alt={item.name} />
            </button>
            {onRemove ? (
              <button
                type="button"
                className="evolucion-image-thumb-remove"
                aria-label={`Quitar imagen ${item.name}`}
                title="Quitar imagen"
                onClick={() => onRemove(item.key)}
                disabled={disabled}
              >
                &times;
              </button>
            ) : null}
          </div>
        ))}
        {onAdd && items.length < MAX_EVOLUCION_IMAGES ? (
          <button type="button" className="evolucion-image-add" onClick={() => inputRef.current?.click()} disabled={disabled}>
            + Imagen
          </button>
        ) : null}
      </div>

      {onAdd ? (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      ) : null}

      {pickError || error ? <p className="evolution-form-error">{pickError || error}</p> : null}

      {lightboxItem ? (
        <div className="evolucion-image-lightbox" role="dialog" aria-modal="true" onClick={() => setLightboxKey(null)}>
          <button
            type="button"
            className="close-button evolucion-image-lightbox-close"
            aria-label="Cerrar"
            onClick={() => setLightboxKey(null)}
          >
            &times;
          </button>
          <img src={lightboxItem.url} alt={lightboxItem.name} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  )
}

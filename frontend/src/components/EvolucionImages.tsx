import { useEffect, useRef, useState } from 'react'
import { MAX_EVOLUCION_IMAGES, validateNewEvolucionImages } from '../utils/evolucionImageValidation'
import AuthorizedImg from './AuthorizedImg'

export type EvolucionImageItem = { key: string; url: string; name: string }

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

type EvolucionImagesProps = {
  items: EvolucionImageItem[]
  // Sin onAdd: solo lectura (evolución histórica ya guardada, sin permiso de edición).
  onAdd?: (files: File[]) => void
  onRemove?: (key: string) => void
  disabled?: boolean
  uploading?: boolean
  error?: string | null
}

// Campo "Archivos" — mismo look que un `.dropdown-field` (label arriba,
// control abajo) para poder ir en la misma fila que Diagnóstico
// (`.evolution-form-fields-row` en PatientDetailPage.tsx/EvolutionTable.tsx).
// El botón de subida es una acción con label + ícono, no un cuadrado
// placeholder — las miniaturas aparecen debajo recién cuando hay algo
// seleccionado/subido.
export default function EvolucionImages({ items, onAdd, onRemove, disabled, uploading, error }: EvolucionImagesProps) {
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
    <div className="evolucion-images dropdown-field">
      {onAdd ? (
        <>
          <span className="dropdown-field-label">Archivos</span>
          <button
            type="button"
            className="secondary-button evolucion-images-upload-button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || items.length >= MAX_EVOLUCION_IMAGES}
          >
            <UploadIcon />
            {uploading ? 'Subiendo...' : items.length ? 'Agregar imagen' : 'Subir imágenes'}
          </button>
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
        </>
      ) : null}

      {items.length > 0 ? (
        <div className="evolucion-images-grid">
          {items.map((item) => (
            <div key={item.key} className="evolucion-image-thumb">
              <button
                type="button"
                className="evolucion-image-thumb-open"
                onClick={() => setLightboxKey(item.key)}
                aria-label={`Ver imagen ${item.name}`}
                title={item.name}
              >
                <AuthorizedImg src={item.url} alt={item.name} />
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
        </div>
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
          <AuthorizedImg src={lightboxItem.url} alt={lightboxItem.name} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  )
}

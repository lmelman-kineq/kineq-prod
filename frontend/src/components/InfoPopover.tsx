import { useEffect, useRef, useState } from 'react'

type InfoPopoverProps = {
  /** Texto de ayuda que se muestra al abrir. */
  text: string
  /** Nombre accesible del botón, ej. "Qué es Comienzo de módulo". */
  label: string
}

/**
 * Ícono "i" que abre un globo chico con una ayuda — para explicar un campo
 * sin ocupar lugar fijo en el formulario. Se abre/cierra con click y se
 * cierra con click afuera o Escape.
 */
export default function InfoPopover({ text, label }: InfoPopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <span className="info-popover" ref={rootRef}>
      <button
        type="button"
        className="info-popover-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
      </button>
      {open ? <span className="info-popover-bubble" role="tooltip">{text}</span> : null}
    </span>
  )
}

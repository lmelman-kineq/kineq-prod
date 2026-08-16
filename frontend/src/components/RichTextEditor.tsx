import { useEffect, useRef } from 'react'
import { sanitizeRichTextHtml } from '../utils/richTextSanitize'

type Props = {
  id?: string
  html: string
  onChange: (html: string, plainText: string) => void
  placeholder?: string
  disabled?: boolean
}

// Editor mínimo de formato básico (negrita/cursiva/subrayado) sobre un
// `contentEditable` + `document.execCommand` — deprecado pero todavía
// soportado en todos los navegadores evergreen para este uso puntual, y
// evita meter una dependencia de RTE completa para 3 botones.
export default function RichTextEditor({ id, html, onChange, placeholder, disabled }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const focusedRef = useRef(false)

  // Sincroniza el HTML externo solo cuando el usuario no está escribiendo
  // ahí en ese momento — mismo principio que el fix de autosave de Ficha
  // Inicial: nunca pisar una edición local en curso.
  useEffect(() => {
    if (!ref.current || focusedRef.current) return
    if (ref.current.innerHTML !== html) ref.current.innerHTML = html
  }, [html])

  const emitChange = () => {
    const el = ref.current
    if (!el) return
    const sanitized = sanitizeRichTextHtml(el.innerHTML)
    if (sanitized !== el.innerHTML) el.innerHTML = sanitized
    onChange(sanitized, el.textContent ?? '')
  }

  const exec = (command: 'bold' | 'italic' | 'underline') => {
    if (disabled) return
    ref.current?.focus()
    document.execCommand(command)
    emitChange()
  }

  return (
    <div className={`rich-text-editor${disabled ? ' rich-text-editor--disabled' : ''}`}>
      <div className="rich-text-toolbar" role="toolbar" aria-label="Formato de texto">
        <button type="button" aria-label="Negrita" title="Negrita (Ctrl+B)" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}>
          <strong>B</strong>
        </button>
        <button type="button" aria-label="Cursiva" title="Cursiva (Ctrl+I)" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}>
          <em>I</em>
        </button>
        <button type="button" aria-label="Subrayado" title="Subrayado (Ctrl+U)" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}>
          <u>U</u>
        </button>
      </div>
      <div
        id={id}
        ref={ref}
        className="rich-text-content"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        onInput={emitChange}
        onFocus={() => {
          focusedRef.current = true
          // Enter → <p> (permitido) en vez de <div> (Chrome default, se
          // descarta al sanitizar y se perdería el salto de línea).
          document.execCommand('defaultParagraphSeparator', false, 'p')
        }}
        onBlur={() => {
          focusedRef.current = false
          emitChange()
        }}
        onKeyDown={(event) => {
          const mod = event.ctrlKey || event.metaKey
          if (!mod) return
          const key = event.key.toLowerCase()
          if (key === 'b') { event.preventDefault(); exec('bold') }
          else if (key === 'i') { event.preventDefault(); exec('italic') }
          else if (key === 'u') { event.preventDefault(); exec('underline') }
        }}
      />
    </div>
  )
}

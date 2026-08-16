import { useRef, useState, type SVGProps } from 'react'
import { formatDisplayDate, parseDisplayDate } from '../utils/dateFormat'

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M3.5 10h17" />
    </svg>
  )
}

type DateInputProps = {
  id?: string
  value: string | null | undefined
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  className?: string
}

/**
 * Campo de fecha tipeable (`dd/mm/aaaa`), con un date picker nativo oculto
 * disparado por el ícono de calendario para quien prefiera elegir la fecha
 * visualmente. Ambos caminos escriben/leen el mismo valor `YYYY-MM-DD`
 * (mismo contrato que ya usaban los `<input type="date">` que reemplaza).
 */
export default function DateInput({ id, value, onChange, required, disabled, min, max, className }: DateInputProps) {
  const [text, setText] = useState(() => formatDisplayDate(value))
  const [lastSyncedValue, setLastSyncedValue] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const pickerRef = useRef<HTMLInputElement | null>(null)

  // Sincroniza el texto visible con `value` cuando cambia desde afuera
  // (reset del formulario, selección por el picker), pero nunca mientras
  // se está tipeando — ajustar estado durante el render en vez de en un
  // efecto evita un re-render extra después del commit.
  if (!focused && value !== lastSyncedValue) {
    setLastSyncedValue(value)
    setText(formatDisplayDate(value))
  }

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setError(null)
      onChange('')
      return
    }
    const parsed = parseDisplayDate(trimmed)
    if (!parsed) {
      setError('Fecha inválida. Usá el formato dd/mm/aaaa.')
      return
    }
    setError(null)
    setText(formatDisplayDate(parsed))
    onChange(parsed)
  }

  const openPicker = () => {
    const input = pickerRef.current
    if (!input || disabled) return
    if (typeof input.showPicker === 'function') input.showPicker()
    else input.focus()
  }

  return (
    <div className={`date-input${className ? ` ${className}` : ''}`}>
      <div className="date-input-row">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          className="date-input-text"
          value={text}
          disabled={disabled}
          required={required}
          onFocus={() => setFocused(true)}
          onChange={(event) => setText(event.target.value)}
          onBlur={(event) => {
            setFocused(false)
            commit(event.target.value)
          }}
        />
        <button
          type="button"
          className="date-input-picker-button"
          aria-label="Abrir calendario"
          title="Abrir calendario"
          disabled={disabled}
          onClick={openPicker}
        >
          <CalendarIcon />
        </button>
        <input
          ref={pickerRef}
          type="date"
          className="date-input-native"
          tabIndex={-1}
          aria-hidden="true"
          value={value ?? ''}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => {
            const nextValue = event.target.value
            setError(null)
            setText(formatDisplayDate(nextValue))
            onChange(nextValue)
          }}
        />
      </div>
      {error ? <p className="date-input-error">{error}</p> : null}
    </div>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { loadGoogleMapsPlaces } from '../utils/googleMaps'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
const DEBOUNCE_MS = 300
const MIN_CHARS = 3

type AddressAutocompleteInputProps = {
  value: string
  onChange: (value: string) => void
}

/**
 * Dirección con sugerencias de Google Places (API nueva,
 * `AutocompleteSuggestion`), restringidas a Argentina, en un dropdown propio
 * con el mismo look que el resto de los combos (`.dropdown-list`). Se usa el
 * texto de la sugerencia tal cual (sin pedir Place Details, que se cobra
 * aparte). Sin `VITE_GOOGLE_MAPS_API_KEY`, o si Google falla (key inválida,
 * dominio no autorizado), queda como un input de texto plano.
 */
export default function AddressAutocompleteInput({ value, onChange }: AddressAutocompleteInputProps) {
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(-1)
  const listId = useId()
  // Solo se buscan sugerencias cuando el cambio vino de tipear (no al
  // abrir el formulario con una dirección ya cargada, ni al elegir una).
  const tipeadoRef = useRef(false)

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !tipeadoRef.current) return
    const texto = value.trim()
    if (texto.length < MIN_CHARS) return

    let cancelado = false
    const timer = window.setTimeout(() => {
      loadGoogleMapsPlaces(GOOGLE_MAPS_API_KEY)
        .then(({ AutocompleteSuggestion }) =>
          AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: texto, includedRegionCodes: ['ar'], language: 'es' }),
        )
        .then(({ suggestions }) => {
          if (cancelado) return
          setSugerencias(suggestions.flatMap((s) => (s.placePrediction ? [s.placePrediction.text.toString()] : [])))
          setActiva(-1)
          setAbierto(true)
        })
        .catch(() => {
          // Sin Google (key/dominio/red): el campo sigue como texto libre.
          if (!cancelado) setSugerencias([])
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelado = true
      window.clearTimeout(timer)
    }
  }, [value])

  const elegir = (direccion: string) => {
    tipeadoRef.current = false
    onChange(direccion)
    setAbierto(false)
    setSugerencias([])
  }

  // Con menos de MIN_CHARS no se busca: se ocultan las sugerencias viejas.
  const visible = abierto && sugerencias.length > 0 && value.trim().length >= MIN_CHARS

  return (
    <div className="address-autocomplete">
      <input
        type="text"
        value={value}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={GOOGLE_MAPS_API_KEY ? 'Empezá a escribir para buscar la dirección...' : undefined}
        onChange={(event) => {
          tipeadoRef.current = true
          onChange(event.target.value)
        }}
        onBlur={() => setAbierto(false)}
        onFocus={() => { if (sugerencias.length) setAbierto(true) }}
        onKeyDown={(event) => {
          if (!visible) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const paso = event.key === 'ArrowDown' ? 1 : -1
            setActiva((i) => (i + paso + sugerencias.length) % sugerencias.length)
          } else if (event.key === 'Enter' && activa >= 0) {
            event.preventDefault()
            elegir(sugerencias[activa])
          } else if (event.key === 'Escape') {
            setAbierto(false)
          }
        }}
      />
      {visible ? (
        <div className="dropdown-list dropdown-list--anchored address-autocomplete-list" id={listId} role="listbox">
          {sugerencias.map((direccion, index) => (
            <button
              key={direccion}
              type="button"
              role="option"
              aria-selected={index === activa}
              className={index === activa ? 'dropdown-option--selected' : undefined}
              // mousedown + preventDefault: elige antes de que el blur del
              // input cierre la lista.
              onMouseDown={(event) => {
                event.preventDefault()
                elegir(direccion)
              }}
            >
              {direccion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

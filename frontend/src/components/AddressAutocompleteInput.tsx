import { useEffect, useRef } from 'react'
import { loadGoogleMapsPlaces } from '../utils/googleMaps'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

type AddressAutocompleteInputProps = {
  value: string
  onChange: (value: string) => void
}

/**
 * Sin `VITE_GOOGLE_MAPS_API_KEY` configurada, se comporta como un input de
 * texto plano — no rompe entornos sin la key de Google Maps Platform.
 */
export default function AddressAutocompleteInput({ value, onChange }: AddressAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !inputRef.current) return

    let autocomplete: google.maps.places.Autocomplete | null = null
    let cancelled = false

    loadGoogleMapsPlaces(GOOGLE_MAPS_API_KEY)
      .then((google) => {
        if (cancelled || !inputRef.current) return
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address'],
          types: ['address'],
        })
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete?.getPlace()
          if (place?.formatted_address) onChangeRef.current(place.formatted_address)
        })
      })
      .catch(() => {
        // Sin conexión a Google Maps: el campo sigue funcionando como texto libre.
      })

    return () => {
      cancelled = true
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete)
    }
  }, [])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      placeholder={GOOGLE_MAPS_API_KEY ? 'Empezá a escribir para buscar la dirección...' : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

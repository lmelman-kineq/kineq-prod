import { useEffect, useState } from 'react'

// Feriados nacionales de Argentina (inamovibles, trasladables y puentes
// turísticos) desde ArgentinaDatos — API pública, sin key, con CORS
// abierto, que se actualiza cada año con los decretos oficiales. Se pide
// por año a demanda, así que años futuros aparecen solos apenas la API los
// publica (sin listas hardcodeadas que haya que mantener). Si la API no
// responde, el calendario funciona igual, solo sin marcar feriados.
const FERIADOS_API_URL = 'https://api.argentinadatos.com/v1/feriados'

type FeriadoApi = { fecha: string; nombre: string }

// Una promesa por año, compartida por todas las vistas durante la sesión.
const porAnio = new Map<number, Promise<FeriadoApi[]>>()

function fetchFeriadosAnio(anio: number): Promise<FeriadoApi[]> {
  let promise = porAnio.get(anio)
  if (!promise) {
    promise = fetch(`${FERIADOS_API_URL}/${anio}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => (Array.isArray(data) ? (data as FeriadoApi[]) : []))
      .catch(() => {
        porAnio.delete(anio) // reintenta en el próximo render que lo pida
        return []
      })
    porAnio.set(anio, promise)
  }
  return promise
}

/**
 * Feriados (fecha `YYYY-MM-DD` → nombre) del año de `fecha` y de los años
 * vecinos — una semana o grilla de mes puede cruzar fin/principio de año.
 */
export function useFeriados(fecha: string): Map<string, string> {
  const anio = Number(fecha.slice(0, 4))
  const [feriados, setFeriados] = useState<Map<string, string>>(() => new Map())

  useEffect(() => {
    let cancelled = false
    Promise.all([anio - 1, anio, anio + 1].map(fetchFeriadosAnio)).then((listas) => {
      if (cancelled) return
      const map = new Map<string, string>()
      for (const feriado of listas.flat()) {
        // Dos feriados el mismo día (pasa): se muestran juntos.
        const previo = map.get(feriado.fecha)
        map.set(feriado.fecha, previo ? `${previo} / ${feriado.nombre}` : feriado.nombre)
      }
      setFeriados(map)
    })
    return () => { cancelled = true }
  }, [anio])

  return feriados
}

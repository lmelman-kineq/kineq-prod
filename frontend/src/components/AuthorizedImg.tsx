import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { fetchAuthorizedBlob } from '../services/api'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string }

// `src` puede ser un object URL local (`blob:`, imagen todavía sin subir —
// ver EvolucionImages.tsx) o una ruta del backend que sirve un archivo
// privado de Vercel Blob (imágenes de Evolución, foto de Usuario/Paciente).
// En el segundo caso, un <img src=...> directo no funciona: el archivo
// requiere la misma sesión (cookies) que el resto de la app, así que se pide
// con fetch(credentials:'include') y se arma un object URL propio — mismo
// mecanismo que ya usa services/api.ts para todo lo demás.
export default function AuthorizedImg({ src, alt, ...rest }: Props) {
  const isLocal = src.startsWith('blob:') || src.startsWith('data:')
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (isLocal) return undefined
    let cancelled = false
    let objectUrl: string | null = null
    fetchAuthorizedBlob(src)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setFetchedUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFetchedUrl(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, isLocal])

  const resolvedUrl = isLocal ? src : fetchedUrl
  if (!resolvedUrl) return <div className={`authorized-img-placeholder ${rest.className ?? ''}`} aria-hidden="true" />
  return <img src={resolvedUrl} alt={alt} {...rest} />
}

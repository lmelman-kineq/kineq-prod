import { sanitizeRichTextHtml } from '../utils/richTextSanitize'
import type { Evolucion } from '../types/domain'
import EvolucionImages from './EvolucionImages'

type Props = {
  evolucion: Pick<Evolucion, 'contenido' | 'contenidoHtml' | 'imagenes'>
}

// Vista de solo lectura del contenido completo de una evolución (detalle
// expandido). Si tiene formato (contenidoHtml), se sanitiza de nuevo acá
// antes de inyectarlo — defensa en profundidad, nunca confiar en que ya
// vino sanitizado del backend. Evoluciones sin formato (todas las
// anteriores a esta función) siguen mostrando texto plano, sin cambios.
export default function EvolucionContent({ evolucion }: Props) {
  return (
    <>
      {evolucion.contenidoHtml ? (
        <div
          className="evolution-item-preview evolution-rich-content"
          dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(evolucion.contenidoHtml) }}
        />
      ) : (
        <p className="evolution-item-preview">{evolucion.contenido}</p>
      )}
      {evolucion.imagenes?.length ? (
        <EvolucionImages items={evolucion.imagenes.map((img) => ({ key: String(img.id), url: img.url, name: img.nombreOriginal }))} />
      ) : null}
    </>
  )
}

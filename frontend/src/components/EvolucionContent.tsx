import { sanitizeRichTextHtml } from '../utils/richTextSanitize'
import type { Evolucion } from '../types/domain'

type Props = {
  evolucion: Pick<Evolucion, 'contenido' | 'contenidoHtml'>
}

// Vista de solo lectura del contenido completo de una evolución (detalle
// expandido). Si tiene formato (contenidoHtml), se sanitiza de nuevo acá
// antes de inyectarlo — defensa en profundidad, nunca confiar en que ya
// vino sanitizado del backend. Evoluciones sin formato (todas las
// anteriores a esta función) siguen mostrando texto plano, sin cambios.
export default function EvolucionContent({ evolucion }: Props) {
  if (evolucion.contenidoHtml) {
    return (
      <div
        className="evolution-item-preview evolution-rich-content"
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(evolucion.contenidoHtml) }}
      />
    )
  }
  return <p className="evolution-item-preview">{evolucion.contenido}</p>
}

import { sanitizeRichTextHtml } from '../utils/richTextSanitize'
import type { Evolucion } from '../types/domain'
import EvolucionImages from './EvolucionImages'
import { GrupoChip } from './EvolutionTable'

type Props = {
  evolucion: Pick<Evolucion, 'contenido' | 'contenidoHtml' | 'imagenes' | 'grupo'>
  // La card colapsada de EvolutionTable.tsx en mobile ya muestra el chip de
  // Diagnóstico (columna propia) — al expandir ahí, se omite acá para no
  // duplicarlo. Desktop (la fila normal no tiene esa columna visible al
  // expandir) sigue mostrándolo, default `true`.
  showDiagnostico?: boolean
}

// Vista de solo lectura del contenido completo de una evolución (detalle
// expandido, fila colapsada de EvolutionTable.tsx ya muestra fecha/
// profesional). Si tiene formato (contenidoHtml), se sanitiza de nuevo acá
// antes de inyectarlo — defensa en profundidad, nunca confiar en que ya
// vino sanitizado del backend. Evoluciones sin formato (todas las
// anteriores a esta función) siguen mostrando texto plano, sin cambios.
// Diagnóstico/Archivos solo se muestran si hay algo que mostrar — nunca un
// bloque vacío.
export default function EvolucionContent({ evolucion, showDiagnostico = true }: Props) {
  return (
    <>
      {showDiagnostico && evolucion.grupo ? (
        <div className="evolution-item-diagnostico">
          <span className="details-label">Diagnóstico</span>
          <GrupoChip grupo={evolucion.grupo} />
        </div>
      ) : null}
      {evolucion.imagenes?.length ? (
        <div className="evolution-item-diagnostico">
          <span className="details-label">Archivos</span>
          <EvolucionImages items={evolucion.imagenes.map((img) => ({ key: String(img.id), url: img.url, name: img.nombreOriginal }))} />
        </div>
      ) : null}
      {evolucion.contenidoHtml ? (
        <div
          className="evolution-item-preview evolution-rich-content"
          dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(evolucion.contenidoHtml) }}
        />
      ) : (
        <p className="evolution-item-preview">{evolucion.contenido}</p>
      )}
    </>
  )
}

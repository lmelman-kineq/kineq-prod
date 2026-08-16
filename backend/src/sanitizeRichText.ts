import sanitizeHtml from 'sanitize-html'

// Formato básico permitido en Evoluciones: negrita, cursiva, subrayado y
// saltos de línea/párrafo — nada más. Nunca confiar solo en la
// sanitización del frontend (el cliente puede mandar cualquier cosa): esto
// es lo que realmente decide qué HTML queda persistido.
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'p', 'br']

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  })
}

// Texto plano derivado del HTML sanitizado, para `Evolucion.contenido`
// (búsqueda/compatibilidad con consumidores que todavía leen texto plano).
export function stripToPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim()
}

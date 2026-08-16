import DOMPurify from 'dompurify'

// Mismo allowlist que el backend (backend/src/sanitizeRichText.ts) — acá es
// solo la primera línea de defensa (evita que el propio usuario se
// autoinyecte algo raro tipeando/pegando HTML); el backend vuelve a
// sanitizar todo antes de persistir, nunca confía en esto.
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'p', 'br']

export function sanitizeRichTextHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] })
}

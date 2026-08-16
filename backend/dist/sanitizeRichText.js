"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeRichText = sanitizeRichText;
exports.stripToPlainText = stripToPlainText;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
// Formato básico permitido en Evoluciones: negrita, cursiva, subrayado y
// saltos de línea/párrafo — nada más. Nunca confiar solo en la
// sanitización del frontend (el cliente puede mandar cualquier cosa): esto
// es lo que realmente decide qué HTML queda persistido.
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'p', 'br'];
function sanitizeRichText(html) {
    return (0, sanitize_html_1.default)(html, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: {},
        disallowedTagsMode: 'discard',
    });
}
// Texto plano derivado del HTML sanitizado, para `Evolucion.contenido`
// (búsqueda/compatibilidad con consumidores que todavía leen texto plano).
function stripToPlainText(html) {
    return (0, sanitize_html_1.default)(html, { allowedTags: [], allowedAttributes: {} }).trim();
}
//# sourceMappingURL=sanitizeRichText.js.map
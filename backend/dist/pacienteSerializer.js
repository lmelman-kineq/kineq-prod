"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pacienteParaCliente = pacienteParaCliente;
// Mismo criterio que estudioSerializer.ts: el frontend nunca recibe
// `fotoPathname` (clave interna del blob privado), solo `fotoUrl` — la ruta
// propia que sirve el contenido tras validar consultorio (ver
// pacienteFotoRoutes.ts).
function pacienteParaCliente(paciente) {
    const { fotoPathname, fotoMimeType, ...rest } = paciente;
    return { ...rest, fotoUrl: fotoPathname ? `/api/pacientes/${paciente.id}/foto/contenido` : null };
}
//# sourceMappingURL=pacienteSerializer.js.map
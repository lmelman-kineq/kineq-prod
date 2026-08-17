"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_DATA_ROLES = exports.CLINICAL_ROLES = exports.MIN_PASSWORD_LENGTH = exports.COOKIE_NAME = void 0;
exports.normalizeEmail = normalizeEmail;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signSessionToken = signSessionToken;
exports.setSessionCookie = setSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
exports.findAuthUsuario = findAuthUsuario;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.puedeVerClinico = puedeVerClinico;
exports.requireProfesionalVinculado = requireProfesionalVinculado;
exports.quedariaSinAdministrador = quedariaSinAdministrador;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("./prisma"));
const client_1 = require("./generated/prisma/client");
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET no está definida en backend/.env');
}
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
exports.COOKIE_NAME = 'kineq_session';
exports.MIN_PASSWORD_LENGTH = 8;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function hashPassword(password) {
    return bcryptjs_1.default.hash(password, 12);
}
function verifyPassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
function signSessionToken(usuarioId) {
    return jsonwebtoken_1.default.sign({ usuarioId }, JWT_SECRET, {
        expiresIn: TOKEN_TTL_MS / 1000,
    });
}
function setSessionCookie(res, token) {
    res.cookie(exports.COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TOKEN_TTL_MS,
    });
}
function clearSessionCookie(res) {
    res.clearCookie(exports.COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
}
const USUARIO_SELECT = {
    id: true,
    nombre: true,
    apellido: true,
    email: true,
    rol: true,
    activo: true,
    consultorioId: true,
    profesionalId: true,
    fotoPathname: true,
};
function findAuthUsuario(usuarioId) {
    return prisma_1.default.usuario.findUnique({ where: { id: usuarioId }, select: USUARIO_SELECT });
}
/** Requiere sesión válida y usuario activo. Adjunta `req.usuario`. */
async function requireAuth(req, res, next) {
    const token = req.cookies?.[exports.COOKIE_NAME];
    if (!token) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        res.status(401).json({ error: 'Sesión inválida' });
        return;
    }
    // Se busca el usuario en cada request (en vez de confiar en el JWT) para
    // reflejar de inmediato una desactivación (`activo=false`) sin esperar
    // a que expire el token.
    const usuario = await findAuthUsuario(payload.usuarioId);
    if (!usuario || !usuario.activo) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }
    req.usuario = usuario;
    next();
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.usuario) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        if (!roles.includes(req.usuario.rol)) {
            res.status(403).json({ error: 'No autorizado' });
            return;
        }
        next();
    };
}
/** Fase 5 — alcance clínico centralizado: quién puede ver evoluciones/historia clínica. */
function puedeVerClinico(rol) {
    return rol === client_1.RolUsuario.ADMINISTRADOR || rol === client_1.RolUsuario.PROFESIONAL;
}
exports.CLINICAL_ROLES = Object.values(client_1.RolUsuario).filter(puedeVerClinico);
/** Datos administrativos del paciente y turnos: todos los roles autenticados del consultorio, nunca contenido clínico. */
exports.ADMIN_DATA_ROLES = Object.values(client_1.RolUsuario);
/**
 * El profesional vinculado al usuario autenticado. Toda escritura de
 * contenido clínico (evoluciones, ficha inicial, antecedentes, alergias,
 * medicación, estudios) pasa por acá — sin vínculo, 403, sin excepción para
 * Administrador: nadie se convierte implícitamente en autor clínico.
 *
 * También bloquea acá (no en cada ruta por separado) al profesional
 * vinculado que esté inactivo o archivado (`deletedAt`): un usuario
 * vinculado a un profesional dado de baja no puede seguir escribiendo
 * contenido clínico en su nombre, aunque su propia cuenta siga activa.
 */
async function requireProfesionalVinculado(req, res) {
    const profesionalId = req.usuario?.profesionalId;
    if (!profesionalId) {
        res.status(403).json({ error: 'Tu usuario no está vinculado a un profesional. Un administrador debe completar el vínculo para registrar información clínica.' });
        return null;
    }
    const profesional = await prisma_1.default.profesional.findUnique({ where: { id: profesionalId }, select: { activo: true, deletedAt: true } });
    if (!profesional || !profesional.activo || profesional.deletedAt) {
        res.status(403).json({ error: 'Tu usuario no está vinculado a un profesional activo. Un administrador debe completar el vínculo para registrar información clínica.' });
        return null;
    }
    return profesionalId;
}
/**
 * true si, sacando al usuario indicado, el consultorio se queda sin ningún
 * administrador activo. Se usa antes de degradar de rol o inactivar a un
 * administrador. Chequeo por conteo (no locking): ventana de carrera teórica
 * entre dos requests simultáneos degradando a dos admins distintos a la vez,
 * aceptada dado el volumen de uso esperado (un consultorio chico).
 */
async function quedariaSinAdministrador(consultorioId, usuarioIdExcluido) {
    const otrosAdministradoresActivos = await prisma_1.default.usuario.count({
        where: {
            consultorioId,
            rol: client_1.RolUsuario.ADMINISTRADOR,
            activo: true,
            id: { not: usuarioIdExcluido },
        },
    });
    return otrosAdministradoresActivos === 0;
}
//# sourceMappingURL=auth.js.map
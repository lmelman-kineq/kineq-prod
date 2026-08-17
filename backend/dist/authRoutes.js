"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const client_1 = require("./generated/prisma/client");
const auth_1 = require("./auth");
const router = (0, express_1.Router)();
function toPublicUsuario(usuario) {
    return {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
        consultorioId: usuario.consultorioId,
        profesionalId: usuario.profesionalId,
        fotoUrl: usuario.fotoPathname ? '/api/usuarios/me/foto/contenido' : null,
    };
}
// Crea un nuevo consultorio junto con su primer administrador.
// No acepta rol, consultorioId existente ni vínculo con un profesional:
// el registro público solo sirve para dar de alta un espacio de trabajo nuevo.
router.post('/register', async (req, res) => {
    const { nombreConsultorio, nombre, apellido, email, password, confirmPassword } = req.body;
    if (!nombreConsultorio || !nombre || !apellido || !email || !password) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }
    if (typeof password !== 'string' || password.length < auth_1.MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `La contraseña debe tener al menos ${auth_1.MIN_PASSWORD_LENGTH} caracteres` });
    }
    const normalizedEmail = (0, auth_1.normalizeEmail)(String(email));
    const slug = `consultorio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
        const passwordHash = await (0, auth_1.hashPassword)(password);
        const usuario = await prisma_1.default.$transaction(async (tx) => {
            const consultorio = await tx.consultorio.create({
                data: { nombre: nombreConsultorio, slug },
            });
            return tx.usuario.create({
                data: {
                    consultorioId: consultorio.id,
                    nombre,
                    apellido,
                    email: normalizedEmail,
                    passwordHash,
                    rol: client_1.RolUsuario.ADMINISTRADOR,
                },
            });
        });
        const token = (0, auth_1.signSessionToken)(usuario.id);
        (0, auth_1.setSessionCookie)(res, token);
        res.status(201).json(toPublicUsuario(usuario));
    }
    catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
            return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
        }
        res.status(500).json({ error: 'No se pudo completar el registro' });
    }
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    const normalizedEmail = (0, auth_1.normalizeEmail)(String(email));
    // Mensaje genérico en todos los casos de fallo para no revelar
    // si el email existe, si la contraseña es incorrecta, o si el
    // usuario está inactivo.
    const invalidCredentials = () => res.status(401).json({ error: 'Email o contraseña incorrectos' });
    const usuario = await prisma_1.default.usuario.findUnique({ where: { email: normalizedEmail } });
    if (!usuario || !usuario.activo)
        return invalidCredentials();
    const valid = await (0, auth_1.verifyPassword)(password, usuario.passwordHash);
    if (!valid)
        return invalidCredentials();
    const token = (0, auth_1.signSessionToken)(usuario.id);
    (0, auth_1.setSessionCookie)(res, token);
    res.json(toPublicUsuario(usuario));
});
router.post('/logout', (_req, res) => {
    (0, auth_1.clearSessionCookie)(res);
    res.status(204).end();
});
router.get('/me', auth_1.requireAuth, (req, res) => {
    res.json(toPublicUsuario(req.usuario));
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map
import { Router } from 'express'
import prisma from './prisma'
import { RolUsuario } from './generated/prisma/client'
import {
  MIN_PASSWORD_LENGTH,
  clearSessionCookie,
  hashPassword,
  normalizeEmail,
  requireAuth,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
} from './auth'

const router = Router()

function toPublicUsuario(usuario: {
  id: number
  nombre: string
  apellido: string
  email: string
  rol: RolUsuario
  consultorioId: number
  profesionalId: number | null
  fotoPathname?: string | null
}) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    rol: usuario.rol,
    consultorioId: usuario.consultorioId,
    profesionalId: usuario.profesionalId,
    fotoUrl: usuario.fotoPathname ? '/api/usuarios/me/foto/contenido' : null,
  }
}

// Crea un nuevo consultorio junto con su primer administrador.
// No acepta rol, consultorioId existente ni vínculo con un profesional:
// el registro público solo sirve para dar de alta un espacio de trabajo nuevo.
router.post('/register', async (req, res) => {
  const { nombreConsultorio, nombre, apellido, email, password, confirmPassword } = req.body

  // apellido no es requerido: el frontend manda el nombre completo en un solo
  // campo (`nombre`), mismo criterio que Paciente/Profesional/Usuario.
  if (!nombreConsultorio || !nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos requeridos' })
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' })
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` })
  }

  const normalizedEmail = normalizeEmail(String(email))
  const slug = `consultorio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  try {
    const passwordHash = await hashPassword(password)

    const usuario = await prisma.$transaction(async (tx) => {
      const consultorio = await tx.consultorio.create({
        data: { nombre: nombreConsultorio, slug },
      })

      return tx.usuario.create({
        data: {
          consultorioId: consultorio.id,
          nombre,
          apellido: apellido || '',
          email: normalizedEmail,
          passwordHash,
          rol: RolUsuario.ADMINISTRADOR,
        },
      })
    })

    const token = signSessionToken(usuario.id)
    setSessionCookie(res, token)
    res.status(201).json(toPublicUsuario(usuario))
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' })
    }
    res.status(500).json({ error: 'No se pudo completar el registro' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' })
  }

  const normalizedEmail = normalizeEmail(String(email))

  // Mensaje genérico en todos los casos de fallo para no revelar
  // si el email existe, si la contraseña es incorrecta, o si el
  // usuario está inactivo.
  const invalidCredentials = () => res.status(401).json({ error: 'Email o contraseña incorrectos' })

  const usuario = await prisma.usuario.findUnique({ where: { email: normalizedEmail } })
  if (!usuario || !usuario.activo) return invalidCredentials()

  const valid = await verifyPassword(password, usuario.passwordHash)
  if (!valid) return invalidCredentials()

  const token = signSessionToken(usuario.id)
  setSessionCookie(res, token)
  res.json(toPublicUsuario(usuario))
})

router.post('/logout', (_req, res) => {
  clearSessionCookie(res)
  res.status(204).end()
})

router.get('/me', requireAuth, (req, res) => {
  res.json(toPublicUsuario(req.usuario!))
})

export default router

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import prisma from './prisma'
import { RolUsuario } from './generated/prisma/client'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está definida en backend/.env')
}

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000 // 8 horas
export const COOKIE_NAME = 'kineq_session'
export const MIN_PASSWORD_LENGTH = 8

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

type TokenPayload = { usuarioId: number }

export function signSessionToken(usuarioId: number): string {
  return jwt.sign({ usuarioId } satisfies TokenPayload, JWT_SECRET as string, {
    expiresIn: TOKEN_TTL_MS / 1000,
  })
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_TTL_MS,
  })
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
}

export type AuthUsuario = {
  id: number
  nombre: string
  apellido: string
  email: string
  rol: RolUsuario
  activo: boolean
  consultorioId: number
  profesionalId: number | null
  fotoPathname: string | null
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
} as const

export function findAuthUsuario(usuarioId: number): Promise<AuthUsuario | null> {
  return prisma.usuario.findUnique({ where: { id: usuarioId }, select: USUARIO_SELECT })
}

/** Requiere sesión válida y usuario activo. Adjunta `req.usuario`. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }

  let payload: TokenPayload
  try {
    payload = jwt.verify(token, JWT_SECRET as string) as TokenPayload
  } catch {
    res.status(401).json({ error: 'Sesión inválida' })
    return
  }

  // Se busca el usuario en cada request (en vez de confiar en el JWT) para
  // reflejar de inmediato una desactivación (`activo=false`) sin esperar
  // a que expire el token.
  const usuario = await findAuthUsuario(payload.usuarioId)
  if (!usuario || !usuario.activo) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }

  req.usuario = usuario
  next()
}

export function requireRole(...roles: RolUsuario[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }
    if (!roles.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'No autorizado' })
      return
    }
    next()
  }
}

/** Fase 5 — alcance clínico centralizado: quién puede ver evoluciones/historia clínica. */
export function puedeVerClinico(rol: RolUsuario): boolean {
  return rol === RolUsuario.ADMINISTRADOR || rol === RolUsuario.PROFESIONAL
}

export const CLINICAL_ROLES = Object.values(RolUsuario).filter(puedeVerClinico)

/** Datos administrativos del paciente y turnos: todos los roles autenticados del consultorio, nunca contenido clínico. */
export const ADMIN_DATA_ROLES = Object.values(RolUsuario)

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
export async function requireProfesionalVinculado(req: Request, res: Response): Promise<number | null> {
  const profesionalId = req.usuario?.profesionalId
  if (!profesionalId) {
    res.status(403).json({ error: 'Tu usuario no está vinculado a un profesional. Un administrador debe completar el vínculo para registrar información clínica.' })
    return null
  }

  const profesional = await prisma.profesional.findUnique({ where: { id: profesionalId }, select: { activo: true, deletedAt: true } })
  if (!profesional || !profesional.activo || profesional.deletedAt) {
    res.status(403).json({ error: 'Tu usuario no está vinculado a un profesional activo. Un administrador debe completar el vínculo para registrar información clínica.' })
    return null
  }

  return profesionalId
}

/**
 * true si, sacando al usuario indicado, el consultorio se queda sin ningún
 * administrador activo. Se usa antes de degradar de rol o inactivar a un
 * administrador. Chequeo por conteo (no locking): ventana de carrera teórica
 * entre dos requests simultáneos degradando a dos admins distintos a la vez,
 * aceptada dado el volumen de uso esperado (un consultorio chico).
 */
export async function quedariaSinAdministrador(consultorioId: number, usuarioIdExcluido: number): Promise<boolean> {
  const otrosAdministradoresActivos = await prisma.usuario.count({
    where: {
      consultorioId,
      rol: RolUsuario.ADMINISTRADOR,
      activo: true,
      id: { not: usuarioIdExcluido },
    },
  })
  return otrosAdministradoresActivos === 0
}

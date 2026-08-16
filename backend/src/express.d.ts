import type { AuthUsuario } from './auth'

declare global {
  namespace Express {
    interface Request {
      usuario?: AuthUsuario
    }
  }
}

export {}

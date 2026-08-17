import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from '../services/api'
import { ApiError } from '../services/api'
import type { Usuario } from '../types/domain'
import { clearDataCache } from '../utils/dataCache'

type AuthContextValue = {
  user: Usuario | null
  loading: boolean
  /**
   * Cambia (se incrementa) cada vez que un login o registro exitoso deja al
   * usuario adentro de la app. `loading` solo cubre la restauración inicial
   * de sesión y no vuelve a activarse nunca, así que la pantalla de carga
   * posterior al login necesita esta señal aparte para saber cuándo
   * arrancar un nuevo ciclo.
   */
  loginBootTrigger: number
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /**
   * Vuelve a pedir `/auth/me`. Hace falta después de guardar cambios en
   * Configuración que puedan afectar al propio usuario logueado (p. ej.
   * vincularse a un profesional) — `user` solo se carga una vez al montar,
   * así que sin esto la sesión queda con datos viejos hasta el próximo login.
   */
  refreshUser: () => Promise<void>
  register: (data: {
    nombreConsultorio: string
    nombre: string
    apellido: string
    email: string
    password: string
    confirmPassword: string
  }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [loginBootTrigger, setLoginBootTrigger] = useState(0)

  useEffect(() => {
    let cancelled = false

    api
      .getMe()
      .then((usuario) => {
        if (!cancelled) setUser(usuario)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // Si api.login rechaza (credenciales inválidas), no llegamos a las
    // siguientes líneas: el trigger no cambia y la pantalla de carga no
    // aparece en un login fallido.
    const usuario = await api.login(email, password)
    setUser(usuario)
    setLoginBootTrigger((current) => current + 1)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) throw err
    }
    setUser(null)
    // Si otro usuario (de otro consultorio) inicia sesión después en la
    // misma pestaña, no debe ver ni por un instante datos cacheados de este.
    clearDataCache()
  }, [])

  const register = useCallback(async (data: Parameters<AuthContextValue['register']>[0]) => {
    const usuario = await api.register(data)
    setUser(usuario)
    setLoginBootTrigger((current) => current + 1)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const usuario = await api.getMe()
      setUser(usuario)
    } catch {
      // Si la sesión ya no es válida, dejamos que el resto de la app
      // reaccione a un 401 normal en su próximo request — no forzamos logout acá.
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, loginBootTrigger, login, logout, register, refreshUser }),
    [user, loading, loginBootTrigger, login, logout, register, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}

import { useState, type FormEvent } from 'react'
import './LoginPage.css'
import { useAuth } from './AuthContext'
import { ApiError } from '../services/api'
import KineqIsologotipo from '../assets/branding/KineqIsologotipo'
import { EyeIcon, EyeOffIcon, ErrorIcon, ForgotIcon } from './AuthIcons'

type LoginPageProps = {
  onSwitchToRegister: () => void
}

/**
 * Logo del consultorio: todavía no hay backend/UI para configurarlo, así
 * que queda en null (solo se muestra el logo de Kineq). Cuando exista,
 * alcanza con completar esta variable con la URL del tenant actual para
 * que el layout de abajo (Kineq + separador + logo del consultorio) se
 * active solo.
 */
const consultorioLogoUrl: string | null = null

export default function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [view, setView] = useState<'login' | 'forgot'>('login')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <KineqIsologotipo className="login-logo-kineq" />
          {consultorioLogoUrl ? (
            <>
              <span className="login-brand-divider" aria-hidden="true" />
              <img src={consultorioLogoUrl} alt="Logo del consultorio" className="login-logo-consultorio" />
            </>
          ) : null}
        </div>

        {view === 'login' ? (
          <>
            <div className="login-header">
              <h1>Iniciar sesión</h1>
              <p className="login-subtitle">Ingresá con tu email y contraseña.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              {error ? (
                <p className="login-error" role="alert">
                  <ErrorIcon />
                  {error}
                </p>
              ) : null}

              <div className="login-field">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  className="login-input"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="login-field">
                <div className="login-field-label-row">
                  <label htmlFor="login-password">Contraseña</label>
                  <button type="button" className="login-forgot-link" onClick={() => setView('forgot')}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="login-password-wrap">
                  <input
                    id="login-password"
                    className="login-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="login-toggle-visibility"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit" disabled={submitting}>
                {submitting ? <span className="login-spinner" aria-hidden="true" /> : null}
                {submitting ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </form>

            <p className="login-footer">
              ¿No tenés una cuenta?{' '}
              <button type="button" onClick={onSwitchToRegister}>
                Creá tu consultorio
              </button>
            </p>
          </>
        ) : (
          <>
            <div className="login-forgot-icon">
              <ForgotIcon />
            </div>
            <div className="login-header">
              <h1>Recuperar contraseña</h1>
            </div>
            <p className="login-forgot-text">
              Esta función todavía no está disponible. Mientras tanto, pedile a un administrador de tu consultorio que
              restablezca tu acceso.
            </p>
            <button type="button" className="login-back-button" onClick={() => setView('login')}>
              Volver a iniciar sesión
            </button>
          </>
        )}
      </div>
    </div>
  )
}

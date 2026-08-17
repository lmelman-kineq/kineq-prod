import { useState, type FormEvent } from 'react'
import './LoginPage.css'
import { useAuth } from './AuthContext'
import { ApiError } from '../services/api'
import KineqIsologotipo from '../assets/branding/KineqIsologotipo'
import { EyeIcon, EyeOffIcon, ErrorIcon, ArrowLeftIcon } from './AuthIcons'

type RegisterPageProps = {
  onSwitchToLogin: () => void
}

const MIN_PASSWORD_LENGTH = 8

export default function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const { register } = useAuth()
  const [nombreConsultorio, setNombreConsultorio] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }

    setSubmitting(true)
    try {
      // Nombre completo en un solo campo (regla transversal de UI de
      // personas) — se guarda entero en `nombre`, `apellido` queda vacío,
      // mismo criterio que Paciente/Profesional/Usuario.
      await register({ nombreConsultorio, nombre: nombreCompleto.trim(), apellido: '', email, password, confirmPassword })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card login-card--wide">
        <button
          type="button"
          className="login-back-arrow"
          aria-label="Volver a iniciar sesión"
          onClick={onSwitchToLogin}
        >
          <ArrowLeftIcon />
        </button>

        <div className="login-brand">
          <KineqIsologotipo className="login-logo-kineq" />
        </div>

        <div className="login-header">
          <h1>Creá tu consultorio</h1>
          <p className="login-subtitle">Esto crea un nuevo espacio de trabajo de Kineq con vos como administrador.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error ? (
            <p className="login-error" role="alert">
              <ErrorIcon />
              {error}
            </p>
          ) : null}

          <div className="login-field">
            <label htmlFor="register-consultorio">Nombre del consultorio</label>
            <input
              id="register-consultorio"
              className="login-input"
              type="text"
              required
              value={nombreConsultorio}
              onChange={(event) => setNombreConsultorio(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="login-field">
            <label htmlFor="register-nombre">Nombre completo</label>
            <input
              id="register-nombre"
              className="login-input"
              type="text"
              required
              value={nombreCompleto}
              onChange={(event) => setNombreCompleto(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="login-field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              className="login-input"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="login-form-row">
            <div className="login-field">
              <label htmlFor="register-password">Contraseña</label>
              <div className="login-password-wrap">
                <input
                  id="register-password"
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
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

            <div className="login-field">
              <label htmlFor="register-confirm-password">Confirmar contraseña</label>
              <div className="login-password-wrap">
                <input
                  id="register-confirm-password"
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? <span className="login-spinner" aria-hidden="true" /> : null}
            {submitting ? 'Creando…' : 'Crear consultorio'}
          </button>
        </form>

        <p className="login-footer">
          ¿Ya tenés una cuenta?{' '}
          <button type="button" onClick={onSwitchToLogin}>
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  )
}

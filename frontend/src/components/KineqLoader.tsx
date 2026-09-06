import './KineqLoader.css'
import KineqIsologo from '../assets/branding/KineqIsologo'

type KineqLoaderSize = 'small' | 'medium' | 'large'

type KineqLoaderProps = {
  size?: KineqLoaderSize
  label?: string
  className?: string
}

// Loader reusable para bloques/secciones que todavía no tienen contenido
// (no confundir con BootScreen: ese es pantalla completa, solo para el
// arranque inicial de la app — ver docs/ui/loading-animation-reference.md,
// "Do not appear during normal internal route changes"). Reusa el mismo
// lenguaje visual (anillos + isologo), pero con tokens de tema (claro/
// oscuro) en vez de los colores fijos de BootScreen, y sin ocupar la
// pantalla completa.
export default function KineqLoader({ size = 'medium', label = 'Cargando', className = '' }: KineqLoaderProps) {
  return (
    <div className={`kineq-loader kineq-loader--${size} ${className}`} role="status" aria-live="polite">
      <div className="kineq-loader__composition" aria-hidden="true">
        <svg className="kineq-loader__ring kineq-loader__ring--outer" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="92" />
        </svg>
        <svg className="kineq-loader__ring kineq-loader__ring--middle" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="70" />
        </svg>
        <div className="kineq-loader__ring kineq-loader__ring--inner" />
        <KineqIsologo className="kineq-loader__logo" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

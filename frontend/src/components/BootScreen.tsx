import './BootScreen.css'
import KineqIsologo from '../assets/branding/KineqIsologo'

export default function BootScreen({ fading = false }: { fading?: boolean }) {
  return (
    <div className={`boot-screen ${fading ? 'boot-screen--fading' : ''}`} role="status" aria-live="polite">
      <div className="boot-screen__composition" aria-hidden="true">
        <svg className="boot-screen__ring boot-screen__ring--outer" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="92" />
        </svg>
        <svg className="boot-screen__ring boot-screen__ring--middle" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="70" />
        </svg>
        <div className="boot-screen__ring boot-screen__ring--inner" />
        <KineqIsologo className="boot-screen__logo" />
      </div>
      <p className="boot-screen__text">Preparando Kineq</p>
    </div>
  )
}

import type { SVGProps } from 'react'

function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 3l9 16H3l9-16Z" />
      <path d="M12 10v4" />
      <path d="M12 17.5v.01" />
    </svg>
  )
}

type Props = {
  active: boolean
  disabled?: boolean
  onToggle: () => void
}

// Marca manual del profesional ("quiero que esto quede destacado en futuras
// atenciones") — no es un diagnóstico automático de Kineq. Mismo lenguaje
// visual discreto que el resto de Alertas clínicas, sin rojo agresivo.
// Icon-only: el texto vive en el tooltip (`title`) y en `aria-label`, no en
// el botón — mismo estado activo/inactivo y misma lógica de siempre.
export default function AlertToggleButton({ active, disabled, onToggle }: Props) {
  const label = active ? 'Quitar alerta' : 'Marcar como alerta'
  return (
    <button
      type="button"
      className={`alert-toggle-button${active ? ' alert-toggle-button--active' : ''}`}
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <AlertIcon />
    </button>
  )
}

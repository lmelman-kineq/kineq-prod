export type MobileSectionOption = { key: string; label: string }

type MobileSectionSelectProps = {
  ariaLabel: string
  options: MobileSectionOption[]
  value: string
  onChange: (key: string) => void
}

/**
 * Selector compacto mobile para reemplazar una fila de tabs/botones que no
 * entra bien en pantallas chicas (Ficha Inicial, Configuración,
 * Estadísticas) — mismo chevron custom que ya usa el resto de Kineq
 * (`.select-chevron-wrap`, ver CustomRecurrenceModal.tsx/App.css) en vez de
 * la flecha nativa del navegador. Un solo componente reusado en los tres
 * lugares en vez de tres implementaciones casi iguales.
 */
export default function MobileSectionSelect({ ariaLabel, options, value, onChange }: MobileSectionSelectProps) {
  return (
    <label className="mobile-section-select select-chevron-wrap">
      <span className="sr-only">{ariaLabel}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

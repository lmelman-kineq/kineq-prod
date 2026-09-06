import type { KeyboardEvent, ReactNode } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import MobileSectionSelect from './MobileSectionSelect'

export type ClinicalTab = {
  key: string
  label: string
  badge?: string
}

type ClinicalTabsProps = {
  tabs: ClinicalTab[]
  activeKey: string
  onChange: (key: string) => void
  panels: Record<string, ReactNode>
  // Reemplaza la fila de tabs por un `MobileSectionSelect` en mobile — opt-in
  // (default `false`) para no afectar usos con pocas tabs cortas que ya
  // entran bien (ej. Evoluciones/Ficha inicial/Turnos/Estudios del Paciente),
  // y sí a los que la spec pidió compactar (Configuración, 5 tabs).
  mobileCollapse?: boolean
}

export default function ClinicalTabs({ tabs, activeKey, onChange, panels, mobileCollapse = false }: ClinicalTabsProps) {
  const isMobile = useIsMobile()
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    const next = tabs[nextIndex]
    onChange(next.key)
    document.getElementById(`tab-${next.key}`)?.focus()
  }

  return (
    <div className="clinical-tabs">
      {mobileCollapse && isMobile ? (
        <MobileSectionSelect ariaLabel="Secciones clínicas del paciente" options={tabs} value={activeKey} onChange={onChange} />
      ) : (
        <div className="clinical-tabs-list" role="tablist" aria-label="Secciones clínicas del paciente">
          {tabs.map((tab, index) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={activeKey === tab.key}
              aria-controls={`tabpanel-${tab.key}`}
              tabIndex={activeKey === tab.key ? 0 : -1}
              className={`clinical-tab${activeKey === tab.key ? ' clinical-tab--active' : ''}`}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
              {tab.badge ? <span className="clinical-tab-badge">{tab.badge}</span> : null}
            </button>
          ))}
        </div>
      )}

      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`tabpanel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          hidden={activeKey !== tab.key}
          className="clinical-tab-panel"
        >
          {panels[tab.key]}
        </div>
      ))}
    </div>
  )
}

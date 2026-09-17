import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
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
  // Reemplaza la fila de tabs por un `MobileSectionSelect` (<select> nativo)
  // en mobile — opt-in, usado por Configuración (5 tabs).
  mobileCollapse?: boolean
  // Reemplaza la fila de tabs por una barra compacta "nombre de la sección
  // actual + botón de menú" en mobile — opt-in, usado por el detalle de
  // Paciente (Evoluciones/Ficha inicial/Estudios/Turnos): a diferencia de
  // `mobileCollapse`, el nombre de la sección activa queda siempre visible
  // como texto (no escondido dentro de un <select> cerrado).
  mobileMenu?: boolean
}

function MobileTabMenuBar({ tabs, activeKey, onChange }: Pick<ClinicalTabsProps, 'tabs' | 'activeKey' | 'onChange'>) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? tabs[0]

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [open])

  return (
    <div className="mobile-tab-menu-bar" ref={wrapperRef}>
      <span className="mobile-tab-menu-current">
        {activeTab?.label}
        {activeTab?.badge ? <span className="clinical-tab-badge">{activeTab.badge}</span> : null}
      </span>
      <button
        type="button"
        className="mobile-tab-menu-toggle"
        aria-label="Cambiar de sección"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open ? (
        <div className="context-menu mobile-tab-menu-popover">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`context-menu-item ${tab.key === activeKey ? 'context-menu-item--primary' : ''}`}
              onClick={() => { onChange(tab.key); setOpen(false) }}
            >
              {tab.label}
              {tab.badge ? <span className="clinical-tab-badge">{tab.badge}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function ClinicalTabs({ tabs, activeKey, onChange, panels, mobileCollapse = false, mobileMenu = false }: ClinicalTabsProps) {
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
      ) : mobileMenu && isMobile ? (
        <MobileTabMenuBar tabs={tabs} activeKey={activeKey} onChange={onChange} />
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

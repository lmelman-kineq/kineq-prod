export type AssessmentSection = { key: string; label: string; badge?: string }

type Props = {
  sections: AssessmentSection[]
  activeKey: string
  onChange: (key: string) => void
}

export default function AssessmentSectionNav({ sections, activeKey, onChange }: Props) {
  return (
    <div className="assessment-nav" role="tablist" aria-label="Secciones de la ficha inicial">
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          role="tab"
          aria-selected={activeKey === section.key}
          className={`assessment-nav-item${activeKey === section.key ? ' assessment-nav-item--active' : ''}`}
          onClick={() => onChange(section.key)}
        >
          <span>{section.label}</span>
          {section.badge ? <span className="assessment-nav-badge">{section.badge}</span> : null}
        </button>
      ))}
    </div>
  )
}

import type { ReactNode } from 'react'

type ConfigSectionHeaderProps = {
  title: string
  description: string
  action?: ReactNode
}

export default function ConfigSectionHeader({ title, description, action }: ConfigSectionHeaderProps) {
  return (
    <div className="config-section-header">
      <div>
        <h2>{title}</h2>
        <p className="patient-detail-subtitle">{description}</p>
      </div>
      {action ?? null}
    </div>
  )
}

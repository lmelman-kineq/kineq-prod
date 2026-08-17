import { useState, type ReactNode } from 'react'
import type { ConfirmDialogOptions } from '../App'
import ClinicalTabs, { type ClinicalTab } from './ClinicalTabs'
import ConfiguracionGeneral from './ConfiguracionGeneral'
import ConfiguracionUsuarios from './ConfiguracionUsuarios'
import ConfiguracionProfesionales from './ConfiguracionProfesionales'
import ConfiguracionEspecialidades from './ConfiguracionEspecialidades'
import ConfiguracionObrasSociales from './ConfiguracionObrasSociales'

type ConfiguracionPageProps = {
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
  onProfesionalesChanged?: () => void
}

const TABS: ClinicalTab[] = [
  { key: 'general', label: 'General' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'profesionales', label: 'Profesionales' },
  { key: 'especialidades', label: 'Especialidades' },
  { key: 'obras-sociales', label: 'Obras sociales' },
]

export default function ConfiguracionPage({ onRequestConfirm, onProfesionalesChanged }: ConfiguracionPageProps) {
  const [activeTab, setActiveTab] = useState('general')

  const panels: Record<string, ReactNode> = {
    general: <ConfiguracionGeneral />,
    usuarios: <ConfiguracionUsuarios onRequestConfirm={onRequestConfirm} onProfesionalesChanged={onProfesionalesChanged} />,
    profesionales: <ConfiguracionProfesionales onRequestConfirm={onRequestConfirm} onProfesionalesChanged={onProfesionalesChanged} />,
    especialidades: <ConfiguracionEspecialidades onRequestConfirm={onRequestConfirm} />,
    'obras-sociales': <ConfiguracionObrasSociales onRequestConfirm={onRequestConfirm} />,
  }

  return (
    <div className="patients-page">
      <header className="patients-page-header">
        <div>
          <p className="breadcrumb">Home / Configuración</p>
          <h1>Configuración</h1>
          <p className="patient-detail-subtitle">Administrá el equipo y los datos operativos de tu consultorio.</p>
        </div>
      </header>

      <div className="patient-detail-card clinical-workspace">
        <ClinicalTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} panels={panels} />
      </div>
    </div>
  )
}

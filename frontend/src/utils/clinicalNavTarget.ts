import type { AntecedenteCategoria } from './clinicalAlerts'

// Deep-link interno: "click en una alerta clínica → ir al campo/registro de
// origen". `token` cambia en cada navegación (aunque el destino sea
// idéntico al anterior) para que los efectos de React que lo escuchan
// puedan distinguir "se pidió navegar de nuevo" de "no cambió nada".
export type ClinicalNavTarget = {
  token: number
  outerTab: 'ficha' | 'estudios'
  section?: string
  categoria?: AntecedenteCategoria
  elementId: string
}

export type ClinicalNavRequest = Omit<ClinicalNavTarget, 'token'>

// Espejo chico y deliberado del whitelist del backend (ELIGIBLE_ALERT_FIELDS
// en backend/src/app.ts) — campos de texto libre de Ficha Inicial que se
// pueden marcar manualmente como alerta clínica. No cualquier campo amerita
// esto: datos puramente administrativos quedan afuera a propósito.
//
// `outerTab`/`section` son solo para la navegación "click en alerta → ir al
// campo de origen" (ver ClinicalAlertsDetail.tsx / utils/clinicalNavTarget.ts):
// dónde vive cada campo dentro de las tabs del paciente. `estudiosComplementarios`
// vive en la tab "Estudios" (fuera de la Ficha Inicial propiamente dicha),
// el resto vive dentro de Ficha Inicial, en la sección de AssessmentSectionNav indicada.
export const ELIGIBLE_ALERT_FIELDS: Record<string, { label: string; outerTab: 'ficha' | 'estudios'; section?: string }> = {
  motivoConsulta: { label: 'Motivo de consulta', outerTab: 'ficha', section: 'motivo' },
  diagnosticoDerivacion: { label: 'Diagnóstico de derivación', outerTab: 'ficha', section: 'motivo' },
  traumatismosAccidentes: { label: 'Traumatismos / accidentes', outerTab: 'ficha', section: 'motivo' },
  tratamientosPrevios: { label: 'Tratamientos previos', outerTab: 'ficha', section: 'motivo' },
  enfermedadesActuales: { label: 'Enfermedades actuales', outerTab: 'ficha', section: 'seguridad' },
  dolorSintomas: { label: 'Dolor y síntomas', outerTab: 'ficha', section: 'dolor_funcion' },
  limitacionesFuncionales: { label: 'Limitaciones funcionales', outerTab: 'ficha', section: 'dolor_funcion' },
  hallazgosIniciales: { label: 'Hallazgos iniciales', outerTab: 'ficha', section: 'dolor_funcion' },
  observacionesClinicas: { label: 'Observaciones clínicas', outerTab: 'ficha', section: 'dolor_funcion' },
  estudiosComplementarios: { label: 'Estudios complementarios', outerTab: 'estudios' },
}

export function isEligibleAlertField(campo: string): boolean {
  return campo in ELIGIBLE_ALERT_FIELDS
}

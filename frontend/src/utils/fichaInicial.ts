import type { FichaInicial, FichaInicialInput } from '../types/domain'
import { toDateInputValue } from './dateFormat'

export type FichaCompletionStatus = 'pendiente' | 'parcial' | 'completa'

export const FICHA_COMPLETION_LABELS: Record<FichaCompletionStatus, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcialmente completa',
  completa: 'Completa',
}

// Reutiliza los colores de estado de turno que ya existen: azul/pendiente,
// amarillo/parcial (mismo tono que "ausente"), verde/completa.
export const FICHA_COMPLETION_PILL_CLASS: Record<FichaCompletionStatus, string> = {
  pendiente: 'asignado',
  parcial: 'ausente',
  completa: 'finalizado',
}

// Campos narrativos/escalares que se editan en el form plano (los antecedentes,
// alergias, medicación y estudios estructurados viven en sus propias listas,
// con su propio guardado — no participan de este cálculo de completitud).
const FICHA_FORM_FIELDS = [
  'motivoConsulta',
  'fechaInicioProblema',
  'diagnosticoDerivacion',
  'objetivoPaciente',
  'antecedentesPersonales',
  'antecedentesFamiliares',
  'cirugias',
  'traumatismosAccidentes',
  'tratamientosPrevios',
  'alergiasEstado',
  'medicacionEstado',
  'enfermedadesActuales',
  'actividadFisica',
  'deportes',
  'ocupacion',
  'limitacionesFuncionales',
  'estudiosComplementarios',
  'dolorSintomas',
  'hallazgosIniciales',
  'observacionesClinicas',
  'tabaquismoEstado',
  'aniosFumador',
  'cigarrillosDiarios',
  'alcoholEstado',
  'sedentarismoEstado',
  'ejercicioMinutosDia',
  'menarcaEstado',
  'edadMenarca',
  'menopausiaEstado',
  'edadMenopausia',
  'gestas',
  'partos',
  'abortos',
  'observacionesGineco',
] as const

// Campos numéricos: el form los guarda como string (mismo criterio que el
// resto de los inputs), pero el backend espera Int — se convierten al armar
// el payload de guardado, no al leerlos del form.
const FICHA_NUMERIC_FIELDS = new Set([
  'aniosFumador',
  'cigarrillosDiarios',
  'ejercicioMinutosDia',
  'edadMenarca',
  'edadMenopausia',
  'gestas',
  'partos',
  'abortos',
])

// Campos que mapean a un enum de Prisma (`EstadoDatoClinico`, nullable) —
// a diferencia del resto (columnas `String?`), un string vacío no es un
// valor válido para un enum: Prisma lo rechaza con un error de validación.
// Bug real encontrado en producción: el form inicializa estos campos en
// `''` cuando todavía no se tocaron (`fichaFormFromFicha`), y el primer
// autoguardado de *cualquier* campo de la ficha mandaba el form entero —
// incluidos estos en `''` — lo que rompía el guardado con
// "failed to save ficha inicial" apenas se completaba el primer dato de una
// ficha nueva. Acá se traduce `''` a `null` (sin especificar), nunca se
// manda el string vacío.
const FICHA_ENUM_FIELDS = new Set([
  'alergiasEstado',
  'medicacionEstado',
  'tabaquismoEstado',
  'alcoholEstado',
  'sedentarismoEstado',
  'menarcaEstado',
  'menopausiaEstado',
])

function isFieldSatisfied(form: Record<string, string>, field: string): boolean {
  return Boolean(form[field]?.trim())
}

export function computeFichaCompletionStatus(form: Record<string, string>): FichaCompletionStatus {
  const fields = Object.keys(form)
  const anyFilled = fields.some((field) => form[field]?.trim())
  if (!anyFilled) return 'pendiente'

  const allSatisfied = fields.every((field) => isFieldSatisfied(form, field))
  return allSatisfied ? 'completa' : 'parcial'
}

export function fichaFormFromFicha(ficha: FichaInicial | null): Record<string, string> {
  const source = ficha ?? ({} as Partial<FichaInicial>)
  const form: Record<string, string> = {}
  for (const field of FICHA_FORM_FIELDS) {
    const value = source[field as keyof FichaInicial]
    if (field === 'fechaInicioProblema') {
      form[field] = toDateInputValue(source.fechaInicioProblema)
    } else {
      form[field] = value == null ? '' : String(value)
    }
  }
  return form
}

// Arma el payload de PATCH a partir del form plano: convierte los campos
// numéricos a Number (o los omite si están vacíos), omite la fecha si está
// vacía, y deja el resto tal cual — mismo criterio que ya usaban
// PatientDetailPage/AttentionPage antes de esta función existir.
export function buildFichaPayload(form: Record<string, string>): FichaInicialInput {
  const payload: Record<string, unknown> = {}
  for (const field of FICHA_FORM_FIELDS) {
    const raw = form[field]
    if (FICHA_NUMERIC_FIELDS.has(field)) {
      if (raw?.trim()) payload[field] = Number(raw)
      continue
    }
    if (field === 'fechaInicioProblema' && !raw) continue
    if (FICHA_ENUM_FIELDS.has(field)) {
      payload[field] = raw ? raw : null
      continue
    }
    payload[field] = raw
  }
  return payload as FichaInicialInput
}

// Secciones revisables de Ficha Inicial (valores del enum Prisma
// SeccionFicha) — única fuente de verdad de "cuántas secciones hay para
// revisar", consumida acá y por InitialAssessmentPanel.tsx. MOTIVO ya no es
// una sección propia (se fusionó dentro de Antecedentes, mismos campos/
// columnas, sin cambio de datos — ver comentario en InitialAssessmentPanel.tsx)
// y ESTUDIOS nunca contó acá (tiene su propia tab general). Filas
// preexistentes en FichaSeccionEstado con seccion='MOTIVO' quedan como
// historial inofensivo, no se migran ni se borran.
export const REVISABLE_SECCIONES = ['ANTECEDENTES', 'SEGURIDAD', 'HABITOS', 'DOLOR_FUNCION'] as const

export function fichaSeccionesResumen(seccionesEstado: FichaInicial['seccionesEstado']): { revisadas: number; total: number } {
  const revisables: readonly string[] = REVISABLE_SECCIONES
  const revisadas = (seccionesEstado ?? []).filter((s) => s.estado === 'REVISADA' && revisables.includes(s.seccion)).length
  return { revisadas, total: REVISABLE_SECCIONES.length }
}

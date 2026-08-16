import type { FichaAlergia, FichaAlertaCampo, FichaAntecedente, FichaInicial, FichaMedicacion } from '../types/domain'

export type AntecedenteCategoria = 'ANTECEDENTE_PERSONAL' | 'ANTECEDENTE_FAMILIAR' | 'PROCEDIMIENTO_QUIRURGICO'

export const ANTECEDENTE_CATEGORIA_LABELS: Record<AntecedenteCategoria, string> = {
  ANTECEDENTE_PERSONAL: 'Personales',
  ANTECEDENTE_FAMILIAR: 'Familiares',
  PROCEDIMIENTO_QUIRURGICO: 'Quirúrgicos',
}

export type AntecedenteGroup = {
  key: AntecedenteCategoria
  label: string
  items: FichaAntecedente[]
}

// Antecedentes positivos agrupados por categoría, con los marcados como
// alerta clínica primero (solo por el flag explícito — nunca se infiere
// relevancia médica acá). Se comparte entre Resumen clínico y el detalle
// de Alertas clínicas para no duplicar el criterio de agrupación/orden.
export function groupAntecedentesPositivos(antecedentes: FichaAntecedente[] | undefined): AntecedenteGroup[] {
  const positivos = (antecedentes ?? []).filter((a) => a.estado === 'SI')
  return (Object.keys(ANTECEDENTE_CATEGORIA_LABELS) as AntecedenteCategoria[])
    .map((key) => ({
      key,
      label: ANTECEDENTE_CATEGORIA_LABELS[key],
      items: positivos
        .filter((a) => a.catalogoItem.categoria === key)
        .sort((a, b) => Number(b.esAlertaClinica) - Number(a.esAlertaClinica)),
    }))
    .filter((group) => group.items.length > 0)
}

export type EstadoAlertasClinicas = 'sin-alertas' | 'activa' | 'pendiente'

export type AlertasClinicas = {
  alergias: FichaAlergia[]
  antecedentesAlerta: FichaAntecedente[]
  medicacionAlerta: FichaMedicacion[]
  otrasAlertas: FichaAlertaCampo[]
  estado: EstadoAlertasClinicas
  total: number
}

// Única fuente de verdad para "hay alertas clínicas activas": la usan tanto
// la card de resumen como su detalle, para no divergir en el criterio.
// Nunca diagnostica ni infiere severidad — solo junta lo ya registrado
// explícitamente (alergias activas + antecedentes/medicación marcados con
// esAlertaClinica + alertas manuales de otros campos de la ficha).
export function computeAlertasClinicas(ficha: FichaInicial | null): AlertasClinicas {
  const alergias = ficha?.alergias ?? []
  const antecedentesAlerta = (ficha?.antecedentes ?? []).filter((a) => a.estado === 'SI' && a.esAlertaClinica)
  const medicacionAlerta = (ficha?.medicaciones ?? []).filter((m) => m.esAlertaClinica)
  // `valor` se lee del campo de origen en la ficha actual (no se persiste en
  // FichaAlertaCampo) para que el preview del popup siempre refleje el
  // contenido vigente, incluso si el campo se editó después de marcarlo.
  const otrasAlertas = (ficha?.alertasCampo ?? []).map((a) => ({
    ...a,
    valor: ficha ? ((ficha as unknown as Record<string, unknown>)[a.campo] as string | null | undefined) : undefined,
  }))
  const total = alergias.length + antecedentesAlerta.length + medicacionAlerta.length + otrasAlertas.length

  const seccionEstado = (seccion: string) => ficha?.seccionesEstado?.find((s) => s.seccion === seccion)?.estado
  // "Sin alertas activas" requiere haber revisado Seguridad clínica (alergias/
  // medicación) y Antecedentes — si no, no se puede afirmar que no hay nada,
  // solo que todavía no se relevó (distinción pedida explícitamente).
  const relevantesRevisadas = seccionEstado('SEGURIDAD') === 'REVISADA' && seccionEstado('ANTECEDENTES') === 'REVISADA'

  const estado: EstadoAlertasClinicas = total > 0 ? 'activa' : relevantesRevisadas ? 'sin-alertas' : 'pendiente'

  return { alergias, antecedentesAlerta, medicacionAlerta, otrasAlertas, estado, total }
}

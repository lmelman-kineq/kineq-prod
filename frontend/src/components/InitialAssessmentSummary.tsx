import type { FichaInicial } from '../types/domain'
import { fichaSeccionesResumen } from '../utils/fichaInicial'

type Props = {
  ficha: FichaInicial | null
  form: Record<string, string>
  onNavigate: (sectionKey: string) => void
}

function SummaryBlock({ title, items, sectionKey, onNavigate, emptyHint }: {
  title: string
  items: string[]
  sectionKey: string
  onNavigate: (key: string) => void
  emptyHint?: string
}) {
  if (items.length === 0 && !emptyHint) return null
  return (
    <button type="button" className="assessment-summary-block" onClick={() => onNavigate(sectionKey)}>
      <strong>{title}</strong>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      ) : (
        <p>{emptyHint}</p>
      )}
    </button>
  )
}

export default function InitialAssessmentSummary({ ficha, form, onNavigate }: Props) {
  const antecedentesPositivos = (ficha?.antecedentes ?? [])
    .filter((a) => a.estado === 'SI' && a.catalogoItem.categoria !== 'PROCEDIMIENTO_QUIRURGICO')
    .map((a) => a.catalogoItem.categoria === 'ANTECEDENTE_FAMILIAR' && a.parentesco ? `${a.catalogoItem.nombre} (${a.parentesco})` : a.catalogoItem.nombre)

  const quirurgicos = (ficha?.antecedentes ?? [])
    .filter((a) => a.estado === 'SI' && a.catalogoItem.categoria === 'PROCEDIMIENTO_QUIRURGICO')
    .map((a) => a.catalogoItem.nombre)

  const alergias = (ficha?.alergias ?? []).map((a) => {
    const nombre = a.catalogoItem?.nombre ?? a.nombreLibre ?? 'Alergia'
    return a.reaccion ? `${nombre} — ${a.reaccion}` : nombre
  })

  const medicaciones = (ficha?.medicaciones ?? []).map((m) => (m.dosis ? `${m.nombre} ${m.dosis}${m.unidad ?? ''}` : m.nombre))

  const habitos: string[] = []
  if (form.tabaquismoEstado === 'SI') habitos.push(`Tabaquismo${form.cigarrillosDiarios ? ` (${form.cigarrillosDiarios}/día)` : ''}`)
  if (form.alcoholEstado === 'SI') habitos.push('Consumo de alcohol')
  if (form.sedentarismoEstado === 'SI') habitos.push('Sedentarismo')
  if (form.actividadFisica?.trim()) habitos.push(form.actividadFisica.trim())

  const { revisadas: seccionesRevisadas, total: totalSecciones } = fichaSeccionesResumen(ficha?.seccionesEstado)

  const hasAnyAlert = alergias.length > 0 || antecedentesPositivos.length > 0

  return (
    <div className="assessment-summary">
      {!ficha ? (
        <p className="patient-detail-note">Todavía no hay ficha inicial cargada para este paciente.</p>
      ) : (
        <>
          <div className="assessment-summary-header">
            <span>{seccionesRevisadas} de {totalSecciones} secciones revisadas</span>
            {!hasAnyAlert ? <span className="clinical-alert-badge clinical-alert-badge--ok">Sin alertas activas</span> : null}
          </div>

          {form.motivoConsulta?.trim() ? (
            <SummaryBlock title="Motivo de consulta" items={[form.motivoConsulta.trim()]} sectionKey="motivo" onNavigate={onNavigate} />
          ) : null}

          <SummaryBlock title="Alergias" items={alergias} sectionKey="seguridad" onNavigate={onNavigate} emptyHint={alergias.length === 0 && form.alergiasEstado === 'SI' ? 'Marcada como "Sí" pero sin alergias cargadas.' : undefined} />
          <SummaryBlock title="Medicación" items={medicaciones} sectionKey="seguridad" onNavigate={onNavigate} />
          <SummaryBlock title="Antecedentes personales y familiares" items={antecedentesPositivos} sectionKey="antecedentes" onNavigate={onNavigate} />
          <SummaryBlock title="Antecedentes quirúrgicos" items={quirurgicos} sectionKey="antecedentes" onNavigate={onNavigate} />
          <SummaryBlock title="Contexto y Hábitos" items={habitos} sectionKey="habitos" onNavigate={onNavigate} />
          {form.dolorSintomas?.trim() || form.limitacionesFuncionales?.trim() ? (
            <SummaryBlock
              title="Dolor y función"
              items={[form.dolorSintomas, form.limitacionesFuncionales].filter((v) => v?.trim()).map((v) => v!.trim())}
              sectionKey="dolor_funcion"
              onNavigate={onNavigate}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

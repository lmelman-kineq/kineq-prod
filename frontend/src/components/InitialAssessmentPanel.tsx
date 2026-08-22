import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { UseFichaInicial } from '../hooks/useFichaInicial'
import { formatDateTime } from '../utils/dateFormat'
import { professionalName } from '../utils/professional'
import { FICHA_COMPLETION_LABELS, FICHA_COMPLETION_PILL_CLASS, computeFichaCompletionStatus, fichaSeccionesResumen } from '../utils/fichaInicial'
import AssessmentSectionNav, { type AssessmentSection } from './AssessmentSectionNav'
import ClinicalAntecedentesSection from './ClinicalAntecedentesSection'
import FichaAllergyList from './FichaAllergyList'
import FichaMedicationList from './FichaMedicationList'
import AlertToggleButton from './AlertToggleButton'
import type { ClinicalNavTarget } from '../utils/clinicalNavTarget'
import { scrollToAndHighlight } from '../utils/scrollAndHighlight'

type AlertProps = { active: boolean; disabled?: boolean; onToggle: () => void }

function FieldLabel({ label, alert }: { label: string; alert?: AlertProps }) {
  if (!alert) return <span>{label}</span>
  return (
    <span className="ficha-field-label-row">
      {label}
      <AlertToggleButton active={alert.active} disabled={alert.disabled} onToggle={alert.onToggle} />
    </span>
  )
}

function TextField({ id, label, value, onChange, placeholder, alert }: { id?: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; alert?: AlertProps }) {
  return (
    <label id={id} className="ficha-field">
      <FieldLabel label={label} alert={alert} />
      <input type="text" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="ficha-field">
      <span>{label}</span>
      <input type="number" min={0} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function TextAreaField({ id, label, value, onChange, placeholder, alert }: { id?: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; alert?: AlertProps }) {
  return (
    <label id={id} className="ficha-field ficha-field--wide">
      <FieldLabel label={label} alert={alert} />
      <textarea rows={2} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function EstadoClinicoField({
  label,
  estado,
  onEstadoChange,
}: {
  label: string
  estado: string
  onEstadoChange: (v: string) => void
}) {
  return (
    <div className="ficha-field ficha-field--estado">
      <span>{label}</span>
      <select value={estado} onChange={(event) => onEstadoChange(event.target.value)}>
        <option value="">Sin especificar</option>
        <option value="SI">Sí</option>
        <option value="NO">No</option>
        <option value="NO_INFORMA">No informa</option>
      </select>
    </div>
  )
}

function FichaSection({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="ficha-section">
      <div className="ficha-section-header">
        <span className="ficha-section-icon" aria-hidden="true">{icon}</span>
        <div>
          <h3>{title}</h3>
          {description ? <p className="ficha-section-description">{description}</p> : null}
        </div>
      </div>
      <div className="ficha-form-grid">{children}</div>
    </section>
  )
}

const ICONS = {
  antecedentes: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>,
  seguridad: <svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /></svg>,
  habitos: <svg viewBox="0 0 24 24"><path d="M3 12h4l2 7 4-14 2 7h6" /></svg>,
  dolorFuncion: <svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v3H9z" /><path d="M9 12l2 2 4-4" /></svg>,
}

// "Motivo" ya no es una subpestaña propia ni tiene sus campos en ningún
// lado de la UI (motivoConsulta, fechaInicioProblema, diagnosticoDerivacion,
// objetivoPaciente, tratamientosPrevios, traumatismosAccidentes — ver
// "Motivo y contexto" eliminado de panels.antecedentes más abajo). Los
// datos/columnas de Prisma no se tocaron. La cantidad de secciones
// revisables vive en REVISABLE_SECCIONES (utils/fichaInicial.ts) — si se
// agrega/saca una sección acá, actualizar esa lista también.
const NAV_SECTIONS: AssessmentSection[] = [
  { key: 'antecedentes', label: 'Antecedentes' },
  { key: 'seguridad', label: 'Seguridad clínica' },
  { key: 'habitos', label: 'Contexto y Hábitos' },
  { key: 'dolor_funcion', label: 'Dolor y función' },
]

type InitialAssessmentPanelProps = {
  fichaHook: UseFichaInicial
  patientId: number
  navTarget?: ClinicalNavTarget | null
  onNavTargetHandled?: () => void
}

export default function InitialAssessmentPanel({ fichaHook, patientId, navTarget, onNavTargetHandled }: InitialAssessmentPanelProps) {
  const [activeKey, setActiveKey] = useState('antecedentes')
  const { ficha, loading, form, saving, saveError, canWrite, updateField, toggleAlertaCampo } = fichaHook

  // Ficha Inicial ya no tiene una subpestaña "Resumen" (ese rol lo cumple
  // ahora la tab principal "Resumen clínico" de PatientDetailPage.tsx) —
  // siempre abre en "Antecedentes", la primera sección real. Se decide una
  // sola vez por paciente (apenas termina de cargar), nunca en cada render,
  // para no arrancarle la sección de las manos al profesional mientras está
  // completando otra más adelante en la lista (Seguridad, etc.).
  const initialTabPatientRef = useRef<number | null>(null)
  useEffect(() => {
    if (loading) return
    if (initialTabPatientRef.current === patientId) return
    initialTabPatientRef.current = patientId
    setActiveKey('antecedentes')
  }, [loading, patientId])

  // Deep-link desde una alerta clínica: cambia a la sección de origen y
  // resalta el campo. Escucha `navTarget?.token` (no el objeto entero) para
  // no repetirse en cada render.
  useEffect(() => {
    if (!navTarget || navTarget.outerTab !== 'ficha') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (navTarget.section) setActiveKey(navTarget.section)
    scrollToAndHighlight(navTarget.elementId)
    onNavTargetHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navTarget?.token])

  if (loading) return <p>Cargando ficha inicial...</p>

  const completionStatus = computeFichaCompletionStatus(form)
  const { revisadas, total } = fichaSeccionesResumen(ficha?.seccionesEstado)

  // Alerta manual sobre un campo elegible: reusable por todos los TextField/
  // TextAreaField de abajo, sin repetir el lookup en cada uno.
  const alertasCampoActivas = new Set((ficha?.alertasCampo ?? []).map((a) => a.campo))
  const alertFor = (campo: string): AlertProps => ({
    active: alertasCampoActivas.has(campo),
    disabled: !canWrite,
    onToggle: () => { void toggleAlertaCampo(campo) },
  })

  const panels: Record<string, ReactNode> = {
    // La sección "Motivo y contexto" (motivoConsulta, fechaInicioProblema,
    // diagnosticoDerivacion, objetivoPaciente, tratamientosPrevios,
    // traumatismosAccidentes) se sacó de la UI por completo a pedido — las
    // columnas de Prisma NO se tocaron (retirar UI, no migración
    // destructiva); esos 6 campos también se sacaron de FICHA_FORM_FIELDS
    // (utils/fichaInicial.ts) para que computeFichaCompletionStatus() no
    // los siga contando (si no, ninguna ficha nueva podría llegar a
    // "Completa": esos campos ya no tienen forma de completarse).
    antecedentes: (
      <>
        <div className="ficha-section-header">
          <span className="ficha-section-icon" aria-hidden="true">{ICONS.antecedentes}</span>
          <div>
            <h3>Antecedentes</h3>
          </div>
        </div>
        <ClinicalAntecedentesSection
          antecedentes={ficha?.antecedentes ?? []}
          onAdd={fichaHook.addAntecedente}
          onUpdate={fichaHook.updateAntecedente}
          onRemove={fichaHook.removeAntecedente}
          focusCategoria={navTarget?.outerTab === 'ficha' && navTarget.section === 'antecedentes' ? navTarget.categoria : undefined}
          focusToken={navTarget?.token}
        />
        <FichaSection icon={ICONS.antecedentes} title="Notas adicionales" description="Texto libre complementario a la lista de arriba.">
          <TextAreaField label="Antecedentes personales (notas)" value={form.antecedentesPersonales} onChange={(v) => updateField('antecedentesPersonales', v)} />
          <TextAreaField label="Antecedentes familiares (notas)" value={form.antecedentesFamiliares} onChange={(v) => updateField('antecedentesFamiliares', v)} />
          <TextAreaField label="Cirugías (notas)" value={form.cirugias} onChange={(v) => updateField('cirugias', v)} />
        </FichaSection>
      </>
    ),

    seguridad: (
      <>
        <div className="ficha-section-header">
          <span className="ficha-section-icon" aria-hidden="true">{ICONS.seguridad}</span>
          <div>
            <h3>Seguridad clínica</h3>
            <p className="ficha-section-description">Alergias y medicación relevantes para la atención.</p>
          </div>
        </div>
        <div className="ficha-form-grid">
          <EstadoClinicoField label="¿Tiene alergias?" estado={form.alergiasEstado} onEstadoChange={(v) => updateField('alergiasEstado', v)} />
          <EstadoClinicoField label="¿Toma medicación?" estado={form.medicacionEstado} onEstadoChange={(v) => updateField('medicacionEstado', v)} />
        </div>
        <h4 className="assessment-subsection-title">Alergias</h4>
        <FichaAllergyList alergias={ficha?.alergias ?? []} onAdd={fichaHook.addAlergia} onUpdate={fichaHook.updateAlergia} onRemove={fichaHook.removeAlergia} />
        <h4 className="assessment-subsection-title">Medicación</h4>
        <FichaMedicationList medicaciones={ficha?.medicaciones ?? []} onAdd={fichaHook.addMedicacion} onUpdate={fichaHook.updateMedicacion} onRemove={fichaHook.removeMedicacion} />
        <FichaSection icon={ICONS.seguridad} title="Condiciones actuales">
          <TextAreaField id="ficha-field-enfermedadesActuales" label="Enfermedades actuales" value={form.enfermedadesActuales} onChange={(v) => updateField('enfermedadesActuales', v)} alert={alertFor('enfermedadesActuales')} />
        </FichaSection>
      </>
    ),

    habitos: (
      <>
        <FichaSection icon={ICONS.habitos} title="Actividad y hábitos">
          <TextField label="Actividad física" value={form.actividadFisica} onChange={(v) => updateField('actividadFisica', v)} />
          <TextField label="Deportes" value={form.deportes} onChange={(v) => updateField('deportes', v)} />
          <TextField label="Ocupación" value={form.ocupacion} onChange={(v) => updateField('ocupacion', v)} />
          <EstadoClinicoField label="Tabaquismo" estado={form.tabaquismoEstado} onEstadoChange={(v) => updateField('tabaquismoEstado', v)} />
          {form.tabaquismoEstado === 'SI' ? (
            <>
              <NumberField label="Años como fumador" value={form.aniosFumador} onChange={(v) => updateField('aniosFumador', v)} />
              <NumberField label="Cigarrillos diarios" value={form.cigarrillosDiarios} onChange={(v) => updateField('cigarrillosDiarios', v)} />
            </>
          ) : null}
          <EstadoClinicoField label="Consumo de alcohol" estado={form.alcoholEstado} onEstadoChange={(v) => updateField('alcoholEstado', v)} />
          <EstadoClinicoField label="Sedentarismo" estado={form.sedentarismoEstado} onEstadoChange={(v) => updateField('sedentarismoEstado', v)} />
          <NumberField label="Ejercicio diario (min.)" value={form.ejercicioMinutosDia} onChange={(v) => updateField('ejercicioMinutosDia', v)} />
        </FichaSection>
        <FichaSection icon={ICONS.habitos} title="Contexto gineco-obstétrico" description="Opcional — completar solo si es clínicamente relevante.">
          <EstadoClinicoField label="Menarca" estado={form.menarcaEstado} onEstadoChange={(v) => updateField('menarcaEstado', v)} />
          {form.menarcaEstado === 'SI' ? <NumberField label="Edad de menarca" value={form.edadMenarca} onChange={(v) => updateField('edadMenarca', v)} /> : null}
          <EstadoClinicoField label="Menopausia" estado={form.menopausiaEstado} onEstadoChange={(v) => updateField('menopausiaEstado', v)} />
          {form.menopausiaEstado === 'SI' ? <NumberField label="Edad de menopausia" value={form.edadMenopausia} onChange={(v) => updateField('edadMenopausia', v)} /> : null}
          <NumberField label="Gestas" value={form.gestas} onChange={(v) => updateField('gestas', v)} />
          <NumberField label="Partos" value={form.partos} onChange={(v) => updateField('partos', v)} />
          <NumberField label="Abortos" value={form.abortos} onChange={(v) => updateField('abortos', v)} />
          <TextAreaField label="Observaciones" value={form.observacionesGineco} onChange={(v) => updateField('observacionesGineco', v)} />
        </FichaSection>
      </>
    ),

    dolor_funcion: (
      <>
        <FichaSection icon={ICONS.dolorFuncion} title="Dolor, función y evaluación inicial">
          <TextField id="ficha-field-dolorSintomas" label="Dolor o síntomas" value={form.dolorSintomas} onChange={(v) => updateField('dolorSintomas', v)} alert={alertFor('dolorSintomas')} />
          <TextField id="ficha-field-limitacionesFuncionales" label="Limitaciones funcionales" value={form.limitacionesFuncionales} onChange={(v) => updateField('limitacionesFuncionales', v)} alert={alertFor('limitacionesFuncionales')} />
          <TextAreaField id="ficha-field-hallazgosIniciales" label="Hallazgos iniciales" value={form.hallazgosIniciales} onChange={(v) => updateField('hallazgosIniciales', v)} alert={alertFor('hallazgosIniciales')} />
          <TextAreaField id="ficha-field-observacionesClinicas" label="Observaciones clínicas" value={form.observacionesClinicas} onChange={(v) => updateField('observacionesClinicas', v)} alert={alertFor('observacionesClinicas')} />
        </FichaSection>
      </>
    ),
  }

  return (
    <div className="ficha-form">
      <div className="ficha-form-header">
        <span className={`turnos-status-pill turnos-status-pill--${FICHA_COMPLETION_PILL_CLASS[completionStatus]}`}>
          {FICHA_COMPLETION_LABELS[completionStatus]}
        </span>
        <span className="ficha-saving-hint">{revisadas} de {total} secciones revisadas</span>
        {saving ? <span className="ficha-saving-hint">Guardando...</span> : null}
        <p className="patient-detail-note patient-detail-note--inline">
          {ficha
            ? `Última actualización: ${formatDateTime(ficha.updatedAt)}${ficha.profesionalResponsable ? ` · ${professionalName(ficha.profesionalResponsable)}` : ''}`
            : 'Completá la información clínica base del paciente. Los cambios se guardan automáticamente.'}
        </p>
      </div>

      {!canWrite ? (
        <p className="patient-detail-note">
          Tu usuario no está vinculado a un profesional. Un administrador debe completar el vínculo para registrar información clínica — podés consultar la ficha, pero no editarla.
        </p>
      ) : null}

      <div className="assessment-workspace">
        <AssessmentSectionNav sections={NAV_SECTIONS} activeKey={activeKey} onChange={setActiveKey} />
        <fieldset disabled={!canWrite} className="assessment-workspace-panel assessment-workspace-fieldset">{panels[activeKey]}</fieldset>
      </div>

      {saveError ? <p className="evolution-form-error">{saveError}</p> : null}
    </div>
  )
}

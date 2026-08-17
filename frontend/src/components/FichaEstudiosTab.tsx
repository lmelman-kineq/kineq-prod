import { useEffect } from 'react'
import type { UseFichaInicial } from '../hooks/useFichaInicial'
import FichaEstudiosList from './FichaEstudiosList'
import AlertToggleButton from './AlertToggleButton'
import type { ClinicalNavTarget } from '../utils/clinicalNavTarget'
import { scrollToAndHighlight } from '../utils/scrollAndHighlight'

const ESTUDIOS_ICON = (
  <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6Z" /><path d="M15 2v5h5" /><path d="M9 13h6M9 17h6" /></svg>
)

type Props = {
  fichaHook: UseFichaInicial
  navTarget?: ClinicalNavTarget | null
  onNavTargetHandled?: () => void
}

export default function FichaEstudiosTab({ fichaHook, navTarget, onNavTargetHandled }: Props) {
  const { ficha, loading, form, canWrite, updateField, toggleAlertaCampo } = fichaHook

  // Deep-link desde la alerta manual de "Estudios complementarios".
  useEffect(() => {
    if (!navTarget || navTarget.outerTab !== 'estudios') return
    scrollToAndHighlight(navTarget.elementId)
    onNavTargetHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navTarget?.token])

  if (loading) return <p>Cargando estudios...</p>

  const alertaEstudiosActiva = (ficha?.alertasCampo ?? []).some((a) => a.campo === 'estudiosComplementarios')

  return (
    <div className="ficha-form">
      <div className="ficha-section-header">
        <span className="ficha-section-icon" aria-hidden="true">{ESTUDIOS_ICON}</span>
        <div>
          <h3>Estudios complementarios</h3>
          <p className="ficha-section-description">Entradas puntuales con fecha, cada una con su archivo adjunto opcional (PDF, JPG, PNG o WEBP).</p>
        </div>
      </div>

      {!canWrite ? (
        <p className="patient-detail-note">
          Tu usuario no está vinculado a un profesional. Un administrador debe completar el vínculo para registrar información clínica — podés consultar los estudios, pero no editarlos.
        </p>
      ) : null}

      <fieldset disabled={!canWrite} className="assessment-workspace-fieldset ficha-estudios-tab-stack">
        <FichaEstudiosList
          estudios={ficha?.estudios ?? []}
          onAdd={fichaHook.addEstudio}
          onUpdate={fichaHook.updateEstudio}
          onRemove={fichaHook.removeEstudio}
          onUploadArchivo={fichaHook.uploadEstudioArchivo}
          onRemoveArchivo={fichaHook.removeEstudioArchivo}
        />
        <section className="ficha-section">
          <div className="ficha-section-header">
            <span className="ficha-section-icon" aria-hidden="true">{ESTUDIOS_ICON}</span>
            <div><h3>Nota general</h3></div>
          </div>
          <div className="ficha-form-grid">
            <label id="ficha-field-estudiosComplementarios" className="ficha-field ficha-field--wide">
              <span className="ficha-field-label-row">
                Estudios complementarios (notas)
                <AlertToggleButton
                  active={alertaEstudiosActiva}
                  disabled={!canWrite}
                  onToggle={() => { void toggleAlertaCampo('estudiosComplementarios') }}
                />
              </span>
              <textarea
                rows={2}
                value={form.estudiosComplementarios}
                onChange={(event) => updateField('estudiosComplementarios', event.target.value)}
              />
            </label>
          </div>
        </section>
      </fieldset>
    </div>
  )
}

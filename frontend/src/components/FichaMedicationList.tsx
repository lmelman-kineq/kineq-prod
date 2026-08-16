import { useState, type SVGProps } from 'react'
import type { FichaMedicacion, FichaMedicacionInput } from '../types/domain'

function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  )
}

function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 3l9 16H3l9-16Z" />
      <path d="M12 10v4" />
      <path d="M12 17.5v.01" />
    </svg>
  )
}

const EMPTY_FORM = { nombre: '', dosis: '', unidad: '', frecuencia: '', via: '', motivo: '', observaciones: '', esAlertaClinica: false }

type Props = {
  medicaciones: FichaMedicacion[]
  onAdd: (data: FichaMedicacionInput) => Promise<void>
  onUpdate: (id: number, data: Partial<FichaMedicacionInput>) => Promise<void>
  onRemove: (id: number) => Promise<void>
}

export default function FichaMedicationList({ medicaciones, onAdd, onUpdate, onRemove }: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const startAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setAdding(true)
  }

  const startEdit = (medicacion: FichaMedicacion) => {
    setAdding(false)
    setEditingId(medicacion.id)
    setForm({
      nombre: medicacion.nombre,
      dosis: medicacion.dosis ?? '',
      unidad: medicacion.unidad ?? '',
      frecuencia: medicacion.frecuencia ?? '',
      via: medicacion.via ?? '',
      motivo: medicacion.motivo ?? '',
      observaciones: medicacion.observaciones ?? '',
      esAlertaClinica: medicacion.esAlertaClinica,
    })
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
  }

  const save = async () => {
    if (!form.nombre.trim()) return
    const payload: FichaMedicacionInput = {
      nombre: form.nombre.trim(),
      dosis: form.dosis || undefined,
      unidad: form.unidad || undefined,
      frecuencia: form.frecuencia || undefined,
      via: form.via || undefined,
      motivo: form.motivo || undefined,
      observaciones: form.observaciones || undefined,
      esAlertaClinica: form.esAlertaClinica,
    }
    if (editingId !== null) await onUpdate(editingId, payload)
    else await onAdd(payload)
    cancel()
  }

  const formOpen = adding || editingId !== null

  return (
    <div className="antecedentes-section">
      {!formOpen ? (
        <button type="button" className="secondary-button" onClick={startAdd}>+ Agregar medicación</button>
      ) : (
        <div className="antecedentes-edit-form">
          <div className="antecedentes-edit-row antecedentes-edit-row--medicacion">
            <input type="text" placeholder="Nombre *" value={form.nombre} onChange={(event) => setForm((c) => ({ ...c, nombre: event.target.value }))} />
            <input type="text" placeholder="Dosis" value={form.dosis} onChange={(event) => setForm((c) => ({ ...c, dosis: event.target.value }))} />
            <input type="text" placeholder="Unidad" value={form.unidad} onChange={(event) => setForm((c) => ({ ...c, unidad: event.target.value }))} />
            <input type="text" placeholder="Frecuencia" value={form.frecuencia} onChange={(event) => setForm((c) => ({ ...c, frecuencia: event.target.value }))} />
            <input type="text" placeholder="Vía" value={form.via} onChange={(event) => setForm((c) => ({ ...c, via: event.target.value }))} />
            <input type="text" placeholder="Motivo" value={form.motivo} onChange={(event) => setForm((c) => ({ ...c, motivo: event.target.value }))} />
          </div>
          <label className="antecedentes-alerta-checkbox">
            <input
              type="checkbox"
              checked={form.esAlertaClinica}
              onChange={(event) => setForm((c) => ({ ...c, esAlertaClinica: event.target.checked }))}
            />
            <span>Marcar como alerta clínica</span>
          </label>
          <div className="evolution-edit-actions">
            <button type="button" className="secondary-button" onClick={cancel}>Cancelar</button>
            <button type="button" className="primary-button" disabled={!form.nombre.trim()} onClick={() => { void save() }}>Guardar</button>
          </div>
        </div>
      )}

      {medicaciones.length === 0 ? (
        <p className="patient-detail-note">Sin medicación registrada.</p>
      ) : (
        <div className="antecedentes-list">
          {medicaciones.map((medicacion) => (
            <div key={medicacion.id} id={`medicacion-row-${medicacion.id}`} className="antecedentes-item">
              <div className="antecedentes-item-info">
                <strong>
                  {medicacion.nombre}
                  {medicacion.esAlertaClinica ? <span className="clinical-alert-flag" title="Alerta clínica"> ⚠</span> : null}
                </strong>
                <span>
                  {[medicacion.dosis && `${medicacion.dosis}${medicacion.unidad ? ` ${medicacion.unidad}` : ''}`, medicacion.frecuencia, medicacion.via, medicacion.motivo]
                    .filter(Boolean)
                    .join(' · ') || 'Sin detalle adicional'}
                </span>
              </div>
              <div className="config-row-actions">
                <button
                  type="button"
                  className={`config-icon-button${medicacion.esAlertaClinica ? ' config-icon-button--alerta-activa' : ''}`}
                  aria-label={medicacion.esAlertaClinica ? 'Quitar de alertas clínicas' : 'Marcar como alerta clínica'}
                  title={medicacion.esAlertaClinica ? 'Quitar de alertas clínicas' : 'Marcar como alerta clínica'}
                  onClick={() => { void onUpdate(medicacion.id, { esAlertaClinica: !medicacion.esAlertaClinica }) }}
                >
                  <AlertIcon />
                </button>
                <button type="button" className="config-icon-button" aria-label="Editar medicación" title="Editar" onClick={() => startEdit(medicacion)}>
                  <EditIcon />
                </button>
                <button type="button" className="config-icon-button config-icon-button--danger" aria-label="Quitar medicación" title="Quitar" onClick={() => { void onRemove(medicacion.id) }}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

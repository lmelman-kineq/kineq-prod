import { useState, type SVGProps } from 'react'
import type { FichaEstudioComplementario, FichaEstudioInput } from '../types/domain'
import DateInput from './DateInput'

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

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

const EMPTY_FORM = { tipo: '', fecha: '', resumen: '' }

type Props = {
  estudios: FichaEstudioComplementario[]
  onAdd: (data: FichaEstudioInput) => Promise<void>
  onUpdate: (id: number, data: Partial<FichaEstudioInput>) => Promise<void>
  onRemove: (id: number) => Promise<void>
}

export default function FichaEstudiosList({ estudios, onAdd, onUpdate, onRemove }: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const startAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setAdding(true)
  }

  const startEdit = (estudio: FichaEstudioComplementario) => {
    setAdding(false)
    setEditingId(estudio.id)
    setForm({
      tipo: estudio.tipo,
      fecha: estudio.fecha ? estudio.fecha.slice(0, 10) : '',
      resumen: estudio.resumen ?? '',
    })
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
  }

  const save = async () => {
    if (!form.tipo.trim()) return
    const payload: FichaEstudioInput = {
      tipo: form.tipo.trim(),
      fecha: form.fecha || undefined,
      resumen: form.resumen || undefined,
    }
    if (editingId !== null) await onUpdate(editingId, payload)
    else await onAdd(payload)
    cancel()
  }

  const formOpen = adding || editingId !== null

  return (
    <div className="antecedentes-section">
      {!formOpen ? (
        <button type="button" className="secondary-button" onClick={startAdd}>+ Agregar estudio</button>
      ) : (
        <div className="antecedentes-edit-form">
          <div className="antecedentes-edit-row">
            <input type="text" placeholder="Tipo de estudio *" value={form.tipo} onChange={(event) => setForm((c) => ({ ...c, tipo: event.target.value }))} />
            <DateInput value={form.fecha} onChange={(fecha) => setForm((c) => ({ ...c, fecha }))} />
            <input type="text" placeholder="Resumen" value={form.resumen} onChange={(event) => setForm((c) => ({ ...c, resumen: event.target.value }))} />
          </div>
          <div className="ficha-field-archivo">
            <span>Archivo adjunto</span>
            {/* Carga real de archivos pendiente — ver adjuntar `fileId`/`attachmentId` a futuro */}
            <button type="button" className="secondary-button ficha-field-archivo-button" title="Carga de archivos próximamente" onClick={() => {}}>
              <UploadIcon /> Subir archivo
            </button>
            <span className="ficha-field-archivo-hint">Carga de archivos próximamente</span>
          </div>
          <div className="evolution-edit-actions">
            <button type="button" className="secondary-button" onClick={cancel}>Cancelar</button>
            <button type="button" className="primary-button" disabled={!form.tipo.trim()} onClick={() => { void save() }}>Guardar</button>
          </div>
        </div>
      )}

      {estudios.length === 0 ? (
        <p className="patient-detail-note">
          Todavía no hay estudios registrados. Agregá un estudio para mantener la información clínica organizada.
        </p>
      ) : (
        <div className="antecedentes-list">
          {estudios.map((estudio) => (
            <div key={estudio.id} className="antecedentes-item">
              <div className="antecedentes-item-info">
                <strong>{estudio.tipo}</strong>
                <span>
                  {[estudio.fecha ? estudio.fecha.slice(0, 10) : null, estudio.resumen].filter(Boolean).join(' · ') || 'Sin resumen'}
                </span>
              </div>
              <div className="config-row-actions">
                {/* Carga real de archivos pendiente — ver adjuntar `fileId`/`attachmentId` a futuro */}
                <button type="button" className="config-icon-button" aria-label="Subir archivo" title="Carga de archivos próximamente" onClick={() => {}}>
                  <UploadIcon />
                </button>
                <button type="button" className="config-icon-button" aria-label="Editar estudio" title="Editar" onClick={() => startEdit(estudio)}>
                  <EditIcon />
                </button>
                <button type="button" className="config-icon-button config-icon-button--danger" aria-label="Quitar estudio" title="Quitar" onClick={() => { void onRemove(estudio.id) }}>
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

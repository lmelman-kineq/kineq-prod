import { useRef, useState, type SVGProps } from 'react'
import type { FichaEstudioComplementario, FichaEstudioInput } from '../types/domain'
import { openAuthorizedFile } from '../services/api'
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

function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M6 2h9l5 5v15H6Z" />
      <path d="M15 2v5h5" />
    </svg>
  )
}

const EMPTY_FORM = { tipo: '', fecha: '', resumen: '' }

const MAX_ARCHIVO_SIZE_BYTES = 15 * 1024 * 1024
const ALLOWED_ARCHIVO_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

type Props = {
  estudios: FichaEstudioComplementario[]
  onAdd: (data: FichaEstudioInput) => Promise<FichaEstudioComplementario>
  onUpdate: (id: number, data: Partial<FichaEstudioInput>) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onUploadArchivo: (id: number, file: File) => Promise<void>
  onRemoveArchivo: (id: number) => Promise<void>
}

function validateArchivo(file: File): string | null {
  if (!ALLOWED_ARCHIVO_TYPES.includes(file.type)) return 'Formato no permitido. Solo se aceptan PDF, JPG, PNG o WEBP.'
  if (file.size > MAX_ARCHIVO_SIZE_BYTES) return `El archivo debe pesar como máximo ${MAX_ARCHIVO_SIZE_BYTES / (1024 * 1024)}MB.`
  return null
}

export default function FichaEstudiosList({ estudios, onAdd, onUpdate, onRemove, onUploadArchivo, onRemoveArchivo }: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [archivoBusyId, setArchivoBusyId] = useState<number | null>(null)
  const [archivoError, setArchivoError] = useState<{ id: number; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pickingForId, setPickingForId] = useState<number | null>(null)

  // Archivo elegido junto con el alta de un estudio nuevo (todavía sin id):
  // se sube recién al guardar, después de crear el estudio ("upload
  // diferido" — ver save()). Distinto de archivoBusyId/archivoError, que son
  // para subir/reemplazar el archivo de un estudio ya existente.
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [stagedFileError, setStagedFileError] = useState<string | null>(null)
  const stagedFileInputRef = useRef<HTMLInputElement | null>(null)

  const startAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setStagedFile(null)
    setStagedFileError(null)
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
    setStagedFile(null)
    setStagedFileError(null)
  }

  const handleStagedFileSelected = (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    const validationError = validateArchivo(file)
    if (validationError) {
      setStagedFileError(validationError)
      return
    }
    setStagedFileError(null)
    setStagedFile(file)
  }

  const save = async () => {
    if (!form.tipo.trim()) return
    const payload: FichaEstudioInput = {
      tipo: form.tipo.trim(),
      fecha: form.fecha || undefined,
      resumen: form.resumen || undefined,
    }
    setSaving(true)
    try {
      if (editingId !== null) {
        await onUpdate(editingId, payload)
      } else {
        const created = await onAdd(payload)
        if (stagedFile) {
          try {
            await onUploadArchivo(created.id, stagedFile)
          } catch (err) {
            // El estudio ya se guardó: no perder ese trabajo por un error de
            // subida. El archivo se puede reintentar desde la fila de la lista.
            setArchivoError({
              id: created.id,
              message: err instanceof Error && err.message.trim() ? err.message : 'El estudio se guardó, pero no se pudo subir el archivo. Podés reintentarlo desde la lista.',
            })
          }
        }
      }
      cancel()
    } finally {
      setSaving(false)
    }
  }

  const formOpen = adding || editingId !== null

  const triggerUpload = (estudioId: number) => {
    setPickingForId(estudioId)
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (fileList: FileList | null) => {
    const estudioId = pickingForId
    setPickingForId(null)
    const file = fileList?.[0]
    if (!file || estudioId === null) return

    if (!ALLOWED_ARCHIVO_TYPES.includes(file.type)) {
      setArchivoError({ id: estudioId, message: 'Formato no permitido. Solo se aceptan PDF, JPG, PNG o WEBP.' })
      return
    }
    if (file.size > MAX_ARCHIVO_SIZE_BYTES) {
      setArchivoError({ id: estudioId, message: `El archivo debe pesar como máximo ${MAX_ARCHIVO_SIZE_BYTES / (1024 * 1024)}MB.` })
      return
    }

    setArchivoError(null)
    setArchivoBusyId(estudioId)
    try {
      await onUploadArchivo(estudioId, file)
    } catch (err) {
      setArchivoError({ id: estudioId, message: err instanceof Error && err.message.trim() ? err.message : 'No se pudo subir el archivo.' })
    } finally {
      setArchivoBusyId(null)
    }
  }

  const handleRemoveArchivo = async (estudioId: number) => {
    setArchivoError(null)
    setArchivoBusyId(estudioId)
    try {
      await onRemoveArchivo(estudioId)
    } catch (err) {
      setArchivoError({ id: estudioId, message: err instanceof Error && err.message.trim() ? err.message : 'No se pudo eliminar el archivo.' })
    } finally {
      setArchivoBusyId(null)
    }
  }

  return (
    <div className="antecedentes-section">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          void handleFileSelected(event.target.files)
          event.target.value = ''
        }}
      />

      {!formOpen ? (
        <button type="button" className="secondary-button" onClick={startAdd}>+ Agregar estudio</button>
      ) : (
        <div className="antecedentes-edit-form">
          <div className="antecedentes-edit-row">
            <input type="text" placeholder="Tipo de estudio *" value={form.tipo} onChange={(event) => setForm((c) => ({ ...c, tipo: event.target.value }))} />
            <DateInput value={form.fecha} onChange={(fecha) => setForm((c) => ({ ...c, fecha }))} />
            <input type="text" placeholder="Resumen" value={form.resumen} onChange={(event) => setForm((c) => ({ ...c, resumen: event.target.value }))} />
          </div>

          {editingId !== null ? (
            <p className="ficha-field-archivo-hint">El archivo adjunto se sube desde la lista, con el estudio ya guardado.</p>
          ) : (
            <div className="ficha-estudio-staged-archivo">
              <input
                ref={stagedFileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  handleStagedFileSelected(event.target.files)
                  event.target.value = ''
                }}
              />
              {stagedFile ? (
                <span className="ficha-estudio-staged-archivo-chip">
                  <FileIcon />
                  {stagedFile.name}
                  <button
                    type="button"
                    className="config-icon-button config-icon-button--danger"
                    aria-label="Quitar archivo"
                    title="Quitar archivo"
                    onClick={() => setStagedFile(null)}
                  >
                    <TrashIcon />
                  </button>
                </span>
              ) : (
                <button type="button" className="secondary-button evolucion-images-upload-button" onClick={() => stagedFileInputRef.current?.click()}>
                  <UploadIcon /> Subir archivo
                </button>
              )}
              {stagedFileError ? <p className="evolution-form-error">{stagedFileError}</p> : null}
            </div>
          )}

          <div className="evolution-edit-actions">
            <button type="button" className="secondary-button" onClick={cancel} disabled={saving}>Cancelar</button>
            <button type="button" className="primary-button" disabled={!form.tipo.trim() || saving} onClick={() => { void save() }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {estudios.length === 0 ? (
        <p className="patient-detail-note">
          Todavía no hay estudios registrados. Agregá un estudio para mantener la información clínica organizada.
        </p>
      ) : (
        <div className="antecedentes-list">
          {estudios.map((estudio) => {
            const busy = archivoBusyId === estudio.id
            const rowError = archivoError?.id === estudio.id ? archivoError.message : null
            return (
              <div key={estudio.id} className="antecedentes-item antecedentes-item--column">
                <div className="antecedentes-item-row">
                  <div className="antecedentes-item-info">
                    <strong>{estudio.tipo}</strong>
                    <span>
                      {[estudio.fecha ? estudio.fecha.slice(0, 10) : null, estudio.resumen].filter(Boolean).join(' · ') || 'Sin resumen'}
                    </span>
                  </div>
                  <div className="config-row-actions">
                    {estudio.archivoUrl ? (
                      <>
                        <button
                          type="button"
                          className="config-icon-button"
                          aria-label="Ver archivo"
                          title={estudio.archivoNombreOriginal ?? 'Ver archivo'}
                          disabled={busy}
                          onClick={() => { void openAuthorizedFile(estudio.archivoUrl!) }}
                        >
                          <FileIcon />
                        </button>
                        <button
                          type="button"
                          className="config-icon-button config-icon-button--danger"
                          aria-label="Quitar archivo"
                          title="Quitar archivo"
                          disabled={busy}
                          onClick={() => { void handleRemoveArchivo(estudio.id) }}
                        >
                          <TrashIcon />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="config-icon-button"
                        aria-label="Subir archivo"
                        title="Subir archivo"
                        disabled={busy}
                        onClick={() => triggerUpload(estudio.id)}
                      >
                        <UploadIcon />
                      </button>
                    )}
                    <button type="button" className="config-icon-button" aria-label="Editar estudio" title="Editar" onClick={() => startEdit(estudio)}>
                      <EditIcon />
                    </button>
                    <button type="button" className="config-icon-button config-icon-button--danger" aria-label="Quitar estudio" title="Quitar" onClick={() => { void onRemove(estudio.id) }}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {busy ? <span className="ficha-field-archivo-hint">Subiendo...</span> : null}
                {rowError ? <p className="evolution-form-error">{rowError}</p> : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

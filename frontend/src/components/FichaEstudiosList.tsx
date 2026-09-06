import { useRef, useState, type SVGProps } from 'react'
import type { EstudioArchivo, FichaEstudioComplementario, FichaEstudioInput } from '../types/domain'
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
  onUploadArchivos: (id: number, files: File[]) => Promise<void>
  onRemoveArchivo: (estudioId: number, archivoId: number) => Promise<void>
}

// Devuelve el mensaje del PRIMER archivo inválido de la lista — subir se
// corta ahí (nunca "sube los válidos, avisa de los que fallan en silencio":
// el usuario vería una tanda parcial sin enterarse de cuál faltó).
function validateArchivos(files: File[]): string | null {
  for (const file of files) {
    if (!ALLOWED_ARCHIVO_TYPES.includes(file.type)) return `"${file.name}": formato no permitido. Solo se aceptan PDF, JPG, PNG o WEBP.`
    if (file.size > MAX_ARCHIVO_SIZE_BYTES) return `"${file.name}": debe pesar como máximo ${MAX_ARCHIVO_SIZE_BYTES / (1024 * 1024)}MB.`
  }
  return null
}

export default function FichaEstudiosList({ estudios, onAdd, onUpdate, onRemove, onUploadArchivos, onRemoveArchivo }: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [archivoBusyId, setArchivoBusyId] = useState<number | null>(null)
  const [archivoError, setArchivoError] = useState<{ id: number; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pickingForId, setPickingForId] = useState<number | null>(null)

  // Archivos elegidos junto con el alta de un estudio nuevo (todavía sin
  // id): se suben recién al guardar, después de crear el estudio ("upload
  // diferido" — ver save()). Distinto de archivoBusyId/archivoError, que son
  // para subir/eliminar archivos de un estudio ya existente.
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [stagedFileError, setStagedFileError] = useState<string | null>(null)
  const stagedFileInputRef = useRef<HTMLInputElement | null>(null)

  const startAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setStagedFiles([])
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
    setStagedFiles([])
    setStagedFileError(null)
  }

  const handleStagedFilesSelected = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    const validationError = validateArchivos(files)
    if (validationError) {
      setStagedFileError(validationError)
      return
    }
    setStagedFileError(null)
    setStagedFiles((current) => [...current, ...files])
  }

  const removeStagedFile = (index: number) => {
    setStagedFiles((current) => current.filter((_, i) => i !== index))
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
        if (stagedFiles.length > 0) {
          try {
            await onUploadArchivos(created.id, stagedFiles)
          } catch (err) {
            // El estudio ya se guardó: no perder ese trabajo por un error de
            // subida. Los archivos se pueden reintentar desde la fila de la lista.
            setArchivoError({
              id: created.id,
              message: err instanceof Error && err.message.trim() ? err.message : 'El estudio se guardó, pero no se pudieron subir los archivos. Podés reintentarlo desde la lista.',
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
    const files = Array.from(fileList ?? [])
    if (files.length === 0 || estudioId === null) return

    const validationError = validateArchivos(files)
    if (validationError) {
      setArchivoError({ id: estudioId, message: validationError })
      return
    }

    setArchivoError(null)
    setArchivoBusyId(estudioId)
    try {
      await onUploadArchivos(estudioId, files)
    } catch (err) {
      setArchivoError({ id: estudioId, message: err instanceof Error && err.message.trim() ? err.message : 'No se pudieron subir los archivos.' })
    } finally {
      setArchivoBusyId(null)
    }
  }

  const handleRemoveArchivo = async (estudioId: number, archivoId: number) => {
    setArchivoError(null)
    setArchivoBusyId(estudioId)
    try {
      await onRemoveArchivo(estudioId, archivoId)
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
        multiple
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
            <p className="ficha-field-archivo-hint">Los archivos adjuntos se suben desde la lista, con el estudio ya guardado.</p>
          ) : (
            <div className="ficha-estudio-staged-archivo">
              <input
                ref={stagedFileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => {
                  handleStagedFilesSelected(event.target.files)
                  event.target.value = ''
                }}
              />
              {stagedFiles.length > 0 ? (
                <div className="ficha-estudio-staged-archivo-list">
                  {stagedFiles.map((file, index) => (
                    <span key={`${file.name}-${index}`} className="ficha-estudio-staged-archivo-chip">
                      <FileIcon />
                      {file.name}
                      <button
                        type="button"
                        className="config-icon-button config-icon-button--danger"
                        aria-label="Quitar archivo"
                        title="Quitar archivo"
                        onClick={() => removeStagedFile(index)}
                      >
                        <TrashIcon />
                      </button>
                    </span>
                  ))}
                  <button type="button" className="secondary-button evolucion-images-upload-button" onClick={() => stagedFileInputRef.current?.click()}>
                    <UploadIcon /> Agregar más archivos
                  </button>
                </div>
              ) : (
                <button type="button" className="secondary-button evolucion-images-upload-button" onClick={() => stagedFileInputRef.current?.click()}>
                  <UploadIcon /> Subir archivos
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
                    <button
                      type="button"
                      className="config-icon-button"
                      aria-label="Subir archivos"
                      title="Subir archivos"
                      disabled={busy}
                      onClick={() => triggerUpload(estudio.id)}
                    >
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

                {estudio.archivos.length > 0 ? (
                  <div className="ficha-estudio-archivos-list">
                    {estudio.archivos.map((archivo: EstudioArchivo) => (
                      <span key={archivo.id} className="ficha-estudio-staged-archivo-chip">
                        <button
                          type="button"
                          className="ficha-estudio-archivo-link"
                          title={archivo.nombreOriginal}
                          onClick={() => { void openAuthorizedFile(archivo.url) }}
                        >
                          <FileIcon />
                          {archivo.nombreOriginal}
                        </button>
                        <button
                          type="button"
                          className="config-icon-button config-icon-button--danger"
                          aria-label="Eliminar archivo"
                          title="Eliminar archivo"
                          disabled={busy}
                          onClick={() => { void handleRemoveArchivo(estudio.id, archivo.id) }}
                        >
                          <TrashIcon />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

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

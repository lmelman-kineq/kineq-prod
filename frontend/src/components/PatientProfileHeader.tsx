import { useEffect, useRef, useState } from 'react'
import type { Paciente } from '../types/domain'
import { calculateAge } from '../utils/dateFormat'
import { patientFullName } from '../utils/patient'
import * as api from '../services/api'
import PatientAvatar from './PatientAvatar'
import AuthorizedImg from './AuthorizedImg'

const MAX_FOTO_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_FOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type PatientProfileHeaderProps = {
  patient: Paciente
  socialWorkName?: string | null
  canEditPhoto?: boolean
  onPhotoChanged?: (fotoUrl: string | null) => void
}

function joinFacts(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

export default function PatientProfileHeader({ patient, socialWorkName, canEditPhoto, onPhotoChanged }: PatientProfileHeaderProps) {
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const avatarWrapperRef = useRef<HTMLDivElement | null>(null)

  // Cierra el popover de "Foto del paciente" al hacer click afuera o
  // presionar Escape — mismo patrón que el popover de "Foto de perfil" del
  // usuario logueado en App.tsx.
  useEffect(() => {
    if (!photoMenuOpen) return undefined
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (avatarWrapperRef.current && !avatarWrapperRef.current.contains(target)) setPhotoMenuOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPhotoMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [photoMenuOpen])
  const age = calculateAge(patient.fechaNacimiento)
  const contactLine = joinFacts([patient.email, patient.telefono])
  const metaLine = joinFacts([
    patient.documento ? `DNI ${patient.documento}` : null,
    age !== null ? `${age} años` : null,
    socialWorkName ?? patient.obraSocial?.nombre ?? null,
    patient.numeroAfiliado ? `Afiliado ${patient.numeroAfiliado}` : null,
  ])

  const handleFileSelected = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return

    if (!ALLOWED_FOTO_TYPES.includes(file.type)) {
      setError('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.')
      return
    }
    if (file.size > MAX_FOTO_SIZE_BYTES) {
      setError(`La foto debe pesar como máximo ${MAX_FOTO_SIZE_BYTES / (1024 * 1024)}MB.`)
      return
    }

    setError(null)
    setUploading(true)
    try {
      const { fotoUrl } = await api.uploadPacienteFoto(patient.id, file)
      onPhotoChanged?.(fotoUrl)
      setPhotoMenuOpen(false)
    } catch (err) {
      setError(err instanceof Error && err.message.trim() ? err.message : 'No se pudo subir la foto.')
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async () => {
    setError(null)
    setUploading(true)
    try {
      await api.deletePacienteFoto(patient.id)
      onPhotoChanged?.(null)
      setPhotoMenuOpen(false)
    } catch (err) {
      setError(err instanceof Error && err.message.trim() ? err.message : 'No se pudo eliminar la foto.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <header className="patient-profile-header">
      <div className="patient-header-identity">
        <div className="avatar-wrapper" ref={avatarWrapperRef}>
          {patient.fotoUrl ? (
            <div className="patient-avatar patient-avatar--xl patient-avatar--photo">
              <AuthorizedImg src={patient.fotoUrl} alt="" />
            </div>
          ) : (
            <PatientAvatar nombre={patient.nombre} apellido={patient.apellido} size="xl" />
          )}
          {canEditPhoto ? (
            <>
              <button
                type="button"
                className="avatar-edit-button avatar-edit-button--circle"
                aria-label="Foto del paciente"
                title="Foto del paciente"
                onClick={() => setPhotoMenuOpen((current) => !current)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  void handleFileSelected(event.target.files)
                  event.target.value = ''
                }}
              />
              {photoMenuOpen ? (
                <div className="avatar-edit-popover" role="dialog" aria-label="Foto del paciente">
                  <p className="avatar-edit-popover-title">Foto del paciente</p>
                  <div className="avatar-edit-popover-actions">
                    <button type="button" className="secondary-button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                      {uploading ? 'Subiendo...' : patient.fotoUrl ? 'Reemplazar foto' : 'Subir foto'}
                    </button>
                    {patient.fotoUrl ? (
                      <button type="button" className="secondary-button" disabled={uploading} onClick={() => { void removePhoto() }}>
                        Quitar foto
                      </button>
                    ) : null}
                  </div>
                  {error ? <p className="evolution-form-error">{error}</p> : null}
                  <button type="button" className="secondary-button" onClick={() => setPhotoMenuOpen(false)}>Cerrar</button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="patient-profile-info">
          <div className="patient-detail-title-row">
            <h1>{patientFullName(patient)}</h1>
            {/* El caso normal (Activo) no necesita badge — ruido visual
                para el estado esperado. Solo se muestra cuando hay algo
                relevante que señalar (Inactivo). */}
            {!patient.activo ? (
              <span className="turnos-status-pill turnos-status-pill--cancelado">Inactivo</span>
            ) : null}
          </div>
          <p className="patient-profile-contact">{contactLine || 'Sin datos de contacto registrados'}</p>
          <p className="patient-profile-meta">{metaLine || 'Sin documento ni obra social registrados'}</p>
        </div>
      </div>
    </header>
  )
}

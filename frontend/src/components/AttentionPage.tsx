import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as api from '../services/api'
import type {
  EstadoTurno,
  Evolucion,
  Paciente,
  Turno as DomainTurno,
} from '../types/domain'
import type { ConfirmDialogOptions, Turno } from '../App'
import { statusClass } from '../utils/turnoStatus'
import { formatPlainDate } from '../utils/dateFormat'
import { computeFichaCompletionStatus } from '../utils/fichaInicial'
import { useFichaInicial } from '../hooks/useFichaInicial'
import { useAuth } from '../auth/AuthContext'
import PatientAvatar from './PatientAvatar'
import PatientSummaryCards from './PatientSummaryCards'
import PatientAdminSummary from './PatientAdminSummary'
import ClinicalSummaryPanel from './ClinicalSummaryPanel'
import ClinicalTabs, { type ClinicalTab } from './ClinicalTabs'
import EvolutionTable from './EvolutionTable'
import InitialAssessmentPanel from './InitialAssessmentPanel'
import PatientAppointmentsTable from './PatientAppointmentsTable'
import FichaEstudiosTab from './FichaEstudiosTab'
import RichTextEditor from './RichTextEditor'
import type { ClinicalNavRequest, ClinicalNavTarget } from '../utils/clinicalNavTarget'

type AttentionPageProps = {
  turno: Turno
  refreshKey: number
  onBack: () => void
  onUpdateEstado: (turnoId: number, estado: EstadoTurno) => Promise<Turno | null>
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function AttentionPage({ turno, refreshKey, onBack, onUpdateEstado, onRequestConfirm }: AttentionPageProps) {
  const { user } = useAuth()
  const [patient, setPatient] = useState<Paciente | null>(null)
  const [turnos, setTurnos] = useState<DomainTurno[]>([])
  const [evoluciones, setEvoluciones] = useState<Evolucion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [activeTab, setActiveTab] = useState('evoluciones')

  const navTokenRef = useRef(0)
  const [navTarget, setNavTarget] = useState<ClinicalNavTarget | null>(null)
  const navigateToClinicalTarget = (request: ClinicalNavRequest) => {
    navTokenRef.current += 1
    setActiveTab(request.outerTab)
    setNavTarget({ ...request, token: navTokenRef.current })
  }

  const [newEvolucionText, setNewEvolucionText] = useState('')
  const [newEvolucionHtml, setNewEvolucionHtml] = useState('')
  const [savingEvolucion, setSavingEvolucion] = useState(false)
  const [evolucionError, setEvolucionError] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)

  const [editingEvolucionId, setEditingEvolucionId] = useState<number | null>(null)
  const [editingEvolucionText, setEditingEvolucionText] = useState('')
  const [editingEvolucionHtml, setEditingEvolucionHtml] = useState('')
  const [savingEvolucionEdit, setSavingEvolucionEdit] = useState(false)
  const [editEvolucionError, setEditEvolucionError] = useState<string | null>(null)

  const canEditClinical = user?.rol === 'ADMINISTRADOR' || user?.rol === 'PROFESIONAL'
  // Autoría clínica: además del rol, hace falta un profesional vinculado —
  // el backend vuelve a exigir esto en cada escritura clínica.
  const canWriteClinical = canEditClinical && Boolean(user?.profesionalId)
  const fichaHook = useFichaInicial(turno.patientId, canEditClinical, refreshKey, canWriteClinical)

  const loadEvoluciones = async () => {
    if (!canEditClinical) return
    const response = await api.getEvoluciones(turno.patientId)
    setEvoluciones(response)
  }

  useEffect(() => {
    let cancelled = false

    async function loadAttentionData() {
      setLoading(true)
      setError(null)

      try {
        const [patientResult, turnosResult, evolucionesResult] = await Promise.all([
          api.getPaciente(turno.patientId),
          api.getTurnos({ pacienteId: turno.patientId }),
          canEditClinical ? api.getEvoluciones(turno.patientId) : Promise.resolve([]),
        ])

        if (cancelled) return
        setPatient(patientResult)
        setTurnos(turnosResult)
        setEvoluciones(evolucionesResult)
      } catch (loadError) {
        if (!cancelled) {
          setPatient(null)
          setError(getErrorMessage(loadError, 'No se pudo cargar la información del paciente.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadAttentionData()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno.patientId, refreshKey])

  useEffect(() => {
    if (turno.status !== 'Atendiendo' || !turno.startAttention) return undefined

    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [turno.status, turno.startAttention])

  const elapsedSeconds =
    turno.status === 'Atendiendo' && turno.startAttention
      ? Math.max(0, Math.floor((now - new Date(turno.startAttention).getTime()) / 1000))
      : 0

  const submitEvolucion = async () => {
    const contenido = newEvolucionText.trim()
    if (!contenido || !user?.profesionalId) return

    setSavingEvolucion(true)
    setEvolucionError(null)

    try {
      await api.createEvolucion({
        pacienteId: turno.patientId,
        profesionalId: user.profesionalId,
        turnoId: turno.id,
        contenido,
        contenidoHtml: newEvolucionHtml || null,
      })
      setNewEvolucionText('')
      setNewEvolucionHtml('')
      await loadEvoluciones()
    } catch (createError) {
      setEvolucionError(getErrorMessage(createError, 'No se pudo guardar la evolución.'))
    } finally {
      setSavingEvolucion(false)
    }
  }

  const canEditEvolucion = (evolucion: Evolucion) =>
    Boolean(user?.profesionalId) &&
    (user?.rol === 'ADMINISTRADOR' || (user?.rol === 'PROFESIONAL' && evolucion.profesionalId === user.profesionalId))

  const startEditEvolucion = (evolucion: Evolucion) => {
    setEditingEvolucionId(evolucion.id)
    setEditingEvolucionText(evolucion.contenido)
    setEditingEvolucionHtml(evolucion.contenidoHtml ?? '')
    setEditEvolucionError(null)
  }

  const cancelEditEvolucion = () => {
    setEditingEvolucionId(null)
    setEditingEvolucionText('')
    setEditingEvolucionHtml('')
    setEditEvolucionError(null)
  }

  const saveEditEvolucion = async () => {
    if (editingEvolucionId === null) return
    const contenido = editingEvolucionText.trim()
    if (!contenido) return

    setSavingEvolucionEdit(true)
    setEditEvolucionError(null)

    try {
      await api.patchEvolucion(editingEvolucionId, { contenido, contenidoHtml: editingEvolucionHtml || null })
      cancelEditEvolucion()
      await loadEvoluciones()
    } catch (patchError) {
      setEditEvolucionError(getErrorMessage(patchError, 'No se pudo guardar la edición.'))
    } finally {
      setSavingEvolucionEdit(false)
    }
  }

  const deleteEvolucion = async (evolucion: Evolucion) => {
    try {
      await api.deleteEvolucion(evolucion.id)
      if (editingEvolucionId === evolucion.id) cancelEditEvolucion()
      await loadEvoluciones()
    } catch (deleteError) {
      setEvolucionError(getErrorMessage(deleteError, 'No se pudo eliminar la evolución.'))
    }
  }

  const requestDeleteEvolucion = (evolucion: Evolucion) => {
    onRequestConfirm({
      title: 'Eliminar evolución',
      description: 'Esta nota clínica deja de mostrarse en el historial del paciente.',
      confirmLabel: 'Eliminar evolución',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: () => { void deleteEvolucion(evolucion) },
    })
  }

  const goToFicha = () => setActiveTab('ficha')

  const doFinalize = async () => {
    setFinalizing(true)
    const updated = await onUpdateEstado(turno.id, 'FINALIZADO')
    setFinalizing(false)
    if (updated) onBack()
  }

  const finalizarAtencion = () => {
    const hasUnsavedDraft = newEvolucionText.trim().length > 0 || fichaHook.pending || editingEvolucionId !== null

    if (hasUnsavedDraft) {
      onRequestConfirm({
        title: 'Tenés cambios sin guardar',
        description: 'Si finalizás ahora, la evolución o la ficha inicial que estás editando se van a perder. ¿Querés finalizar igual?',
        confirmLabel: 'Finalizar igual',
        cancelLabel: 'Volver',
        destructive: true,
        onConfirm: () => { void doFinalize() },
      })
      return
    }

    const hasEvolucionDelTurno = evoluciones.some((evolucion) => evolucion.turnoId === turno.id)
    if (!hasEvolucionDelTurno) {
      onRequestConfirm({
        title: 'Este turno no tiene una evolución cargada',
        description: '¿Querés finalizar igualmente?',
        confirmLabel: 'Finalizar igualmente',
        cancelLabel: 'Volver y cargar evolución',
        destructive: true,
        onConfirm: () => { void doFinalize() },
      })
      return
    }

    onRequestConfirm({
      title: 'Finalizar atención',
      description: '¿Seguro que querés finalizar la atención de este paciente? El turno quedará marcado como finalizado.',
      confirmLabel: 'Finalizar atención',
      cancelLabel: 'Cancelar',
      destructive: false,
      onConfirm: () => { void doFinalize() },
    })
  }

  const sortedEvoluciones = [...evoluciones].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const lastEvolucion = sortedEvoluciones[0] ?? null
  const hasEvolucionDelTurno = evoluciones.some((evolucion) => evolucion.turnoId === turno.id)
  const fichaStatus = computeFichaCompletionStatus(fichaHook.form)
  const nextTurno = turnos
    .filter((t) => t.estado === 'ASIGNADO' || t.estado === 'EN_ESPERA')
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())[0] ?? null

  const tabs: ClinicalTab[] = [
    ...(canEditClinical ? [{ key: 'evoluciones', label: 'Evoluciones', badge: evoluciones.length ? String(evoluciones.length) : undefined }] : []),
    ...(canEditClinical ? [{ key: 'ficha', label: 'Ficha inicial' }] : []),
    { key: 'turnos', label: 'Turnos' },
    ...(canEditClinical ? [{ key: 'estudios', label: 'Estudios' }] : []),
  ]

  const evolucionesPanel = (
    <>
      {canEditClinical ? (
        canWriteClinical ? (
          <div className="evolution-form">
            <label htmlFor="nueva-evolucion">Evolución de la sesión</label>
            <p className="patient-detail-note patient-detail-note--inline">
              La evolución se va a registrar como {turno.professionalId === user?.profesionalId ? turno.professionalDisplay : 'tu profesional vinculado'}.
            </p>
            <RichTextEditor
              id="nueva-evolucion"
              html={newEvolucionHtml}
              placeholder="Qué se trabajó, cómo respondió el paciente, indicaciones y próximos pasos..."
              onChange={(html, plainText) => {
                setNewEvolucionHtml(html)
                setNewEvolucionText(plainText)
              }}
            />
            <button
              type="button"
              className="primary-button"
              disabled={!newEvolucionText.trim() || savingEvolucion}
              onClick={() => { void submitEvolucion() }}
            >
              {savingEvolucion ? 'Guardando...' : 'Guardar evolución'}
            </button>
          </div>
        ) : (
          <p className="patient-detail-note">
            Tu usuario no está vinculado a un profesional. Un administrador debe completar el vínculo para registrar información clínica.
          </p>
        )
      ) : (
        <p className="patient-detail-note">No tenés acceso al contenido clínico de este turno.</p>
      )}

      {evolucionError ? <p className="evolution-form-error">{evolucionError}</p> : null}

      {canEditClinical ? (
        loading ? (
          <p>Cargando evoluciones...</p>
        ) : (
          <EvolutionTable
            evoluciones={sortedEvoluciones}
            canEdit={canEditEvolucion}
            editingId={editingEvolucionId}
            editingText={editingEvolucionText}
            editingHtml={editingEvolucionHtml}
            onStartEdit={startEditEvolucion}
            onCancelEdit={cancelEditEvolucion}
            onChangeEditingText={setEditingEvolucionText}
            onChangeEditingHtml={setEditingEvolucionHtml}
            onSaveEdit={() => { void saveEditEvolucion() }}
            onDelete={requestDeleteEvolucion}
            saving={savingEvolucionEdit}
            error={editEvolucionError}
          />
        )
      ) : null}
    </>
  )

  const fichaPanel = <InitialAssessmentPanel fichaHook={fichaHook} navTarget={navTarget} onNavTargetHandled={() => setNavTarget(null)} />

  const panels: Record<string, ReactNode> = {
    evoluciones: evolucionesPanel,
    ficha: fichaPanel,
    turnos: <PatientAppointmentsTable turnos={turnos} />,
    estudios: <FichaEstudiosTab fichaHook={fichaHook} navTarget={navTarget} onNavTargetHandled={() => setNavTarget(null)} />,
  }

  return (
    <div className="patient-detail-page attention-page">
      <button type="button" className="patient-detail-back-button" onClick={onBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Volver
      </button>

      <header className="patient-detail-header attention-header">
        <div className="patient-header-identity">
          <PatientAvatar nombre={patient?.nombre ?? turno.patientDisplay} apellido={patient?.apellido ?? ''} size="lg" />
          <div className="patient-detail-heading">
            <div className="patient-detail-title-row">
              <h1>{turno.patientDisplay}</h1>
              <span className={`turnos-status-pill turnos-status-pill--${statusClass(turno.status)}`}>
                {turno.status}
              </span>
            </div>
            <p className="patient-detail-subtitle">
              {formatPlainDate(turno.date)} · {turno.time} — {turno.professionalDisplay ?? 'Profesional no disponible'}
              {turno.specialtyName ? ` · ${turno.specialtyName}` : ''}
              {turno.sessionNumber != null ? ` · Sesión ${turno.sessionNumber}` : ''}
            </p>
          </div>
        </div>

        <div className="attention-header-actions">
          {turno.status === 'Atendiendo' && turno.startAttention ? (
            <div className="attention-timer">
              <p className="details-label">Tiempo atendiendo</p>
              <strong>{new Date(elapsedSeconds * 1000).toISOString().slice(11, 19)}</strong>
              <span className="details-duration-hint">Reservado: {turno.duration} min</span>
            </div>
          ) : (
            <div className="attention-timer attention-timer--static">
              <p className="details-label">Duración reservada</p>
              <strong>{turno.duration} min</strong>
            </div>
          )}

          {turno.status === 'Atendiendo' ? (
            <button type="button" className="primary-button" disabled={finalizing} onClick={finalizarAtencion}>
              {finalizing ? 'Finalizando...' : 'Finalizar atención'}
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <section className="schedule-panel" role="alert">
          <h2>No se pudo cargar la información del paciente</h2>
          <p>{error}</p>
        </section>
      ) : null}

      <PatientSummaryCards
        turnos={turnos}
        ficha={fichaHook.ficha}
        fichaStatus={fichaStatus}
        onGoToFicha={goToFicha}
        onNavigateToTarget={navigateToClinicalTarget}
      />

      <div className="patient-detail-layout">
        <div className="patient-detail-stack">
          <section className="patient-detail-card">
            <h2>Datos administrativos</h2>
            {loading ? <p>Cargando datos del paciente...</p> : patient ? (
              <PatientAdminSummary patient={patient} socialWorkName={turno.socialWorkDisplay} />
            ) : (
              <p>No se pudieron cargar los datos del paciente.</p>
            )}
          </section>

          {canEditClinical ? (
            <section className="patient-detail-card">
              <h2>Resumen clínico</h2>
              <ClinicalSummaryPanel
                loading={fichaHook.loading}
                ficha={fichaHook.ficha}
                fichaForm={fichaHook.form}
                lastEvolucionDate={lastEvolucion?.createdAt ?? null}
                nextTurnoDate={nextTurno?.inicio ?? null}
                onGoToFicha={goToFicha}
                showNoEvolucionAlert={turno.status === 'Atendiendo' && !hasEvolucionDelTurno}
              />
            </section>
          ) : null}
        </div>

        <div className="patient-detail-card clinical-workspace">
          <ClinicalTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} panels={panels} />
        </div>
      </div>
    </div>
  )
}

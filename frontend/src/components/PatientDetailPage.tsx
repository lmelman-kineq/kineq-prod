import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as api from '../services/api'
import type { Evolucion, GrupoEvolucion, Paciente, Profesional, Turno } from '../types/domain'
import type { ConfirmDialogOptions } from '../App'
import { useAuth } from '../auth/AuthContext'
import PatientProfileHeader from './PatientProfileHeader'
import PatientSummaryCards from './PatientSummaryCards'
import ClinicalSummaryPanel from './ClinicalSummaryPanel'
import ClinicalTabs, { type ClinicalTab } from './ClinicalTabs'
import EvolutionTable, { GrupoChip } from './EvolutionTable'
import GrupoEvolucionModal from './GrupoEvolucionModal'
import GestionarGruposModal from './GestionarGruposModal'
import DiagnosticoSelect from './DiagnosticoSelect'
import InitialAssessmentPanel from './InitialAssessmentPanel'
import PatientAppointmentsTable from './PatientAppointmentsTable'
import FichaEstudiosTab from './FichaEstudiosTab'
import PatientFormModal from './PatientFormModal'
import RichTextEditor from './RichTextEditor'
import { useFichaInicial } from '../hooks/useFichaInicial'
import { computeFichaCompletionStatus } from '../utils/fichaInicial'
import { professionalName } from '../utils/professional'
import { groupEvolucionesByGrupo } from '../utils/groupEvolucionesByGrupo'
import { SPECIALTY_COLOR_TOKENS } from '../utils/specialtyColors'
import type { ClinicalNavRequest, ClinicalNavTarget } from '../utils/clinicalNavTarget'

type PatientDetailPageProps = {
  patientId: number
  patientSocialWorkById: Record<number, string | null>
  refreshKey: number
  onBack: () => void
  onNewTurno: (patientId: number) => void
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function PatientDetailPage({
  patientId,
  patientSocialWorkById,
  refreshKey,
  onBack,
  onNewTurno,
  onRequestConfirm,
}: PatientDetailPageProps) {
  const { user } = useAuth()
  const canEditClinical = user?.rol === 'ADMINISTRADOR' || user?.rol === 'PROFESIONAL'
  const canEditAdmin = user?.rol === 'ADMINISTRADOR' || user?.rol === 'RECEPCION'
  // Autoría clínica: además del rol, hace falta un profesional vinculado —
  // el backend vuelve a exigir esto en cada escritura, acá solo evitamos
  // ofrecer acciones que el servidor va a rechazar.
  const canWriteClinical = canEditClinical && Boolean(user?.profesionalId)

  const [patient, setPatient] = useState<Paciente | null>(null)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [evoluciones, setEvoluciones] = useState<Evolucion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(() => (canEditClinical ? 'ficha' : 'turnos'))
  const [editPatientOpen, setEditPatientOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [newEvolucionText, setNewEvolucionText] = useState('')
  const [newEvolucionHtml, setNewEvolucionHtml] = useState('')
  const [savingEvolucion, setSavingEvolucion] = useState(false)
  const [evolucionError, setEvolucionError] = useState<string | null>(null)
  const [propioProfesional, setPropioProfesional] = useState<Profesional | null>(null)

  const [editingEvolucionId, setEditingEvolucionId] = useState<number | null>(null)
  const [editingEvolucionText, setEditingEvolucionText] = useState('')
  const [editingEvolucionHtml, setEditingEvolucionHtml] = useState('')
  const [editingEvolucionGrupoId, setEditingEvolucionGrupoId] = useState<number | null>(null)
  const [savingEvolucionEdit, setSavingEvolucionEdit] = useState(false)
  const [editEvolucionError, setEditEvolucionError] = useState<string | null>(null)

  const [grupos, setGrupos] = useState<GrupoEvolucion[]>([])
  const [nuevaEvolucionGrupoId, setNuevaEvolucionGrupoId] = useState<number | ''>('')
  const [grupoModal, setGrupoModal] = useState<'crear' | GrupoEvolucion | null>(null)
  const [vistaEvoluciones, setVistaEvoluciones] = useState<'fecha' | 'grupo'>('fecha')
  const [gestionarGruposOpen, setGestionarGruposOpen] = useState(false)
  const [filtroGrupo, setFiltroGrupo] = useState<'todos' | 'sin-grupo' | number>('todos')
  const [grupoFilterOpen, setGrupoFilterOpen] = useState(false)
  const grupoFilterRef = useRef<HTMLDivElement | null>(null)

  // Deep-link "click en alerta clínica → ir al campo de origen" (ver
  // utils/clinicalNavTarget.ts). `token` fuerza a los efectos que lo
  // escuchan a reaccionar incluso si el destino es idéntico al anterior.
  const navTokenRef = useRef(0)
  const [navTarget, setNavTarget] = useState<ClinicalNavTarget | null>(null)
  const navigateToClinicalTarget = (request: ClinicalNavRequest) => {
    navTokenRef.current += 1
    setActiveTab(request.outerTab)
    setNavTarget({ ...request, token: navTokenRef.current })
  }

  const fichaHook = useFichaInicial(patientId, canEditClinical, refreshKey, canWriteClinical)

  const loadGrupos = async () => {
    if (!canEditClinical) return
    const response = await api.getGruposEvolucion(patientId)
    setGrupos(response)
  }

  // Alta rápida de Diagnóstico desde el propio dropdown (DiagnosticoSelect,
  // mismo patrón que "+ Nueva Especialidad"): único campo obligatorio es el
  // nombre, color asignado automáticamente (rotación sobre la misma paleta
  // curada que ya usa Especialidad/Grupo). La gestión completa (editar
  // nombre/color, eliminar) sigue viviendo en GrupoEvolucionModal, sin
  // duplicar esa lógica acá. No toca el contenido de la evolución en curso.
  const createDiagnosticoInline = async (nombre: string): Promise<GrupoEvolucion> => {
    const color = SPECIALTY_COLOR_TOKENS[grupos.length % SPECIALTY_COLOR_TOKENS.length]
    const created = await api.createGrupoEvolucion(patientId, { nombre, color })
    setGrupos((current) => [created, ...current])
    return created
  }

  const loadEvoluciones = async () => {
    if (!canEditClinical) return
    const response = await api.getEvoluciones(patientId)
    setEvoluciones(response)
  }

  useEffect(() => {
    if (!grupoFilterOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (grupoFilterRef.current && !grupoFilterRef.current.contains(event.target as Node)) setGrupoFilterOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [grupoFilterOpen])

  // Única lógica de borrado de grupo — la usan tanto GestionarGruposModal
  // (tachito en la lista) como GrupoEvolucionModal (tachito del modal de
  // edición), con la misma confirmación y el mismo llamado al backend.
  // El backend nunca borra evoluciones: grupoId queda en null (onDelete: SetNull).
  const deleteGrupo = (grupo: GrupoEvolucion, afterDelete?: () => void) => {
    onRequestConfirm({
      title: 'Eliminar diagnóstico',
      description: 'Las evoluciones vinculadas a este diagnóstico se conservarán y quedarán sin diagnóstico.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: async () => {
        await api.deleteGrupoEvolucion(grupo.id)
        if (filtroGrupo === grupo.id) setFiltroGrupo('todos')
        afterDelete?.()
        void loadGrupos()
        void loadEvoluciones()
      },
    })
  }

  useEffect(() => {
    let cancelled = false

    async function loadPatientDetail() {
      setLoading(true)
      setError(null)

      try {
        const [patientResult, turnosResult, evolucionesResult, profesionalesResult, gruposResult] = await Promise.all([
          api.getPaciente(patientId),
          api.getTurnos({ pacienteId: patientId }),
          canEditClinical ? api.getEvoluciones(patientId) : Promise.resolve([]),
          user?.profesionalId ? api.getProfesionales() : Promise.resolve([]),
          canEditClinical ? api.getGruposEvolucion(patientId) : Promise.resolve([]),
        ])

        if (cancelled) return
        setPatient(patientResult)
        setTurnos(turnosResult)
        setEvoluciones(evolucionesResult)
        setPropioProfesional(profesionalesResult.find((p) => p.id === user?.profesionalId) ?? null)
        setGrupos(gruposResult)
      } catch (loadError) {
        if (!cancelled) {
          setPatient(null)
          setError(getErrorMessage(loadError, 'No se pudo cargar la información del paciente.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPatientDetail()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, refreshKey])

  const submitEvolucion = async () => {
    const contenido = newEvolucionText.trim()
    if (!contenido || !user?.profesionalId) return

    setSavingEvolucion(true)
    setEvolucionError(null)

    try {
      await api.createEvolucion({
        pacienteId: patientId,
        profesionalId: user.profesionalId,
        contenido,
        contenidoHtml: newEvolucionHtml || null,
        grupoId: nuevaEvolucionGrupoId || null,
      })
      setNewEvolucionText('')
      setNewEvolucionHtml('')
      setNuevaEvolucionGrupoId('')
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
    setEditingEvolucionGrupoId(evolucion.grupoId ?? null)
    setEditEvolucionError(null)
  }

  const cancelEditEvolucion = () => {
    setEditingEvolucionId(null)
    setEditingEvolucionText('')
    setEditingEvolucionHtml('')
    setEditingEvolucionGrupoId(null)
    setEditEvolucionError(null)
  }

  const saveEditEvolucion = async () => {
    if (editingEvolucionId === null) return
    const contenido = editingEvolucionText.trim()
    if (!contenido) return

    setSavingEvolucionEdit(true)
    setEditEvolucionError(null)

    try {
      await api.patchEvolucion(editingEvolucionId, { contenido, contenidoHtml: editingEvolucionHtml || null, grupoId: editingEvolucionGrupoId })
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

  if (loading) {
    return (
      <div className="patient-detail-page">
        <p>Cargando paciente...</p>
      </div>
    )
  }

  if (error || !patient) {
    return (
      <div className="patient-detail-page">
        <button type="button" className="patient-detail-back-button" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Volver a Pacientes
        </button>
        <section className="schedule-panel" role="alert">
          <h2>No se pudo cargar el paciente</h2>
          <p>{error ?? 'El paciente no existe o no pertenece a este consultorio.'}</p>
        </section>
      </div>
    )
  }

  const deletePatient = async () => {
    setDeleting(true)
    try {
      await api.patchPaciente(patient.id, { activo: false })
      onBack()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'No se pudo eliminar el paciente.'))
      setDeleting(false)
    }
  }

  const requestDeletePatient = () => {
    onRequestConfirm({
      title: 'Eliminar paciente',
      description: 'El paciente dejará de aparecer en la operación diaria. Sus turnos futuros se cancelarán y su historial clínico se conservará.',
      confirmLabel: 'Eliminar paciente',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: () => { void deletePatient() },
    })
  }

  const sortedEvoluciones = [...evoluciones].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const lastEvolucion = sortedEvoluciones[0] ?? null
  const socialWorkName = patient.obraSocial?.nombre ?? patientSocialWorkById[patient.id] ?? null
  const fichaStatus = computeFichaCompletionStatus(fichaHook.form)

  const nextTurno = turnos
    .filter((turno) => turno.estado === 'ASIGNADO' || turno.estado === 'EN_ESPERA')
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())[0] ?? null

  const tabs: ClinicalTab[] = [
    ...(canEditClinical ? [{ key: 'ficha', label: 'Ficha inicial' }] : []),
    ...(canEditClinical ? [{ key: 'evoluciones', label: 'Evoluciones', badge: evoluciones.length ? String(evoluciones.length) : undefined }] : []),
    { key: 'turnos', label: 'Turnos' },
    ...(canEditClinical ? [{ key: 'estudios', label: 'Estudios' }] : []),
  ]

  const evolutionTableCommonProps = {
    canEdit: canEditEvolucion,
    editingId: editingEvolucionId,
    editingText: editingEvolucionText,
    editingHtml: editingEvolucionHtml,
    onStartEdit: startEditEvolucion,
    onCancelEdit: cancelEditEvolucion,
    onChangeEditingText: setEditingEvolucionText,
    onChangeEditingHtml: setEditingEvolucionHtml,
    onSaveEdit: () => { void saveEditEvolucion() },
    onDelete: requestDeleteEvolucion,
    saving: savingEvolucionEdit,
    error: editEvolucionError,
    grupos,
    editingGrupoId: editingEvolucionGrupoId,
    onChangeEditingGrupoId: setEditingEvolucionGrupoId,
  }

  // Filtro por grupo: acota qué se ve en la tab Evoluciones (ambas vistas),
  // sin afectar "Última evolución" del resumen ni el badge de la tab, que
  // siguen reflejando el total real del paciente.
  const evolucionesFiltradas = filtroGrupo === 'todos'
    ? sortedEvoluciones
    : filtroGrupo === 'sin-grupo'
      ? sortedEvoluciones.filter((e) => !e.grupoId)
      : sortedEvoluciones.filter((e) => e.grupoId === filtroGrupo)

  const { secciones, sinGrupo: evolucionesSinGrupo } = groupEvolucionesByGrupo(evolucionesFiltradas)

  const panels: Record<string, ReactNode> = {
    evoluciones: (
      <>
        {canWriteClinical ? (
          <div className="evolution-form">
            <label htmlFor="nueva-evolucion">Nueva evolución</label>
            <p className="patient-detail-note patient-detail-note--inline">
              La evolución se va a registrar como {propioProfesional ? professionalName(propioProfesional) : 'tu profesional vinculado'}.
            </p>
            <RichTextEditor
              id="nueva-evolucion"
              html={newEvolucionHtml}
              placeholder="Qué se observó, qué se trabajó, indicaciones y próximos pasos..."
              onChange={(html, plainText) => {
                setNewEvolucionHtml(html)
                setNewEvolucionText(plainText)
              }}
            />
            <DiagnosticoSelect
              grupos={grupos}
              value={nuevaEvolucionGrupoId}
              onChange={setNuevaEvolucionGrupoId}
              onCreate={createDiagnosticoInline}
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
        ) : canEditClinical ? (
          <p className="patient-detail-note">
            Tu usuario no está vinculado a un profesional. Un administrador debe completar el vínculo para registrar información clínica.
          </p>
        ) : null}
        {evolucionError ? <p className="evolution-form-error">{evolucionError}</p> : null}

        <div className="evolutions-toolbar">
          <div className="antecedentes-categorias" role="tablist" aria-label="Vista de evoluciones">
            <button
              type="button"
              role="tab"
              aria-selected={vistaEvoluciones === 'fecha'}
              className={`antecedentes-categoria-button${vistaEvoluciones === 'fecha' ? ' antecedentes-categoria-button--active' : ''}`}
              onClick={() => setVistaEvoluciones('fecha')}
            >
              <span className="label-full">Ver por fecha</span>
              <span className="label-compact">Por fecha</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vistaEvoluciones === 'grupo'}
              className={`antecedentes-categoria-button${vistaEvoluciones === 'grupo' ? ' antecedentes-categoria-button--active' : ''}`}
              onClick={() => setVistaEvoluciones('grupo')}
            >
              <span className="label-full">Ver por diagnóstico</span>
              <span className="label-compact">Por diagnóstico</span>
            </button>
          </div>
          <div className="evolutions-toolbar-actions">
            <div className="schedule-filters-wrapper" ref={grupoFilterRef}>
              <button
                type="button"
                className={`filter-button ${filtroGrupo !== 'todos' ? 'has-active-filter' : ''}`}
                aria-expanded={grupoFilterOpen}
                aria-label="Filtro"
                title="Filtro"
                onClick={() => setGrupoFilterOpen((current) => !current)}
              >
                <span className="label-full">Filtro</span>
                <span className="filter-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 4H21L14 11V18L10 20V11L3 4Z" />
                  </svg>
                </span>
              </button>

              {grupoFilterOpen ? (
                <div className="filters-panel">
                  <div className="filter-group">
                    <strong>Diagnóstico</strong>
                    <label>
                      <input
                        type="radio"
                        name="filtro-grupo-evolucion"
                        checked={filtroGrupo === 'todos'}
                        onChange={() => { setFiltroGrupo('todos'); setGrupoFilterOpen(false) }}
                      />
                      Todos los diagnósticos
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="filtro-grupo-evolucion"
                        checked={filtroGrupo === 'sin-grupo'}
                        onChange={() => { setFiltroGrupo('sin-grupo'); setGrupoFilterOpen(false) }}
                      />
                      Sin diagnóstico
                    </label>
                    {grupos.map((g) => (
                      <label key={g.id}>
                        <input
                          type="radio"
                          name="filtro-grupo-evolucion"
                          checked={filtroGrupo === g.id}
                          onChange={() => { setFiltroGrupo(g.id); setGrupoFilterOpen(false) }}
                        />
                        {g.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {canWriteClinical ? (
              <button type="button" className="secondary-button" onClick={() => setGestionarGruposOpen(true)}>Ver diagnósticos</button>
            ) : null}
          </div>
        </div>

        {vistaEvoluciones === 'grupo' ? (
          <div className="evolutions-by-group">
            {secciones.map(({ grupo, items }) => (
              <div key={grupo.id} className="evolutions-group-section">
                <div className="evolutions-group-section-header">
                  <button
                    type="button"
                    className="clinical-summary-link evolutions-group-edit-button"
                    onClick={() => setGrupoModal(grupo)}
                    disabled={!canWriteClinical}
                  >
                    <GrupoChip grupo={grupo} />
                  </button>
                  <span>{items.length} evolución{items.length === 1 ? '' : 'es'}</span>
                </div>
                <EvolutionTable evoluciones={items} {...evolutionTableCommonProps} />
              </div>
            ))}
            {evolucionesSinGrupo.length ? (
              <div className="evolutions-group-section">
                <div className="evolutions-group-section-header">
                  <strong>Sin diagnóstico</strong>
                  <span>{evolucionesSinGrupo.length} evolución{evolucionesSinGrupo.length === 1 ? '' : 'es'}</span>
                </div>
                <EvolutionTable evoluciones={evolucionesSinGrupo} {...evolutionTableCommonProps} />
              </div>
            ) : null}
            {secciones.length === 0 && evolucionesSinGrupo.length === 0 ? (
              <EvolutionTable evoluciones={[]} {...evolutionTableCommonProps} />
            ) : null}
          </div>
        ) : (
          <EvolutionTable evoluciones={evolucionesFiltradas} {...evolutionTableCommonProps} />
        )}

        {gestionarGruposOpen ? (
          <GestionarGruposModal
            grupos={grupos}
            onClose={() => setGestionarGruposOpen(false)}
            onEditGrupo={(grupo) => { setGestionarGruposOpen(false); setGrupoModal(grupo) }}
            onNuevoGrupo={() => { setGestionarGruposOpen(false); setGrupoModal('crear') }}
            onDeleteGrupo={(grupo) => deleteGrupo(grupo)}
          />
        ) : null}

        {grupoModal ? (
          <GrupoEvolucionModal
            pacienteId={patientId}
            grupo={grupoModal === 'crear' ? undefined : grupoModal}
            onClose={() => setGrupoModal(null)}
            onSaved={() => {
              setGrupoModal(null)
              void loadGrupos()
              void loadEvoluciones()
            }}
            onDelete={(grupo) => deleteGrupo(grupo, () => setGrupoModal(null))}
            onRequestConfirm={onRequestConfirm}
          />
        ) : null}
      </>
    ),
    ficha: <InitialAssessmentPanel fichaHook={fichaHook} patientId={patientId} navTarget={navTarget} onNavTargetHandled={() => setNavTarget(null)} />,
    turnos: <PatientAppointmentsTable turnos={turnos} />,
    estudios: <FichaEstudiosTab fichaHook={fichaHook} navTarget={navTarget} onNavTargetHandled={() => setNavTarget(null)} />,
  }

  return (
    <div className="patient-detail-page">
      <div className="patient-detail-topbar">
        <button type="button" className="patient-detail-back-button" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Volver a Pacientes
        </button>

        {canEditAdmin ? (
          <button
            type="button"
            className="icon-button--danger"
            aria-label="Eliminar paciente"
            title="Eliminar paciente"
            disabled={deleting}
            onClick={requestDeletePatient}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
            </svg>
          </button>
        ) : null}
      </div>

      <PatientProfileHeader
        patient={patient}
        socialWorkName={socialWorkName}
        actions={
          <>
            {canEditAdmin ? (
              <button type="button" className="secondary-button" onClick={() => setEditPatientOpen(true)}>
                Editar paciente
              </button>
            ) : null}
            <button type="button" className="new-turn-button" onClick={() => onNewTurno(patient.id)}>
              Nuevo turno
            </button>
          </>
        }
      />

      <PatientSummaryCards
        turnos={turnos}
        ficha={fichaHook.ficha}
        fichaStatus={fichaStatus}
        onGoToFicha={() => setActiveTab('ficha')}
        onNavigateToTarget={navigateToClinicalTarget}
      />

      <div className={`patient-detail-layout${canEditClinical ? '' : ' patient-detail-layout--full'}`}>
        {canEditClinical ? (
          <div className="patient-detail-stack">
            <section className="patient-detail-card">
              <h2>Resumen clínico</h2>
              <ClinicalSummaryPanel
                loading={fichaHook.loading}
                ficha={fichaHook.ficha}
                fichaForm={fichaHook.form}
                lastEvolucionDate={lastEvolucion?.createdAt ?? null}
                nextTurnoDate={nextTurno?.inicio ?? null}
                onGoToFicha={() => setActiveTab('ficha')}
              />
            </section>
          </div>
        ) : null}

        <div className="patient-detail-card clinical-workspace">
          <ClinicalTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} panels={panels} />
        </div>
      </div>

      {editPatientOpen ? (
        <PatientFormModal
          patient={patient}
          canEditObservaciones={user?.rol === 'ADMINISTRADOR'}
          onClose={() => setEditPatientOpen(false)}
          onSaved={(updated) => {
            setPatient(updated)
            setEditPatientOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

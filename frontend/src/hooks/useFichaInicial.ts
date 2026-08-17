import { useEffect, useRef, useState } from 'react'
import * as api from '../services/api'
import type {
  FichaAlergiaInput,
  FichaAntecedenteInput,
  FichaEstudioInput,
  FichaInicial,
  FichaMedicacionInput,
} from '../types/domain'
import { buildFichaPayload, fichaFormFromFicha } from '../utils/fichaInicial'

const FICHA_AUTOSAVE_DELAY_MS = 900

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

// Autoguardado + CRUD de antecedentes/alergias/medicación/estudios/secciones
// de la Ficha Inicial. Usado por PatientDetailPage.tsx (única pantalla de
// Paciente, con o sin turno activo — ver `activeTurno` en ese componente).
// `canEditClinical` gobierna la lectura (según rol); `canWriteClinical`
// gobierna la escritura (además necesita profesional vinculado) — el backend
// vuelve a validar todo esto, acá solo evitamos autoguardar en vano.
export function useFichaInicial(patientId: number, canEditClinical: boolean, refreshKey: number, canWriteClinical = canEditClinical) {
  const [ficha, setFicha] = useState<FichaInicial | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Record<string, string>>(() => fichaFormFromFicha(null))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const skipAutosaveRef = useRef(true)
  const autosaveTimerRef = useRef<number | null>(null)
  // Espejo en ref de `pending` (a diferencia del state, siempre está al día
  // dentro de un handler async aunque el usuario haya seguido escribiendo
  // mientras ese handler esperaba una respuesta de red — un closure sobre
  // el state `pending` capturado en el render del click puede quedar
  // desactualizado para cuando la promesa resuelve).
  const pendingRef = useRef(false)

  // Refetch silenciosa, sin tocar `loading`: la usan tanto la carga inicial
  // como los handlers de antecedentes/alergias/medicación/estudios/alertas
  // después de cada cambio. Nunca pisa `form` si hay una edición de texto
  // sin guardar todavía (`pendingRef`): antes, marcar una alerta mientras el
  // autoguardado del campo de texto seguía en debounce podía traer de vuelta
  // el valor viejo del servidor y perder lo recién tipeado — bug real
  // encontrado en producción. Si hay algo pendiente, `ficha` sí se
  // actualiza (para que se vea la alerta/antecedente nuevo), pero `form`
  // queda como está hasta que el autoguardado en curso termine.
  const refresh = async () => {
    if (!canEditClinical) return
    try {
      const result = await api.getFichaInicial(patientId)
      setFicha(result)
      if (!pendingRef.current) {
        skipAutosaveRef.current = true
        setForm(fichaFormFromFicha(result))
      }
    } catch (err) {
      setSaveError(getErrorMessage(err, 'No se pudo cargar la ficha inicial.'))
    }
  }

  useEffect(() => {
    let cancelled = false
    // Fetch-on-mount con guarda de cancelación; mismo patrón ya usado sin
    // objeción en PatientDetailPage.tsx, el linter solo lo marca acá por
    // vivir dentro de un hook `use*`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, refreshKey, canEditClinical])

  const autosave = async () => {
    setSaving(true)
    setSaveError(null)
    const payload = buildFichaPayload(form)
    try {
      const saved = await api.patchFichaInicial(patientId, payload)
      setFicha(saved)
    } catch (err) {
      setSaveError(getErrorMessage(err, 'No se pudo guardar la ficha inicial.'))
    } finally {
      setSaving(false)
      setPending(false)
      pendingRef.current = false
    }
  }

  // Autoguardado con debounce, sin botón de guardar/borrador manual.
  useEffect(() => {
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false
      return undefined
    }
    if (!canWriteClinical) return undefined

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => { void autosave() }, FICHA_AUTOSAVE_DELAY_MS)

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const updateField = (field: string, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setPending(true)
    pendingRef.current = true
  }

  // Los antecedentes/alergias/medicación/estudios/secciones se recargan
  // pidiendo la ficha completa de nuevo después de cada cambio: son
  // operaciones clínicas de baja frecuencia (agregar un antecedente no pasa
  // cientos de veces por minuto), así que un round-trip extra es más simple
  // y más difícil de romper que parchear listas anidadas a mano en el estado.
  const addAntecedente = async (data: FichaAntecedenteInput) => {
    await api.createFichaAntecedente(patientId, data)
    await refresh()
  }
  const updateAntecedente = async (id: number, data: Partial<FichaAntecedenteInput>) => {
    await api.patchFichaAntecedente(id, data)
    await refresh()
  }
  const removeAntecedente = async (id: number) => {
    await api.deleteFichaAntecedente(id)
    await refresh()
  }

  const addAlergia = async (data: FichaAlergiaInput) => {
    await api.createFichaAlergia(patientId, data)
    await refresh()
  }
  const updateAlergia = async (id: number, data: Partial<FichaAlergiaInput>) => {
    await api.patchFichaAlergia(id, data)
    await refresh()
  }
  const removeAlergia = async (id: number) => {
    await api.deleteFichaAlergia(id)
    await refresh()
  }

  const addMedicacion = async (data: FichaMedicacionInput) => {
    await api.createFichaMedicacion(patientId, data)
    await refresh()
  }
  const updateMedicacion = async (id: number, data: Partial<FichaMedicacionInput>) => {
    await api.patchFichaMedicacion(id, data)
    await refresh()
  }
  const removeMedicacion = async (id: number) => {
    await api.deleteFichaMedicacion(id)
    await refresh()
  }

  // Alertas manuales sobre campos de texto libre elegibles (Motivo,
  // Traumatismos, Dolor y función, etc.) — la existencia de la fila es la
  // alerta, así que "toggle" es simplemente crear o borrar.
  const toggleAlertaCampo = async (campo: string) => {
    const activa = (ficha?.alertasCampo ?? []).some((a) => a.campo === campo)
    if (activa) {
      await api.deleteAlertaCampo(patientId, campo)
    } else {
      await api.putAlertaCampo(patientId, campo)
    }
    await refresh()
  }

  const addEstudio = async (data: FichaEstudioInput) => {
    await api.createFichaEstudio(patientId, data)
    await refresh()
  }
  const updateEstudio = async (id: number, data: Partial<FichaEstudioInput>) => {
    await api.patchFichaEstudio(id, data)
    await refresh()
  }
  const removeEstudio = async (id: number) => {
    await api.deleteFichaEstudio(id)
    await refresh()
  }

  return {
    ficha,
    loading,
    form,
    saving,
    saveError,
    pending,
    canWrite: canWriteClinical,
    updateField,
    addAntecedente,
    updateAntecedente,
    removeAntecedente,
    addAlergia,
    updateAlergia,
    removeAlergia,
    addMedicacion,
    updateMedicacion,
    removeMedicacion,
    addEstudio,
    updateEstudio,
    removeEstudio,
    toggleAlertaCampo,
  }
}

export type UseFichaInicial = ReturnType<typeof useFichaInicial>

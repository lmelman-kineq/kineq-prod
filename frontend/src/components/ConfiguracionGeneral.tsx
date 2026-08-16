import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { Consultorio, ConsultorioInput } from '../types/domain'
import ConfigSectionHeader from './ConfigSectionHeader'
import AddressAutocompleteInput from './AddressAutocompleteInput'
import { TIMEZONE_OPTIONS, getTimezoneOffsetLabel } from '../utils/timezone'

type FormState = {
  nombre: string
  email: string
  telefono: string
  direccion: string
  ciudad: string
  provincia: string
  zonaHoraria: string
}

function formFromConsultorio(consultorio: Consultorio): FormState {
  return {
    nombre: consultorio.nombre,
    email: consultorio.email ?? '',
    telefono: consultorio.telefono ?? '',
    direccion: consultorio.direccion ?? '',
    ciudad: consultorio.ciudad ?? '',
    provincia: consultorio.provincia ?? '',
    zonaHoraria: consultorio.zonaHoraria,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function ConfiguracionGeneral() {
  const [consultorio, setConsultorio] = useState<Consultorio | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.getConsultorio()
      .then((result) => {
        if (cancelled) return
        setConsultorio(result)
        setForm(formFromConsultorio(result))
      })
      .catch((loadError) => {
        if (!cancelled) setError(getErrorMessage(loadError, 'No se pudo cargar la configuración del consultorio.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p>Cargando configuración...</p>
  if (error || !consultorio || !form) return <p className="evolution-form-error">{error ?? 'No se pudo cargar.'}</p>

  const dirty = JSON.stringify(form) !== JSON.stringify(formFromConsultorio(consultorio))

  const update = (patch: Partial<FormState>) => {
    setForm((current) => (current ? { ...current, ...patch } : current))
    setSavedNotice(false)
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    const payload: ConsultorioInput = {
      nombre: form.nombre.trim(),
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      direccion: form.direccion.trim() || null,
      ciudad: form.ciudad.trim() || null,
      provincia: form.provincia.trim() || null,
      zonaHoraria: form.zonaHoraria,
    }
    try {
      const updated = await api.patchConsultorio(payload)
      setConsultorio(updated)
      setForm(formFromConsultorio(updated))
      setSavedNotice(true)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar la configuración.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <ConfigSectionHeader title="General" description="Datos administrativos básicos del consultorio." />

      <div className="ficha-form-grid">
        <label className="ficha-field">
          <span>Nombre del consultorio</span>
          <input type="text" value={form.nombre} onChange={(event) => update({ nombre: event.target.value })} />
        </label>
        <label className="ficha-field">
          <span>Email administrativo</span>
          <input type="email" value={form.email} onChange={(event) => update({ email: event.target.value })} />
        </label>
        <label className="ficha-field">
          <span>Teléfono</span>
          <input type="text" value={form.telefono} onChange={(event) => update({ telefono: event.target.value })} />
        </label>
        <label className="ficha-field">
          <span>Zona horaria</span>
          <select value={form.zonaHoraria} onChange={(event) => update({ zonaHoraria: event.target.value })}>
            {(TIMEZONE_OPTIONS.some((option) => option.zone === form.zonaHoraria)
              ? TIMEZONE_OPTIONS
              : [...TIMEZONE_OPTIONS, { zone: form.zonaHoraria, city: form.zonaHoraria }]
            ).map(({ zone, city }) => (
              <option key={zone} value={zone}>{city} — {getTimezoneOffsetLabel(zone)}</option>
            ))}
          </select>
        </label>
        <label className="ficha-field ficha-field--wide">
          <span>Dirección</span>
          <AddressAutocompleteInput value={form.direccion} onChange={(direccion) => update({ direccion })} />
        </label>
        <label className="ficha-field">
          <span>Ciudad</span>
          <input type="text" value={form.ciudad} onChange={(event) => update({ ciudad: event.target.value })} />
        </label>
        <label className="ficha-field">
          <span>Provincia</span>
          <input type="text" value={form.provincia} onChange={(event) => update({ provincia: event.target.value })} />
        </label>
      </div>

      {error ? <p className="evolution-form-error">{error}</p> : null}

      <div className="config-form-actions">
        {dirty ? <span className="ficha-saving-hint">Cambios sin guardar</span> : savedNotice ? <span className="ficha-saving-hint">Guardado</span> : null}
        <button type="button" className="primary-button" disabled={saving || !dirty} onClick={() => { void submit() }}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

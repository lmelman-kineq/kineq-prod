import { useEffect, useMemo, useState } from 'react'
import * as api from '../services/api'
import type { Especialidad, EstadisticasResumen, Profesional } from '../types/domain'
import { useAuth } from '../auth/AuthContext'
import { PERIODO_PRESETS, DEFAULT_PERIODO_PRESET, rangoParaPreset, type PeriodoPreset } from '../utils/statsPeriods'
import { professionalName } from '../utils/professional'
import DateInput from './DateInput'
import {
  EvolutionChart,
  EstadoTurnosChart,
  SesionesPorProfesionalChart,
  ActividadPorEspecialidadChart,
  ResumenProfesionalesTable,
} from './EstadisticasCharts'
import { SkeletonCards } from './Skeleton'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function KpiCard({ label, value, hint, size = 'normal' }: { label: string; value: string; hint?: string; size?: 'normal' | 'small' }) {
  return (
    <div className={`patient-summary-card${size === 'small' ? ' stats-kpi-card--small' : ''}`}>
      <p className="patient-summary-label">{label}</p>
      <p className="patient-summary-value">{value}</p>
      {hint ? <p className="patient-summary-hint">{hint}</p> : null}
    </div>
  )
}

function formatPct(pct: number | null): string {
  return pct === null ? '—' : `${pct.toString().replace('.', ',')} %`
}

export default function EstadisticasPage() {
  const { user } = useAuth()
  const esProfesional = user?.rol === 'PROFESIONAL'
  const sinAcceso = user?.rol === 'RECEPCION'

  const [preset, setPreset] = useState<PeriodoPreset>(DEFAULT_PERIODO_PRESET)
  const [customDesde, setCustomDesde] = useState('')
  const [customHasta, setCustomHasta] = useState('')
  const [profesionalId, setProfesionalId] = useState<number | ''>('')
  const [especialidadId, setEspecialidadId] = useState<number | ''>('')

  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [resumen, setResumen] = useState<EstadisticasResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const rango = useMemo(() => {
    if (preset === 'personalizado') {
      if (!customDesde || !customHasta || customDesde > customHasta) return null
      return { desde: customDesde, hasta: customHasta }
    }
    return rangoParaPreset(preset)
  }, [preset, customDesde, customHasta])

  useEffect(() => {
    if (sinAcceso) return
    let cancelled = false

    async function loadCatalogos() {
      try {
        const [profesionalesResult, especialidadesResult] = await Promise.all([
          esProfesional ? Promise.resolve([]) : api.getProfesionales(),
          api.getEspecialidades(),
        ])
        if (cancelled) return
        setProfesionales(profesionalesResult)
        setEspecialidades(especialidadesResult)
      } catch {
        // Los catálogos son solo para poblar los filtros — si fallan, los
        // selects quedan vacíos, pero el resumen igual puede cargar.
      }
    }

    void loadCatalogos()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinAcceso])

  useEffect(() => {
    if (sinAcceso || !rango) return
    let cancelled = false

    async function loadResumen() {
      setLoading(true)
      setError(null)
      try {
        const result = await api.getEstadisticasResumen({
          desde: rango!.desde,
          hasta: rango!.hasta,
          profesionalId: esProfesional ? undefined : (profesionalId || undefined),
          especialidadId: especialidadId || undefined,
        })
        if (!cancelled) setResumen(result)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'No se pudieron cargar las estadísticas.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadResumen()
    return () => { cancelled = true }
  }, [sinAcceso, rango, profesionalId, especialidadId, esProfesional, reloadKey])

  if (sinAcceso) {
    return (
      <div className="patients-page">
        <div className="patients-page-header"><h1>Estadísticas</h1></div>
        <section className="patients-table-card">
          <p className="turnos-table-message"><strong>No tenés acceso a esta sección.</strong></p>
        </section>
      </div>
    )
  }

  return (
    <div className="patients-page">
      <div className="patients-page-header"><h1>Estadísticas</h1></div>

      <section className="patients-table-card stats-filters-card">
        <div className="stats-periodo-chips antecedentes-categorias">
          {PERIODO_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`antecedentes-categoria-button${preset === p.key ? ' antecedentes-categoria-button--active' : ''}`}
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="config-filters-row">
          {preset === 'personalizado' ? (
            <>
              <DateInput value={customDesde} onChange={setCustomDesde} max={customHasta || undefined} />
              <DateInput value={customHasta} onChange={setCustomHasta} min={customDesde || undefined} />
            </>
          ) : null}

          {!esProfesional ? (
            <select value={profesionalId} onChange={(event) => setProfesionalId(event.target.value ? Number(event.target.value) : '')}>
              <option value="">Todos los profesionales</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>{professionalName(p)}</option>
              ))}
            </select>
          ) : null}

          <select value={especialidadId} onChange={(event) => setEspecialidadId(event.target.value ? Number(event.target.value) : '')}>
            <option value="">Todas las especialidades</option>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </div>
      </section>

      {!rango ? (
        <section className="patients-table-card">
          <p className="turnos-table-message"><strong>Elegí una fecha de inicio y fin para el período personalizado.</strong></p>
        </section>
      ) : loading && !resumen ? (
        // Primera carga (sin datos previos todavía): skeleton discreto en
        // vez de un texto grande de "Cargando...".
        <>
          <div className="patient-summary-grid">
            <SkeletonCards count={4} />
          </div>
          <div className="patient-summary-grid">
            <SkeletonCards count={4} />
          </div>
        </>
      ) : error && !resumen ? (
        <section className="patients-table-card" role="alert">
          <p className="evolution-form-error">{error}</p>
          <button type="button" className="secondary-button" onClick={() => setReloadKey((k) => k + 1)}>Reintentar</button>
        </section>
      ) : !resumen ? null : resumen.kpis.turnos === 0 ? (
        <section className="patients-table-card">
          <p className="turnos-table-message">
            <strong>Todavía no hay datos suficientes para este período.</strong>
            <span>Probá ampliando el rango de fechas.</span>
          </p>
        </section>
      ) : (
        <>
          {/* Cambiar filtros/período dispara un refetch, pero los datos del
              período anterior se mantienen en pantalla (sin volver a un
              "Cargando...") hasta que llegan los nuevos — solo se avisa con
              una nota chica, nunca se oculta un error real. */}
          {loading ? (
            <p className="patient-detail-note patient-detail-note--inline">Actualizando estadísticas…</p>
          ) : error ? (
            <p className="evolution-form-error">{error}</p>
          ) : null}
          <div className="patient-summary-grid">
            <KpiCard label="Turnos" value={String(resumen.kpis.turnos)} />
            <KpiCard label="Sesiones realizadas" value={String(resumen.kpis.sesionesRealizadas)} />
            <KpiCard label="Pacientes atendidos" value={String(resumen.kpis.pacientesAtendidos)} />
            <KpiCard
              label="Ausentismo"
              value={formatPct(resumen.kpis.ausentismo.porcentaje)}
              hint={`${resumen.kpis.ausentismo.cantidad} ausencias`}
            />
          </div>

          <div className="patient-summary-grid">
            <KpiCard size="small" label="Cancelaciones" value={formatPct(resumen.kpis.cancelaciones.porcentaje)} hint={`${resumen.kpis.cancelaciones.cantidad} turnos`} />
            <KpiCard size="small" label="Pacientes nuevos" value={String(resumen.kpis.pacientesNuevos)} />
            <KpiCard size="small" label="Evoluciones registradas" value={String(resumen.kpis.evolucionesRegistradas)} />
            <KpiCard
              size="small"
              label="Promedio de sesiones por paciente"
              value={resumen.kpis.promedioSesionesPorPaciente === null ? '—' : resumen.kpis.promedioSesionesPorPaciente.toString().replace('.', ',')}
            />
          </div>

          <div className="stats-charts-grid">
            <EvolutionChart resumen={resumen} />
            <EstadoTurnosChart estados={resumen.estados} />
            {!esProfesional ? <SesionesPorProfesionalChart porProfesional={resumen.porProfesional} /> : null}
            <ActividadPorEspecialidadChart porEspecialidad={resumen.porEspecialidad} />
          </div>

          {!esProfesional ? <ResumenProfesionalesTable resumenProfesionales={resumen.resumenProfesionales} /> : null}
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import type { EstadisticasResumen, EstadoTurno } from '../types/domain'
import { mapEstadoToStatus } from '../utils/turnoStatus'
import { professionalName } from '../utils/professional'

const ESTADO_COLOR: Record<EstadoTurno, string> = {
  ASIGNADO: 'var(--color-primary)',
  EN_ESPERA: 'var(--turnos-waiting-badge)',
  ATENDIENDO: 'var(--turnos-attending)',
  FINALIZADO: 'var(--color-success)',
  AUSENTE: 'var(--color-warning)',
  CANCELADO: 'var(--color-danger)',
}

function formatBucketLabel(fecha: string): string {
  // 'YYYY-MM' (mes) vs 'YYYY-MM-DD' (día/semana).
  const parts = fecha.split('-')
  if (parts.length === 2) return `${parts[1]}/${parts[0].slice(2)}`
  return `${parts[2]}/${parts[1]}`
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="patients-table-card stats-chart-card">
      <div className="turnos-table-toolbar">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

export function EvolutionChart({ resumen }: { resumen: EstadisticasResumen }) {
  const subtitleByGranularidad: Record<EstadisticasResumen['periodo']['granularidad'], string> = {
    dia: 'Por día',
    semana: 'Por semana',
    mes: 'Por mes',
  }

  if (resumen.serieTemporal.every((b) => b.turnos === 0)) {
    return (
      <ChartCard title="Evolución de turnos" subtitle={subtitleByGranularidad[resumen.periodo.granularidad]}>
        <p className="turnos-table-message"><strong>Sin turnos en este período.</strong></p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Evolución de turnos" subtitle={subtitleByGranularidad[resumen.periodo.granularidad]}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={resumen.serieTemporal} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={formatBucketLabel} stroke="var(--color-text-muted)" fontSize={12} />
          <YAxis allowDecimals={false} stroke="var(--color-text-muted)" fontSize={12} />
          <Tooltip
            labelFormatter={(fecha) => formatBucketLabel(String(fecha))}
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, color: 'var(--color-text)' }}
          />
          <Legend />
          <Line type="monotone" dataKey="turnos" name="Turnos" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="finalizados" name="Finalizados" stroke="var(--color-success)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function EstadoTurnosChart({ estados }: { estados: EstadisticasResumen['estados'] }) {
  const conDatos = estados.filter((e) => e.cantidad > 0)
  const total = conDatos.reduce((sum, e) => sum + e.cantidad, 0)

  if (total === 0) {
    return (
      <ChartCard title="Estado de los turnos">
        <p className="turnos-table-message"><strong>Sin turnos en este período.</strong></p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Estado de los turnos">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={conDatos} dataKey="cantidad" nameKey="estado" innerRadius={60} outerRadius={95} paddingAngle={2}>
            {conDatos.map((entry) => (
              <Cell key={entry.estado} fill={ESTADO_COLOR[entry.estado]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, entry) => {
              const numeric = Number(value)
              const label = mapEstadoToStatus((entry.payload as { estado: EstadoTurno }).estado)
              const pct = Math.round((numeric / total) * 1000) / 10
              return [`${numeric} turnos · ${pct}%`, label]
            }}
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, color: 'var(--color-text)' }}
          />
          <Legend formatter={(value: string) => mapEstadoToStatus(value)} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

const PROFESIONALES_VISIBLES_INICIAL = 8

export function SesionesPorProfesionalChart({ porProfesional }: { porProfesional: EstadisticasResumen['porProfesional'] }) {
  const [verTodos, setVerTodos] = useState(false)

  if (porProfesional.length === 0) {
    return (
      <ChartCard title="Sesiones por profesional">
        <p className="turnos-table-message"><strong>Sin sesiones finalizadas en este período.</strong></p>
      </ChartCard>
    )
  }

  const visibles = verTodos ? porProfesional : porProfesional.slice(0, PROFESIONALES_VISIBLES_INICIAL)
  const data = visibles.map((p) => ({ ...p, nombreCorto: professionalName({ nombre: p.nombre, apellido: p.apellido }) }))

  return (
    <ChartCard title="Sesiones por profesional" subtitle="Turnos finalizados">
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} stroke="var(--color-text-muted)" fontSize={12} />
          <YAxis type="category" dataKey="nombreCorto" width={140} stroke="var(--color-text-muted)" fontSize={12} />
          <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, color: 'var(--color-text)' }} />
          <Bar dataKey="finalizados" name="Finalizados" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {porProfesional.length > PROFESIONALES_VISIBLES_INICIAL ? (
        <button type="button" className="clinical-summary-link" onClick={() => setVerTodos((v) => !v)}>
          {verTodos ? 'Ver menos' : `Ver todos (${porProfesional.length})`}
        </button>
      ) : null}
    </ChartCard>
  )
}

export function ActividadPorEspecialidadChart({ porEspecialidad }: { porEspecialidad: EstadisticasResumen['porEspecialidad'] }) {
  const total = porEspecialidad.reduce((sum, e) => sum + e.finalizados, 0)

  if (total === 0) {
    return (
      <ChartCard title="Actividad por especialidad">
        <p className="turnos-table-message"><strong>Sin sesiones finalizadas en este período.</strong></p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Actividad por especialidad" subtitle="Turnos finalizados">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={porEspecialidad} dataKey="finalizados" nameKey="nombre" innerRadius={60} outerRadius={95} paddingAngle={2}>
            {porEspecialidad.map((entry) => (
              <Cell key={entry.especialidadId} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const numeric = Number(value)
              const pct = Math.round((numeric / total) * 1000) / 10
              return [`${numeric} sesiones · ${pct}%`, String(name)]
            }}
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, color: 'var(--color-text)' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function ResumenProfesionalesTable({ resumenProfesionales }: { resumenProfesionales: EstadisticasResumen['resumenProfesionales'] }) {
  if (resumenProfesionales.length === 0) {
    return (
      <section className="patients-table-card">
        <div className="turnos-table-toolbar"><h2>Resumen por profesional</h2></div>
        <p className="turnos-table-message"><strong>Sin datos en este período.</strong></p>
      </section>
    )
  }

  return (
    <section className="patients-table-card">
      <div className="turnos-table-toolbar"><h2>Resumen por profesional</h2></div>
      <div className="turnos-table-scroll">
        <table className="turnos-table">
          <thead>
            <tr>
              <th>Profesional</th>
              <th>Turnos</th>
              <th>Finalizados</th>
              <th>Ausentes</th>
              <th>Cancelados</th>
              <th>Pacientes únicos</th>
            </tr>
          </thead>
          <tbody>
            {resumenProfesionales.map((r) => (
              <tr key={r.profesionalId}>
                <td data-label="Profesional">{professionalName({ nombre: r.nombre, apellido: r.apellido })}</td>
                <td data-label="Turnos">{r.turnos}</td>
                <td data-label="Finalizados">{r.finalizados}</td>
                <td data-label="Ausentes">{r.ausentes}</td>
                <td data-label="Cancelados">{r.cancelados}</td>
                <td data-label="Pacientes únicos">{r.pacientesUnicos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

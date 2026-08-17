// Skeletons discretos y genéricos, reutilizados por las pantallas donde hoy
// aparecía un "Cargando..." grande (Turnos, Pacientes, Estadísticas) — ver
// docs/tasks.md. Deliberadamente simples: una barra con shimmer, sin
// dependencias nuevas ni animaciones pesadas.

export function SkeletonBar({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <span className="skeleton-bar" style={{ width, height }} aria-hidden="true" />
}

export function SkeletonTableRows({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="skeleton-row" aria-hidden="true">
          {Array.from({ length: columns }, (__, colIndex) => (
            <td key={colIndex}><SkeletonBar width={colIndex === 0 ? '70%' : '85%'} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function SkeletonCard() {
  return (
    <div className="patient-summary-card skeleton-card" aria-hidden="true">
      <SkeletonBar width="50%" height={12} />
      <SkeletonBar width="65%" height={26} />
    </div>
  )
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} />)}
    </>
  )
}

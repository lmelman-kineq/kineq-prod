import type { PlantillaEvolucion } from '../types/domain'
import { EditIcon, TrashIcon } from './EvolutionTable'

type Props = {
  plantillas: PlantillaEvolucion[]
  onClose: () => void
  onAplicar: (plantilla: PlantillaEvolucion) => void
  onEditar: (plantilla: PlantillaEvolucion) => void
  onNueva: () => void
  onEliminar: (plantilla: PlantillaEvolucion) => void
}

// Lista de Plantillas del consultorio — único punto de entrada a crear/
// editar/eliminar (mismo patrón que GestionarGruposModal para Diagnóstico).
// "Aplicar" es la fila entera (clic en el nombre/contenido); editar/eliminar
// son íconos aparte, para no competir por el mismo gesto.
export default function PlantillasListModal({ plantillas, onClose, onAplicar, onEditar, onNueva, onEliminar }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <div>
              <h3>Plantillas de evolución</h3>
              <p>Contenido reutilizable para cargar evoluciones más rápido.</p>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {plantillas.length === 0 ? (
            <p className="patient-detail-note">Todavía no hay plantillas creadas en este consultorio.</p>
          ) : (
            <div className="antecedentes-list">
              {plantillas.map((plantilla) => (
                <div key={plantilla.id} className="antecedentes-item">
                  <button
                    type="button"
                    className="antecedentes-item-info antecedentes-item--clickable-inner"
                    onClick={() => onAplicar(plantilla)}
                  >
                    <strong>{plantilla.nombre}</strong>
                    <span>{plantilla.contenido.slice(0, 80)}{plantilla.contenido.length > 80 ? '…' : ''}</span>
                  </button>
                  <div className="config-row-actions">
                    <button type="button" className="config-icon-button" aria-label={`Editar ${plantilla.nombre}`} title="Editar plantilla" onClick={() => onEditar(plantilla)}>
                      <EditIcon />
                    </button>
                    <button type="button" className="config-icon-button config-icon-button--danger" aria-label={`Eliminar ${plantilla.nombre}`} title="Eliminar plantilla" onClick={() => onEliminar(plantilla)}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cerrar</button>
          <button type="button" className="primary-button" onClick={onNueva}>+ Nueva plantilla</button>
        </div>
      </div>
    </div>
  )
}

import type { GrupoEvolucion } from '../types/domain'
import { EditIcon, GrupoChip, TrashIcon } from './EvolutionTable'

type Props = {
  grupos: GrupoEvolucion[]
  onClose: () => void
  onEditGrupo: (grupo: GrupoEvolucion) => void
  onNuevoGrupo: () => void
  onDeleteGrupo: (grupo: GrupoEvolucion) => void
}

// Lista todos los grupos del paciente, independientemente de si ya tienen
// alguna evolución asignada — la única otra forma de editar un grupo (el
// header de su sección en "Ver por grupo") no existe hasta que tiene al
// menos una evolución. Único acceso a crear/editar/eliminar grupos desde
// Evoluciones (ver item 2 del prompt de UI: nada de esto vive suelto en el
// toolbar).
export default function GestionarGruposModal({ grupos, onClose, onEditGrupo, onNuevoGrupo, onDeleteGrupo }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <div>
              <h3>Gestionar diagnósticos</h3>
              <p>Organización visual de evoluciones de este paciente.</p>
            </div>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {grupos.length === 0 ? (
            <p className="patient-detail-note">Todavía no hay diagnósticos creados para este paciente.</p>
          ) : (
            <div className="antecedentes-list">
              {grupos.map((grupo) => (
                <div key={grupo.id} className="antecedentes-item">
                  <div className="antecedentes-item-info">
                    <GrupoChip grupo={grupo} />
                  </div>
                  <div className="config-row-actions">
                    <button type="button" className="config-icon-button" aria-label={`Editar ${grupo.nombre}`} title="Editar diagnóstico" onClick={() => onEditGrupo(grupo)}>
                      <EditIcon />
                    </button>
                    <button type="button" className="config-icon-button config-icon-button--danger" aria-label={`Eliminar ${grupo.nombre}`} title="Eliminar diagnóstico" onClick={() => onDeleteGrupo(grupo)}>
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
          <button type="button" className="primary-button" onClick={onNuevoGrupo}>+ Nuevo diagnóstico</button>
        </div>
      </div>
    </div>
  )
}

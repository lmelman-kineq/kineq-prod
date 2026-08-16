import type { SVGProps } from 'react'

function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function PowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 3v8" />
      <path d="M7.5 5.5a8 8 0 1 0 9 0" />
    </svg>
  )
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

type ConfigRowActionsProps =
  | {
      variant?: 'toggle'
      active: boolean
      onEdit: () => void
      onToggleActive: () => void
      onDelete?: never
      editLabel?: string
      editDisabled?: boolean
      deleteLabel?: string
      toggleDisabled?: boolean
      toggleTitle?: string
    }
  | {
      variant: 'delete'
      active?: boolean
      onEdit: () => void
      onToggleActive?: never
      onDelete: () => void
      editLabel?: string
      editDisabled?: boolean
      deleteLabel?: string
      toggleDisabled?: never
      toggleTitle?: never
    }

/** Acciones de fila (editar + activar/inactivar o eliminar) compartidas por las tablas de Configuración. */
export default function ConfigRowActions(props: ConfigRowActionsProps) {
  const { onEdit, editLabel = 'Editar', editDisabled = false, deleteLabel = 'Eliminar' } = props

  return (
    <>
      <button
        type="button"
        className="config-icon-button"
        aria-label={editLabel}
        title={editLabel}
        onClick={onEdit}
        disabled={editDisabled}
      >
        <EditIcon />
      </button>
      {props.variant === 'delete' ? (
        <button
          type="button"
          className="config-icon-button config-icon-button--danger"
          aria-label={deleteLabel}
          title={deleteLabel}
          onClick={props.onDelete}
        >
          <TrashIcon />
        </button>
      ) : (
        <button
          type="button"
          className={`config-icon-button${props.active ? ' config-icon-button--danger' : ''}`}
          aria-label={props.toggleTitle ?? (props.active ? 'Desactivar' : 'Activar')}
          title={props.toggleTitle ?? (props.active ? 'Desactivar' : 'Activar')}
          onClick={props.onToggleActive}
          disabled={props.toggleDisabled}
        >
          <PowerIcon />
        </button>
      )}
    </>
  )
}

import { useEffect } from 'react'
import type { ConfirmDialogOptions } from '../App'

type UseModalDismissOptions = {
  isDirty: boolean
  saving: boolean
  onClose: () => void
  onRequestConfirm: (dialog: ConfirmDialogOptions) => void
}

/**
 * Cierre de modal por backdrop click o Escape, con confirmación custom (no
 * `confirm()`) cuando hay cambios sin guardar. No hace nada mientras se está
 * guardando, para no cortar un submit en curso.
 */
export function useModalDismiss({ isDirty, saving, onClose, onRequestConfirm }: UseModalDismissOptions): () => void {
  const requestClose = () => {
    if (saving) return
    if (!isDirty) {
      onClose()
      return
    }
    onRequestConfirm({
      title: 'Descartar cambios',
      description: 'Tenés cambios sin guardar. Si salís ahora, se van a perder.',
      confirmLabel: 'Descartar cambios',
      cancelLabel: 'Seguir editando',
      destructive: true,
      onConfirm: onClose,
    })
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, saving])

  return requestClose
}

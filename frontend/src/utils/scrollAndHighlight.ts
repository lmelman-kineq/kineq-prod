// Resalta brevemente el elemento al que se navegó desde una alerta clínica
// (o cualquier otro deep-link interno). Doble rAF: espera a que el cambio de
// tab/sección ya haya pintado el nuevo subárbol antes de buscar el id.
export function scrollToAndHighlight(elementId: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById(elementId)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('clinical-nav-highlight')
      window.setTimeout(() => el.classList.remove('clinical-nav-highlight'), 1600)
    })
  })
}

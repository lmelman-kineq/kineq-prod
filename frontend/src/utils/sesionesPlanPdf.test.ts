import { describe, it, expect } from 'vitest'
import { renderSesionesPlanPdf } from './sesionesPlanPdf'
import { buildSesionesPlanDocument } from './sesionesPlan'

// Smoke test del documento generado — sin snapshot pixel-perfect (frágil,
// ver spec de la ronda). Verifica invariantes de bajo nivel: es un PDF
// válido y el texto de contenido (paciente/consultorio/sesión/fecha) quedó
// realmente incrustado en el stream, no solo en el DTO de entrada.
describe('renderSesionesPlanPdf', () => {
  const documento = buildSesionesPlanDocument({
    patientName: 'Nicolás Zotalis',
    consultorioName: 'IAFS Center',
    sesiones: [
      { numeroSesion: 1, inicio: '2026-09-02T20:45:00.000Z', duracionMinutos: 60, profesionalDisplay: 'Matías Delevic', especialidadNombre: 'Kinesiología general' },
      { numeroSesion: 2, inicio: '2026-09-05T14:00:00.000Z', duracionMinutos: 60, profesionalDisplay: 'Matías Delevic', especialidadNombre: 'Kinesiología general' },
    ],
    timeZone: 'America/Argentina/Buenos_Aires',
  })

  it('genera un PDF A4 válido (firma %PDF- y objetos de página)', () => {
    const pdf = renderSesionesPlanPdf(documento)
    const raw = pdf.output()
    expect(raw.startsWith('%PDF-')).toBe(true)
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('el contenido incluye paciente, consultorio, número de sesión y hora', () => {
    const pdf = renderSesionesPlanPdf(documento)
    const raw = pdf.output()
    // jsPDF por default no comprime el stream de texto (sin `compress:
    // true`), así que el texto queda legible como substring del PDF crudo
    // — incluidos los acentos, codificados como un solo byte WinAnsi cuyo
    // valor coincide con el code point Unicode ('á' = U+00E1 = 0xE1).
    expect(raw).toContain('Nicolás')
    expect(raw).toContain('Zotalis')
    expect(raw).toContain('IAFS Center')
    expect(raw).toContain('Sesión 1')
    expect(raw).toContain('Sesión 2')
    expect(raw).toContain('17:45')
  })

  it('pagina cuando hay muchas sesiones', () => {
    const manySesiones = Array.from({ length: 60 }, (_, index) => ({
      numeroSesion: index + 1,
      inicio: new Date(Date.UTC(2026, 8, 5, 14, 0, 0) + index * 86_400_000).toISOString(),
      duracionMinutos: 60,
      profesionalDisplay: 'Matías Delevic',
      especialidadNombre: 'Kinesiología general',
    }))
    const doc = buildSesionesPlanDocument({
      patientName: 'Nicolás Zotalis',
      consultorioName: 'IAFS Center',
      sesiones: manySesiones,
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    const pdf = renderSesionesPlanPdf(doc)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
  })
})

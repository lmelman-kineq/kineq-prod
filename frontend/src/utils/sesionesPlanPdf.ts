import jsPDF from 'jspdf'
import type { SesionPlanDocument } from './sesionesPlan'

const MARGIN_X = 20
const FOOTER_Y_FROM_BOTTOM = 12

/**
 * Dibuja el PDF a partir del DTO ya normalizado (`buildSesionesPlanDocument`)
 * — A4, una sola dependencia (`jspdf`, sin plugin de tablas: el layout es
 * una lista simple, no justifica sumar `jspdf-autotable`). Nunca incluye
 * datos clínicos (diagnóstico, evoluciones, ficha, alertas) — solo el
 * cronograma operativo (ver "Exportar plan de sesiones" en
 * docs/modules/patients.md).
 */
export function renderSesionesPlanPdf(doc: SesionPlanDocument): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  let y = 22

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(124, 58, 237)
  pdf.text('KINEQ', MARGIN_X, y)
  y += 12

  pdf.setFontSize(18)
  pdf.setTextColor(23, 23, 23)
  pdf.text('Planificación de sesiones', MARGIN_X, y)
  y += 10

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(12)
  pdf.setTextColor(60, 60, 60)
  pdf.text(`${doc.patientName} | ${doc.consultorioName}`, MARGIN_X, y)
  y += 12

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(23, 23, 23)
  pdf.text('Cronograma de sesiones', MARGIN_X, y)
  y += 5
  pdf.setDrawColor(226, 226, 230)
  pdf.line(MARGIN_X, y, pageWidth - MARGIN_X, y)
  y += 10

  const rowStartX = MARGIN_X
  const rowDetailX = MARGIN_X + 34
  const bottomLimit = pageHeight - 26

  for (const row of doc.rows) {
    const rowHeight = row.profesionalEspecialidad ? 14 : 10
    if (y + rowHeight > bottomLimit) {
      pdf.addPage()
      y = 22
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(23, 23, 23)
    pdf.text(row.numeroSesionLabel, rowStartX, y)

    pdf.setFont('helvetica', 'normal')
    pdf.text(`${row.weekdayDate} · ${row.hora}`, rowDetailX, y)

    if (row.profesionalEspecialidad) {
      y += 6
      pdf.setFontSize(9.5)
      pdf.setTextColor(120, 120, 120)
      pdf.text(row.profesionalEspecialidad, rowDetailX, y)
    }

    y += rowHeight - (row.profesionalEspecialidad ? 6 : 0)
  }

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(150, 150, 150)
    pdf.text(doc.generatedOnLabel, MARGIN_X, pageHeight - FOOTER_Y_FROM_BOTTOM)
    pdf.text(`Página ${page} de ${pageCount}`, pageWidth - MARGIN_X, pageHeight - FOOTER_Y_FROM_BOTTOM, { align: 'right' })
  }

  return pdf
}

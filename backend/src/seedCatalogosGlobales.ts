import prisma from './prisma'

// Especialidades y obras sociales de sistema (esSistema=true,
// consultorioId=null): igual que el catálogo clínico (seedCatalogoClinico.ts),
// son dato de sistema, no dato demo — deben existir en cualquier ambiente,
// no solo en el consultorio demo. Mismos tokens de color que ya usa el
// frontend para especialidades custom (frontend/src/utils/specialtyColors.ts).
const ESPECIALIDAD_COLOR_TOKENS = [
  'var(--appointment-purple)',
  'var(--appointment-teal)',
  'var(--appointment-red)',
  'var(--appointment-amber)',
  'var(--appointment-sky)',
]

const ESPECIALIDADES_GLOBALES = [
  'Kinesiología general',
  'Rehabilitación deportiva',
  'Terapia manual',
  'Osteopatía',
  'Reeducación postural',
]

const OBRAS_SOCIALES_GLOBALES = ['OSDE', 'Swiss Medical', 'Galeno', 'Medifé', 'Sancor Salud']

export async function seedCatalogosGlobales() {
  for (let i = 0; i < ESPECIALIDADES_GLOBALES.length; i++) {
    const nombre = ESPECIALIDADES_GLOBALES[i]
    const color = ESPECIALIDAD_COLOR_TOKENS[i % ESPECIALIDAD_COLOR_TOKENS.length]
    // No se puede usar `upsert` con un where compuesto que incluya
    // `consultorioId: null` (mismo motivo que seedCatalogoClinico.ts) — se
    // resuelve a mano con findFirst + create/update.
    const existente = await prisma.especialidad.findFirst({ where: { consultorioId: null, esSistema: true, nombre } })
    if (existente) {
      await prisma.especialidad.update({ where: { id: existente.id }, data: { color } })
    } else {
      await prisma.especialidad.create({ data: { nombre, color, esSistema: true, consultorioId: null } })
    }
  }

  for (const nombre of OBRAS_SOCIALES_GLOBALES) {
    const existente = await prisma.obraSocial.findFirst({ where: { consultorioId: null, esSistema: true, nombre } })
    if (!existente) {
      await prisma.obraSocial.create({ data: { nombre, esSistema: true, consultorioId: null } })
    }
  }

  console.log('Catálogos globales (especialidades, obras sociales) sembrados')
}

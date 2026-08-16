import 'dotenv/config'
import prisma from './prisma'
import { hashPassword, normalizeEmail } from './auth'
import { seedCatalogoClinico } from './seedCatalogoClinico'
import { seedCatalogosGlobales } from './seedCatalogosGlobales'

async function main() {
  await seedCatalogosGlobales()

  const consultorio = await prisma.consultorio.upsert({
    where: { slug: 'kineq-demo' },
    update: { nombre: 'Consultorio Kineq Demo' },
    create: {
      nombre: 'Consultorio Kineq Demo',
      slug: 'kineq-demo',
      zonaHoraria: 'America/Argentina/Buenos_Aires',
    },
  })

  const consultorioId = consultorio.id

  const especialidadesData = [
    { nombre: 'Kinesiología general', color: 'var(--appointment-purple)' },
    { nombre: 'Rehabilitación lumbar', color: 'var(--appointment-teal)' },
    { nombre: 'Terapia avanzada', color: 'var(--appointment-red)' },
  ]

  const obrasData = ['OSDE', 'Medife', 'Swiss', 'Galeno']

  const pacientesData = ['María|López', 'Juan|Pérez', 'Verena|Pardo', 'Ana|Gómez', 'Sofía|Díaz']

  const profesionalesData = [
    { nombre: 'Gómez', apellido: 'Perez', titulo: 'Dr.' },
    { nombre: 'Ruiz', apellido: 'Lopez', titulo: 'Dra.' },
    { nombre: 'Castro', apellido: 'Sanchez', titulo: 'Dr.' },
    { nombre: 'Fernández', apellido: 'Diaz', titulo: 'Dra.' },
  ]

  const createdEspecialidades = [] as any[]
  for (const e of especialidadesData) {
    const espec = await prisma.especialidad.upsert({
      where: { consultorioId_nombre: { consultorioId, nombre: e.nombre } },
      create: { consultorioId, nombre: e.nombre, color: e.color },
      update: { color: e.color },
    })
    createdEspecialidades.push(espec)
  }

  const createdObras = [] as any[]
  for (const name of obrasData) {
    const obra = await prisma.obraSocial.upsert({
      where: { consultorioId_nombre: { consultorioId, nombre: name } },
      create: { consultorioId, nombre: name },
      update: { nombre: name },
    })
    createdObras.push(obra)
  }

  const createdPacientes = [] as any[]
  for (const p of pacientesData) {
    const [nombre, apellido] = p.split('|')
    const documento = `${nombre}-${apellido}`
    const existing = await prisma.paciente.findFirst({ where: { consultorioId, documento } })
    let paciente
    if (existing) {
      paciente = await prisma.paciente.update({ where: { id: existing.id }, data: { nombre, apellido, documento } })
    } else {
      paciente = await prisma.paciente.create({ data: { consultorioId, nombre, apellido, documento } })
    }
    createdPacientes.push(paciente)
  }

  const createdProfesionales = [] as any[]
  for (const prof of profesionalesData) {
    const matricula = `${prof.titulo}-${prof.nombre}`
    const existingProf = await prisma.profesional.findFirst({ where: { consultorioId, matricula } })
    let profesional
    if (existingProf) {
      profesional = await prisma.profesional.update({ where: { id: existingProf.id }, data: { nombre: prof.nombre, apellido: prof.apellido, titulo: prof.titulo, matricula } })
    } else {
      profesional = await prisma.profesional.create({ data: { consultorioId, nombre: prof.nombre, apellido: prof.apellido, titulo: prof.titulo, matricula } })
    }
    createdProfesionales.push(profesional)
  }

  // Asociar profesional-especialidad (simple round-robin)
  for (let i = 0; i < createdProfesionales.length; i++) {
    const profesionalId = createdProfesionales[i].id
    const especialidadId = createdEspecialidades[i % createdEspecialidades.length].id
    await prisma.profesionalEspecialidad.upsert({
      where: { profesionalId_especialidadId: { profesionalId, especialidadId } },
      create: { consultorioId, profesionalId, especialidadId },
      update: {},
    })
  }

  // Crear tres turnos de demostración (hoy)
  const clinicTimeZone = 'America/Argentina/Buenos_Aires'
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: clinicTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((item) => item.type === type)?.value ?? ''
  const yyyy = Number(part('year'))
  const mm = part('month')
  const dd = part('day')

  const times = ['09:00', '11:30', '19:00']
  const durations = [60, 60, 120]

  for (let i = 0; i < times.length; i++) {
    // Los horarios demo están expresados en la zona del consultorio
    // (America/Argentina/Buenos_Aires, UTC-03:00). Convertimos ese horario
    // local a un instante UTC antes de enviarlo a Prisma.
    const inicio = new Date(`${yyyy}-${mm}-${dd}T${times[i]}:00-03:00`)
    const paciente = createdPacientes[i % createdPacientes.length]
    const profesional = createdProfesionales[i % createdProfesionales.length]
    const especialidad = createdEspecialidades[i % createdEspecialidades.length]
    const obra = createdObras[i % createdObras.length]

    await prisma.turno.upsert({
      where: { id: i + 1 },
      create: {
        consultorioId,
        pacienteId: paciente.id,
        profesionalId: profesional.id,
        especialidadId: especialidad.id,
        obraSocialId: obra.id,
        inicio,
        duracionMinutos: durations[i],
        numeroSesion: i + 1,
        notas: `Turno demo ${i + 1}`,
      },
      update: {
        pacienteId: paciente.id,
        profesionalId: profesional.id,
        especialidadId: especialidad.id,
        obraSocialId: obra.id,
        inicio,
        duracionMinutos: durations[i],
        numeroSesion: i + 1,
        notas: `Turno demo ${i + 1}`,
      },
    })
  }

  await seedCatalogoClinico()

  // Usuario administrador de desarrollo, opcional: solo se crea si se
  // configuran SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD (ver backend/.env).
  // No se convierte automáticamente ningún profesional existente en usuario.
  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    const passwordHash = await hashPassword(adminPassword)
    await prisma.usuario.upsert({
      where: { email: normalizeEmail(adminEmail) },
      update: { passwordHash, activo: true },
      create: {
        consultorioId,
        nombre: 'Admin',
        apellido: 'Desarrollo',
        email: normalizeEmail(adminEmail),
        passwordHash,
        rol: 'ADMINISTRADOR',
      },
    })
    console.log(`Usuario administrador de desarrollo listo: ${normalizeEmail(adminEmail)}`)
  } else {
    console.log('SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD no configurados: no se creó usuario administrador de desarrollo')
  }

  console.log('Seed completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

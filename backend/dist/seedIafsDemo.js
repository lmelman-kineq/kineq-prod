"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("./prisma"));
const client_1 = require("./generated/prisma/client");
const seedCatalogoClinico_1 = require("./seedCatalogoClinico");
// Seed específico y acotado a un consultorio real ya existente (creado por
// registro público, no por el seed general). No crea el consultorio: si no
// lo encuentra, falla con un mensaje claro en vez de inventar uno nuevo.
const CONSULTORIO_NOMBRE = 'IAFS Center';
const DEMO_TAG = 'DEMO-IAFS';
const CONSULTORIO_TZ = 'America/Argentina/Buenos_Aires';
function buenosAiresDateParts(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: CONSULTORIO_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    return { yyyy: get('year'), mm: get('month'), dd: get('day') };
}
// Construye un instante UTC correspondiente a una hora de reloj en Buenos
// Aires, N días a partir de hoy (mismo criterio que backend/src/seed.ts).
function atHour(daysFromNow, hour, minute = 0) {
    const target = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
    const { yyyy, mm, dd } = buenosAiresDateParts(target);
    const hh = String(hour).padStart(2, '0');
    const mi = String(minute).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00-03:00`);
}
async function main() {
    const consultorio = await prisma_1.default.consultorio.findFirst({ where: { nombre: CONSULTORIO_NOMBRE } });
    if (!consultorio) {
        throw new Error(`No se encontró un consultorio con nombre "${CONSULTORIO_NOMBRE}". Este script no crea el consultorio, solo carga datos demo dentro de uno existente.`);
    }
    const consultorioId = consultorio.id;
    // ESPECIALIDADES (unique real por [consultorioId, nombre]: upsert nativo)
    const especialidadesData = [
        { nombre: 'Kinesiología General', color: 'var(--appointment-purple)' },
        { nombre: 'Rehabilitación Deportiva', color: 'var(--appointment-teal)' },
        { nombre: 'Terapia Manual', color: 'var(--appointment-amber)' },
    ];
    const especialidades = [];
    for (const e of especialidadesData) {
        const espec = await prisma_1.default.especialidad.upsert({
            where: { consultorioId_nombre: { consultorioId, nombre: e.nombre } },
            create: { consultorioId, nombre: e.nombre, color: e.color },
            update: {},
        });
        especialidades.push(espec);
    }
    // OBRAS SOCIALES (unique real por [consultorioId, nombre]: upsert nativo)
    const obrasData = ['OSDE', 'Swiss Medical'];
    const obras = [];
    for (const nombre of obrasData) {
        const obra = await prisma_1.default.obraSocial.upsert({
            where: { consultorioId_nombre: { consultorioId, nombre } },
            create: { consultorioId, nombre },
            update: {},
        });
        obras.push(obra);
    }
    // PROFESIONALES (sin unique real en el schema: idempotencia manual por
    // matrícula demo estable, mismo patrón que backend/src/seed.ts)
    const profesionalesData = [
        { nombre: 'Martín', apellido: 'Ibarra', titulo: 'Lic.', matricula: `${DEMO_TAG}-PROF-1` },
        { nombre: 'Sabrina', apellido: 'Roldán', titulo: 'Lic.', matricula: `${DEMO_TAG}-PROF-2` },
    ];
    const profesionales = [];
    for (const p of profesionalesData) {
        const existing = await prisma_1.default.profesional.findFirst({ where: { consultorioId, matricula: p.matricula } });
        const profesional = existing
            ? await prisma_1.default.profesional.update({ where: { id: existing.id }, data: p })
            : await prisma_1.default.profesional.create({ data: { consultorioId, ...p } });
        profesionales.push(profesional);
    }
    // VÍNCULO PROFESIONAL-ESPECIALIDAD (PK compuesta real: upsert nativo)
    const links = [
        [profesionales[0].id, especialidades[0].id],
        [profesionales[0].id, especialidades[1].id],
        [profesionales[1].id, especialidades[1].id],
        [profesionales[1].id, especialidades[2].id],
    ];
    for (const [profesionalId, especialidadId] of links) {
        await prisma_1.default.profesionalEspecialidad.upsert({
            where: { profesionalId_especialidadId: { profesionalId, especialidadId } },
            create: { consultorioId, profesionalId, especialidadId },
            update: {},
        });
    }
    // PACIENTES: documento demo estable como clave de idempotencia (sin
    // unique real en el schema, misma estrategia que el seed general).
    // Mezcla con y sin obra social, sin datos clínicos.
    const pacientesData = [
        { nombre: 'Valentina', apellido: 'Ríos', obraSocialId: obras[0].id },
        { nombre: 'Tomás', apellido: 'Benítez', obraSocialId: null },
        { nombre: 'Camila', apellido: 'Acosta', obraSocialId: obras[1].id },
        { nombre: 'Martín', apellido: 'Ferraro', obraSocialId: null },
        { nombre: 'Julieta', apellido: 'Sosa', obraSocialId: obras[0].id },
        { nombre: 'Nicolás', apellido: 'Pereyra', obraSocialId: null },
        { nombre: 'Lucía', apellido: 'Méndez', obraSocialId: obras[1].id },
        { nombre: 'Franco', apellido: 'Cabrera', obraSocialId: null },
    ];
    const pacientes = [];
    for (let i = 0; i < pacientesData.length; i++) {
        const documento = `${DEMO_TAG}-PAC-${String(i + 1).padStart(2, '0')}`;
        const p = pacientesData[i];
        const data = {
            consultorioId,
            nombre: p.nombre,
            apellido: p.apellido,
            documento,
            telefono: `11-5555-${1000 + i}`,
            fechaNacimiento: new Date(Date.UTC(1985 + i, i % 12, (i % 27) + 1)),
            obraSocialId: p.obraSocialId,
        };
        const existing = await prisma_1.default.paciente.findFirst({ where: { consultorioId, documento } });
        const paciente = existing
            ? await prisma_1.default.paciente.update({ where: { id: existing.id }, data })
            : await prisma_1.default.paciente.create({ data });
        pacientes.push(paciente);
    }
    // TURNOS: notas con una clave demo estable como marca de idempotencia
    // (los turnos no tienen ningún campo natural único: se permiten
    // superposiciones a propósito, así que no puede usarse fecha+profesional
    // como clave). "Hoy" incluye EN_ESPERA/ATENDIENDO para que el Dashboard
    // muestre actividad real apenas se entra; el resto son fechas futuras
    // (desde mañana), por lo que se mantienen en ASIGNADO — o CANCELADO,
    // que sigue siendo coherente para un turno futuro cancelado con
    // anticipación. No se usa FINALIZADO/AUSENTE en fechas futuras porque
    // ambos estados solo tienen sentido una vez pasada la hora del turno.
    const now = new Date();
    const turnosData = [
        // Hoy: mezcla de estados para poblar el Dashboard/Inicio de inmediato.
        {
            inicio: new Date(now.getTime() - 20 * 60_000),
            duracion: 45,
            paciente: 0,
            profesional: 0,
            especialidad: 0,
            estado: client_1.EstadoTurno.ATENDIENDO,
            inicioAtencion: new Date(now.getTime() - 18 * 60_000),
        },
        { inicio: new Date(now.getTime() + 5 * 60_000), duracion: 30, paciente: 1, profesional: 1, especialidad: 1, estado: client_1.EstadoTurno.EN_ESPERA },
        { inicio: atHour(0, 18), duracion: 60, paciente: 2, profesional: 0, especialidad: 1, estado: client_1.EstadoTurno.ASIGNADO },
        // Mañana
        { inicio: atHour(1, 9), duracion: 60, paciente: 3, profesional: 0, especialidad: 0, estado: client_1.EstadoTurno.ASIGNADO },
        { inicio: atHour(1, 11), duracion: 45, paciente: 4, profesional: 1, especialidad: 2, estado: client_1.EstadoTurno.ASIGNADO },
        { inicio: atHour(1, 16), duracion: 60, paciente: 5, profesional: 0, especialidad: 1, estado: client_1.EstadoTurno.ASIGNADO },
        // Día +2 (incluye superposición intencional del mismo profesional)
        { inicio: atHour(2, 8), duracion: 60, paciente: 6, profesional: 1, especialidad: 1, estado: client_1.EstadoTurno.ASIGNADO },
        { inicio: atHour(2, 10), duracion: 90, paciente: 7, profesional: 0, especialidad: 0, estado: client_1.EstadoTurno.ASIGNADO },
        { inicio: atHour(2, 10, 30), duracion: 60, paciente: 0, profesional: 0, especialidad: 1, estado: client_1.EstadoTurno.ASIGNADO },
        // Día +3
        { inicio: atHour(3, 14), duracion: 60, paciente: 1, profesional: 1, especialidad: 2, estado: client_1.EstadoTurno.ASIGNADO },
        { inicio: atHour(3, 17), duracion: 45, paciente: 2, profesional: 0, especialidad: 0, estado: client_1.EstadoTurno.CANCELADO },
        // Día +4
        { inicio: atHour(4, 9), duracion: 60, paciente: 3, profesional: 1, especialidad: 1, estado: client_1.EstadoTurno.ASIGNADO },
        { inicio: atHour(4, 13), duracion: 60, paciente: 4, profesional: 0, especialidad: 1, estado: client_1.EstadoTurno.ASIGNADO },
        // Día +5
        { inicio: atHour(5, 10), duracion: 45, paciente: 5, profesional: 1, especialidad: 2, estado: client_1.EstadoTurno.ASIGNADO },
        { inicio: atHour(5, 18), duracion: 60, paciente: 6, profesional: 0, especialidad: 0, estado: client_1.EstadoTurno.ASIGNADO },
        // Día +6
        { inicio: atHour(6, 9, 30), duracion: 60, paciente: 7, profesional: 1, especialidad: 1, estado: client_1.EstadoTurno.ASIGNADO },
        { inicio: atHour(6, 15), duracion: 60, paciente: 0, profesional: 0, especialidad: 0, estado: client_1.EstadoTurno.ASIGNADO },
    ];
    let created = 0;
    let skipped = 0;
    for (let i = 0; i < turnosData.length; i++) {
        const t = turnosData[i];
        const clave = `[${DEMO_TAG}] turno-${i + 1}`;
        const existing = await prisma_1.default.turno.findFirst({ where: { consultorioId, notas: clave } });
        if (existing) {
            skipped++;
            continue;
        }
        await prisma_1.default.turno.create({
            data: {
                consultorioId,
                pacienteId: pacientes[t.paciente].id,
                profesionalId: profesionales[t.profesional].id,
                especialidadId: especialidades[t.especialidad].id,
                inicio: t.inicio,
                duracionMinutos: t.duracion,
                estado: t.estado,
                notas: clave,
                inicioAtencion: t.inicioAtencion ?? null,
                canceladoAt: t.estado === client_1.EstadoTurno.CANCELADO ? new Date() : null,
            },
        });
        created++;
    }
    // Catálogo clínico: dato de sistema, no de este consultorio demo, pero
    // los antecedentes/alergias de abajo necesitan que ya exista.
    await (0, seedCatalogoClinico_1.seedCatalogoClinico)();
    // FICHA INICIAL: una en borrador para el primer paciente demo (unique real
    // por pacienteId: upsert nativo, no hace falta clave de idempotencia manual).
    const fichaDemo = await prisma_1.default.fichaInicial.upsert({
        where: { pacienteId: pacientes[0].id },
        create: {
            consultorioId,
            pacienteId: pacientes[0].id,
            profesionalResponsableId: profesionales[0].id,
            motivoConsulta: 'Dolor lumbar de tres semanas de evolución',
            antecedentesPersonales: 'Sedentaria, trabajo de oficina',
            dolorSintomas: 'Dolor lumbar 6/10, sin irradiación',
            limitacionesFuncionales: 'Dificultad para permanecer sentada más de 30 minutos',
            actividadFisica: 'Caminata ocasional, sin rutina fija',
            alergiasEstado: 'SI',
            medicacionEstado: 'SI',
            estado: 'BORRADOR',
        },
        update: {},
    });
    // ANTECEDENTES estructurados: 2 personales + 2 familiares + 1 quirúrgico
    // (unique real por [fichaInicialId, catalogoItemId]: upsert nativo).
    const antecedentesDemo = [
        { categoria: 'ANTECEDENTE_PERSONAL', codigo: 'hta', detalle: 'Diagnosticada en 2019, controlada' },
        { categoria: 'ANTECEDENTE_PERSONAL', codigo: 'dislipidemia' },
        { categoria: 'ANTECEDENTE_FAMILIAR', codigo: 'diabetes', parentesco: 'Madre' },
        { categoria: 'ANTECEDENTE_FAMILIAR', codigo: 'hta', parentesco: 'Padre' },
        { categoria: 'PROCEDIMIENTO_QUIRURGICO', codigo: 'apendicectomia', detalle: 'Sin secuelas referidas' },
    ];
    for (const a of antecedentesDemo) {
        const catalogoItem = await prisma_1.default.catalogoClinicoItem.findFirst({ where: { categoria: a.categoria, codigo: a.codigo } });
        if (!catalogoItem)
            continue;
        await prisma_1.default.fichaAntecedente.upsert({
            where: { fichaInicialId_catalogoItemId: { fichaInicialId: fichaDemo.id, catalogoItemId: catalogoItem.id } },
            create: {
                consultorioId,
                fichaInicialId: fichaDemo.id,
                catalogoItemId: catalogoItem.id,
                estado: 'SI',
                detalle: a.detalle,
                parentesco: a.parentesco,
            },
            update: {},
        });
    }
    // ALERGIA demo (sin unique real: idempotencia por fichaInicialId + catalogoItemId).
    const penicilina = await prisma_1.default.catalogoClinicoItem.findFirst({ where: { categoria: 'ALERGIA', codigo: 'penicilina' } });
    if (penicilina) {
        const existingAlergia = await prisma_1.default.fichaAlergia.findFirst({ where: { fichaInicialId: fichaDemo.id, catalogoItemId: penicilina.id } });
        if (!existingAlergia) {
            await prisma_1.default.fichaAlergia.create({
                data: {
                    consultorioId,
                    fichaInicialId: fichaDemo.id,
                    catalogoItemId: penicilina.id,
                    reaccion: 'Erupción cutánea',
                    gravedad: 'MODERADA',
                },
            });
        }
    }
    // MEDICACIÓN demo (sin catálogo; idempotencia por fichaInicialId + nombre).
    const medicacionDemo = [
        { nombre: 'Losartán', dosis: '50', unidad: 'mg', frecuencia: 'Cada 24 h', via: 'Oral' },
        { nombre: 'Ibuprofeno', dosis: '400', unidad: 'mg', frecuencia: 'Según dolor', via: 'Oral', motivo: 'Dolor lumbar' },
    ];
    for (const m of medicacionDemo) {
        const existing = await prisma_1.default.fichaMedicacion.findFirst({ where: { fichaInicialId: fichaDemo.id, nombre: m.nombre } });
        if (existing)
            continue;
        await prisma_1.default.fichaMedicacion.create({ data: { consultorioId, fichaInicialId: fichaDemo.id, ...m } });
    }
    // ESTUDIO COMPLEMENTARIO demo (idempotencia por fichaInicialId + tipo).
    const existingEstudio = await prisma_1.default.fichaEstudioComplementario.findFirst({ where: { fichaInicialId: fichaDemo.id, tipo: 'Radiografía lumbar' } });
    if (!existingEstudio) {
        await prisma_1.default.fichaEstudioComplementario.create({
            data: {
                consultorioId,
                fichaInicialId: fichaDemo.id,
                tipo: 'Radiografía lumbar',
                resumen: 'Sin hallazgos significativos',
            },
        });
    }
    // EVOLUCIONES: histórico demo para el primer paciente (sin unique real en
    // el schema; se usa un prefijo estable en el contenido como clave de
    // idempotencia, mismo criterio que los turnos de este seed).
    const evolucionesData = [
        { paciente: 0, profesional: 0, contenido: `[${DEMO_TAG}] Evaluación inicial: dolor lumbar 6/10, sin irradiación. Se indican ejercicios de movilidad y calor local.` },
        { paciente: 0, profesional: 0, contenido: `[${DEMO_TAG}] Buena respuesta al tratamiento, dolor 3/10. Se progresa con fortalecimiento de core.` },
    ];
    let evolucionesCreated = 0;
    for (const e of evolucionesData) {
        const clave = e.contenido.slice(0, 20);
        const existing = await prisma_1.default.evolucion.findFirst({ where: { consultorioId, pacienteId: pacientes[e.paciente].id, contenido: { startsWith: clave } } });
        if (existing)
            continue;
        await prisma_1.default.evolucion.create({
            data: {
                consultorioId,
                pacienteId: pacientes[e.paciente].id,
                profesionalId: profesionales[e.profesional].id,
                contenido: e.contenido,
            },
        });
        evolucionesCreated++;
    }
    console.log(`Especialidades: ${especialidades.length}, Profesionales: ${profesionales.length}, Obras sociales: ${obras.length}, Pacientes: ${pacientes.length}`);
    console.log(`Turnos: ${created} creados, ${skipped} ya existían`);
    console.log(`Evoluciones demo: ${evolucionesCreated} creadas`);
    console.log(`Seed demo de "${CONSULTORIO_NOMBRE}" (consultorioId=${consultorioId}) completado`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma_1.default.$disconnect());
//# sourceMappingURL=seedIafsDemo.js.map
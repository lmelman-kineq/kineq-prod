"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.granularidadFor = granularidadFor;
exports.getEstadisticasResumen = getEstadisticasResumen;
// Agregaciones para la sección Estadísticas. Todo el cálculo pesado pasa por
// acá (nunca se bajan turnos crudos al frontend) — el service devuelve datos
// ya reducidos: conteos, buckets de serie temporal, sumas por grupo.
const prisma_1 = __importDefault(require("./prisma"));
const ESTADOS = ['ASIGNADO', 'EN_ESPERA', 'ATENDIENDO', 'FINALIZADO', 'AUSENTE', 'CANCELADO'];
function turnoWhere(f) {
    const where = { consultorioId: f.consultorioId, inicio: { gte: f.desde, lte: f.hasta } };
    if (f.profesionalId)
        where.profesionalId = f.profesionalId;
    if (f.especialidadId)
        where.especialidadId = f.especialidadId;
    return where;
}
function granularidadFor(desde, hasta) {
    const dias = (hasta.getTime() - desde.getTime()) / 86_400_000;
    if (dias <= 31)
        return 'dia';
    if (dias <= 120)
        return 'semana';
    return 'mes';
}
function inicioDeSemana(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dia = d.getUTCDay() || 7; // domingo=0 -> 7, para que la semana empiece el lunes
    d.setUTCDate(d.getUTCDate() - dia + 1);
    return d;
}
function bucketKey(date, granularidad) {
    if (granularidad === 'dia')
        return date.toISOString().slice(0, 10);
    if (granularidad === 'mes')
        return date.toISOString().slice(0, 7);
    return inicioDeSemana(date).toISOString().slice(0, 10);
}
// Genera las claves de bucket entre desde/hasta en orden, para que la serie
// temporal no tenga huecos aunque un día/semana/mes no tenga turnos.
function bucketKeysEnRango(desde, hasta, granularidad) {
    const keys = [];
    if (granularidad === 'dia') {
        const cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
        const fin = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate()));
        while (cursor <= fin) {
            keys.push(cursor.toISOString().slice(0, 10));
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }
    else if (granularidad === 'semana') {
        const cursor = inicioDeSemana(desde);
        const fin = inicioDeSemana(hasta);
        while (cursor <= fin) {
            keys.push(cursor.toISOString().slice(0, 10));
            cursor.setUTCDate(cursor.getUTCDate() + 7);
        }
    }
    else {
        const cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
        const fin = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), 1));
        while (cursor <= fin) {
            keys.push(cursor.toISOString().slice(0, 7));
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
    }
    return keys;
}
function pct(numerador, denominador) {
    if (denominador <= 0)
        return null;
    return Math.round((numerador / denominador) * 1000) / 10;
}
async function getEstadisticasResumen(f) {
    const where = turnoWhere(f);
    const whereFinalizado = { ...where, estado: 'FINALIZADO' };
    const [porEstadoRaw, pacientesAtendidosFilas, pacientesNuevos, evolucionesRegistradas, filasSerie, porProfesionalRaw, porEspecialidadRaw, resumenPorProfesionalEstadoRaw, pacientesPorProfesionalFilas,] = await Promise.all([
        prisma_1.default.turno.groupBy({ by: ['estado'], where, _count: { _all: true } }),
        prisma_1.default.turno.findMany({ where: whereFinalizado, distinct: ['pacienteId'], select: { pacienteId: true } }),
        prisma_1.default.paciente.count({ where: { consultorioId: f.consultorioId, createdAt: { gte: f.desde, lte: f.hasta } } }),
        prisma_1.default.evolucion.count({
            where: {
                consultorioId: f.consultorioId,
                activo: true,
                createdAt: { gte: f.desde, lte: f.hasta },
                ...(f.profesionalId ? { profesionalId: f.profesionalId } : {}),
            },
        }),
        prisma_1.default.turno.findMany({ where, select: { inicio: true, estado: true } }),
        f.ocultarDesglosePorProfesional
            ? Promise.resolve([])
            : prisma_1.default.turno.groupBy({ by: ['profesionalId'], where: whereFinalizado, _count: { _all: true } }),
        prisma_1.default.turno.groupBy({ by: ['especialidadId'], where: whereFinalizado, _count: { _all: true } }),
        f.ocultarDesglosePorProfesional
            ? Promise.resolve([])
            : prisma_1.default.turno.groupBy({ by: ['profesionalId', 'estado'], where, _count: { _all: true } }),
        f.ocultarDesglosePorProfesional
            ? Promise.resolve([])
            : prisma_1.default.turno.findMany({ where: whereFinalizado, distinct: ['profesionalId', 'pacienteId'], select: { profesionalId: true, pacienteId: true } }),
    ]);
    // --- KPIs ---
    const countByEstado = new Map(porEstadoRaw.map((r) => [r.estado, r._count._all]));
    const turnosTotales = porEstadoRaw.reduce((sum, r) => sum + r._count._all, 0);
    const sesionesRealizadas = countByEstado.get('FINALIZADO') ?? 0;
    const ausentes = countByEstado.get('AUSENTE') ?? 0;
    const cancelados = countByEstado.get('CANCELADO') ?? 0;
    const pacientesAtendidos = pacientesAtendidosFilas.length;
    const denominadorAusentismo = sesionesRealizadas + ausentes;
    const kpis = {
        turnos: turnosTotales,
        sesionesRealizadas,
        pacientesAtendidos,
        ausentismo: { porcentaje: pct(ausentes, denominadorAusentismo), cantidad: ausentes, denominador: denominadorAusentismo },
        cancelaciones: { porcentaje: pct(cancelados, turnosTotales), cantidad: cancelados },
        pacientesNuevos,
        evolucionesRegistradas,
        promedioSesionesPorPaciente: pacientesAtendidos > 0 ? Math.round((sesionesRealizadas / pacientesAtendidos) * 10) / 10 : null,
    };
    // --- Estados (dona/barras) ---
    const estados = ESTADOS.map((estado) => ({ estado, cantidad: countByEstado.get(estado) ?? 0 }));
    // --- Serie temporal ---
    const granularidad = granularidadFor(f.desde, f.hasta);
    const buckets = new Map(bucketKeysEnRango(f.desde, f.hasta, granularidad).map((key) => [key, { turnos: 0, finalizados: 0 }]));
    for (const turno of filasSerie) {
        const key = bucketKey(turno.inicio, granularidad);
        const bucket = buckets.get(key);
        if (!bucket)
            continue; // fuera de rango por corrimiento de bucket, no debería pasar
        bucket.turnos += 1;
        if (turno.estado === 'FINALIZADO')
            bucket.finalizados += 1;
    }
    const serieTemporal = Array.from(buckets.entries()).map(([fecha, valores]) => ({ fecha, ...valores }));
    // --- Por profesional / especialidad (nombres) ---
    const profesionalIds = porProfesionalRaw.map((r) => r.profesionalId);
    const especialidadIds = porEspecialidadRaw.map((r) => r.especialidadId);
    const [profesionales, especialidades] = await Promise.all([
        profesionalIds.length ? prisma_1.default.profesional.findMany({ where: { id: { in: profesionalIds } }, select: { id: true, nombre: true, apellido: true } }) : Promise.resolve([]),
        especialidadIds.length ? prisma_1.default.especialidad.findMany({ where: { id: { in: especialidadIds } }, select: { id: true, nombre: true, color: true } }) : Promise.resolve([]),
    ]);
    const profesionalById = new Map(profesionales.map((p) => [p.id, p]));
    const especialidadById = new Map(especialidades.map((e) => [e.id, e]));
    const porProfesional = porProfesionalRaw
        .map((r) => {
        const p = profesionalById.get(r.profesionalId);
        return p ? { profesionalId: r.profesionalId, nombre: p.nombre, apellido: p.apellido, finalizados: r._count._all } : null;
    })
        .filter((x) => x !== null)
        .sort((a, b) => b.finalizados - a.finalizados);
    const porEspecialidad = porEspecialidadRaw
        .map((r) => {
        const e = especialidadById.get(r.especialidadId);
        return e ? { especialidadId: r.especialidadId, nombre: e.nombre, color: e.color, finalizados: r._count._all } : null;
    })
        .filter((x) => x !== null)
        .sort((a, b) => b.finalizados - a.finalizados);
    // --- Resumen por profesional (tabla) ---
    const resumenMap = new Map();
    for (const r of resumenPorProfesionalEstadoRaw) {
        const entry = resumenMap.get(r.profesionalId) ?? { turnos: 0, finalizados: 0, ausentes: 0, cancelados: 0 };
        entry.turnos += r._count._all;
        if (r.estado === 'FINALIZADO')
            entry.finalizados += r._count._all;
        if (r.estado === 'AUSENTE')
            entry.ausentes += r._count._all;
        if (r.estado === 'CANCELADO')
            entry.cancelados += r._count._all;
        resumenMap.set(r.profesionalId, entry);
    }
    const pacientesUnicosPorProfesional = new Map();
    for (const fila of pacientesPorProfesionalFilas) {
        const set = pacientesUnicosPorProfesional.get(fila.profesionalId) ?? new Set();
        set.add(fila.pacienteId);
        pacientesUnicosPorProfesional.set(fila.profesionalId, set);
    }
    const resumenProfesionalesIds = Array.from(resumenMap.keys());
    const resumenProfesionalesInfo = resumenProfesionalesIds.length
        ? await prisma_1.default.profesional.findMany({ where: { id: { in: resumenProfesionalesIds } }, select: { id: true, nombre: true, apellido: true } })
        : [];
    const resumenProfesionalesInfoById = new Map(resumenProfesionalesInfo.map((p) => [p.id, p]));
    const resumenProfesionales = resumenProfesionalesIds
        .map((id) => {
        const info = resumenProfesionalesInfoById.get(id);
        const conteo = resumenMap.get(id);
        if (!info)
            return null;
        return {
            profesionalId: id,
            nombre: info.nombre,
            apellido: info.apellido,
            ...conteo,
            pacientesUnicos: pacientesUnicosPorProfesional.get(id)?.size ?? 0,
        };
    })
        .filter((x) => x !== null)
        .sort((a, b) => b.turnos - a.turnos);
    return {
        periodo: { desde: f.desde.toISOString(), hasta: f.hasta.toISOString(), granularidad },
        kpis,
        serieTemporal,
        estados,
        porProfesional,
        porEspecialidad,
        resumenProfesionales,
    };
}
//# sourceMappingURL=estadisticasService.js.map
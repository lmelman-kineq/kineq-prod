# Módulo: Estadísticas

## Objetivo del módulo

Estadísticas es la sección de métricas, análisis y reportes del consultorio — separada de Inicio, que sigue siendo la vista operativa del día (ver `docs/modules/dashboard.md`, sección "Dashboard operativo vs estadísticas").

Objetivo: que Administrador, Supervisor y Profesional puedan entender rápidamente cuánto se está atendiendo, cómo evoluciona el volumen de turnos, cuántos pacientes asisten, cuántos faltan o cancelan, cómo se distribuye el trabajo entre profesionales y qué especialidades concentran actividad — sin tener que leer contenido clínico individual.

**Estado**: implementado (V1).

---

## Diferencia con Inicio

| | Inicio | Estadísticas |
|---|---|---|
| Foco | operación del día | métricas de un período |
| Datos | turnos de hoy, sala de espera, atención en curso | agregados: conteos, porcentajes, series, rankings |
| Filtros | fecha del día, profesional (implícito por sesión) | período, profesional, especialidad |

No se sobrecargó Inicio con nada de esto — es una página nueva e independiente (`frontend/src/components/EstadisticasPage.tsx`).

---

## Permisos

- **ADMINISTRADOR** y **SUPERVISOR**: ven todo el consultorio, con filtro de profesional libre.
- **PROFESIONAL**: solo sus propios datos. El backend (`GET /api/estadisticas/resumen`, `backend/src/estadisticasRoutes.ts`) ignora cualquier `profesionalId` que llegue por query y fuerza el propio vínculo (`req.usuario.profesionalId`) — mismo criterio que ya usa `POST /api/turnos`. Sin vínculo, la consulta resuelve a ceros (no expone datos de todo el consultorio por error). En el frontend, el filtro de profesional ni se muestra para este rol, y los gráficos/tabla "por profesional" (que no tendrían sentido con una sola barra) se omiten.
- **RECEPCION**: sin acceso por default (`requireRole` no la incluye). El ítem de nav sigue visible para todos los roles logueados; si el fetch devuelve 403, la página muestra "No tenés acceso a esta sección" en vez de romper.

---

## Filtros

- **Período**: chips de preset (Últimos 7 días, Últimos 30 días — default, Este mes, Mes anterior, Últimos 3 meses, Este año) + "Personalizado" con dos `DateInput`. Presets calculados en `frontend/src/utils/statsPeriods.ts` (`rangoParaPreset`), reutilizando el mismo criterio de límites de día que ya usa el filtro de fecha de Turnos (`normalizeDateBoundary` en `services/api.ts` — hora local del navegador, no la del consultorio; mismo límite conocido y aceptado que ya tenía ese filtro).
- **Profesional**: `<select>` poblado con `GET /api/profesionales` (endpoint ya existente, no se agregó un catálogo nuevo al endpoint de estadísticas). Fijo/oculto para rol Profesional.
- **Especialidad**: `<select>` poblado con `GET /api/especialidades` (ídem).

El backend valida `desde <= hasta` y rechaza (`400`) un rango "Personalizado" mayor a 366 días — protección simple contra una consulta sin límite razonable sobre años de historial.

---

## KPIs — fórmulas exactas

Todos calculados en `backend/src/estadisticasService.ts`, sobre `Turno` filtrado por `consultorioId` (siempre de la sesión, nunca del cliente) + rango de `inicio` + profesional/especialidad opcionales.

| KPI | Fórmula |
|---|---|
| Turnos | cantidad de turnos en el período (todos los estados) |
| Sesiones realizadas | cantidad con `estado = FINALIZADO` |
| Pacientes atendidos | pacientes **únicos** con al menos un turno `FINALIZADO` en el período |
| Ausentismo | `AUSENTE / (FINALIZADO + AUSENTE)` — `CANCELADO` nunca entra en este cálculo. Se muestra `—` si el denominador es 0. |
| Cancelaciones | `CANCELADO / total de turnos del período` |
| Pacientes nuevos | `Paciente.createdAt` dentro del período — **no** se filtra por profesional (`Paciente` no tiene noción de profesional en el schema; es una métrica administrativa consultorio-wide, incluso para el rol Profesional — limitación deliberada, documentada acá) |
| Evoluciones registradas | `Evolucion.createdAt` dentro del período, `activo: true`, filtrado por profesional si aplica — cuenta registros, nunca lee `contenido` |
| Promedio de sesiones por paciente | `sesiones FINALIZADO / pacientes atendidos`, `—` si no hay pacientes |

---

## Gráficos

- **Evolución de turnos**: línea de Turnos + Finalizados, granularidad automática según el ancho del rango (`granularidadFor` en `estadisticasService.ts`): ≤31 días → día, 32–120 → semana, >120 → mes. El backend nunca manda turnos crudos al frontend — arma los buckets server-side (`bucketKeysEnRango`, rellena huecos con 0 para que el gráfico no tenga saltos) y el frontend solo grafica el resultado ya agregado.
- **Estado de los turnos**: donut con los 6 estados de `EstadoTurno`, mismos colores que ya usa la agenda de Turnos (`--color-primary`, `--turnos-waiting-badge`, `--turnos-attending`, `--color-success`, `--color-warning`, `--color-danger`) — no se inventó una paleta nueva. Estados en 0 se ocultan del gráfico.
- **Sesiones por profesional**: barras horizontales, `FINALIZADO` por profesional, orden descendente, primeras 8 con "Ver todos". Omitido para rol Profesional.
- **Actividad por especialidad**: donut, `FINALIZADO` por especialidad, usando `Especialidad.color` tal cual está configurado (sin paleta nueva).
- **Resumen por profesional**: tabla (Turnos / Finalizados / Ausentes / Cancelados / Pacientes únicos), omitida para rol Profesional.

Librería: **recharts** (única dependencia nueva del proyecto para esta tarea) — no había ninguna instalada; se descartó una implementación en SVG a mano por ser más código propio para mantener que una dependencia chica y estándar dado que se necesitaban 4 tipos de gráfico con tooltip y responsive de fábrica.

---

## Privacidad

La V1 solo muestra datos agregados. Nunca se exponen: contenido de evoluciones, antecedentes, alergias, medicación, diagnósticos, ni nombres de pacientes dentro de un gráfico. Toda consulta se limita al consultorio de la sesión — no existe forma de pedir datos de otro consultorio desde este endpoint.

---

## Backend

- `GET /api/estadisticas/resumen?desde&hasta&profesionalId&especialidadId` — único endpoint, módulo aislado (`backend/src/estadisticasRoutes.ts` + `backend/src/estadisticasService.ts`, montado en `app.ts` con una sola línea `app.use('/api/estadisticas', estadisticasRoutes)`, sin tocar ni reordenar el resto del archivo).
- Reutiliza `requireRole`, `requireAuth` (vía el `app.use('/api', requireAuth)` ya existente) y el criterio de scoping de `PROFESIONAL` tal cual usa el resto de la app.
- Agregaciones vía `prisma.turno.groupBy` (por estado, por profesional, por especialidad, por profesional+estado) + un par de `findMany` con `distinct` para conteos de pacientes únicos — nunca se trae la tabla completa de turnos al servicio salvo `select: { inicio, estado }` acotado al rango, exclusivamente para construir la serie temporal.
- Sin migraciones: el endpoint solo lee tablas ya existentes (`Turno`, `Paciente`, `Evolucion`, `Profesional`, `Especialidad`).
- Sin índices nuevos: los que ya tiene `Turno` (`[consultorioId, inicio]`, `[consultorioId, profesionalId, inicio]`, `[consultorioId, estado, inicio]`, `[especialidadId]`) cubren los patrones de filtro usados.

---

## Limitaciones de V1 (a propósito, no implementar sin pedido explícito)

- No hay ocupación real (turnos / horas disponibles) — no existe todavía una fuente confiable de disponibilidad horaria por profesional en el schema.
- Sin exportación PDF/Excel, sin envío programado de reportes.
- Sin comparación entre consultorios ni benchmarks globales de Kineq.
- Sin predicciones, IA, ni reglas automáticas sobre las métricas.
- "Pacientes nuevos" es consultorio-wide incluso para Profesional (ver tabla de KPIs arriba) — no hay forma de atribuir un alta de paciente a un profesional en el modelo actual.
- Filtros de período usan hora local del navegador para los límites de día (mismo comportamiento ya aceptado en el filtro de fecha de Turnos), no la zona horaria del consultorio.

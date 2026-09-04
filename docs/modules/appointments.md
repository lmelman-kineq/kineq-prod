# Módulo: Turnos

## Objetivo del módulo

El módulo de Turnos permite gestionar la agenda diaria del consultorio, registrar citas agendadas, controlar el estado de atención de los pacientes y servir como punto de entrada al flujo clínico de cada sesión.

En Kineq, un turno representa dos cosas al mismo tiempo:

1. Una cita agendada entre un paciente y un profesional.
2. Una posible sesión clínica, en caso de que el paciente se presente y sea atendido.

El turno puede evolucionar a lo largo del día según el estado del paciente: reservado, en espera, en atención, finalizado, ausente o cancelado.

---

## Estado actual

Actualmente el sistema ya cuenta con funcionalidad base para turnos:

- Visualización de turnos del día en la pantalla de Inicio.
- Calendario diario.
- Calendario mensual lateral.
- Listado de turnos.
- Creación de turnos.
- Edición de turnos.
- Visualización de datos del turno seleccionado.
- Estados de turno.
- Asociación con paciente, profesional, especialidad y obra social.
- Registro de duración y tiempos vinculados a la atención.
- Menú contextual (click derecho) en cada fila del listado de Turnos, con exactamente las mismas acciones/permisos que el menú contextual del calendario de Inicio — ambos llaman a la misma función `getTurnoQuickActions` (`frontend/src/App.tsx`), nunca a una matriz de estados duplicada; el botón "⋮" existente sigue siendo el equivalente táctil.
- El botón "Volver" de la pantalla de Atención regresa a la pantalla real desde la que se entró (Inicio o Turnos, los dos orígenes posibles hoy), no siempre a Inicio.
- "Finalizar atención" pide confirmación (modal custom, nunca `confirm()`) desde cualquiera de sus cuatro disparadores: la propia pantalla de Atención, el menú contextual de Inicio, el menú contextual/de tres puntos de Turnos, y las acciones rápidas del modal "Editar turno".

**Actualización (implementado) — bug corregido: el modal "Editar turno" quedaba abierto sobre la pantalla de Atención**: las acciones rápidas "Iniciar atención"/"Continuar atención" del modal "Editar turno" (`.turno-quick-actions`, ver arriba) llaman a `iniciarAtencion`/`continuarAtencion` (`App.tsx`), que navegan a `activePage: 'atencion'` — pero ese modal (`showViewTurno`/`editingTurnoForm`) es un overlay hermano de `activePage`, no condicionado por él, así que no se cerraba solo al navegar y quedaba flotando (backdrop incluido) sobre `AttentionPage`. Causa real, no un problema de scroll-lock/focus-trap (la app no usa JS para eso — el `modal-overlay` en `position: fixed` ya bloquea la interacción visualmente, y al desmontarse no deja rastro). Fix: ambas funciones llaman a `closeTurnoDetails()` (ya existía, mismo helper que usa el botón "Cancelar"/la X del modal) antes de navegar — inofensivo cuando se llama desde otro origen donde el modal ya está cerrado (Inicio, menú de Turnos).

**Actualización (implementado) — "Editar paciente" disponible durante la atención**: `AttentionPage.tsx` no tenía forma de editar los datos administrativos del paciente sin volver antes al detalle normal. Se agregó el mismo botón "Editar paciente" (mismo `PatientFormModal.tsx`, mismo criterio de permisos `ADMINISTRADOR`/`RECEPCION` que ya usaba `PatientDetailPage.tsx`) al inicio de `.attention-header-actions`, antes del timer/"Finalizar atención" — no compite con esa acción principal porque es un `secondary-button`.

**Actualización (implementado) — `AttentionPage.tsx` eliminado, pantalla única de Paciente/Atención**: las dos entradas anteriores describían funcionalidad agregada a `AttentionPage.tsx` como componente separado de `PatientDetailPage.tsx` — ese componente ya no existe. `PatientDetailPage.tsx` es ahora la única pantalla, y recibe `activeTurno`/`onUpdateEstado` como props opcionales cuando se entra desde "Iniciar atención"/"Continuar atención" (timer, "Finalizar atención", vínculo evolución↔turno se agregan de forma aditiva). Esto elimina por construcción cualquier posibilidad de que "Editar paciente", el Diagnóstico, el orden de tabs o el layout diverjan entre ver un paciente normal y atenderlo — ver "Pantalla única de Paciente/Atención" en `docs/modules/clinical-history.md` para el detalle técnico.

**Actualización (ver "Autoría clínica, vínculo Usuario–Profesional y permisos" en `docs/tasks.md`)**: los cuatro roles (`ADMINISTRADOR`, `PROFESIONAL`, `RECEPCION`, `SUPERVISOR`) pueden crear y editar turnos del propio consultorio — antes `PROFESIONAL` no podía crear y `SUPERVISOR` no podía ni crear ni editar. La regla "un `PROFESIONAL` solo edita sus propios turnos" sigue vigente, sin cambios. En la tabla de Turnos (`TurnosPage.tsx`), hacer click en una fila **siempre** abre la pantalla de paciente/atención (antes solo pasaba para turnos `Atendiendo`; el resto de los estados abría directamente el modal de edición) — nunca cambia el estado del turno ni inicia atención. Editar el turno ahora es una acción separada: el ícono de lápiz en cada fila, con su propio `stopPropagation()` para no disparar también la navegación de la fila.

**Actualización (permisos de creación/edición por rol, ajustes generales)**:
- Un usuario `PROFESIONAL` solo puede crear turnos para sí mismo: el campo Profesional no se muestra en el formulario y el backend ignora cualquier `profesionalId` recibido del cliente, tomando siempre el profesional vinculado a la sesión (`POST /api/turnos`, `backend/src/app.ts`). Si no tiene un profesional vinculado y activo, la creación se rechaza con 403 y el mensaje "Tu usuario no está vinculado a un profesional activo...".
- Al editar (`PATCH /api/turnos/:id`), un `PROFESIONAL` puede modificar únicamente turnos cuyo `profesionalId` coincida con el suyo, y no puede reasignarlos a otro profesional: `profesionalId` queda fuera de los campos editables para ese rol (antes solo se validaba el profesional *original* del turno, no el nuevo valor enviado en el mismo PATCH). `RECEPCION`, `SUPERVISOR` y `ADMINISTRADOR` pueden crear y reasignar cualquier turno del consultorio sin restricción.
- En la UI, el lápiz de "Editar turno" queda deshabilitado (con tooltip "Solo podés editar tus propios turnos") cuando un `PROFESIONAL` abre el detalle de un turno ajeno; la lectura sigue permitida.

**Actualización (implementado) — alta rápida de Paciente y de Profesional, campos fuera del dropdown**: los selectores de Paciente y Profesional de `TurnoFormFields` (`frontend/src/components/FormFields.tsx`) tienen, al final del dropdown, un botón de ancho completo ("+ Agregar paciente" / "+ Agregar profesional", mismo patrón visual que "+ Nueva Especialidad"). Al tocarlo, el dropdown se cierra y aparece una sección propia (`.quick-create-section`) dentro del formulario del turno — nunca dentro del panel del dropdown, a diferencia de la versión anterior. Paciente: Nombre completo (único campo obligatorio, mismo criterio que `docs/modules/patients.md`), Documento y Teléfono opcionales; al guardar (`POST /api/pacientes`, mismos roles que ya podían crear turnos — `ADMIN_DATA_ROLES`) queda seleccionado automáticamente y se agrega al listado ya cargado, sin resetear el resto del formulario de turno. "Cancelar" no crea nada y vuelve al estado anterior, conservando el paciente que hubiera elegido antes. Si el documento ya existe en el consultorio, el backend responde `409` y el mensaje se muestra dentro de la sección sin cerrar el modal de turno.

Profesional (mismo patrón, nuevo en esta ronda): Nombre completo (único obligatorio — mismo criterio "sin parseo" que Paciente, se guarda entero en `nombre` con `apellido: ''`; distinto de `ProfesionalFormModal.tsx`, que sigue con Nombre/Apellido separados), Título, Matrícula y "Usuario vinculado" opcionales. "Usuario vinculado" solo se ofrece si el rol puede ver `GET /api/usuarios` (`ADMINISTRADOR` únicamente — mismo permiso de siempre, no se amplió); para el resto de los roles el campo directamente no aparece. Usa `POST /api/profesionales` sin cambios de backend (ya soportaba estos campos mínimos + `usuarioId` opcional). No repite el selector de Especialidades — la ficha completa se termina desde Configuración → Profesionales.

**Actualización (implementado) — dropdowns nunca esconden la opción ya elegida**: Paciente y Profesional tenían un bug real: al abrir el dropdown con algo ya seleccionado, el buscador se precargaba con el nombre exacto de la opción elegida (`onFocus` → `setPatientSearch(selectedPatient?.displayName)`), y el filtro por texto (`.includes()`) entonces solo dejaba ver esa única opción — parecía que "el resto había desaparecido". Fix: al abrir, el buscador arranca vacío (se ve la lista completa) y la opción ya elegida se marca con un check (`✓`, clase `.dropdown-option--selected`) en vez de sacarse del array — mismo tratamiento aplicado también a Especialidad y Diagnóstico (que no tenían el bug del buscador, pero tampoco marcaban visualmente la selección). Ver "Diagnóstico con sesiones planificadas" más arriba y `docs/modules/clinical-history.md` para Diagnóstico específicamente.

**Actualización (implementado) — Profesional recién creado/editado aparece sin recargar la página**: `pacientesState`/`profesionalesState` (`App.tsx`) solo se recargaban vía `reloadKey`, y nada llamaba a `setReloadKey` después de crear/editar/eliminar un Profesional o un Usuario con rol `PROFESIONAL` desde Configuración — un profesional recién dado de alta ahí no aparecía en el selector de Turnos hasta un reload completo. `ConfiguracionUsuarios.tsx`/`ConfiguracionProfesionales.tsx` ahora reciben `onProfesionalesChanged` (vía `ConfiguracionPage.tsx`), que `App.tsx` conecta a `setReloadKey`. La creación rápida de Paciente/Profesional *desde el propio formulario de Turno* ya no tenía este problema (siempre agregó localmente al array ya cargado, `setPacientesState/setProfesionalesState((s) => [...s, next])`) — el gap era específicamente "creado en otra pantalla, mientras el modal de turno ya estaba abierto o se abre después".

**Actualización (implementado) — "Ver Historia Clínica" en el menú contextual de Inicio**: el menú contextual (click derecho sobre un bloque de turno en la Home) ahora siempre incluye "Ver Historia Clínica" al final, independientemente de qué acciones de estado (`getTurnoQuickActions`) estén disponibles para el rol/turno — antes, si esa lista salía vacía (ej. rol `SUPERVISOR`), el menú ni se abría. Es **exclusivo de Inicio**: `getTurnoQuickActions()` (compartida con Turnos y el modal "Editar turno") no se tocó, el ítem se agrega directamente en el render del menú de `App.tsx`, así que la tabla de Turnos y el modal de edición no lo heredan. Navega con `openPatientDetail(patientId)` (mismo helper que el resto de la app) a la pantalla única de Paciente — la tab en la que aterriza (Ficha inicial para roles clínicos, Turnos para el resto) es la que ya calcula `PatientDetailPage.tsx` por defecto, sin lógica nueva.

**Actualización (implementado) — bug de especialidad "no pertenece al consultorio" corregido**: `POST`/`PATCH /api/turnos` validaban la especialidad con `especialidad.consultorioId === consultorioId`, lo que rechazaba las especialidades globales/default (`consultorioId: null`) aunque el propio backend las ofreciera como seleccionables. Ambas rutas ahora usan el helper centralizado `especialidadesInvalidasParaConsultorio()` (`backend/src/app.ts`, mismo que usa Profesionales — ver `docs/modules/specialties.md`), que acepta global-visible o custom-propia y excluye global-oculta/custom-de-otro-consultorio/inactiva. `PATCH /api/turnos/:id` antes ni siquiera validaba `especialidadId` al cambiarlo — ahora sí, cerrando ese hueco.

**Actualización (implementado) — Profesional↔Especialidad ya no restringe la creación de Turnos**: antes, `POST /api/turnos` exigía `profesionalEspecialidad.findFirst({ profesionalId, especialidadId })` — un turno solo podía crearse si el profesional tenía esa especialidad asignada en su ficha, con el error `profesional does not have the especialidad`. Esa validación se eliminó por completo (no había un equivalente en `PATCH`, así que ahí no hubo nada que sacar). Un turno puede asociar cualquier combinación válida de Paciente/Profesional/Especialidad del consultorio, sin importar las especialidades que tenga asignadas el profesional — esa relación (`ProfesionalEspecialidad`) sigue existiendo y sirve para organización, filtros y la ficha del profesional, pero deja de ser una restricción de agenda. El frontend nunca filtraba las especialidades del selector de Turno según el profesional elegido, así que no hizo falta ningún cambio ahí.

**Actualización (implementado) — alineación vertical de las acciones de la fila**: en `TurnosPage.tsx`, la celda de acciones combinaba `className="turnos-actions-cell config-row-actions"` en el mismo `<td>` — `.config-row-actions` pone `display: flex`, que anula `vertical-align: middle` (el `<td>` deja de participar del layout normal de tabla y el navegador lo ancla arriba de una fila más alta, ej. cuando el nombre del paciente ocupa dos líneas). Fix: el `<td>` vuelve a ser una celda de tabla normal (`className="turnos-actions-cell"` únicamente, `vertical-align: middle` ya vigente en `.turnos-table td`) y el flex para alinear los botones horizontalmente vive en un `<div className="config-row-actions">` interno. Mismo patrón ya usado en las tablas de Configuración — acá solo se corrigió Turnos, que era la única con el bug reportado.

**Actualización (implementado) — eliminación real de turnos (baja lógica), disponible en cualquier estado**: antes no existía ningún endpoint de borrado de `Turno` — el botón "Eliminar turno" del modal de edición en realidad llamaba a `cancelTurno` (lo dejaba en estado `CANCELADO`, sin sacarlo de las estadísticas ni de la agenda). Se investigó primero la semántica real antes de tocar nada (la FK `Evolucion.turnoId` ya es `onDelete: SetNull`, así que un `DELETE` físico no habría roto evoluciones) — pero un `DELETE` físico sí habría corrompido en silencio estadísticas de meses ya cerrados (sesiones realizadas/ausentismo), que es exactamente el tipo de "romper historial" que se buscaba evitar. Se optó por baja lógica, mismo criterio ya usado en el resto de la app (`Paciente.activo`, `Profesional.deletedAt`, `Evolucion.activo`): `Turno` ganó `eliminadoAt DateTime?` (migración `20260817170811_turno_eliminado_at`, aditiva). `DELETE /api/turnos/:turnoId` (nuevo, `requireRole(...ADMIN_DATA_ROLES)`, un `PROFESIONAL` solo puede eliminar turnos propios — mismo criterio que `PATCH`) marca `eliminadoAt: new Date()`, nunca borra la fila. `eliminadoAt: null` se agregó al `where` de toda lectura operativa que antes no lo tenía: `GET /api/turnos`, la verificación de superposición, el chequeo de existencia de `PATCH /api/turnos/:id`, el conteo de `sesionAutomaticaParaGrupo()` y — importante para no desviar reportes ya cerrados — el `turnoWhere()` compartido de `estadisticasService.ts` (ver `docs/modules/statistics.md`), que alimenta todas las queries de esa pantalla. Un turno "eliminado" desaparece de agenda, ficha del paciente y estadísticas, pero la fila y su `estado`/timestamps quedan intactos en la base.

El botón "Eliminar turno" del modal de edición ahora llama al endpoint real (`api.deleteTurno()`), con la misma confirmación custom de siempre (nunca `confirm()` nativo) — el texto se actualizó para reflejar que es permanente. El menú `⋮`/contextual (`getTurnoQuickActions()` en `App.tsx`, compartido por el menú de Inicio, el de `TurnosPage.tsx` y las acciones rápidas del modal de edición) ahora agrega "Eliminar turno" al final de la lista de acciones **sin importar el estado del turno** — antes, para `FINALIZADO`/`AUSENTE`/`CANCELADO` esa función devolvía una lista vacía, lo que en `TurnosPage.tsx` directamente ocultaba el botón `⋮` de la fila (`{rowActions.length > 0 ? <button>⋮</button> : null}`); con "Eliminar turno" siempre presente para roles autorizados, el `⋮` vuelve a aparecer en todos los estados sin tocar esa condición. Respeta el mismo filtro por rol que ya existía para las demás acciones administrativas (como "Cancelar turno"): `ADMINISTRADOR` y `RECEPCION` lo ven, `PROFESIONAL` no (no está en `clinicalKeys`), `SUPERVISOR` nunca ve acciones. El botón fijo "Eliminar turno" del modal de edición (que ya existía, siempre visible sin importar estado) ahora también respeta ese mismo filtro (`canDeleteTurno`, antes no tenía ningún gate de rol). Dentro del modal de edición, "Eliminar turno" se excluye deliberadamente de las acciones rápidas (`.turno-quick-actions`) para no duplicarlo con el botón fijo de abajo.

**Actualización (implementado) — orden fijo del menú contextual de Inicio**: el menú de click derecho sobre un turno en Inicio ahora tiene un orden explícito, siempre igual sin importar el estado: **Editar Turno → [acciones de estado que correspondan] → Ver Historia Clínica → Eliminar Turno**. "Editar Turno" es nuevo en este menú (antes solo se abría con click izquierdo sobre el bloque) y llama al mismo `openTurnoDetails()` de siempre — ningún handler nuevo. Las acciones de estado (Marcar en espera, Iniciar/Finalizar atención, Cancelar, Marcar ausente) siguen exactamente igual, solo cambiaron de posición dentro del menú (antes iban primero, ahora van en el medio); "Eliminar Turno" se saca de esa lista y se renderiza aparte, al final, respetando el mismo filtro por rol que ya tenía dentro de `getTurnoQuickActions()`. Exclusivo de Inicio — el menú de fila de `TurnosPage.tsx` y las acciones rápidas del modal de edición no se tocaron.

**Actualización (implementado) — cualquier turno es editable sin importar el estado (ya era así)**: se verificó explícitamente el pedido de que `FINALIZADO`/`CANCELADO`/`AUSENTE` sigan siendo editables — ya lo eran. El guard existente en `PATCH /api/turnos/:id` (`estadosFinales.includes(turno.estado)` → `409`) solo bloquea **cambiar el `estado`** de un turno ya terminal hacia otro estado (reabrir una atención cerrada) — nunca bloqueó editar el resto de los campos (notas, fecha, profesional, diagnóstico, etc.) de un turno terminal. En el frontend, el modal "Editar turno" siempre abre en modo edición (`isEditingTurno` se setea `true` en `openTurnoDetails()`, sin condicionar por `turno.estado`). Se agregó un test de regresión (`app.test.ts`) que confirma explícitamente que `PATCH` con un campo no-`estado` funciona en los tres estados terminales.

**Actualización (implementado) — "Última atención" ya calculaba correctamente (verificado, no un bug)**: se investigó el pedido de que "Última atención" solo considere turnos `FINALIZADO` — la lógica en `PatientSummaryCards.tsx` ya filtraba por `estado === 'FINALIZADO'` y ordenaba descendente por `inicio` antes de esta ronda; un `ASIGNADO`/`CANCELADO` posterior nunca lo pisaba. Se extrajo a una función pura testeada, `ultimaAtencionFinalizada()` (`frontend/src/utils/patient.ts`), para dejar el comportamiento cubierto por un test de regresión en vez de solo lógica inline sin verificar.

**Actualización (implementado) — la tabla de Turnos dentro de la ficha del paciente abre el mismo modal de edición**: `PatientAppointmentsTable.tsx` (tab "Turnos" de `PatientDetailPage.tsx`) antes solo mostraba los turnos del paciente en modo lectura. Cada fila es ahora clickeable (mouse y teclado — `tabIndex`/Enter/Espacio) y abre el mismo `openTurnoDetails()`/modal "Editar turno" que usan Inicio y `TurnosPage.tsx` — no una pantalla ni componente separado, y sin perder el contexto de paciente (el modal se cierra devolviendo a la misma tab). `App.tsx` conecta esto con un wrapper (`onEditTurno={(turno) => openTurnoDetails(mapApiTurnoToUi(turno))}`) porque `PatientDetailPage`/`PatientAppointmentsTable` trabajan con el `Turno` "de dominio" (tal cual lo devuelve la API) mientras que `openTurnoDetails` espera el `Turno` "de UI" (con `date`/`time`/`patientDisplay` ya derivados) — la conversión vive solo en el punto de conexión, sin duplicar lógica dentro de esos dos componentes. Respeta los mismos permisos que el resto de la app (el modal que se abre es el mismo, con las mismas reglas por rol). La tabla también se comprimió de 6 a 5 columnas (Fecha+Hora fusionadas en una celda) y pasó a `table-layout: fixed` con anchos explícitos y truncado+tooltip (`title`) en Profesional/Especialidad — para no requerir scroll horizontal en desktop, mismo patrón ya usado en `.evolution-table`.

La pantalla de Turnos actualmente muestra una tabla con turnos visibles, filtros y estados.

La pantalla de Inicio funciona como una vista rápida del día, mostrando el calendario diario y el detalle del turno seleccionado.

**Actualización (implementado) — Turnos recurrentes y alta rápida compacta desde Home**: ver sección completa "Turnos recurrentes (series)" más abajo. Resumen: un pack finito de turnos (`SerieTurno`, nunca recurrencia infinita) se crea de una sola vez con `Cantidad de sesiones` fija, con patrón semanal (cada N semanas) o mensual por ordinal de día de semana ("todos los meses, el tercer viernes"); el alta rápida desde Home (`Nuevo turno` / click en un horario vacío) ahora abre una card flotante compacta de verdad (ícono + control en cada fila, sin labels tradicionales, sin scroll interno) en vez del formulario completo de siempre — "Más opciones" sigue llevando al mismo formulario completo (Monto, Estado incluidos), compartiendo el mismo estado/validaciones/guardado. Editar o eliminar una ocurrencia de una serie pregunta "Este turno" / "Este turno y los siguientes" antes de aplicar el cambio.

**Actualización (implementado) — corrección de UX del quick-create + recurrencia mensual**: ronda de corrección sobre la implementación anterior. Ver el resto de esta sección para el detalle completo — resumen ejecutivo: la card compacta pasó de ser un formulario tradicional con tamaños reducidos a una card real con densidad Google-Calendar (íconos en vez de labels, sin `Cancelar` en el footer); se agregó recurrencia mensual por ordinal de día de semana; se corrigió un bug real donde un turno recurrente en el calendario mostraba el ícono de recurrencia pero no el horario; y se corrigió una condición de carrera real donde elegir Repetición justo después de un alta rápida de paciente/profesional/especialidad podía revertirse silenciosamente.

---

## Turnos recurrentes (series)

### Concepto

Un turno recurrente representa varias citas reales generadas a partir de una misma configuración (ej. "10 sesiones, todos los lunes"). Cada ocurrencia sigue siendo un `Turno` real e independiente — nunca una recurrencia "virtual" expandida solo en frontend. La recurrencia en Kineq es siempre **finita**: crear una serie exige indicar `Cantidad de sesiones` (2 a 60), nunca "para siempre".

### Modelo

```
SerieTurno (id, consultorioId, patron, frecuenciaSemanas, cantidadSesiones, createdAt)
        1
        |
        N
      Turno (serieId nullable, ordenEnSerie nullable)
```

`ordenEnSerie` es la posición estructural (1-based) del turno dentro de su serie actual — **nunca se confunde con `numeroSesion`** (el número clínico, editable a mano, que puede divergir). Un turno perteneciente a una serie nunca se identifica por heurística (mismo paciente+profesional+hora): la relación siempre pasa por `Turno.serieId`.

`patron` (`PatronRecurrenciaSerie`, migración `20260904150000_serie_turno_patron_mensual`) distingue dos formas de generar las fechas, ambas calculadas por el frontend (el backend nunca hace aritmética de fechas/zona horaria):

- `SEMANAL`: usa `frecuenciaSemanas` (cada cuántas semanas — 1 o 2 hoy), siempre el día de semana de la fecha inicial.
- `MENSUAL_ORDINAL`: repite todos los meses en el mismo N-ésimo día de semana que la fecha inicial (ej. el 04/09/2026 es el primer viernes de septiembre → "todos los meses, el primer viernes"). `frecuenciaSemanas` queda `null` para este patrón — no aplica.

### Recurrencia mensual por ordinal de día de semana

`frontend/src/utils/recurrence.ts`: `ordinalOfWeekdayInMonth(fecha)` calcula la posición 1-5 que ocupa una fecha entre las ocurrencias de su mismo día de semana dentro de su mes (`Math.floor((día-1)/7)+1` — aritmética de calendario pura, nunca sumando ~30 días). `generateMonthlyOrdinalDates(fechaInicial, cantidad)` genera esa cantidad de fechas, mes calendario real por mes calendario real. Si un mes no tiene esa N-ésima ocurrencia (solo relevante para un "quinto X" — todo mes tiene al menos 4 ocurrencias de cualquier día de semana, nunca menos), ese mes se **salta** y se sigue buscando en el siguiente — nunca se reinterpreta como "último X" — así `cantidad` sigue siendo siempre el total exacto de turnos generados. Ejemplo real (ver `recurrence.test.ts`): desde el 30/01/2026 (5to viernes de enero), la siguiente ocurrencia real es el 29/05/2026 (ni febrero, marzo ni abril tienen un 5to viernes).

### Creación

`POST /api/turnos/serie` (mismos roles/aislamiento que `POST /api/turnos`; un `PROFESIONAL` solo crea para sí mismo). El frontend calcula cada fecha de ocurrencia (`buildSerieFechasInicio` para semanal, `buildMonthlySerieFechasInicio` para mensual) usando la misma utilidad de zona horaria del consultorio que ya usa el turno individual (`zonedTimeToUtcIso`) — el backend solo valida y persiste `fechasInicio` + `patron`. `numeroSesionInicial` es editable por el usuario (default: el mismo cálculo automático que ya existía para un turno individual con Diagnóstico); cada ocurrencia siguiente incrementa en 1. La creación es atómica (`prisma.$transaction`): la serie + sus N turnos se crean todos o ninguno. Igual que un turno individual, una superposición nunca bloquea — si una o más ocurrencias se superponen con turnos existentes, el backend responde `409` con la lista de conflictos (`overlaps`) y el frontend ofrece confirmar (`confirmarSuperposicion: true`) y reintentar en vez de bloquear.

### Edición y eliminación: "Este turno" / "Este turno y los siguientes"

- **Este turno**: usa los endpoints normales de siempre (`PATCH`/`DELETE /api/turnos/:id`) — la ocurrencia se edita/elimina sola, sin afectar a las demás. `numeroSesion` nunca se renumera automáticamente por esto (ni por eliminar una ocurrencia intermedia).
- **Este turno y los siguientes**: `PATCH /api/turnos/:id/serie` / `DELETE /api/turnos/:id/serie`, donde `:id` es el turno-ancla (punto de corte). Nunca tocan turnos anteriores al corte — incluidos los ya `FINALIZADO`/`AUSENTE`/`CANCELADO`. Si quedan turnos antes del corte en la serie original, la operación **parte la serie explícitamente en dos**: los turnos del corte en adelante pasan a una `SerieTurno` nueva (con su propio `cantidadSesiones`), la original ajusta el suyo al total que le queda — así ninguna serie cambia de significado retroactivamente. El PATCH solo permite cambiar hora (de pared, preservando la fecha propia de cada ocurrencia), duración, profesional, especialidad, diagnóstico, monto y "sesión de consulta" — nunca `numeroSesion` (se mantiene lo que cada turno ya tenía) ni el paciente (ver "Qué no se implementó" abajo). `GET /api/turnos/:id/serie` expone el ancla + sus siguientes (con `inicio` real de cada uno) para que el frontend arme el payload sin depender de lo que ya tenga cargado en pantalla (el calendario diario de Home solo carga el día visible).

En el frontend, tanto editar como eliminar un turno de una serie muestran primero un diálogo custom ("Este turno" / "Este turno y los siguientes", nunca `confirm()`/`alert()` nativos) — para editar, aparece recién al guardar ("antes de aplicar los cambios"), no al abrir el formulario.

### Alta rápida compacta (Home)

`TurnoFormFields` (`frontend/src/components/FormFields.tsx`) tiene un modo `compact` (más `allowRecurrence` para el selector de Repetición) en vez de un formulario paralelo — comparte estado, dropdowns, validaciones y guardado con el formulario completo de siempre; lo que cambia es la composición visual, no la lógica. En modo compacto:

- Fecha + Hora inicio + Hora fin en una sola fila con ícono de reloj (la duración se deriva de esas dos horas, `duracionMinutos` sigue siendo la única fuente de verdad persistida — nunca se guarda un "fin" separado).
- Repetición en su propia fila (ícono, sin label visible) con `No se repite` / `Cada semana` / `Cada 2 semanas` / `Todos los meses, el N-ésimo díaDeSemana` (calculado según la fecha elegida — ver "Recurrencia mensual" arriba); `Cantidad de sesiones` aparece al lado, solo si hay recurrencia elegida.
- Paciente, Profesional y Especialidad: ícono + control (buscador/selector), **sin** el label grande tradicional arriba de cada campo — el nombre del campo sigue siendo accesible vía un `<label class="sr-only">` asociado por `id`/`htmlFor` (visible para lectores de pantalla, nunca solo un placeholder).
- "Sesión de consulta" y "Nro. de sesión" comparten una misma fila.
- Diagnóstico, Monto, Estado y Duración (min) **nunca** se muestran en este modo — son datos avanzados, solo están en "Más opciones".

"Más opciones" abre el mismo formulario completo de siempre (`compact` en `false`), sin resetear nada ya cargado — mismo objeto de estado (`newTurnoForm`), nada se vuelve a pedir. El footer de la card compacta tiene únicamente `Más opciones` (acción secundaria "de texto", sin fondo pesado) y `Guardar turno` — **no** tiene `Cancelar`: la `X` del header ya cierra la card. `Cancelar` vuelve a aparecer solo en el formulario completo. "No se repite" (el caso normal) sigue siendo tan rápido como antes — no exige tocar Repetición ni Cantidad de sesiones.

### Indicador visual

Un turno de una serie muestra un ícono chico de recurrencia en la esquina superior derecha de la card del calendario diario (tooltip "Sesión X de Y") y, en "Datos del turno", una línea discreta "Turno recurrente — Sesión X de Y" (`X`/`Y` = `ordenEnSerie`/`cantidadSesiones`, nunca el `numeroSesion` clínico). El ícono está **posicionado absoluto, deliberadamente fuera del flujo de texto** — nunca inline junto al nombre del paciente: un nombre largo lo empujaba a una segunda línea dentro del mismo bloque de texto que el nombre, y esa línea extra desplazaba el horario (`HH:MM - HH:MM`) fuera del área visible de la card (bug real de la ronda anterior, corregido esta ronda — ver HANDOVER.md). El nombre del paciente y el horario siempre se renderean en su propia línea, con o sin recurrencia; el ícono es metadata secundaria, nunca reemplaza esa información.

### Qué no se implementó (limitaciones intencionales)

- **Múltiples días por semana** (ej. "lunes y jueves"): el selector de Repetición no lo ofrece — el modelo (`SerieTurno.patron`/`frecuenciaSemanas`) puede evolucionar para soportarlo más adelante, pero agregarlo ahora era desproporcionado para esta ronda.
- **Reasignar el paciente** en un "editar este turno y los siguientes": el paciente de toda una serie/sub-serie se asume constante en esta implementación — no está en el whitelist de campos editables de `PATCH /api/turnos/:id/serie`.
- **Cambiar el patrón de recurrencia o la cantidad restante** desde una edición "este turno y los siguientes": esa operación cambia solo hora/duración/profesional/especialidad/diagnóstico/monto/sesión de consulta de las ocurrencias ya generadas, nunca regenera fechas nuevas ni agrega/quita ocurrencias, ni cambia semanal↔mensual de una serie ya creada.
- Migrar toda la edición de turnos al patrón de card compacta: se mantuvo el editor completo existente (`TurnoFormFields` sin `compact`) para editar, con el diálogo de alcance de serie delante — migrar edición completa a la card compacta hubiera excedido el alcance de esta ronda (permitido explícitamente, ver criterio de la ronda).

---

## Entidades relacionadas

El módulo de Turnos se relaciona principalmente con:

- `Turno`
- `SerieTurno`
- `Paciente`
- `Profesional`
- `Especialidad`
- `ObraSocial`
- `Consultorio`
- `Evolucion`

---

## Estados del turno

Los estados actuales del turno son:

- `ASIGNADO`
- `EN_ESPERA`
- `ATENDIENDO`
- `FINALIZADO`
- `AUSENTE`
- `CANCELADO`

### ASIGNADO

Estado inicial del turno.

Significa que el paciente tiene una cita reservada y asignada a un profesional específico.

El paciente todavía no hizo check-in ni se encuentra esperando en el consultorio.

### EN_ESPERA

Significa que el paciente ya llegó al consultorio e hizo check-in.

El paciente está esperando a ser atendido por el profesional.

Este estado debe tener alta visibilidad en la interfaz, especialmente para el profesional.

Es importante mostrar claramente cuánto tiempo lleva esperando el paciente, en minutos.

Actualmente los turnos en espera se ordenan por prioridad usando el mayor tiempo de espera primero, pero falta mostrar un timer visible en la UI.

### ATENDIENDO

Significa que el paciente está siendo atendido por el profesional en ese momento.

Al pasar a este estado, debería iniciarse un timer de atención.

Durante este estado, el profesional debería tener una vista simple y clara de la sesión en curso, con acceso a:

- Datos básicos del paciente.
- Historia clínica.
- Ficha inicial.
- Evoluciones anteriores.
- Tratamientos.
- Documentos relacionados.
- Información relevante para la atención.

Esta parte del flujo todavía no está completamente desarrollada.

### FINALIZADO

Significa que la atención terminó.

Al finalizar el turno, debería cerrarse el timer de atención y registrarse la duración real de la sesión.

El sistema debería permitir comparar el tiempo real de atención con la duración reservada para ayudar al profesional a no pasarse del tiempo previsto.

### AUSENTE

Significa que el paciente no se presentó al turno.

Un turno ausente cuenta como sesión consumida, porque el paciente tenía el turno reservado y no asistió.

Este estado no libera automáticamente la responsabilidad del paciente respecto al turno.

### CANCELADO

Significa que el turno fue cancelado.

Un turno cancelado libera el horario.

Debe diferenciarse claramente de un turno ausente.

---

## Reglas de negocio

### Un paciente puede tener más de un turno el mismo día

Aunque no sea lo más común, el sistema debe permitir que un mismo paciente tenga varios turnos en un mismo día.

No debe bloquearse esta posibilidad de forma rígida.

### Un profesional puede tener turnos superpuestos

El sistema debe ser flexible y permitir turnos superpuestos para un mismo profesional.

No debe impedir la carga de turnos superpuestos.

En caso de detectar superposición, puede mostrarse una advertencia visual, pero no debería bloquearse la acción.

**Actualización (layout visual de superposiciones)**: el calendario diario (`App.tsx`) ya no dibuja los turnos superpuestos completamente encimados. `frontend/src/utils/turnoLayout.ts` expone `layoutTurnos`, una utilidad pura que agrupa turnos por colisión (intervalos semiabiertos `[inicio, fin)`) y asigna cada uno a una columna mediante coloreo de intervalos greedy, reutilizando columnas que quedan libres; los turnos de un mismo grupo comparten el ancho disponible en partes iguales según la concurrencia máxima del grupo. No replica visualmente Google Calendar (no hace "ensanchado" dinámico de columnas liberadas) — es la distribución mínima que garantiza que ningún turno tape completamente a otro. Cubierto por `frontend/src/utils/turnoLayout.test.ts`.

**Actualización (gap visual entre turnos contiguos)**: cuando un turno termina justo cuando empieza el siguiente, los bloques quedaban pegados verticalmente. `App.tsx` renderiza la altura del bloque como `Math.max(duracionMinutos - 3, 12)` px en vez de `duracionMinutos` px — resta 3px de separación visual sin tocar `top` (la hora real no cambia) y sin bajar de un piso de 12px, para no comerse turnos de 15 minutos. La detección de superposición y las columnas de `layoutTurnos` no se tocaron.

**Actualización (zona horaria del consultorio)**: la fecha/hora de un turno se interpreta y se muestra en la zona horaria del consultorio (`Consultorio.zonaHoraria`), nunca en la del navegador de quien está usando la app. `frontend/src/utils/timezone.ts` expone `zonedTimeToUtcIso`/`utcIsoToZonedParts` (truco estándar sin librería de timezones: se compara la hora de pared reconstruida vía `Intl.DateTimeFormat` con la zona objetivo contra la fecha ingenua tratada como UTC, y se corrige por la diferencia). `frontend/src/services/api.ts` (`toInicio`, usado por `createTurno`/`patchTurno`) y las funciones que mapean turnos de la API a la UI (`App.tsx` `mapApiTurnoToUi`, `TurnosPage.tsx` `mapApiTurno`) usan ambas funciones de forma simétrica — se guarda y se muestra con el mismo criterio, así que editar un turno ya guardado sigue mostrando la hora que se eligió originalmente. `App.tsx` carga la zona horaria del consultorio una vez al iniciar sesión (`api.getConsultorio()` → `api.setConsultorioTimeZone`), antes de eso se usa el default `America/Argentina/Buenos_Aires`. No se tocó `normalizeDateBoundary` (los filtros `from`/`to` de la tabla de Turnos siguen en hora local del navegador — solo afecta el límite de un filtro, no la hora mostrada de un turno).

**Actualización (implementado) — bug corregido: mini calendario de Home usaba la zona horaria del navegador**: el mini calendario mensual (`App.tsx`, sección Inicio) calculaba "hoy" (para resaltar el día actual) comparando `day`/mes/año contra getters locales crudos (`new Date().getDate()`, `.getMonth()`, `.getFullYear()`) — de noche, con el navegador en una zona horaria distinta a la del consultorio (o directamente en UTC), podía marcar "hoy" un día equivocado (ej. domingo a la noche en Argentina ya mostraba lunes). Nuevo helper `todayInTimeZone(timeZone)` en `frontend/src/utils/timezone.ts` (envuelve `utcIsoToZonedParts(new Date().toISOString(), timeZone).date`) — el mini calendario ahora compara el string `YYYY-MM-DD` de cada celda contra `todayInTimeZone(api.getConsultorioTimeZone())`. `selectedDate` (qué día se ve por defecto en Inicio) tenía el mismo problema en su valor inicial y se corrigió igual. Sin cambios en cómo se persisten los turnos (siguen en UTC) ni en `getMonthDays`/`formatDate` (arman la GRILLA del mes navegado, no dependen de "ahora" — no tenían el bug).

### Duración del turno

La duración del turno debe ser configurable.

En el futuro, esta configuración debería estar disponible desde la pestaña Configuración.

Inicialmente, la duración default puede estar definida a nivel consultorio.

No se debe asumir que todos los turnos duran lo mismo de manera fija.

### Número de sesión

El número de sesión debería calcularse automáticamente en base al historial del paciente.

Sin embargo, no debe ser restrictivo.

El usuario debe poder modificar manualmente el número de sesión en caso de ser necesario.

**Actualización (implementado) — "Sesión X de Y" ligada a un Diagnóstico**: `GrupoEvolucion` ("Diagnóstico", ver `docs/modules/clinical-history.md`) ganó un campo opcional `cantidadSesionesPlanificadas` — un Diagnóstico sin este campo se comporta exactamente igual que antes (agrupación puramente visual). `Turno` ganó `grupoId` (FK opcional a `GrupoEvolucion`, `onDelete: SetNull`): al elegir un Diagnóstico con sesiones planificadas en el formulario de Turno, el campo "Nro. de sesión" pasa a mostrarse como "Sesión (de Y)" y se autocompleta con el próximo número real (`GET /api/grupos-evolucion/:id/proxima-sesion`) — pero **sigue siendo un input editable normal**, nunca de solo lectura; corregirlo a mano es tan válido como el valor sugerido. El cálculo automático (mismo criterio en el backend como default en `POST`/`PATCH /api/turnos` si el cliente no manda `numeroSesion` explícito) es `count(turnos FINALIZADO del mismo paciente+diagnóstico) + 1` — **nunca** `count(Evolucion)+1`, que se desincroniza fácil (una evolución puede cargarse sin turno asociado, o un turno puede terminar con más de una evolución). Un `numeroSesion` explícito enviado por el cliente nunca se pisa con el cálculo automático. Solo se ofrece el selector de Diagnóstico a roles con acceso clínico (`ADMINISTRADOR`/`PROFESIONAL`, mismo criterio que Evoluciones/Ficha Inicial) — `RECEPCION`/`SUPERVISOR` siguen viendo el campo "Nro. de sesión" manual de siempre, sin Diagnóstico (dato clínico). Ver "Diagnóstico con sesiones planificadas" en `docs/modules/clinical-history.md` para el detalle del modelo y los estados que cuentan.

### Obra social

La obra social debe copiarse desde el paciente.

La obra social es un dato propio del paciente, no del turno.

Por ahora no se contempla cambiar la obra social en un turno puntual.

### Cancelación

Cuando un turno se cancela, el horario queda disponible.

### Ausente

Cuando un turno se marca como ausente, cuenta como sesión consumida.

Esto se diferencia de una cancelación o reprogramación.

**Aclaración (no ambigua a partir de esta implementación)**: "sesión consumida" acá es un concepto administrativo/de cobertura (el horario se usó, más allá de si hubo atención) — es un concepto distinto de "Sesión X de Y" (arriba), que es progreso real del tratamiento. `AUSENTE` **no** incrementa "Sesión X de Y" (solo `FINALIZADO` cuenta ahí), mismo criterio que ya usa `estadisticasService.ts` para `sesionesRealizadas`/ausentismo — ver `docs/modules/statistics.md`. `CANCELADO` tampoco cuenta en ninguno de los dos sentidos.

### Diagnóstico + numeración automática de sesiones

**Actualización (implementado) — bug real corregido: el número no se sugería salvo que el diagnóstico tuviera `cantidadSesionesPlanificadas`**: el backend (`sesionAutomaticaParaGrupo()`) siempre calculó bien el número automático para cualquier diagnóstico con `grupoId` — ese cálculo nunca dependió de `cantidadSesionesPlanificadas`. El bug real estaba en el frontend: `TurnoFormFields` (`FormFields.tsx`) solo pedía/pisaba el número sugerido (`onFetchProximaSesion`) cuando el diagnóstico elegido tenía `cantidadSesionesPlanificadas` configurada — para cualquier otro diagnóstico, el campo "Nro. de sesión" se quedaba en su default (`1`) y ese `1` se mandaba como un valor **explícito** en el `POST`, lo que en el backend gana sobre el cálculo automático (`numeroSesion` explícito del cliente siempre pisa el default) — cada turno nuevo de ese diagnóstico quedaba en "Sesión 1" para siempre. Corregido: el auto-fetch ahora se dispara para cualquier diagnóstico elegido, tenga o no `cantidadSesionesPlanificadas` — ese campo sigue controlando únicamente si la UI muestra "Sesión (de Y)" o "Nro. de sesión" a secas, nunca si el número se sugiere o no.

**Actualización (implementado) — "Sesión de consulta"**: nuevo checkbox en Crear/Editar Turno. Un turno marcado así (`Turno.esSesionConsulta`, migración `20260821100057_turno_es_sesion_consulta`) nunca tiene `numeroSesion` — el backend lo fuerza a `null` sin importar lo que mande el cliente — y queda excluido del conteo que usan las demás sesiones del mismo paciente+diagnóstico (`sesionAutomaticaParaGrupo()` ahora filtra `esSesionConsulta: false`). En la UI, tildarlo oculta el campo "Nro. de sesión"; destildarlo (con un diagnóstico ya elegido) vuelve a sugerir el próximo número automáticamente, igual que al elegir el diagnóstico. Nunca se infiere de `numeroSesion === null` — es un campo explícito, porque `numeroSesion` también puede ser `null` por otros motivos (turno sin diagnóstico).

---

## Flujo principal del turno

El flujo ideal de un turno es:

1. El paciente reserva o se le asigna un turno.
2. El turno queda en estado `ASIGNADO`.
3. El paciente llega al consultorio.
4. Recepción o un usuario autorizado marca el check-in.
5. El turno pasa a `EN_ESPERA`.
6. El sistema empieza a contar el tiempo de espera.
7. El profesional inicia la atención.
8. El turno pasa a `ATENDIENDO`.
9. El sistema inicia el timer de atención.
10. Durante la atención, el profesional puede consultar la información clínica del paciente.
11. El profesional finaliza la atención.
12. El turno pasa a `FINALIZADO`.
13. El sistema registra la duración real de la sesión.

Flujos alternativos:

- Si el paciente no se presenta, el turno pasa a `AUSENTE`.
- Si el turno se cancela antes de la atención, pasa a `CANCELADO`.
- Si se reprograma, debería modificarse la fecha y hora del turno o crearse un nuevo turno, según se defina más adelante.

---

## Vista de turnos en espera

La vista de turnos debe ayudar al profesional a identificar rápidamente qué pacientes están esperando y desde hace cuánto tiempo.

Requisitos:

- Mostrar pacientes en estado `EN_ESPERA`.
- Mostrar tiempo de espera en minutos.
- Ordenar por mayor tiempo de espera primero.
- Destacar visualmente los pacientes con espera prolongada.
- Permitir iniciar atención de forma simple.

Este flujo es importante porque Kineq busca simplificar el trabajo diario del kinesiólogo y reducir fricción operativa.

---

## Turno en proceso

La funcionalidad de “turno en proceso” todavía no está completamente desarrollada.

Durante un turno en estado `ATENDIENDO`, el profesional debería acceder a una vista clara y moderna de atención.

Esta vista debería incluir:

- Timer de atención actual.
- Duración reservada para la sesión.
- Datos básicos del paciente.
- Historia clínica.
- Ficha inicial.
- Evoluciones previas.
- Posibilidad de cargar una nueva evolución.
- Tratamientos.
- Documentos relacionados.
- Información administrativa relevante.

La experiencia debe ser simple, intuitiva y moderna.

Kineq debe diferenciarse de sistemas clínicos antiguos, sobrecargados o visualmente complejos.

---

## Alta del paciente

El flujo de alta del paciente todavía no está definido.

Debe investigarse y diseñarse más adelante.

Posibles elementos a considerar:

- Motivo de alta.
- Fecha de alta.
- Profesional responsable.
- Estado final del tratamiento.
- Observaciones.
- Evolución final.
- Indicaciones posteriores.
- Documentos o informes asociados.

No implementar todavía sin una definición funcional más clara.

---

## Roles y permisos relacionados

Todavía falta definir formalmente el sistema de usuarios y roles.

Como criterio inicial:

### Administrador

Puede crear, modificar, cancelar y gestionar todos los turnos del consultorio.

### Recepción

Puede crear, modificar, cancelar, reprogramar y hacer check-in de turnos.

### Profesional

Puede ver turnos del consultorio, pero principalmente debe operar sobre sus propios turnos.

Un profesional debería poder:

- Ver sus turnos.
- Iniciar atención de sus turnos.
- Finalizar atención.
- Cargar evolución.
- Consultar datos clínicos del paciente.

En principio, un profesional no debería modificar turnos de otros profesionales.

### Supervisor

Puede visualizar la operación general y consultar reportes, pero sus permisos operativos deben definirse más adelante.

---

## Portal de reserva para pacientes

En el futuro, Kineq debería permitir que los pacientes reserven turnos desde una página pública o portal de pacientes.

Cada consultorio debería tener un link único para compartir.

Desde ese link, el paciente podría:

- Ver disponibilidad del consultorio.
- Elegir profesional, si corresponde.
- Elegir fecha y horario.
- Reservar un turno.
- Completar datos básicos.

La reserva realizada desde el portal debe impactar directamente en la agenda interna del consultorio correspondiente.

Es fundamental que un paciente o consultorio no pueda acceder a información de otro consultorio.

---

## Multi-consultorio y privacidad

Kineq será usado por múltiples consultorios, centros o instituciones.

Por lo tanto, toda la información de turnos debe estar aislada por consultorio.

Un consultorio nunca debe poder ver, modificar o acceder a turnos, pacientes, profesionales, historias clínicas o configuraciones de otro consultorio.

Este es un requerimiento fundamental del sistema.

Cualquier endpoint, consulta de base de datos o pantalla que trabaje con turnos debe respetar el `consultorioId` o la unidad organizativa equivalente.

---

## Configuración futura

La pestaña Configuración todavía no está desarrollada, pero debería permitir configurar aspectos relacionados con turnos, como:

- Duración default de turnos.
- Zona horaria del consultorio.
- Profesionales disponibles.
- Especialidades.
- Colores de especialidades.
- Obras sociales.
- Reglas de agenda.
- Link público de reserva.
- Plantillas o valores por defecto.

No hardcodear estas reglas si deberían ser configurables más adelante.

---

## Consideraciones de UI

La interfaz debe priorizar:

- Claridad.
- Rapidez de uso.
- Diseño moderno.
- Pocos pasos.
- Buena visibilidad de estados.
- Acciones rápidas para recepción y profesionales.
- Evitar pantallas sobrecargadas.
- Evitar patrones visuales antiguos típicos de sistemas clínicos tradicionales.

Kineq debe sentirse como una herramienta moderna, simple e impulsada por tecnología actual.

La alta rápida desde Home ahora usa una card compacta (ver "Turnos recurrentes (series)" más arriba). La UI de edición completa (y la de creación vía "Más opciones") sigue siendo el formulario largo de siempre — no se rediseñó visualmente en esta ronda.

---

## Pendientes / mejoras futuras

Pendientes importantes:

- Mejorar UI de edición de turno (la creación rápida desde Home ya tiene card compacta, ver arriba).
- Repetición con múltiples días por semana (ej. lunes y jueves) — ver "Qué no se implementó" en Turnos recurrentes.
- Mostrar timer visible para pacientes en espera.
- Desarrollar flujo de atención en curso.
- Crear vista de sesión activa.
- Permitir carga de evolución desde la sesión.
- Mostrar duración reservada vs duración real.
- Definir flujo de alta del paciente.
- Definir reglas de reprogramación.
- Definir permisos finales por rol.
- Definir reserva online para pacientes.
- Definir configuración de duración default.
- Definir comportamiento multi-sede.
- Definir integración futura con IA.

---

## No implementar todavía

No implementar todavía sin definición explícita:

- Login de pacientes.
- Portal público de turnos.
- Sistema avanzado de permisos.
- Alta clínica del paciente.
- Facturación.
- Autorizaciones de obra social.
- Multi-sede avanzado.
- Agente de IA operativo sobre turnos.
- MCP/API pública.

Estos elementos forman parte de la visión futura, pero no deben mezclarse con tareas inmediatas sin una definición previa.

---

## Notas para agentes IA

Antes de modificar el módulo de turnos, revisar:

- `backend/prisma/schema.prisma`
- Endpoints actuales de turnos en backend.
- Componentes actuales de calendario y listado en frontend.
- Documentación de pacientes.
- Documentación de profesionales.
- Documentación de historia clínica.

Reglas importantes:

- No bloquear turnos superpuestos.
- No bloquear múltiples turnos del mismo paciente en el mismo día.
- Mantener aislamiento por consultorio.
- No asumir que todos los turnos duran lo mismo.
- No asumir que todos los usuarios pueden modificar todos los turnos.
- No convertir obra social en un dato propio del turno si ya viene del paciente.
- No agregar lógica compleja de historia clínica dentro del módulo de turnos sin revisar `clinical-history.md`.
- Priorizar una experiencia de usuario simple, moderna y clara.

El objetivo del módulo no es solo administrar una agenda, sino facilitar el flujo completo de atención diaria del kinesiólogo.
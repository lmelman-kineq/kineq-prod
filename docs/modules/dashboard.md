# Módulo: Dashboard / Inicio

## Objetivo del módulo

El módulo de Dashboard, o pantalla de Inicio, funciona como la vista operativa principal del día.

Su objetivo es permitir que el usuario identifique rápidamente qué está pasando en el consultorio: qué turnos hay hoy, qué pacientes están esperando, quién está siendo atendido, qué turnos vienen después y cómo acceder rápidamente a las acciones principales.

En Kineq, el Dashboard no debe sentirse como un panel pesado de métricas. Debe ser una pantalla clara, moderna y práctica para la operación diaria del consultorio.

---

## Estado actual

Actualmente el sistema ya cuenta con una pantalla de Inicio desarrollada inicialmente.

La pantalla actual incluye:

- Vista de turnos del día.
- Calendario diario.
- Calendario mensual lateral.
- Datos del turno seleccionado.
- Acceso a agregar turno.
- Visualización general de agenda.

La pantalla sirve como una vista rápida para identificar turnos y operar sobre la agenda diaria.

Todavía no se busca que esta pantalla sea un dashboard estadístico avanzado.

Las métricas y reportes se contemplan más adelante para una sección separada de Estadísticas.

---

## Entidades relacionadas

El módulo de Dashboard se relaciona principalmente con:

- `Turno`
- `Paciente`
- `Profesional`
- `Especialidad`
- `ObraSocial`
- `Consultorio`
- `Evolucion`

---

## Rol de la pantalla de Inicio

La pantalla de Inicio debe funcionar como una vista operativa diaria.

Debe responder rápidamente preguntas como:

- Qué turnos hay hoy.
- Qué paciente viene ahora.
- Qué pacientes están en espera.
- Qué pacientes están siendo atendidos.
- Qué turnos están finalizados.
- Qué turnos fueron cancelados.
- Qué turnos quedaron como ausentes.
- Qué profesional tiene cada turno.
- Qué especialidad corresponde a cada turno.
- Cómo agregar un nuevo turno rápidamente.

---

## Carga inicial y splash "Preparando Kineq"

**Actualización (implementado)**: `App()` (`frontend/src/App.tsx`) montaba `Dashboard` recién cuando el splash (`BootScreen`, duración mínima 1900ms + 400ms de fade, `useBootPhase.ts`) terminaba — un `if (bootPhase !== 'hidden') return <BootScreen/>` con `return` temprano, así que ningún efecto de `Dashboard` (catálogos de pacientes/profesionales/especialidades/obras sociales/consultorio, turnos del día) corría hasta que el splash desaparecía del todo. Eso producía el patrón "Preparando Kineq → recién ahí Cargando turnos...".

Ahora, con sesión ya resuelta (`user` no nulo), `Dashboard` se monta de una — sus fetches iniciales arrancan en paralelo con el splash — y `BootScreen` se renderiza **encima**, como overlay (`position: fixed; z-index: 9999`, sin cambios de CSS/diseño/duración): mientras el splash sigue visible, `Dashboard` ya está cargando debajo. En la práctica, para cuando el splash termina los datos ya suelen estar listos y no aparece un segundo loading. Sin sesión (`!user`), el comportamiento no cambió: el splash sigue tapando la restauración de sesión y da paso a Login/Registro, porque ahí no hay nada útil que precargar todavía. El splash nunca queda bloqueado esperando estos fetches — su duración depende únicamente de `useBootPhase` (restauración de sesión + mínimo visual), independiente de si los datos de `Dashboard` ya llegaron o fallaron; un fetch fallido lo maneja `Dashboard` con su propio `loadError`/reintentar, ya existente.

**Skeletons discretos** (`frontend/src/components/Skeleton.tsx`, `SkeletonTableRows`/`SkeletonCards`) reemplazan los textos grandes "Cargando turnos..."/"Cargando pacientes..."/"Cargando estadísticas..." en `TurnosPage.tsx`, `PatientsPage.tsx` y `EstadisticasPage.tsx` — mismas dimensiones que el contenido real (filas de tabla / cards de KPI) para no generar salto de layout. Solo se muestran en la **primera** carga (sin datos previos todavía); en Estadísticas, cambiar filtros/período ya no vacía la pantalla durante el refetch — el resultado anterior se sigue mostrando con una nota chica "Actualizando estadísticas…" en vez de un loading que tapa todo (`resumen` nunca se resetea a `null` al refetchear, solo se reemplazaba visualmente por el branch de `loading`; ahora ese branch respeta si ya hay datos).

**Placeholder de datos al navegar** (`frontend/src/utils/dataCache.ts`): un cache en memoria mínimo, sin librería nueva — `TurnosPage`/`PatientsPage` siembran su estado inicial con el último resultado exitoso (si existe) para no mostrar el skeleton al volver a una pantalla ya visitada (Inicio → Turnos → Pacientes → Inicio), pero **siempre** vuelven a pedir datos frescos al montar y sobrescriben la cache con la respuesta real — nunca se confía en el valor cacheado como definitivo, así que no hay ventana real de datos desactualizados más allá de lo que tarda ese fetch. La cache se limpia en `logout()` (`AuthContext.tsx`) para que, si otro usuario de otro consultorio inicia sesión en la misma pestaña, no vea ni por un instante datos del consultorio anterior.

## Dashboard operativo vs estadísticas

El Dashboard de Inicio no debe confundirse con la futura sección de Estadísticas.

### Dashboard / Inicio

Debe enfocarse en la operación diaria.

Ejemplos:

- Turnos de hoy.
- Estado actual de la sala.
- Pacientes en espera.
- Turnos en atención.
- Próximos turnos.
- Acciones rápidas.

### Estadísticas

Debe enfocarse en métricas, análisis y reportes.

**Estado**: implementado (V1) como página independiente — ver `docs/modules/statistics.md` para KPIs, fórmulas, gráficos, permisos y limitaciones. Cubre: cantidad de turnos por período, ausentismo, cancelaciones, sesiones finalizadas, sesiones por profesional, actividad por especialidad y evolución mensual/semanal/diaria del volumen de turnos. "Ocupación por profesional" (turnos / horas disponibles) sigue sin implementar — no hay todavía una fuente confiable de disponibilidad horaria en el schema.

Decisión inicial (se mantuvo):

- Inicio sigue siendo la vista operativa, sin métricas agregadas.
- Reportes y métricas viven en la sección Estadísticas.

---

## Información principal a mostrar

La pantalla de Inicio debería mostrar principalmente información relacionada con los turnos del día.

Datos útiles:

- Hora del turno.
- Paciente.
- Profesional.
- Especialidad.
- Estado del turno.
- Obra social, si resulta útil.
- Duración.
- Número de sesión.
- Notas breves, si existieran.
- Tiempo de espera, cuando el turno esté en estado `EN_ESPERA`.
- Tiempo de atención, cuando el turno esté en estado `ATENDIENDO`.

---

## Estados visibles

Los estados del turno deben ser muy visibles en la pantalla de Inicio.

Estados actuales:

- `ASIGNADO`
- `EN_ESPERA`
- `ATENDIENDO`
- `FINALIZADO`
- `AUSENTE`
- `CANCELADO`

La UI debe permitir identificar rápidamente qué está pasando con cada turno.

Especialmente importantes:

- Pacientes en espera.
- Pacientes siendo atendidos.
- Turnos próximos.
- Turnos atrasados.
- Turnos ausentes o cancelados.

---

## Pacientes en espera

Los pacientes en estado `EN_ESPERA` deben tener alta prioridad visual.

El sistema debe mostrar claramente cuánto tiempo llevan esperando.

Requisitos:

- Mostrar tiempo de espera en minutos.
- Actualizar el tiempo de espera de forma clara.
- Ordenar o destacar pacientes con mayor tiempo de espera.
- Permitir iniciar atención fácilmente.
- Evitar que el profesional tenga que buscar manualmente quién está esperando.

Esto es importante porque Kineq busca simplificar el flujo real del consultorio.

---

## Turnos en atención

Los turnos en estado `ATENDIENDO` deben mostrar que hay una sesión en curso.

Idealmente deberían mostrar:

- Paciente.
- Profesional.
- Hora de inicio de atención.
- Tiempo transcurrido de atención.
- Duración reservada del turno.
- Acción rápida para continuar o finalizar atención.

El profesional debería poder ver cuánto tiempo lleva atendiendo y cuánto tiempo estaba reservado para esa sesión.

**Semántica del contador "Atendiendo" (`TurnosPage.tsx`)**: cuenta **todos** los turnos en estado `ATENDIENDO` del consultorio, sin filtrar por fecha ni por profesional — a diferencia de "En espera" y "Turnos restantes", que sí se limitan al día actual. La intención es que una atención abierta nunca quede "invisible" solo porque el turno quedó abierto de un día anterior (por ejemplo, si nadie lo cerró). El sistema **no cierra ni corrige automáticamente** turnos viejos que hayan quedado en `ATENDIENDO`; si aparece un timer muy grande, es una señal de que ese turno específico debería cerrarse manualmente — no se implementó limpieza automática a propósito.

**Actualización (texto revertido)**: el texto se probó como "Atenciones actualmente abiertas" / "Pacientes en sesión, de cualquier día" en una iteración y se revirtió al texto corto original — título **"Atendiendo"**, leyenda **"Pacientes en sesión"**. El cálculo (global, sin filtro de fecha, descripto arriba) no cambió, solo el copy.

Esto ayuda a mantener el ritmo de atención y evitar retrasos.

---

## Turno seleccionado

Actualmente la pantalla de Inicio muestra datos del turno seleccionado.

Esta sección debe servir para consultar rápidamente información del turno sin abrir una pantalla completa.

Podría incluir:

- Paciente.
- Profesional.
- Especialidad.
- Fecha y hora.
- Estado.
- Obra social.
- Teléfono del paciente.
- Número de sesión.
- Notas.
- Acciones rápidas.

Acciones posibles:

- Editar turno.
- Cancelar turno.
- Marcar como en espera.
- Iniciar atención.
- Finalizar atención.
- Marcar ausente.
- Ver paciente.
- Ver historia clínica.
- Cargar evolución.

No todas estas acciones tienen que estar disponibles desde el MVP.

---

## Acciones rápidas

La pantalla de Inicio debe facilitar acciones frecuentes.

Acciones principales:

- Agregar turno.
- Editar turno.
- Marcar llegada / check-in.
- Iniciar atención.
- Finalizar atención.
- Marcar ausente.
- Cancelar turno.
- Ver paciente.
- Acceder a historia clínica.

**Actualización (implementado) — "Ver Historia Clínica"**: el menú contextual (click derecho sobre un bloque de turno) ahora siempre tiene, al final, "Ver Historia Clínica" — navega a la pantalla única de Paciente (`openPatientDetail`, mismo helper que el resto de la app) del paciente de ese turno. Es exclusivo de Inicio: `getTurnoQuickActions()` (la función que arma las acciones de estado, compartida con la tabla de Turnos y el modal "Editar turno" — ver `docs/modules/appointments.md`) no se tocó; el ítem se agrega directamente en el render del menú de `App.tsx`. Antes, si no había ninguna acción de estado disponible para el rol/turno (ej. `SUPERVISOR`), el menú ni se abría — ahora siempre se abre porque siempre hay al menos este ítem.

El objetivo es reducir la cantidad de clicks necesarios para operar el día.

---

## Crear y modificar turno desde Inicio

Actualmente existen flujos de agregar y modificar turno, pero la UI se percibe básica y puede mejorarse.

Mejoras deseadas:

- Diseño más moderno.
- Formularios más claros.
- Mejor jerarquía visual.
- Menos sensación de modal genérico.
- Selección más simple de paciente, profesional, especialidad y horario.
- Mejor manejo de estado.
- Mejor uso de espacio.
- Mejor coherencia con el resto del sistema.

La creación y edición de turnos debe ser rápida, porque es una acción frecuente.

---

## Calendario diario

El calendario diario debe permitir ver la agenda del día de forma clara.

Debe mostrar:

- Horarios.
- Bloques de turno.
- Estado de cada turno.
- Colores por especialidad.
- Profesional asignado.
- Paciente.
- Superposición si existiera.

Como Kineq debe permitir turnos superpuestos, la UI debe soportar visualmente superposiciones sin bloquearlas.

Si hay superposición, puede mostrarse una advertencia visual, pero no impedir la carga.

**Actualización**: implementado. Los turnos superpuestos se distribuyen en columnas (`frontend/src/utils/turnoLayout.ts`, ver detalle en `docs/modules/appointments.md`) en vez de dibujarse unos encima de otros. El indicador circular de estado de cada bloque (`.turno-card-status-dot`) tiene más padding respecto del borde (`top`/`right: 10px`, antes `8px`) y una variante más compacta para turnos angostos (`.turno-card--narrow`) o cortos (`.short-turno`), para que nunca quede cortado ni pise el texto.

**Actualización (implementado) — Turnos recurrentes**: un bloque de turno perteneciente a una serie (`Turno.serieId`) suma un ícono chico de recurrencia junto al indicador de estado, en la esquina superior derecha del bloque — nunca reemplaza el nombre del paciente ni el horario (`HH:MM - HH:MM`), que siempre se muestran igual sea el turno recurrente o no (ver "Turnos recurrentes (series)" en `docs/modules/appointments.md` para el detalle completo, incluido un bug real donde el ícono desplazaba el horario fuera del bloque, ya corregido). "Nuevo turno" y el click en un horario vacío abren una card flotante compacta (no el formulario completo) con soporte de recurrencia semanal, mensual y personalizada (intervalo + unidad + uno o más días de la semana, ver "Recurrencia 'Personalizado...'" en `docs/modules/appointments.md`).

---

## Vistas de calendario: Día / Semana / Mes / Año

**Actualización (implementado)**: además de la vista diaria de siempre (`day-grid`, sin ningún cambio de comportamiento — ver más abajo), Inicio ahora tiene un selector de vista (`<select>` nativo, mismo chevron custom que el resto de la app) junto al header del calendario, con `Día`/`Semana`/`Mes`/`Año`. La vista elegida persiste entre sesiones vía `localStorage` (`kineq-calendar-view`, envuelto en try/catch — nunca bloquea la carga si `localStorage` no está disponible).

**Arquitectura — un solo ancla de fecha, cuatro vistas derivadas**: no hay cuatro calendarios independientes. `selectedDate` (el mismo string `YYYY-MM-DD` que ya usaba la vista diaria) sigue siendo el único estado de "qué fecha está activa"; cada vista deriva su propio rango/grilla a partir de ese ancla con utilidades puras en `frontend/src/utils/calendarRange.ts` (`getWeekDates`, `getMonthGridDates`, `getYearMonths`, `navigateDate` — 13 tests en `calendarRange.test.ts`, siempre aritmética de calendario real, nunca sumas de ~7/~30/~365 días). `WeekView`/`MonthView`/`YearView` (`App.tsx`) son componentes de layout separados que comparten navegación, filtros, el componente de card de turno, y el contexto de creación con la vista Día — no hay lógica duplicada de agrupado por fecha ni de manejo de turnos entre las cuatro.

- **Header adaptable**: el título/subtítulo del calendario cambia de formato según la vista (`formatPeriodLabel`) — Día: "viernes 4 de septiembre de 2026"; Semana: "31 ago – 6 sep 2026"; Mes: "Septiembre 2026"; Año: "2026" — mismo locale español que ya usaba la vista diaria.
- **Navegación**: las flechas prev/next (`goToPreviousPeriod`/`goToNextPeriod`) respetan la vista activa vía `navigateDate(selectedDate, calendarView, ±1)` — Día ±1 día, Semana ±7 días, Mes ±1 mes calendario (con clamp de fin de mes), Año ±1 año. El botón "Hoy" (`goToToday`) vuelve al período que contiene la fecha actual **sin** resetear la vista activa (si estás en Mes y tocás "Hoy", seguís en Mes).
- **Sidebar (mini calendario mensual + "Datos del turno")**: no se rediseñó — sigue siendo el mismo componente de siempre. Elegir un día ahí actualiza `selectedDate`: en Semana muestra la semana que contiene ese día, en Mes muestra el mes que lo contiene, en Día lo selecciona directamente. En Año el sidebar queda como está (no oculto, no rediseñado).

### Día (sin cambios de comportamiento)

El bloque `day-grid` existente no se tocó: timeline vertical, turnos como bloques, columnas para superposiciones (`layoutTurnos`), indicador de estado, click en slot vacío → alta rápida, click/click-derecho sobre un turno → detalle/menú contextual, filtros. Se verificó explícitamente que no hay regresión (Playwright: vista por defecto es Día, click derecho abre el menú contextual, click izquierdo abre el detalle, click en un slot vacío abre "Nuevo turno").

### Semana

Grilla de 7 columnas (Lun-Dom) con eje horario vertical — reutiliza el mismo rango operativo de horas que ya usa Día (nunca renderiza 24hs). Cada columna de día muestra header (nombre + fecha corta, resaltado si es "hoy"), y los turnos se posicionan/dimensionan por hora real, reutilizando `layoutTurnos()` (mismo algoritmo de columnas por colisión que Día) para superposiciones dentro de un mismo día. Muestra especialidad (color), paciente, horario (cuando el espacio alcanza) e ícono de recurrencia — igual criterio visual que las cards de Día, sin duplicar el componente. Interacción: click en slot vacío abre alta rápida con esa fecha/hora, click en un turno abre el mismo detalle/menú contextual que Día, navegación prev/next semana y "Hoy". En desktop/tablet, `.week-view` scrollea horizontalmente (`overflow-x: auto`, `min-width: 900px` en la grilla) sin romper el layout general de la página. **En mobile (≤820px) ya no scrollea 7 columnas angostas** — ver "Rediseño mobile-first (Home)" más abajo.

### Mes

Grilla de 7×4-6 semanas (siempre semanas completas, incluye días de meses adyacentes atenuados). Cada celda muestra el número de día y hasta 3 turnos como chips compactos (color de especialidad + horario si entra); si hay más, se muestra "+N más". Click en un día navega directamente a Día con esa fecha — se prefirió esta opción (en vez de un panel de detalle superpuesto) para no sumar una quinta superficie de interacción, tal como pedía la spec. Click en un slot de un día vacío abre alta rápida con esa fecha; como Mes no tiene una hora asociada a la celda, no se inventó un horario arbitrario — la hora la completa el usuario en el formulario, igual que "Más opciones" ya lo permite hoy.

### Año

12 mini-calendarios (Enero-Diciembre), puramente de navegación — sin datos operativos de turnos (sin fetch de turnos para esta vista, per "no bajar datos clínicos innecesarios" cuando no hay nada que mostrar con ellos). Click en un número de día navega a Día de esa fecha; click en el nombre de un mes navega a Mes de ese mes. Los indicadores de turno (punto) eran explícitamente opcionales en la spec y no se implementaron — prioridad 1 (navegación correcta) y 2 (12 meses) sobre esa mejora cosmética. Responsive: 4 columnas en desktop, 2 en tablet (`≤820px`), 1 en mobile (`≤480px`) — verificado sin overflow horizontal en 390px.

### Carga de datos (evitar N+1)

Semana y Mes comparten un estado de carga por rango separado del de Día (`rangeTurnosState`/`rangeTurnosLoading`, `App.tsx`) — un solo `api.getTurnos({ from, to })` por cambio de rango (calculado con `getWeekDates`/`getMonthGridDates`), nunca un fetch por día ni por celda. El endpoint `GET /api/turnos` ya soportaba `from`/`to` (usado por `TurnosPage.tsx`) — no se tocó el backend ni se agregó ningún endpoint nuevo. La vista Día sigue usando su propio estado de carga de siempre (`turnosState`/`turnosLoading`, solo el día visible) — separado a propósito, para que Semana/Mes no puedan introducir ninguna regresión ahí. Año no dispara ningún fetch de turnos (ver arriba).

---

## Rediseño mobile-first (Home)

**Actualización (implementado)**: ronda enfocada exclusivamente en la experiencia mobile del calendario de Inicio, sin tocar desktop (≥821px se comporta exactamente igual que antes — verificado explícitamente, ver "Validación" abajo). Reusa el breakpoint "CELULARES" ya existente (`≤820px`, ver sección 16 de `App.css`) — no se sumó un segundo breakpoint mobile (no existía ningún `768px` para reutilizar, como sugería el pedido).

**Diagnóstico previo** (por qué la UX mobile era pobre, antes de tocar código):
- El eje horario de Día **desaparecía por completo** en mobile: `.hours-column { display: none }` en el breakpoint de 480px — no era "poco visible", estaba literalmente oculto. Se angostó (`44px`) en vez de ocultarse.
- No existía ningún patrón de bottom sheet: `.modal-card` era una card centrada a cualquier ancho (incluso a `calc(100% - 24px)` en 480px, seguía centrada verticalmente).
- El buscador de Paciente/Profesional/Especialidad/Diagnóstico (`.dropdown-input-row input`) tenía `font-size: 15px` con especificidad `(0,2,1)` — por debajo del umbral de 16px que evita el zoom automático de iOS Safari al enfocar un input. No era exclusivo de esta ronda (afectaba también a desktop, sin consecuencia ahí), pero sí crítico para mobile.
- `allowRecurrence` en `TurnoFormFields` (`frontend/src/components/FormFields.tsx`) estaba atado a `compact && allowRecurrence` — el formulario completo (no compacto) nunca tuvo UI de Repetición. Saltar directo al "formulario completo" en mobile (sin el paso intermedio "Más opciones") habría hecho desaparecer la recurrencia sin que nadie lo pidiera — se desacopló el gate de `compact` (ver más abajo).
- `.side-panel` (mini calendario + "Datos del turno") ya era un `<aside>` hermano de `<main>`, reflowing debajo de él desde el breakpoint de 1170px — ocultarlo en mobile fue una regla de CSS, no una reestructuración.
- Tocar un turno ya abría el modal completo "Editar turno" (detalle + acciones rápidas + eliminar) — esa es la superficie que pedía la spec para "tap en turno → bottom sheet"; no hizo falta ningún componente nuevo, solo el tratamiento visual de bottom sheet aplicado a `.modal-overlay`/`.modal-card` (ver abajo).
- `WeekView` (Semana) renderizaba 7 columnas de `minmax(120px,1fr)` con `min-width: 900px` + scroll horizontal — ilegible en ~390px. Estrategia elegida: reusar el mismo timeline de un solo día que ya usa Día, con una franja de 7 días arriba para cambiar de día (en vez de construir una segunda grilla apretada de 7 columnas para mobile).
- No hay ninguna librería de gestos en el stack — se descartó implementar swipe-to-dismiss manual (la spec lo permite explícitamente si resulta frágil): cerrar es vía `X` o tocando el backdrop, que ya existía.

### Home: el calendario como protagonista

`useIsMobile()` (nuevo, `frontend/src/hooks/useIsMobile.ts`) — hook reactivo sobre `matchMedia('(max-width: 820px)')`, mismo breakpoint que ya usa `App.css`. Se usa **solo** donde el comportamiento (no solo el estilo) tiene que cambiar: forzar el formulario completo + Repetición siempre visible al crear un turno, y el modo "un solo día" de `WeekView`. Todo lo demás (ocultar el sidebar, compactar el header, mostrar el FAB) es CSS puro, sin ninguna rama de JS nueva.

- `.side-panel` (mini calendario + "Datos del turno"): oculto en mobile. El detalle de un turno ya se resuelve tocándolo (bottom sheet "Editar turno"), y la navegación de fecha la resuelve el header del calendario + el selector de vista.
- `.main-header`: el breadcrumb "Home / Inicio" se oculta, el título "Turnos del día" se achica, y el botón grande "Nuevo turno" del header se oculta — reemplazado por un FAB.
- **FAB** (`.fab-new-turno`, círculo fijo abajo a la derecha, `env(safe-area-inset-bottom)`): mismo `onClick={() => openNewTurnoModal()}` que el botón de header — un solo handler, dos superficies (oculto uno u otro según el breakpoint, nunca ambos a la vez). `z-index` deliberadamente **por debajo** de `.modal-overlay` (15 contra 20) — quedó clickeable por encima de un bottom sheet abierto en la primera pasada de verificación, corregido antes de reportar.
- Navegación temporal (`.calendar-nav`/`.schedule-header`): título/subtítulo del período se achican, misma información, sin fila extra.

### Bottom sheets: Nuevo turno / Editar turno / Recurrencia personalizada

Un solo tratamiento CSS sobre las clases ya compartidas (`.modal-overlay`/`.modal-card`, y `.confirm-dialog-overlay`/`.custom-recurrence-modal` para la Recurrencia Personalizada) cubre los tres modales — no se creó un componente `BottomSheet` nuevo. En `≤820px`: `.modal-overlay` alinea el contenido al fondo (`align-items: flex-end`), `.modal-card`/`.confirm-dialog`/`.custom-recurrence-modal` pasan a ancho completo con esquinas superiores redondeadas únicamente, `max-height: 92dvh` (mismo criterio `dvh` sin fallback ya usado en otros lados de `App.css`, ej. `.sidebar`), animación de entrada `sheet-slide-up` (deshabilitada automáticamente por la regla global `prefers-reduced-motion: reduce` ya existente, sin lógica nueva) y un drag handle puramente decorativo (`.sheet-drag-handle`, no funcional — no hay swipe-to-dismiss, ver diagnóstico).

**Nuevo turno**: en mobile ya no existe el paso intermedio "card compacta → Más opciones" — `newTurnoIsFull = newTurnoExpanded || isMobile` (`App.tsx`) fuerza el formulario completo desde que se abre. `allowRecurrence` pasa a `isMobile || !newTurnoExpanded` (en vez de solo `!newTurnoExpanded`), así que Repetición sigue disponible aunque el formulario ya esté "expandido" — esto exigió decouplear la UI de Repetición de `compact` en `FormFields.tsx` (antes solo existía en su versión ícono-sin-label): ahora la misma fila de controles se muestra con ícono (compacto, desktop) o con el label visible "Repetición" (mobile, estilo `!compact`), sin duplicar el `<select>`/botón/input de cantidad. El pie del modal ("Más opciones"/"Guardar turno", `.modal-actions--new`) se oculta completo en mobile — un botón "Guardar" nuevo vive en el header (`.modal-header-save-mobile`, mismo handler `saveNewTurno`), sticky junto al ícono y la `X`.

**Editar turno**: mismo tratamiento de sheet. El botón "Guardar" del header (mismo `saveEditedTurno`) solo aparece mientras `isEditingTurno` es verdadero. En el pie, "Cancelar"/"Guardar cambios" (`.modal-actions-cancel-desktop`/`.modal-actions-save-desktop`) se ocultan en mobile por ser redundantes con la `X`/el "Guardar" del header — pero **"Eliminar turno" sigue visible**, es la única acción que no tiene otro lugar.

**Recurrencia personalizada**: mismo tratamiento de sheet aplicado a `.custom-recurrence-modal`, sin mover "Cancelar"/"Listo" del pie al header — de las dos variantes que planteaba la spec (header con acción, o mantener el pie existente), se eligió la segunda por ser la más chica y de menor riesgo (reusa el mismo `.confirm-dialog-actions` sin tocar el componente).

**Zoom de iOS**: `.modal-card input/select/textarea` y `.custom-recurrence-modal input/select` fuerzan `font-size: 16px` en mobile — incluyendo una regla específica `.modal-card .dropdown-input-row input:not([type="checkbox"])` para igualar la especificidad `(0,2,1)` de la regla de 15px que ya existía (ver diagnóstico) sin usar `!important`.

### Vista Semana en mobile: franja de 7 días + un solo día

`WeekView` (`App.tsx`) recibe una prop nueva `isMobile`. En mobile, en vez de las 7 columnas de siempre, se muestra una franja horizontal de 7 chips tocables (`.week-day-strip`, día+fecha, con estados "hoy"/"seleccionado") arriba, y la grilla de abajo renderiza **un solo día** (el de `selectedDate`) reusando exactamente la misma función de columna (`renderDayColumn`, extraída del cuerpo del `.map` original para no duplicarla entre el modo 7-columnas de desktop y el de 1-columna de mobile). Tocar un chip de la franja llama a un `onSelectDate` nuevo (→ `setSelectedDate`), igual que elegir un día en el mini calendario del sidebar. La navegación de semana completa (flechas prev/next del header) sigue moviendo la semana entera, no solo el día.

### Qué se dejó afuera (permitido explícitamente por el pedido)

- **Swipe-to-dismiss real**: no se implementó — el drag handle es decorativo. La spec permitía omitirlo si una implementación manual de gestos resultaba frágil sin agregar una librería nueva; se optó por eso en vez de escribir touch handlers propios de bajo valor frente a `X`/tap-en-backdrop, que ya funcionaban.
- **Auto-scroll a la hora actual/primer turno** al abrir Día: no era obligatorio según la spec y no se tocó `App.tsx` en ese sentido.
- **Wheel time picker custom**: se mantienen los `<select>` de hora/minuto ya existentes (o el date/time nativo según el modo) — la spec no pedía clonar el picker de Google Calendar, solo priorizar usabilidad.
- **Pruebas específicas de WebKit real** (Playwright `webkit`): no estaba instalado en este entorno: la verificación mobile se hizo con Chromium emulando viewport 390×844 (mismo método ya usado en rondas anteriores de este proyecto para verificación responsive) — cubre layout/overflow/zoom-guard vía `font-size` computado, pero no es una prueba de motor WebKit real.

### Validación

`tsc -b --force`, `vitest run` (149/149), `npm run build`, `npm run lint` (mismo único error preexistente de `AuthContext.tsx`) limpios. Sin cambios de backend. Con Playwright, viewport 390×844: sidebar/"Datos del turno" ocultos, FAB visible y con el z-index correcto (detrás de un modal abierto), eje horario visible en Día, 0px de overflow horizontal en Día/Nuevo turno/Semana, tap a un turno abre el bottom sheet de detalle, FAB abre "Nuevo turno" ya en formulario completo (sin "Más opciones", con "Guardar" en el header, con Repetición visible), input de Paciente en `16px` de fuente, Recurrencia Personalizada abre como bottom sheet apilado sobre el de Nuevo turno, Semana mobile muestra 1 columna + franja de 7 días, modo oscuro correcto en Home/sheet/Semana. Regresión de desktop (1400×950) explícita: FAB oculto, sidebar visible, botón "Nuevo turno" del header visible, card compacta + "Más opciones" sin cambios, Repetición sigue desapareciendo del formulario completo tal cual antes de esta ronda (comportamiento preexistente, no una regresión introducida).

---

## Calendario mensual lateral

El calendario mensual lateral permite navegar entre días.

Debe servir para:

- Cambiar rápidamente la fecha seleccionada.
- Identificar el día actual.
- Ver días con turnos, si se implementa más adelante.
- Moverse por la agenda sin salir de Inicio.

No debe ocupar demasiado espacio ni competir con la vista principal del día.

**Actualización (implementado) — bug corregido: "identificar el día actual" usaba la hora del navegador, no la del consultorio**: el resaltado de "hoy" comparaba `day`/mes/año contra `new Date().getDate()`/`.getMonth()`/`.getFullYear()` (getters locales del navegador) — de noche, con el navegador en una zona horaria distinta a la del consultorio, podía resaltar el día equivocado (ej. domingo a la noche en Argentina ya marcaba lunes como "hoy"). Nuevo helper `todayInTimeZone(timeZone)` (`frontend/src/utils/timezone.ts`) da el string `YYYY-MM-DD` de "ahora" en cualquier zona IANA; el mini calendario lo usa con `api.getConsultorioTimeZone()`, mismo criterio de timezone que ya usan los turnos (ver `docs/modules/appointments.md`). `selectedDate` (qué día se ve por defecto al entrar a Inicio) tenía el mismo bug en su valor inicial y se corrigió igual. La grilla del mes navegado (`getMonthDays`) no tenía este problema — arma la estructura de un mes ya elegido, no depende de "ahora".

---

## Filtros

La pantalla de Inicio podría permitir filtros simples.

Filtros posibles:

- Profesional.
- Especialidad.
- Estado.
- Mis turnos.
- Todos los turnos.

La opción “Mis turnos” puede ser especialmente útil para profesionales.

La opción “Todos los turnos” puede ser útil para administración, recepción o coordinación general.

No sobrecargar la pantalla con filtros avanzados en el MVP.

---

## Vista según rol

Cuando exista un sistema real de usuarios y roles, la pantalla de Inicio puede adaptarse según el rol.

### Administrador

Puede ver todos los turnos del consultorio.

Puede operar sobre todos los turnos.

### Recepción

Puede ver y gestionar la agenda general.

Puede crear, editar, cancelar y marcar llegada de pacientes.

### Profesional

Debe tener acceso rápido a sus propios turnos.

Puede iniciar y finalizar atención.

Puede consultar historia clínica y cargar evolución.

Podría tener opción de ver todos los turnos para coordinación general.

### Supervisor

Puede ver la operación general.

Podría tener acceso a información de agenda y reportes, según permisos.

---

## Multi-consultorio y privacidad

La pantalla de Inicio debe mostrar únicamente información del consultorio correspondiente.

Reglas fundamentales:

- No mostrar turnos de otros consultorios.
- No mostrar pacientes de otros consultorios.
- No mostrar profesionales de otros consultorios.
- No mostrar especialidades de otros consultorios.
- No mostrar obras sociales de otros consultorios.
- Toda consulta debe filtrar por `consultorioId` o unidad organizativa equivalente.

El aislamiento entre consultorios es obligatorio.

---

## Multi-sede

Actualmente el sistema no contempla formalmente múltiples sedes.

A futuro, si Kineq soporta varias sedes, la pantalla de Inicio podría permitir:

- Filtrar por sede.
- Ver turnos por sede.
- Ver profesionales por sede.
- Cambiar la vista diaria según sede.
- Mostrar indicadores de ocupación por sede.

No implementar multi-sede todavía sin una definición específica.

---

## Consideraciones de UI

La pantalla de Inicio es una de las pantallas más importantes de Kineq.

Debe transmitir desde el primer uso que el sistema es moderno, simple y cómodo.

Prioridades de diseño:

- Buena lectura visual.
- Estados claros.
- Acciones rápidas.
- Pocos clicks.
- Información importante visible.
- Evitar pantallas sobrecargadas.
- Buen uso de colores.
- Consistencia con modo claro y oscuro.
- Diseño moderno y profesional.
- Sensación de producto renovador, no sistema clínico antiguo.

Kineq debe diferenciarse visualmente de sistemas de consultorio tradicionales que suelen sentirse viejos, pesados o difíciles de usar.

---

## Consideraciones de MVP

Para el MVP, el Dashboard debería mantenerse enfocado.

Funcionalidades mínimas recomendadas:

- Ver turnos del día.
- Cambiar fecha.
- Ver detalle de turno seleccionado.
- Crear turno.
- Editar turno.
- Ver estado de turno.
- Ver profesional y paciente.
- Ver especialidad y color.
- Marcar estados principales del turno.
- Acceder a acciones relevantes.

No agregar métricas complejas todavía.

---

## Pendientes / mejoras futuras

Pendientes importantes:

- Mejorar UI de agregar turno.
- Mejorar UI de modificar turno.
- Mejorar detalle de turno seleccionado.
- Mostrar timer visible de espera.
- Mostrar timer visible de atención.
- Agregar acción rápida de check-in.
- Agregar acción rápida de iniciar atención.
- Agregar acción rápida de finalizar atención.
- Agregar acceso rápido a historia clínica.
- Agregar acceso rápido a cargar evolución.
- Mejorar visualización de turnos superpuestos.
- Agregar toggle “Mis turnos / Todos”.
- Definir comportamiento por rol.
- Definir futura vista multi-sede.
- Definir posible asistencia de IA en Inicio.

---

## No implementar todavía

No implementar todavía sin definición explícita:

- Estadísticas avanzadas en Inicio.
- Reportes gerenciales.
- Multi-sede.
- Vista institucional avanzada.
- IA operativa en Dashboard.
- Automatizaciones complejas.
- Indicadores financieros.
- Facturación.
- Gestión avanzada de sala de espera.
- Alertas avanzadas.
- Integraciones externas.

Estos elementos forman parte de la visión futura, pero no deben mezclarse con tareas inmediatas sin una definición previa.

---

## Notas para agentes IA

Antes de modificar el Dashboard, revisar:

- Componentes actuales de la pantalla de Inicio.
- Componentes actuales de calendario.
- Componentes actuales de turnos.
- `backend/prisma/schema.prisma`
- Endpoints actuales de turnos.
- `docs/modules/appointments.md`
- `docs/modules/patients.md`
- `docs/modules/professionals.md`
- `docs/modules/users-and-roles.md`

Reglas importantes:

- Inicio es una vista operativa diaria, no un dashboard estadístico pesado.
- No sobrecargar la pantalla con métricas todavía.
- Mantener aislamiento por consultorio.
- Mostrar información clara de turnos del día.
- Priorizar pacientes en espera y turnos en atención.
- No bloquear turnos superpuestos.
- Mejorar UI sin romper los flujos existentes.
- Mantener consistencia visual con el resto de Kineq.
- Priorizar simplicidad, velocidad y claridad.

El objetivo del Dashboard es que el consultorio pueda operar el día con fluidez, entendiendo rápidamente qué pacientes hay, quién está esperando, quién está atendiendo y qué acciones deben realizarse.
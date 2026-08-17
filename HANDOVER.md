# HANDOVER

Notas de traspaso entre sesiones de trabajo sobre Kineq. Complementa (no
reemplaza) `docs/modules/*.md` — acá va lo que cambió recientemente y por
qué, no la especificación completa de cada módulo.

---

## Sesión: ajustes generales (auth, calendario, permisos, Configuración)

Iteración incremental sobre 18 puntos: onboarding, loading, indicador de
estado del calendario, superposición de turnos, contador "Atendiendo",
permisos de turnos por rol, Configuración solo-Administrador, interacción de
tablas (Usuarios/Profesionales/Especialidades/Obras sociales), bajas
seguras, especialidades truncadas en el modal de Profesional, cierre de
modales al hacer click fuera, espaciado del modal de Alertas clínicas, y
autocomplete de antecedentes/alergias al enfocar el input.

Ningún cambio de esta sesión requirió una migración de Prisma — los
`onDelete` existentes en `schema.prisma` (`Turno`/`Evolucion` → `Profesional`
sin cascade, `Usuario.profesionalId` → `SET NULL`) ya eran los correctos
para las eliminaciones seguras implementadas.

### Login / Creá tu consultorio

`RegisterPage.tsx` pasó a reusar los mismos estilos que `LoginPage.tsx`
(`frontend/src/auth/LoginPage.css`, ahora compartido — se borró
`AuthPages.css`), con un botón de flecha explícito ("Volver a iniciar
sesión") que navega a Login sin depender de `history.back()`. Los íconos
de ojo/error/flecha se movieron a `frontend/src/auth/AuthIcons.tsx` para no
duplicarlos entre las dos pantallas. En desktop, Nombre/Apellido y
Contraseña/Confirmar contraseña van en una fila de dos columnas
(`.login-form-row`, colapsa a una columna en el mismo breakpoint de 480px
que ya tenía Login).

### Loading inicial

`frontend/src/components/useBootPhase.ts`: `MIN_VISIBLE_MS` pasó de
**1400ms a 1900ms** (+500ms pedidos). `FADE_OUT_MS` (400ms) no cambió. Sigue
respetando `prefers-reduced-motion` y desmontándose por completo (no
`display:none`).

### Calendario: superposición de turnos e indicador de estado

Turnos superpuestos (de distintos profesionales) ya no se dibujan
completamente tapados entre sí. Nueva utilidad pura y testeada,
`frontend/src/utils/turnoLayout.ts` (`layoutTurnos`): agrupa turnos por
colisión usando intervalos semiabiertos `[inicio, fin)`, asigna columnas por
coloreo de intervalos greedy (reutiliza columnas liberadas) y cada turno de
un grupo ocupa `1/N` del ancho disponible, con `N` la concurrencia máxima
del grupo. No replica visualmente Google Calendar (sin "ensanchado"
dinámico de columnas que se liberan) — ver tests en
`turnoLayout.test.ts` para los casos cubiertos (mismo horario, solapamiento
parcial, grupo encadenado, reutilización de columna, turnos consecutivos).
Aplicado en `App.tsx` sobre el `.turno-card` del día (`left`/`width`
calculados en vez del `left:16px;right:16px` fijo de antes).

El indicador circular de estado (`.turno-card-status-dot`) se movió un poco
más adentro (`top`/`right: 10px`, antes `8px`) y tiene una variante más
compacta para turnos que comparten columna (`.turno-card--narrow`) además
de la ya existente para turnos cortos (`.short-turno`).

### Contador "Atendiendo"

`TurnosPage.tsx`: ahora cuenta **todos** los turnos en `ATENDIENDO` del
consultorio, sin filtrar por fecha (antes solo contaba los de "hoy", según
el reloj del navegador) — a diferencia de "En espera" y "Turnos restantes",
que sí siguen acotados al día. Texto visible: "Atenciones actualmente
abiertas". No se agregó ningún cierre/limpieza automática de turnos viejos
en `ATENDIENDO` — es intencional, ver `docs/modules/dashboard.md`.

### Permisos de turnos por rol

- `PROFESIONAL` solo puede crear turnos para sí mismo: el campo Profesional
  no se muestra en el formulario (`FormFields.tsx`, prop
  `hideProfessionalField`) y el backend (`POST /api/turnos`,
  `backend/src/app.ts`) ignora cualquier `profesionalId` del body, tomando
  siempre el profesional vinculado a la sesión. Sin vínculo activo → `403`.
- Al editar (`PATCH /api/turnos/:id`), `profesionalId` queda fuera de los
  campos editables para `PROFESIONAL` (antes se validaba el profesional
  *original* del turno pero no el nuevo valor del mismo PATCH — un
  profesional podía, en teoría, reasignar su propio turno a otro).
- `RECEPCION`, `SUPERVISOR` y `ADMINISTRADOR` no cambiaron: gestionan
  cualquier turno del consultorio sin restricción.
- En la UI, el lápiz de "Editar turno" se deshabilita (con tooltip) cuando
  un `PROFESIONAL` abre un turno ajeno; la lectura sigue permitida.

Ver detalle y discrepancias corregidas en `docs/modules/appointments.md` y
`docs/modules/users-and-roles.md`.

### Configuración exclusiva de Administrador

Ya estaba correctamente implementado en el backend antes de esta sesión
(`requireRole(ADMINISTRADOR)` en todos los `POST`/`PATCH` de usuarios,
profesionales, especialidades, obras sociales y consultorio) — no hubo que
tocar permisos ahí, solo se agregaron los `DELETE` nuevos con el mismo gate.

### Tablas de Configuración: click en fila, Desactivar/Eliminar

Patrón unificado en las 4 tablas
(`ConfiguracionUsuarios/Profesionales/Especialidades/ObrasSociales.tsx`):
click en cualquier parte de la fila abre el mismo modal que el lápiz
(`tabIndex`, `onKeyDown` para Enter/Espacio, foco visible vía el `.turnos-table
tbody tr` ya existente). `ConfigRowActions.tsx` ahora tiene dos variantes:

- `variant="toggle"` (default, usada solo por **Usuarios**): power icon,
  ahora dice **"Desactivar"/"Activar"** (antes "Inactivar").
- `variant="delete"` (Profesionales, Especialidades, Obras sociales): ícono
  de tacho, acción "Eliminar", con lógica de baja segura server-side (ver
  abajo). Cuando el borrado físico está bloqueado por historial, el diálogo
  de confirmación ofrece desactivar en su lugar en vez de solo informar.

Todas las confirmaciones usan el `confirmDialog` custom ya existente en
`App.tsx` — nunca `confirm()`/`alert()` nativos.

### Eliminación segura (Profesionales, Especialidades, Obras sociales)

Nuevos endpoints `DELETE /api/profesionales/:id`,
`DELETE /api/especialidades/:id`, `DELETE /api/obras-sociales/:id`
(`ADMINISTRADOR` únicamente, aislados por consultorio). Cada uno cuenta las
relaciones bloqueantes *antes* de intentar el borrado (mismo patrón que ya
usaban los `_count` de Especialidades/Obras sociales en el listado):

- **Profesional**: bloquean turnos y evoluciones asociadas (más
  fichas/estudios donde figura como responsable). Si no hay nada, se borra
  físicamente; el `Usuario` vinculado (si existe) se desvincula solo vía
  `ON DELETE SET NULL`, nunca se borra la cuenta.
- **Especialidad**: bloquean `ProfesionalEspecialidad` y turnos.
- **Obra social**: bloquean pacientes y turnos.

En los tres casos, si hay historial, el endpoint responde `409` con un
mensaje explicando que se conserva — nunca cascada destructiva, nunca se
tocó `schema.prisma`.

### Especialidades legibles en Editar Profesional

`ProfesionalFormModal.tsx` / `App.css` (`.config-checkbox-list`,
`.config-checkbox-item`): se sacó el `text-overflow: ellipsis` que cortaba
nombres largos de especialidad. Ahora hace wrap normal en una grilla
responsive (`minmax(200px, 1fr)`), con scroll vertical interno si hace
falta y sin scroll horizontal.

### Cierre de modales al hacer click fuera

Nuevo hook `frontend/src/hooks/useModalDismiss.ts`, usado por los 4 modales
de Configuración (`UsuarioFormModal`, `ProfesionalFormModal`,
`EspecialidadFormModal`, `ObraSocialFormModal`): click en el backdrop cierra,
click dentro de la tarjeta no, Escape cierra, y si hay cambios sin guardar
se pide confirmación custom antes de descartar (comparando el form actual
contra su snapshot inicial). No hace nada mientras se está guardando
(`saving`), para no cortar un submit en curso.

### Alertas clínicas: espaciado

`ClinicalAlertsDetail.tsx` / `App.css`: el bloque informativo/lista de
alertas quedó envuelto en `.clinical-alerts-body` (con margen inferior), y
`.clinical-summary-link` ("Ir a ficha inicial →", compartido con
`ClinicalSummaryPanel.tsx`) ganó `margin-top: 16px` para separarse del
bloque de arriba.

### Autocomplete de antecedentes y alergias

Nuevo hook compartido `frontend/src/hooks/useClinicalCatalogSearch.ts`,
usado por `ClinicalAntecedentesSection.tsx` y `FichaAllergyList.tsx`: al
enfocar un input vacío, muestra los primeros 5 ítems del catálogo de la
categoría actual (cargado una sola vez por categoría, no en cada focus);
al escribir, filtra con el mismo endpoint (`GET /api/catalogo-clinico`) con
debounce de 250ms sin cambios. Soporta flechas + Enter para navegar/elegir,
Escape para cerrar, y cierre al hacer click fuera (truco estándar de
combobox: `onMouseDown` con `preventDefault()` en las opciones para que el
`blur` del input no dispare antes que el `click`).

---

## Sesión: catálogos globales, aislamiento, historial, UX clínica, orden de pacientes, timezone y fechas editables

Segunda iteración incremental grande. Una migración de Prisma:
`20260806154210_catalogo_global_custom_y_profesional_deleted_at` — aditiva
(columnas nullable/nuevas, dos tablas nuevas de "ocultamiento", un
`deletedAt` nuevo), sin backfill destructivo ni pérdida de datos. Los
`onDelete` explícitos que ya traía `CatalogoClinicoItem.consultorio`
(`Cascade`) se replicaron igual en `Especialidad.consultorio` y
`ObraSocial.consultorio`, mismo motivo (evitar que las filas custom de un
consultorio borrado "floten" a `consultorioId: null` y se vuelvan globales).

### Catálogo global/custom para Especialidades y Obras sociales

Mismo patrón que ya existía para `CatalogoClinicoItem`: `consultorioId`
nullable + `esSistema: Boolean`. Filas globales (`esSistema: true,
consultorioId: null`) administradas por Kineq, compartidas por todos los
consultorios; filas custom (`esSistema: false`) como antes. `GET
/api/especialidades`/`/api/obras-sociales` devuelven la unión de globales no
ocultas + custom propias. Ningún consultorio puede `PATCH`/`DELETE` una fila
global (`403`, "Este elemento es predeterminado de Kineq y no puede
editarse. Podés ocultarlo para tu consultorio.") — solo puede **ocultarla**
para sí (`POST`/`DELETE /api/especialidades/:id/ocultar` y equivalente para
obras sociales, tablas nuevas `ConsultorioEspecialidadOculta`/
`ConsultorioObraSocialOculta`). En la UI (`ConfiguracionEspecialidades.tsx`/
`ConfiguracionObrasSociales.tsx`), las filas globales muestran badge
"Predeterminada", lápiz deshabilitado, tacho pasa a decir "Ocultar" (no
destructivo); un checkbox "Mostrar ocultas" permite verlas y restaurarlas.
Las filas custom no cambiaron (mismo `DELETE` seguro con historial de la
sesión anterior). Seed idempotente nuevo, `backend/src/seedCatalogosGlobales.ts`
(mismo patrón manual `findFirst`+`create`/`update` que
`seedCatalogoClinico.ts`, porque Prisma no permite `upsert` con
`consultorioId: null` en la clave): 5 especialidades (Kinesiología general,
Rehabilitación deportiva, Terapia manual, Osteopatía, Reeducación postural)
y 5 obras sociales (OSDE, Swiss Medical, Galeno, Medifé, Sancor Salud). Los
datos existentes de cada consultorio **no** se convirtieron en globales —
siguen siendo custom de su consultorio, tal como se pidió.

### Eliminación lógica de pacientes: cascada a turnos futuros

`PATCH /api/pacientes/:id`: al detectar `activo: true → false` real, en la
misma transacción cancela (`CANCELADO`, con `canceladoAt` y nota) los turnos
**futuros** no terminales del paciente — nunca los borra, nunca toca turnos
pasados o ya terminales. Mientras el paciente esté inactivo, se bloquea
(`404`) la creación de turnos nuevos y de contenido clínico nuevo
(evoluciones, ficha inicial y sus sub-recursos) para ese paciente — la
lectura de su historial sigue sin restricciones. Reactivar levanta ambos
bloqueos sin acción adicional. No se agregó `deletedAt` a `Paciente` — se
reusó `activo`, ya alcanzaba.

### Profesional: Inactivo vs. Eliminado

Antes, un solo booleano `activo` conflaba "inactivo pero administrable" con
"archivado fuera de listados". Ahora son dos estados: `activo: false` sigue
siendo "Inactivo" (administrable, visible con `?estado=todos`); nuevo
`Profesional.deletedAt` es "Eliminado" (`POST`/`DELETE
/api/profesionales/:id/archivar`, siempre implica `activo:false` también,
nunca aparece en `GET /api/profesionales` ni con `?estado=todos` — no hay
pantalla de auditoría de eliminados en esta iteración). El tacho de
`ConfiguracionProfesionales.tsx` para un profesional con historial ahora
llama a "archivar" en vez de solo ofrecer "Desactivar" (que sigue
disponible desde el checkbox del formulario de edición). `requireProfesionalVinculado`
(`backend/src/auth.ts`) pasó a `async` y ahora también verifica que el
profesional vinculado siga activo y sin `deletedAt` antes de permitir
autoría clínica — cambio centralizado que protege automáticamente las ~19
rutas de escritura clínica que ya lo usaban. En las vistas históricas
(turnos, calendario, evoluciones, ficha inicial) el nombre del profesional
nunca desaparece ni se reemplaza — el helper compartido
`frontend/src/utils/professional.ts` (`professionalName`) le agrega el
sufijo `(Inactivo)` o `(Eliminado)`.

### UX suelta: Atendiendo, calendario, autocomplete, ficha inicial, evoluciones, avatar

- Contador "Atendiendo": el cálculo global (sin filtro de fecha) de la
  sesión anterior **no se tocó** — solo se revirtió el texto de "Atenciones
  actualmente abiertas"/"Pacientes en sesión, de cualquier día" al título
  corto original: "Atendiendo"/"Pacientes en sesión".
- Calendario: gap visual de 3px entre turnos contiguos (altura renderizada
  `Math.max(duracionMinutos - 3, 12)`px, nunca se toca `top`/la hora real).
- Autocomplete de antecedentes/alergias (`useClinicalCatalogSearch.ts`): al
  enfocar vacío ahora muestra **todo** el catálogo de la categoría (antes
  limitaba a 5) — el contenedor ya tenía `max-height`+scroll, sin cambios
  de CSS.
- Card "Ficha inicial" del resumen del paciente ahora es clickeable
  (reusa la afordancia que ya tenía la card de Alertas clínicas).
- Detalle expandido de una evolución (`.evolution-expanded-content`): se
  agregó `margin: 10px 0` para más respiración visual.
- Avatar de paciente: mismo patrón placeholder-only que ya existía para la
  foto del usuario logueado (`.avatar-wrapper`/`.avatar-edit-button`/
  `.avatar-edit-popover`), aplicado en `PatientProfileHeader.tsx` — mensaje
  "Foto del paciente / La carga de imágenes estará disponible próximamente.",
  sin carga real.

### Orden de la lista de Pacientes

`PatientsPage.tsx` ganó un botón "Ordenar" (mismo patrón visual y de
interacción — panel de radios, cierre por click afuera/Escape — que el ya
existente en `TurnosPage.tsx`, clases CSS reusadas tal cual). Opciones: Más
recientes (`createdAt DESC`, desempate `id DESC` — default), Alfabético A–Z
y Z–A (`localeCompare` locale `es`, `sensitivity: 'base'`, desempate `id`).
Todo en cliente, sobre la lista ya cargada (mismo criterio que
búsqueda/filtros existentes — `GET /api/pacientes` no tiene paginación).

### Zona horaria del consultorio

`ConfiguracionGeneral.tsx`: la lista hardcodeada de 4 zonas argentinas se
reemplazó por una lista curada de ~18 zonas representativas por franja UTC
(Buenos Aires primero/default, más Los Angeles, New York, Santiago, São
Paulo, London, Paris, Moscow, Dubai, India, Bangkok, Shanghai, Tokyo,
Sydney, Auckland, Kiritimati, UTC — `frontend/src/utils/timezone.ts`,
`TIMEZONE_OPTIONS`). El offset mostrado (`getTimezoneOffsetLabel`) se
calcula en el momento vía `Intl.DateTimeFormat` con `timeZoneName:
'shortOffset'` — nunca hardcodeado, respeta horario de verano. **Hallazgo
importante**: `Intl.supportedValuesOf('timeZone')` NO incluye
`America/Argentina/Buenos_Aires` (ICU la trata como alias de
`America/Buenos_Aires` y la excluye de la lista "canónica"), aunque
`Intl.DateTimeFormat` la acepta y resuelve perfectamente — usar esa función
para validar hubiera rechazado el propio default del sistema. La validación
(frontend `isValidTimeZone` y backend `PATCH /api/consultorio`) usa en
cambio `new Intl.DateTimeFormat('en', { timeZone: zona })` dentro de un
`try/catch`, que sí resuelve alias correctamente.

### Fechas tipeables en toda la app

Nuevo componente compartido `frontend/src/components/DateInput.tsx`: input
de texto `dd/mm/aaaa` (parseo/validación en `frontend/src/utils/dateFormat.ts`,
`parseDisplayDate`/`formatDisplayDate` — detecta fechas imposibles
reconstruyendo la fecha y comparando componentes, mismo truco estándar) +
botón de calendario que dispara un `<input type="date">` nativo oculto
(`showPicker()`) para seguir eligiendo visualmente; ambos caminos
sincronizados. Reemplazó los 7 usos de `<input type="date">` crudo que
había en la app (paciente, turno, filtros de Turnos, estudios, ficha
inicial, antecedentes). El contrato con el backend no cambió — sigue
mandando `YYYY-MM-DD` para fechas sin hora. De paso se corrigió un bug
preexistente no documentado: `formatDateOnly` leía componentes en hora
local y `toDateInputValue` en UTC — inconsistencia que podía mostrar la
fecha de nacimiento un día antes en husos detrás de UTC (como Argentina);
se corrigió `calculateAge` para leer la fecha de nacimiento con getters UTC
(coherente con cómo la guarda el backend).

**Turnos ahora respetan la zona horaria del consultorio, no la del
navegador**: nuevo `frontend/src/utils/timezone.ts` (`zonedTimeToUtcIso`/
`utcIsoToZonedParts`, truco estándar sin librería de timezones vía
`Intl.DateTimeFormat.formatToParts`) reemplaza el cálculo en hora-local-del-
navegador que tenía `toInicio` (`frontend/src/services/api.ts`) — y,
simétricamente, las funciones que mapean turnos de la API a la UI (`App.tsx`
`mapApiTurnoToUi`, `TurnosPage.tsx` `mapApiTurno`) también leen con la zona
del consultorio, para que editar un turno ya guardado siga mostrando la
hora que se eligió originalmente. `App.tsx` carga la zona horaria una vez al
iniciar sesión (`api.getConsultorio()` → `api.setConsultorioTimeZone`); hasta
entonces se usa el default `America/Argentina/Buenos_Aires`. No se tocó
`normalizeDateBoundary` (los filtros `from`/`to` de la tabla de Turnos
siguen en hora local del navegador — solo acota un filtro, no cambia la
hora mostrada de ningún turno).

---

## Qué no se tocó (límites intencionales de esta sesión)

- Disponibilidad avanzada, licencias/vacaciones, multi-sede, invitaciones,
  permisos granulares configurables, portal de pacientes, reserva pública,
  auditoría clínica avanzada.
- Rediseño completo del calendario o copia visual de Google Calendar — solo
  el layout de columnas mínimo necesario para no tapar turnos.
- Eliminación de historial clínico o limpieza automática de turnos viejos
  en `ATENDIENDO`.
- El botón "Eliminar turno" del modal de detalle de turno (`App.tsx`) no se
  tocó — no forma parte del pedido de esta sesión; no hay
  `DELETE /api/turnos/:id` en el backend, así que ese botón hace un
  cancelado, no un borrado real (comportamiento previo a esta sesión).
- Panel central de administración de Kineq para editar defaults globales,
  carga real de imágenes/archivos, auditoría clínica avanzada, borrado
  físico de evoluciones/pacientes/profesionales con historial, facturación
  de obras sociales, autorizaciones, topes de sesiones, multi-sede, portal
  de pacientes — todo explícitamente fuera de alcance de la sesión de
  catálogos globales.
- No se agregó una pantalla de auditoría/restauración para profesionales
  archivados (`deletedAt`) — la restauración (`DELETE
  /api/profesionales/:id/archivar`) existe a nivel API pero no tiene UI en
  esta iteración, a propósito (mismo criterio que "no implementar auditoría
  clínica avanzada").
- Editar/eliminar una evolución **ya existente** de un paciente archivado no
  se bloqueó (solo se bloqueó la *creación* de contenido clínico nuevo) —
  esas rutas no hacen lookup de paciente hoy, y agregarlo era una pieza de
  plomería nueva no pedida explícitamente; se interpretó "no permitir
  nuevas escrituras" en sentido estricto (alta, no corrección de lo ya
  cargado).
- El campo de fecha del formulario "Nuevo/Editar turno" (`FormFields.tsx`)
  al ver un turno con un profesional inactivo/eliminado sigue mostrando el
  selector de profesional vacío (el dropdown de profesionales solo lista
  activos) — comportamiento preexistente, no empeorado por esta sesión; el
  sufijo `(Inactivo)`/`(Eliminado)` sí se ve correctamente en las vistas de
  solo lectura (tabla de turnos, calendario, evoluciones).

## Pendiente conocido (no bloqueante)

- Ninguna migración de Prisma pendiente para lo implementado en la primera
  sesión. La segunda sesión sí agregó una migración
  (`20260806154210_catalogo_global_custom_y_profesional_deleted_at`),
  aditiva y ya aplicada — sin backfill destructivo.
- `normalizeDateBoundary` (filtros `from`/`to` de la tabla de Turnos) sigue
  calculando en hora local del navegador, no en la zona del consultorio —
  solo afecta el límite de un filtro (podría incluir/excluir un turno cerca
  de la medianoche en zonas muy distintas a la del navegador), no la hora
  mostrada de ningún turno individual.

---

## Sesión: Estadísticas v1, alertas manuales extendidas, grupos de evolución

Migración nueva: `20260814204620_add_ficha_alerta_campo_y_grupo_evolucion`
— aditiva (dos tablas nuevas, `Evolucion.grupoId` nullable), sin backfill.
Detalle completo en `docs/modules/statistics.md` (nuevo) y las secciones
de alertas/grupos en `docs/modules/clinical-history.md` — acá el resumen.

### Estadísticas

Página nueva (`EstadisticasPage.tsx`) + módulo backend aislado
(`estadisticasRoutes.ts`/`estadisticasService.ts`, montado en `app.ts` con
una sola línea, sin tocar el resto del archivo). Reutiliza
`requireRole`/`requireAuth`/el mismo criterio de scoping de `PROFESIONAL`
que ya usa `POST /api/turnos`. Un solo endpoint,
`GET /api/estadisticas/resumen`, agregaciones vía `groupBy`/`distinct` de
Prisma — nunca se bajan turnos crudos al frontend, salvo el `select`
mínimo (`inicio`, `estado`) usado server-side para construir la serie
temporal. Se agregó **recharts** como única dependencia nueva del proyecto
(no había ninguna librería de gráficos instalada) — se descartó SVG a mano
por ser más código propio que mantener que una dependencia chica y
estándar, dado que hacían falta 4 tipos de gráfico con tooltip y
responsive. Sin migraciones ni índices nuevos para esta parte — solo lee
tablas existentes, los índices de `Turno` ya alcanzaban.

### Alertas clínicas manuales, extendidas a más campos

Antes, "marcar como alerta" solo existía como booleano (`esAlertaClinica`)
en `FichaAntecedente`/`FichaMedicacion` — filas de catálogo. Los campos de
texto libre de `FichaInicial` (Motivo, Diagnóstico de derivación,
Traumatismos, Tratamientos previos, Enfermedades actuales, Dolor y
síntomas, Limitaciones funcionales, Hallazgos iniciales, Observaciones
clínicas, Estudios complementarios) no tenían equivalente. Tabla nueva
`FichaAlertaCampo` (la existencia de la fila **es** la alerta, sin columna
`activa`) + `PUT`/`DELETE
/api/pacientes/:pacienteId/ficha-inicial/alertas-campo/:campo`, mismo
criterio de autoría estricta (`requireProfesionalVinculado`) que el resto
de escritura clínica. **No se tocó** el modelo/booleanos existentes de
Antecedentes/Medicación/Alergias — no hubo migración de datos hacia un
modelo unificado. `ClinicalAlertsDetail.tsx` ganó un cuarto grupo ("Otras
alertas").

### Grupos de evolución

`GrupoEvolucion` nuevo (`nombre`+`color`, misma paleta curada que ya usa
`Especialidad.color`) + `Evolucion.grupoId` nullable. Puramente
visual/organizativo — explícitamente no es `Tratamiento` (sin diagnóstico,
plan de sesiones, ni estado). "Eliminar" un grupo
(`DELETE /api/grupos-evolucion/:id`) solo marca `archivedAt` — nunca borra
evoluciones; un grupo archivado no se puede volver a asignar pero las
evoluciones que ya lo tenían conservan la referencia. UI: botón "+ Nuevo
grupo" + modal (`GrupoEvolucionModal.tsx`, mismo patrón
`.modal-overlay`/`useModalDismiss` que el resto de Kineq), selector de
grupo al crear/editar evolución, chip de color en `EvolutionTable.tsx`, y
toggle "Ver por fecha | Ver por grupo" — el agrupado pasa por una función
pura nueva y testeada (`frontend/src/utils/groupEvolucionesByGrupo.ts`),
sin endpoint nuevo (ya se tienen todas las evoluciones del paciente
cargadas).

### Ajustes puntuales de UI (pedidos en el mismo lote)

- **Creá tu consultorio**: el CSS de `.login-input` era idéntico al de
  Login (no era ahí el problema) — la causa real era `.login-card` fijo en
  440px combinado con las filas de 2 columnas del registro
  (`.login-form-row`), que dejaban cada input en ~170px. Fix: modificador
  `.login-card--wide` (520px) aplicado solo en `RegisterPage.tsx`.
- **Avatar**: el offset del lápiz pasó de `bottom:-4px;right:-4px`
  (magic number calibrado para un tamaño puntual) a
  `bottom:0;right:0;transform:translate(35%,35%)` (proporcional al propio
  tamaño del badge).
- **Orden de tabs**: Ficha inicial ahora va antes que Evoluciones
  (`PatientDetailPage.tsx`, tabs y `activeTab` default).
- **Antecedentes en 2 columnas** en desktop
  (`.antecedentes-section .antecedentes-list`, scoped para no afectar el
  modal de Alertas clínicas ni el drawer de catálogo, que reusan la misma
  clase `.antecedentes-list`), 1 columna ≤820px (mismo breakpoint que ya
  usa el resto de la app).

### Tests

Backend: `estadisticas.test.ts` nuevo (6 tests: fórmulas de KPIs,
aislamiento por consultorio, scoping de `PROFESIONAL` aunque pida otro
`profesionalId` por query, período vacío sin NaN) + 11 tests nuevos
agregados al harness compartido de `app.test.ts` (grupos de evolución y
alertas manuales — duplicados, colores inválidos, cross-paciente,
cross-consultorio, archivar preserva historial, whitelist de campos, sin
vínculo). Suite completa: 132 tests (antes ~119). Frontend:
`groupEvolucionesByGrupo.test.ts` y `statsPeriods.test.ts` nuevos,
`clinicalAlerts.test.ts` extendido. Suite completa: 77 tests (antes 63).
`tsc -b`, `vite build` y `npm run lint` (backend y frontend) sin errores
nuevos — el único lint error existente (`AuthContext.tsx`,
`react-refresh/only-export-components`) es preexistente, no se tocó ese
archivo.

### Verificación manual

Se instaló Playwright + Chromium en el scratchpad de la sesión (no como
dependencia del proyecto) para levantar ambos dev servers y recorrer el
flujo real: registro de consultorio nuevo, seed de turnos con distintos
`estado` vía fetch autenticado del propio browser, KPIs de Estadísticas
verificados contra el cálculo esperado a mano, cambio de preset de período
y de granularidad del gráfico, creación/archivado de un grupo, toggle "Ver
por grupo", marcado/desmarcado de una alerta manual de campo (confirmado
en el resumen y en el detalle de Alertas clínicas), contraste en modo
oscuro. Ver "Known gaps" en `docs/tasks.md` para un bug preexistente
encontrado durante esta verificación (no relacionado a este trabajo, no
arreglado).

### Qué no se tocó

Migración de las alertas existentes (`esAlertaClinica`) a un modelo
unificado, severidad/vencimiento/acknowledgement en alertas, entidad
`Tratamiento`/diagnóstico codificado/plan de sesiones/alta clínica,
ocupación real por profesional (sin fuente confiable de disponibilidad
horaria), export PDF/Excel, envío programado de reportes, comparación
entre consultorios, IA/predicciones sobre estadísticas, reglas
automáticas de alertas clínicas.

---

## Sesión: bugs de alertas/autosave, navegación a origen, grupos, formato rico

Ronda de corrección sobre la sesión anterior — encontrada con un
click-through real del formulario (la verificación manual de la sesión
anterior nunca llegó a tipear en un campo de texto real antes de guardar,
por un selector frágil que apuntaba a otro input; por eso estos bugs
pasaron desapercibidos hasta ahora). Una migración nueva, aditiva:
`20260814233921_add_evolucion_contenido_html` (una columna nullable, sin
backfill). Dos dependencias nuevas: `dompurify` (frontend) y
`sanitize-html` (backend), ambas para la sanitización del formato rico —
no había ningún sanitizador ya instalado para reusar.

### Dos bugs reales detrás de "Failed to save ficha inicial" / pérdida de contenido

No eran el mismo bug:

1. **Carrera real**: `useFichaInicial.ts`'s `refresh()` (se llama después de
   cualquier mutación de la ficha, incluida marcar una alerta manual)
   pisaba `form` con la respuesta del servidor sin mirar si había una
   edición de texto sin guardar en danza (autoguardado con debounce de
   900ms). Si el usuario tipeaba y, antes de que ese autoguardado
   terminara, marcaba una alerta, el `refresh()` disparado por esa alerta
   traía de vuelta el valor viejo del campo y lo pisaba. Fix: nuevo
   `pendingRef` (ref, no el state `pending` — un handler async puede
   resolver después de que el usuario siguió tipeando, y un closure sobre
   el state del render en que arrancó ya estaría desactualizado);
   `refresh()` ahora solo toca `form` si no hay nada pendiente.
2. **No era una carrera, pasaba siempre**: `buildFichaPayload(form)` manda
   el form completo en cada autoguardado — incluidos los 7 campos que
   mapean a un enum de Prisma (`alergiasEstado`, `medicacionEstado`,
   `tabaquismoEstado`, `alcoholEstado`, `sedentarismoEstado`,
   `menarcaEstado`, `menopausiaEstado`), que arrancan en `''` hasta que se
   tocan. Prisma rechaza `''` para un enum nullable con un 500 real —
   pasaba apenas se guardaba el primer dato de cualquier ficha nueva, sin
   necesidad de ninguna concurrencia. Fix en dos capas: el frontend manda
   `null` en vez de `''` para esos 7 campos (la corrección de raíz); el
   backend también normaliza `'' → null` para los mismos campos en el
   `PATCH` (frontera de la API, nunca confiar solo en que el cliente lo
   haga bien).

Además se blindó `upsertFichaInicial` (compartida por el `PATCH` principal
y por `getOrCreateFichaInicial`, que corre en cada alta de
antecedente/alergia/medicación/estudio/alerta-de-campo) contra el caso que
sí es genuinamente concurrente: dos escrituras casi simultáneas sobre una
ficha que todavía no existe pueden chocar contra el unique de `pacienteId`
(`P2002`) al competir por crearla — ahora se reintenta como `update` puro
en vez de devolver 500.

### Resumen clínico y Alertas clínicas: misma fuente de verdad

`ClinicalSummaryPanel.tsx` (el panel lateral "Resumen clínico") tenía su
propio cálculo de alertas (`hasAlergia` + "algún antecedente positivo" —
esto último ni siquiera era correcto por sí solo, un antecedente positivo
sin marcar como alerta no debería contar como alerta según la propia regla
documentada de "nunca diagnóstico automático") que podía divergir de
`computeAlertasClinicas()`, la función real que ya usaban la card de
resumen y su popup. Ahora los tres usan la misma función.

### Navegar de una alerta a su campo de origen

Cada item del popup de Alertas clínicas (`ClinicalAlertsDetail.tsx`) es
ahora un botón real con su propia metadata de origen
(`utils/clinicalNavTarget.ts`: `outerTab`, `section`, `categoria` para
antecedentes, `elementId`), armada a partir de IDs reales — nunca
comparando texto. Al clickear: cierra el popup, cambia a la tab/sección/
categoría correcta, hace scroll al campo/fila y lo resalta ~1.6s
(`.clinical-nav-highlight`, vía `utils/scrollAndHighlight.ts`).

### Grupos de evolución: gestión completa

Antes solo se podía crear un grupo y asignarlo al cargar/editar una
evolución — no había forma de editar un grupo que todavía no tuviera
ninguna evolución (la única edición pasaba por el header de su sección en
"Ver por grupo", que solo aparece si ya tiene ≥1 evolución) ni un filtro.
Se agregó un modal "Gestionar grupos" (`GestionarGruposModal.tsx`, lista
todos los grupos activos del paciente con acción Editar, sin depender de
que tengan evoluciones) y un `<select>` de filtro ("Todos los grupos" /
"Sin grupo" / cada grupo) que acota ambas vistas sin tocar "Última
evolución" del resumen ni el badge de la tab (siguen mostrando el total
real, no el filtrado).

### Formato básico (negrita/cursiva/subrayado) en Evoluciones

`Evolucion.contenidoHtml` nuevo (nullable, `@db.Text` — `contenido` ya
venía de un `VARCHAR(191)` que se queda corto para una nota clínica real,
y el HTML solo empeora eso), se llena solo cuando se usa la toolbar nueva
(`RichTextEditor.tsx`: `contentEditable` + `document.execCommand`, sin
dependencia de RTE completa para 3 botones). `null` en todas las
evoluciones anteriores, que se siguen mostrando como texto plano sin
cambios (`EvolucionContent.tsx` solo renderiza HTML cuando `contenidoHtml`
no es `null`). Sanitizado en las dos capas, nunca solo en el frontend:
DOMPurify en el editor (`utils/richTextSanitize.ts`), `sanitize-html` de
nuevo en el backend (`sanitizeRichText.ts`) antes de persistir — misma
allowlist (`b,strong,i,em,u,p,br`, sin atributos) en ambos lados.
`contenido` (texto plano) se deriva del HTML ya sanitizado en el backend
cuando hay formato, para que las dos columnas nunca queden
desincronizadas.

### También corregido

- **Lápiz del avatar del paciente**: seguía mal ubicado porque reusaba
  `.avatar-edit-button`, calibrado en la sesión anterior para el avatar
  "esquina redondeada" del sidebar (`.avatar`, `border-radius: 18px`) — el
  avatar del paciente es un círculo real (`.patient-avatar`,
  `border-radius: 999px`), cuyo borde visible cerca de la esquina queda
  bastante más adentro que el de un cuadrado. Modificador nuevo
  `.avatar-edit-button--circle` con un inset mayor, calibrado para la
  geometría de un círculo.
- **Catálogo completo de Antecedentes ("Ver todos") en 2 columnas** en
  desktop (`.catalogo-drawer-list`, modal ensanchado a 880px), mismo
  criterio que ya tenía la lista de antecedentes ya agregados — colapsa a
  1 columna ≤820px.

### Tests

Backend: `sanitizeRichText.test.ts` nuevo (10 tests), 3 tests nuevos en
`app.test.ts` (regresión de escritura concurrente sobre ficha nueva,
regresión de enum vacío, 6 tests de integración de formato rico —
crear/editar/HTML malicioso/compatibilidad con evoluciones viejas/editar
grupo sin tocar formato/HTML que sanitiza a vacío rechaza). Suite
completa: 150 tests (antes 132). Frontend:
`eligibleAlertFields.test.ts` nuevo. Suite completa: 81 tests (antes 77).
`sanitizeRichTextHtml`/`scrollToAndHighlight` **no** tienen test unitario
propio — ambos necesitan un DOM real (DOMPurify no funciona en Node puro
sin `window`, y no hay jsdom/happy-dom instalado) — mismo gap ya conocido
de infraestructura de tests de componente, cubierto en cambio por la
verificación manual con Playwright.

### Verificación manual

Mismo setup de Playwright en el scratchpad de la sesión anterior,
reproduciendo el repro exacto del usuario para cada bug: tipear en Motivo
y clickear la alerta inmediatamente después (sin esperar el debounce) —
el texto sobrevive y la ficha llega a "Parcialmente completa" en vez de
romperse; click-through completo de la navegación por alerta (captura
confirma el campo correcto resaltado); el modal "Gestionar grupos" nuevo;
negrita/cursiva tipeadas en vivo con Ctrl+B/Ctrl+I, verificadas tanto
mientras se edita como en la vista guardada de solo lectura.

### Qué no se tocó

El bug preexistente del "Ver detalle" duplicado en las cards de resumen
(hay dos links "Ver detalle" en la página — Ficha inicial y Alertas
clínicas — un selector de texto genérico agarra el primero) no es un bug
real de producto, es solo una particularidad de cómo Playwright resuelve
selectores de texto ambiguos; no se tocó nada del componente por esto. El
warning preexistente de key duplicada en el calendario de Inicio (ver
sesión anterior) tampoco se tocó — sigue sin estar relacionado a este
trabajo.

---

## Sesión: pulido de UI — filtro de Evoluciones, simplificación de grupos, alertas con contenido real, colores de Especialidad

Ronda incremental, sin rediseño. Seis cambios independientes:

1. **Filtro de Evoluciones**: reemplazado el `<select>` sin estilo por el
   mismo patrón `.filter-button` + panel desplegable que ya usan
   Turnos/Pacientes (radio buttons de selección única dentro de
   `.filters-panel`).
2. **Grupos: un solo punto de entrada**. "Ver grupos"
   (`GestionarGruposModal.tsx`) reemplaza al viejo "Gestionar grupos"
   (que solo aparecía si ya había ≥1 grupo) y queda siempre visible; se
   sacó el botón suelto "+ Nuevo grupo" del toolbar — ahora solo existe
   dentro del modal. Editar usa lápiz, eliminar usa tachito
   (`EditIcon`/`TrashIcon`, exportados desde `EvolutionTable.tsx` para
   reusarlos). Tanto el tachito de la lista como el del modal de edición
   llaman a la misma función `deleteGrupo()` en `PatientDetailPage.tsx`
   — misma confirmación, mismo llamado al backend, ninguna lógica
   duplicada.
3. **"Archivar" → eliminar de verdad**. `DELETE
   /api/grupos-evolucion/:id` ahora hace `prisma.grupoEvolucion.delete()`
   en vez de marcar `archivedAt`. Las evoluciones nunca se borran: la FK
   `Evolucion.grupoId` ya tenía `onDelete: SetNull`, así que quedan
   automáticamente "Sin grupo" con todo su contenido intacto. Se sacó la
   columna `archivedAt` (ya sin uso) en la migración
   `20260815004433_remove_grupo_evolucion_archived_at`. También se sacó
   la leyenda "no reemplaza un diagnóstico" del modal y el placeholder
   del nombre pasó a `Ej. Lumbalgia`.
4. **Alertas manuales muestran el contenido real** del campo de origen
   (`computeAlertasClinicas()` lo lee de la `FichaInicial` vigente en
   cada cómputo, nunca una copia vieja — si el profesional edita el campo
   después, el preview se actualiza solo), truncado a ~3 líneas si es
   largo. El texto genérico queda solo como fallback si el campo está
   vacío.
5. **Selector de Especialidad con color**: el combobox custom de
   `TurnoFormFields` ahora muestra un punto de color
   (`.turnos-specialty-dot`, la misma clase que ya usaba la tabla de
   Turnos/Configuración) junto a cada opción y junto al valor
   seleccionado. La asignación automática de color al crear una
   especialidad rápida desde Turnos ya existía de una ronda anterior —
   se verificó, no se duplicó.
6. Más margen entre "Ver por fecha | Ver por grupo" y la tabla de
   evoluciones.

### Migración: drift preexistente encontrado

Al correr la migración que saca `archivedAt`, Prisma detectó una
inconsistencia previa entre el historial de `_prisma_migrations` y la
base real (un `GrupoEvolucion_consultorioId_fkey` y FKs de
`FichaAlertaCampo` que el historial no reflejaba correctamente) — la
migración generada automáticamente quedó incompleta y falló a mitad de
camino. Se recuperó a mano: se corrigió la base al estado real esperado
(re-agregando la FK que había quedado sin recrear), se corrigió el
`migration.sql` para que coincida con lo que realmente hizo falta, y se
marcó con `prisma migrate resolve --applied`. `prisma migrate status` y
un `migrate dev` posterior confirman que no queda drift.

### Tests

Backend: se reescribió el test "archivar un grupo..." como "eliminar un
grupo... quedan sin grupo" (verifica `grupoId` en `null` y que reasignar
a un grupo ya eliminado da 404 en vez de 409). Suite completa: sigue en
150. Frontend: sigue en 81 (no se agregó infraestructura de test de
componentes, mismo criterio que rondas anteriores). `tsc --noEmit` y
`npm run build` limpios en ambos paquetes; el único error de lint
(`AuthContext.tsx`) es el mismo preexistente y no tocado de rondas
anteriores.

### Verificación manual

Con Playwright: el botón de filtro dice "Filtro" (ya no es un select),
no queda ningún "+ Nuevo grupo" fuera del modal, un solo botón "Ver
grupos", sin leyenda ni "Archivar" en los modales de grupo, lápiz y
tachito visibles, placeholder "Ej. Lumbalgia", el diálogo de confirmación
de eliminar muestra exactamente el copy pedido, una evolución con grupo
queda "Sin grupo" (contenido intacto) después de eliminar ese grupo, el
popup de alertas muestra el texto real de `motivoConsulta` en vez del
fallback genérico, y el selector de Especialidad en "Nuevo turno" muestra
un punto de color por opción más uno junto al valor elegido.

---

## Sesión: Antecedentes SI-only, menú contextual en Turnos, Volver, confirmación de Finalizar atención, avatar/logo, pasada mobile

Ronda de diagnóstico-primero, sin rediseño. Seis bugs/gaps puntuales más una
pasada de responsive mobile. Todo verificado en vivo con Playwright, no solo
leído del código.

### Antecedentes: los `NO` ya no aparecen en el listado visible

Causa: `ClinicalAntecedentesSection.tsx` solo filtraba por categoría, nunca
por `estado` — mostraba "Confirmado" y "Descartado" mezclados en la misma
lista. Se separó en `categoriaAntecedentes` (toda la categoría, se lo sigue
pasando entero al catálogo completo para que siga mostrando "No" en vez de
"Sin relevar" en un ítem ya marcado) y `visibleAntecedentes` (filtrado
además a `estado === 'SI'`, usado solo en el listado principal). El Resumen
clínico y el resumen compacto de Ficha Inicial ya filtraban bien — el bug
estaba aislado a este componente. Verificado de punta a punta: marcar HTA
`SI` → aparece; marcar Diabetes `NO` desde el catálogo → no aparece en el
listado, pero sigue mostrando "No" (no "Sin relevar") al reabrir el
catálogo; pasarlo a `SI` → aparece de inmediato.

### Menú contextual (click derecho) en Turnos

`TurnosPage.tsx` ya tenía un botón de tres puntos que abría el mismo
`context-menu`, alimentado por la misma función `getTurnoQuickActions` que
usa el calendario de Inicio — cero divergencia real en la matriz de
acciones. Lo único que faltaba era el disparador de click derecho en sí:
se agregó `onContextMenu` a cada `<tr>` (mismo cálculo de posición
clameada al viewport que ya usaba el calendario), reutilizando el mismo
estado/ref/efecto de cierre (click afuera + Escape) que ya tenía el botón
de tres puntos. Ese botón se mantiene como equivalente táctil.

### "Volver" desde Atención ya no vuelve siempre a Inicio

`closeAttentionScreen()` tenía `'home'` hardcodeado. `closePatientDetail()`
(Pacientes → detalle → Volver) ya estaba bien porque Pacientes es hoy el
único punto de entrada real a `paciente-detalle` (confirmado: un solo
caller de `openPatientDetail` en todo el frontend). Se agregó
`attentionReturnPage`, guardado con el `activePage` real al momento de
entrar a Atención desde `iniciarAtencion`/`continuarAtencion` (compartidas
por Inicio, Turnos y el modal "Editar turno" — un solo cambio cubre los
tres orígenes). Verificado: Turnos → click derecho → Iniciar atención →
Volver → vuelve a Turnos, no a Inicio.

### Confirmación obligatoria para "Finalizar atención"

Tres de los cuatro disparadores (Inicio, Turnos, acciones rápidas de
"Editar turno") comparten un único `onClick` dentro de
`getTurnoQuickActions` que llamaba a `updateTurnoEstado` directo, sin
confirmar — arreglado una sola vez ahí, con un nuevo
`requestFinalizarAtencion()` que abre el modal de confirmación custom de
Kineq (nunca `confirm()`). El cuarto (el botón propio de
`AttentionPage.tsx`) ya confirmaba en dos casos (cambios sin guardar, sin
evolución cargada) pero no en el camino feliz — se agregó la misma
confirmación no-destructiva ahí. Verificados los cuatro; Cancelar deja el
turno en `ATENDIENDO` siempre.

### Avatar: esta vez sí

Las rondas anteriores centraban el badge exactamente sobre el punto de la
esquina redondeada — matemáticamente "correcto", pero un círculo centrado
en la esquina de una caja solo se superpone con un cuarto de su área, así
que se veía "flotando" en vez de superpuesto (confirmado inspeccionando
bounding boxes reales, no solo re-derivando la geometría). Se ancla ahora
al borde plano (`bottom/right: 4%` en el avatar rectangular redondeado del
sidebar, `10%` en el círculo completo del paciente) y se empuja hacia
adentro con un `translate(28%, 28%)` más chico, dejando el centro del
badge *adentro* del avatar. Verificado visualmente (zoom) en ambos
avatares, claro y oscuro.

### Logo de Kineq → Inicio

Las dos versiones (`sidebar-logo` desktop, `mobile-brand` mobile) eran
`<div>`/`<strong>` puramente decorativos. Se les agregó `role="button"`,
`tabIndex`, soporte de teclado (Enter/Space) y `onClick` a `setActivePage('home')`.

### Pasada mobile (breakpoint existente de 820px, sin agregar uno nuevo)

- Antecedentes: nombre largo + 3 íconos ya no arriesgan romper la fila —
  en mobile colapsan a un único "⋮" que abre el mismo `.context-menu`
  reutilizado del resto de la app.
- Toolbar de Evoluciones: nuevo par reusable `.label-full`/`.label-compact`
  para "Por fecha"/"Por grupo" y Filtro icon-only, más `flex-wrap: nowrap`
  para que entre todo en una fila sin scroll horizontal. Las cards de
  Evoluciones y el detalle expandido con rich text ya andaban bien en
  mobile (comparten el CSS de fallback a cards de `.turnos-table` vía la
  clase doble `"turnos-table evolution-table"`) — verificado, sin cambios.
- Pacientes: mismo patrón de label compacto para Filtro/Ordenar
  (icon-only), buscador gana el ancho liberado y ya muestra el
  placeholder completo.
- "Editar turno": mismo nowrap + ancho igual entre botones, más un mapa
  chico de copy compacto (solo mobile) para "En espera"/"Ausente"/"Cancelar".
- Buscadores de Configuración (Usuarios/Profesionales/Especialidades/Obras
  sociales, todos comparten `.patients-search-input`): la causa real era
  `.config-filters-row .patients-search-input { flex: 1 1 220px }`
  combinado con que ese contenedor pasa a `flex-direction: column` en
  mobile — el `220px` de flex-basis, pensado para el eje horizontal, se
  terminaba resolviendo contra el eje vertical y el input quedaba ~220px
  de alto. Un solo fix compartido para las 4 tabs.
- Sidebar "Modo oscuro": se centra solo en el breakpoint del panel mobile
  (1170px) — en desktop se mantiene alineado a la izquierda a propósito.

### Tests

Backend sin cambios (150, nada de backend se tocó esta ronda). Frontend
sin cambios (81) — todo lo de arriba es de componente/CSS, verificado con
navegador real en vez de tests nuevos. `tsc --noEmit` y `npm run build`
limpios en ambos paquetes; el único error de lint sigue siendo el mismo
preexistente de `AuthContext.tsx`.

### Verificación manual

Con Playwright: antecedentes SI/NO + catálogo; click derecho en una fila
real de Turnos con el set de acciones correcto para ASIGNADO; Turnos →
Iniciar atención → Volver → vuelve a Turnos; confirmación de Finalizar
atención en la rama "sin evolución" y en la rama nueva del camino feliz,
Cancelar no cambia nada en ninguna; click en el logo → Inicio; claro y
oscuro en las zonas tocadas; altura de los buscadores de Configuración en
Usuarios y Especialidades a 390px; acciones de "Editar turno" en una sola
fila a 390px.

---

## Sesión: Usuario↔Profesional automático, bug de Especialidades, Paciente mínimo, altas rápidas, Diagnóstico, mobile Evoluciones, favicon

Ronda incremental de 9 puntos independientes. Una migración de Prisma,
`20260817123951_paciente_documento_unico` (aditiva — `Paciente.documento`
pasó de índice simple a `@@unique([consultorioId, documento])`, verificado
sin duplicados previos). `prisma migrate dev` detectó drift de checksum en
migraciones viejas y ofreció un `migrate reset` — se rechazó (nunca resetear
la DB) y se aplicó a mano (`prisma db execute` + `migrate resolve
--applied`); `prisma migrate status` confirma sin drift para la nueva.
Detalle técnico completo en `docs/tasks.md` (nueva sección, mismo nombre que
este título) — acá el resumen ejecutivo.

**Usuario → Profesional automático**: crear un `Usuario` `PROFESIONAL` sin
`profesionalId` explícito crea y vincula un `Profesional` solo (mismo
nombre/apellido/email), atómico (nested write de Prisma en el alta,
`$transaction` en el cambio de rol). El auto-alta en `PATCH
/api/usuarios/:id` solo dispara en la transición real hacia `PROFESIONAL`
dentro del mismo request — no en cualquier PATCH de un usuario que ya era
`PROFESIONAL`, porque eso hubiera revertido solo una desvinculación manual
explícita (se detectó con un test existente que empezó a fallar). Cambiar de
rol **desde** `PROFESIONAL` nunca toca el vínculo existente.
`ProfesionalFormModal.tsx` ahora muestra "Usuario vinculado" también en el
alta (antes solo edición); `POST /api/profesionales` acepta `usuarioId`.

**Bug real corregido — "Esta especialidad no pertenece al consultorio"**:
`POST`/`PATCH /api/profesionales` y `POST`/`PATCH /api/turnos` validaban con
`especialidad.consultorioId === consultorioId`, que excluye a las
especialidades globales/default (`consultorioId: null`) aunque sean
exactamente las que el propio backend ofrece como seleccionables.
Centralizado en `especialidadesInvalidasParaConsultorio()`
(`backend/src/app.ts`), usado por las cuatro rutas. `PATCH /api/turnos/:id`
ni siquiera validaba `especialidadId` al cambiarlo — ahora también.

**Paciente: solo Nombre y Apellido obligatorios**: el schema ya tenía todo
lo demás nullable y el backend ya normalizaba `documento || null` — el gap
real era una validación extra solo en el frontend, en el alta. Se sacó. Se
agregó lo que sí faltaba de verdad: unicidad real de `documento` por
consultorio (antes solo un índice) + `409` legible en vez de `500`.

**Alta rápida de Paciente desde Turno** y **alta rápida de Diagnóstico desde
Nueva evolución**: mismo patrón visual que "+ Nueva Especialidad" ya
existente — botón de ancho completo en el dropdown/selector, mini
formulario inline, selección automática al crear, sin resetear el resto del
formulario. Diagnóstico además asigna color automático (rotación sobre
`SPECIALTY_COLOR_TOKENS`) para no exigir elegir color en el alta rápida.

**"Grupo" de Evoluciones → "Diagnóstico"**: cambio de copy únicamente — el
modelo (`GrupoEvolucion`, `grupoId`) y los nombres internos de componentes
no se tocaron (ya tenía `pacienteId` propio, sin necesidad de migración). La
gestión completa (crear con color a mano, editar, eliminar) sigue igual.

**Evoluciones mobile**: layout en CSS Grid *scoped a `.evolution-table`*
(no toca otras tablas) — fecha+acciones comparten la fila de arriba,
Profesional/Diagnóstico/Resumen se apilan a ancho completo con su etiqueta
arriba. Verificado con Playwright a 390/414/430px. Gap preexistente
encontrado y **no corregido** (fuera de alcance, afecta toda la página, no
solo Evoluciones): `.patient-detail-page` tiene un overflow horizontal de
~30-45px reproducible también en Ficha inicial — ver `docs/tasks.md` →
"Known gaps".

**Favicon**: `frontend/public/favicon.svg` no usaba el branding real de
Kineq (era un mark abstracto sin relación) — reemplazado por el isotipo
real (`Kineq Isologo.svg`, el mismo que `KineqIsologo.tsx` ya usa en
sidebar/boot screen).

### Tests

Backend: 19 tests nuevos en `app.test.ts`. Suite completa: 169 (antes 150).
Frontend: sigue en 81 (mismo criterio de rondas anteriores — sin
infraestructura de test de componentes, verificado con navegador real).
`tsc -b`/`npm run build` limpios en ambos paquetes; el único error de lint
sigue siendo el mismo preexistente de `AuthContext.tsx`.

### Verificación manual

Playwright (Chromium en el scratchpad de la sesión) contra los dos dev
servers reales, con captura de las respuestas de red además de aserciones
de DOM — necesario porque `ClinicalTabs` mantiene **todos** los paneles
montados en el DOM (solo `hidden`), lo que puede hacer que un
`getByText(...).first()` resuelva a un campo homónimo de otra tab oculta y
reporte "no visible" aunque el real esté perfectamente visible; se resolvió
acotando cada selector al `.modal-card`/`#tabpanel-*` correspondiente y
leyendo directamente el body de las respuestas `POST` en los flujos más
finos. Cubierto: alta de Usuario PROFESIONAL → Profesional auto-creado
visible tras recargar; alta de Profesional con Usuario vinculado +
especialidad global sin error; alta de Paciente solo con nombre/apellido;
"+ Agregar paciente" desde Nuevo turno con selección automática; login como
el profesional auto-vinculado y "+ Agregar diagnóstico" desde Nueva
evolución con color automático y contenido intacto; sin copy "Grupo" viejo
en Evoluciones; capturas mobile a 390/414/430px; favicon sirviendo el
isotipo real.

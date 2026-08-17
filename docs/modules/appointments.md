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

**Actualización (ver "Autoría clínica, vínculo Usuario–Profesional y permisos" en `docs/tasks.md`)**: los cuatro roles (`ADMINISTRADOR`, `PROFESIONAL`, `RECEPCION`, `SUPERVISOR`) pueden crear y editar turnos del propio consultorio — antes `PROFESIONAL` no podía crear y `SUPERVISOR` no podía ni crear ni editar. La regla "un `PROFESIONAL` solo edita sus propios turnos" sigue vigente, sin cambios. En la tabla de Turnos (`TurnosPage.tsx`), hacer click en una fila **siempre** abre la pantalla de paciente/atención (antes solo pasaba para turnos `Atendiendo`; el resto de los estados abría directamente el modal de edición) — nunca cambia el estado del turno ni inicia atención. Editar el turno ahora es una acción separada: el ícono de lápiz en cada fila, con su propio `stopPropagation()` para no disparar también la navegación de la fila.

**Actualización (permisos de creación/edición por rol, ajustes generales)**:
- Un usuario `PROFESIONAL` solo puede crear turnos para sí mismo: el campo Profesional no se muestra en el formulario y el backend ignora cualquier `profesionalId` recibido del cliente, tomando siempre el profesional vinculado a la sesión (`POST /api/turnos`, `backend/src/app.ts`). Si no tiene un profesional vinculado y activo, la creación se rechaza con 403 y el mensaje "Tu usuario no está vinculado a un profesional activo...".
- Al editar (`PATCH /api/turnos/:id`), un `PROFESIONAL` puede modificar únicamente turnos cuyo `profesionalId` coincida con el suyo, y no puede reasignarlos a otro profesional: `profesionalId` queda fuera de los campos editables para ese rol (antes solo se validaba el profesional *original* del turno, no el nuevo valor enviado en el mismo PATCH). `RECEPCION`, `SUPERVISOR` y `ADMINISTRADOR` pueden crear y reasignar cualquier turno del consultorio sin restricción.
- En la UI, el lápiz de "Editar turno" queda deshabilitado (con tooltip "Solo podés editar tus propios turnos") cuando un `PROFESIONAL` abre el detalle de un turno ajeno; la lectura sigue permitida.

**Actualización (implementado) — alta rápida de Paciente desde Crear/Editar Turno**: el selector de Paciente de `TurnoFormFields` (`frontend/src/components/FormFields.tsx`) tiene, al final del dropdown, un botón de ancho completo "+ Agregar paciente" (mismo patrón visual que "+ Nueva Especialidad"). Abre un mini formulario inline con Nombre y Apellido obligatorios, Documento y Teléfono opcionales; al guardar (`POST /api/pacientes`, mismos roles que ya podían crear turnos — ver `ADMIN_DATA_ROLES`), el paciente se agrega al listado ya cargado y queda seleccionado automáticamente, sin resetear fecha/hora/profesional/especialidad/duración/notas ya cargados en el formulario de turno. Si el documento ingresado ya existe en el consultorio, el backend responde `409` (ver `docs/modules/patients.md`) y el mensaje se muestra dentro del mini formulario sin cerrar el modal de turno.

**Actualización (implementado) — bug de especialidad "no pertenece al consultorio" corregido**: `POST`/`PATCH /api/turnos` validaban la especialidad con `especialidad.consultorioId === consultorioId`, lo que rechazaba las especialidades globales/default (`consultorioId: null`) aunque el propio backend las ofreciera como seleccionables. Ambas rutas ahora usan el helper centralizado `especialidadesInvalidasParaConsultorio()` (`backend/src/app.ts`, mismo que usa Profesionales — ver `docs/modules/specialties.md`), que acepta global-visible o custom-propia y excluye global-oculta/custom-de-otro-consultorio/inactiva. `PATCH /api/turnos/:id` antes ni siquiera validaba `especialidadId` al cambiarlo — ahora sí, cerrando ese hueco.

La pantalla de Turnos actualmente muestra una tabla con turnos visibles, filtros y estados.

La pantalla de Inicio funciona como una vista rápida del día, mostrando el calendario diario y el detalle del turno seleccionado.

---

## Entidades relacionadas

El módulo de Turnos se relaciona principalmente con:

- `Turno`
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

### Duración del turno

La duración del turno debe ser configurable.

En el futuro, esta configuración debería estar disponible desde la pestaña Configuración.

Inicialmente, la duración default puede estar definida a nivel consultorio.

No se debe asumir que todos los turnos duran lo mismo de manera fija.

### Número de sesión

El número de sesión debería calcularse automáticamente en base al historial del paciente.

Sin embargo, no debe ser restrictivo.

El usuario debe poder modificar manualmente el número de sesión en caso de ser necesario.

### Obra social

La obra social debe copiarse desde el paciente.

La obra social es un dato propio del paciente, no del turno.

Por ahora no se contempla cambiar la obra social en un turno puntual.

### Cancelación

Cuando un turno se cancela, el horario queda disponible.

### Ausente

Cuando un turno se marca como ausente, cuenta como sesión consumida.

Esto se diferencia de una cancelación o reprogramación.

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

La UI de crear y modificar turno existe, pero debe mejorarse visualmente porque actualmente se percibe básica.

---

## Pendientes / mejoras futuras

Pendientes importantes:

- Mejorar UI de creación de turno.
- Mejorar UI de edición de turno.
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
# Módulo: Profesionales

## Objetivo del módulo

El módulo de Profesionales permite registrar, consultar y administrar los kinesiólogos o terapeutas que trabajan dentro de un consultorio, centro o institución.

En Kineq, un profesional representa a una persona que atiende pacientes, tiene turnos asignados, puede cargar evoluciones clínicas y participa del flujo de atención.

El profesional es una entidad central para la agenda, la historia clínica, los turnos, las especialidades y los permisos del sistema.

---

## Estado actual

Actualmente el sistema ya cuenta con una entidad `Profesional`.

El modelo actual de profesional incluye campos como:

- Nombre.
- Apellido.
- Título.
- Matrícula.
- Email.
- Teléfono.
- Estado activo/inactivo.
- Especialidades asociadas.

También existe una relación entre profesionales y especialidades mediante una relación muchos a muchos.

Esto permite que un profesional pueda tener varias especialidades y que una especialidad pueda estar asociada a varios profesionales.

**Vínculo con Usuario (ya implementado, ver `docs/tasks.md` → "Autoría clínica, vínculo Usuario–Profesional y permisos")**: un `Profesional` puede tener un `Usuario` vinculado (relación 1:1 real, `Usuario.profesionalId` es la única fuente de verdad). Se edita desde Configuración → Usuarios o desde Configuración → Profesionales (`ProfesionalFormModal.tsx`, campo "Usuario vinculado", **ahora también en el alta**, no solo en edición) — ambos formularios tocan el mismo campo, nunca hay dos copias que puedan divergir. Ese vínculo ahora es además un requisito: un usuario sin profesional vinculado no puede escribir evoluciones, ficha inicial, antecedentes, alergias, medicación ni estudios, sin importar su rol — el backend devuelve `403`.

**Actualización (implementado) — vínculo automático**: crear (o cambiar el rol de) un `Usuario` hacia `PROFESIONAL` sin elegir un `Profesional` existente ya no requiere ese segundo paso administrativo — se crea y vincula uno automáticamente (mismo nombre/apellido/email). Detalle completo en `docs/modules/users-and-roles.md` → "Actualización (implementado) — creación automática de Profesional...".

---

## Entidades relacionadas

El módulo de Profesionales se relaciona principalmente con:

- `Profesional`
- `Consultorio`
- `Especialidad`
- `ProfesionalEspecialidad`
- `Turno`
- `Paciente`
- `Evolucion`
- `Usuario` o entidad futura equivalente
- `Rol` o entidad futura equivalente

---

## Qué representa un profesional

Un profesional representa a un kinesiólogo o terapeuta que trabaja en el consultorio o centro y utiliza el sistema.

Inicialmente, un profesional debe entenderse como:

- Una persona que atiende pacientes.
- Una persona que puede tener turnos asignados.
- Una persona que puede cargar evoluciones.
- Una persona que puede consultar información clínica necesaria para la atención.
- Una persona asociada a una o varias especialidades.

---

## Profesional vs usuario del sistema

Todavía falta definir formalmente el sistema de autenticación y usuarios.

Por ahora, `Profesional` existe como entidad propia del dominio del consultorio.

A futuro, deberá definirse la relación entre `Profesional` y `Usuario`.

Opciones posibles:

1. Un profesional siempre tiene un usuario de acceso.
2. Un profesional puede existir como recurso de agenda aunque todavía no tenga usuario.
3. Un usuario puede estar vinculado a un profesional.
4. Un usuario puede tener rol profesional y además datos profesionales.

Decisión inicial recomendada:

- Mantener `Profesional` como entidad clínica/operativa.
- Crear o vincular `Usuario` más adelante cuando se implemente autenticación.
- No asumir todavía que todo profesional necesariamente tiene login.
- No reemplazar `Profesional` por `Usuario`.

Esto permite seguir usando profesionales para turnos y agenda incluso antes de tener un sistema completo de login y permisos.

---

## Datos del profesional

Los datos básicos del profesional pueden incluir:

- Nombre.
- Apellido.
- Título.
- Matrícula.
- Email.
- Teléfono.
- Estado activo/inactivo.
- Especialidades.
- Observaciones internas, si hiciera falta en el futuro.

### Nombre y apellido

Identifican al profesional dentro del sistema.

Deben mostrarse claramente en:

- Agenda.
- Turnos.
- Filtros.
- Evoluciones.
- Historia clínica.
- Reportes futuros.

### Título

Representa el título profesional o descripción visible del profesional.

Ejemplos:

- Lic. en Kinesiología.
- Kinesiólogo.
- Fisioterapeuta.
- Osteópata.
- Reeducador postural.
- Especialista en rehabilitación deportiva.

No debería ser obligatorio en el MVP.

### Matrícula

La matrícula es un dato importante en contextos de salud.

Debe poder cargarse, pero no debería ser obligatoria inicialmente.

Puede ser útil para:

- Identificación profesional.
- Informes.
- Documentación clínica.
- Futuras exportaciones o reportes.
- Posibles requisitos institucionales.

Decisión inicial:

- Permitir cargar matrícula.
- No hacerla obligatoria.
- No bloquear profesionales sin matrícula.

### Email y teléfono

El email y teléfono sirven como datos de contacto del profesional.

A futuro, el email podría usarse para:

- Invitación al sistema.
- Login.
- Notificaciones.
- Recuperación de acceso.
- Comunicaciones internas.

Por ahora no asumir que el email del profesional ya funciona como usuario de login.

---

## Estado activo/inactivo

El profesional puede estar activo o inactivo.

El objetivo es evitar eliminar profesionales que ya tienen información histórica asociada.

Reglas:

- No eliminar físicamente profesionales si tienen turnos, evoluciones o información clínica relacionada.
- Usar inactivación lógica cuando el profesional ya no trabaja en el consultorio.
- Un profesional inactivo no debería aparecer como opción principal al crear nuevos turnos.
- Un profesional inactivo debe seguir visible en registros históricos donde corresponda.

Ejemplos:

- Un turno antiguo debe seguir mostrando qué profesional atendió.
- Una evolución antigua debe seguir mostrando qué profesional la cargó.
- Los reportes históricos deberían conservar la referencia al profesional.

---

## Especialidades del profesional

Un profesional puede tener una o varias especialidades.

La relación entre profesionales y especialidades es muchos a muchos.

Ejemplos:

- Un profesional puede atender RPG y rehabilitación deportiva.
- Una especialidad como traumatología kinésica puede estar asociada a varios profesionales.
- Una especialidad puede usarse para filtrar turnos o colorear bloques de agenda.

Las especialidades son propias de cada consultorio.

A futuro, cada consultorio podría iniciar con un set de especialidades kinesiológicas default y luego modificarlas desde Configuración.

---

## Horarios de atención

Por ahora, los horarios de atención del profesional se consideran alineados con los horarios del consultorio.

No se contempla en esta etapa una configuración avanzada de disponibilidad individual por profesional.

Decisión inicial:

- Los horarios base son del consultorio.
- La disponibilidad individual avanzada del profesional queda para una etapa futura.
- No implementar licencias, vacaciones, ausencias programadas ni bloqueos complejos todavía.

A futuro podría agregarse:

- Días de atención por profesional.
- Franjas horarias.
- Bloqueos.
- Vacaciones.
- Ausencias.
- Disponibilidad por sede.
- Duración de turno por profesional.

No implementar esto sin una definición específica.

---

## Duración de turnos

La duración default del turno se define inicialmente a nivel consultorio.

No se define por profesional en esta etapa.

A futuro, si hiciera falta, podrían existir duraciones default por:

- Consultorio.
- Especialidad.
- Profesional.
- Tipo de turno.
- Sede.

Decisión inicial:

- Usar duración default a nivel consultorio.
- No agregar duración por profesional todavía.
- No hardcodear duraciones si deberían ser configurables desde Configuración más adelante.

---

## Relación con turnos

Un profesional puede tener turnos asignados.

Cada turno debe tener un profesional asociado, salvo que en el futuro se decida permitir turnos sin profesional definido.

Reglas actuales deseadas:

- Un profesional puede tener varios turnos en un día.
- Un profesional puede tener turnos superpuestos.
- No se debe bloquear la creación de turnos superpuestos.
- Se puede mostrar una advertencia visual si hay superposición, pero no impedir la acción.
- Un profesional debería poder ver sus propios turnos fácilmente.
- También puede ser útil que tenga posibilidad de ver todos los turnos del consultorio para mantener comunicación con el equipo.

---

## Mis turnos vs todos los turnos

La interfaz debería permitir una forma simple de alternar entre:

- Ver mis turnos.
- Ver todos los turnos del consultorio.

Esto es especialmente útil para profesionales.

La vista “mis turnos” permite foco operativo.

La vista “todos los turnos” permite coordinación general del equipo.

A futuro, esta visibilidad puede depender del rol y permisos del usuario.

---

## Relación con evoluciones

Un profesional puede cargar evoluciones clínicas.

Cada evolución debe estar asociada a un profesional.

Esto permite saber quién registró la información clínica.

Reglas:

- Toda evolución debe tener un profesional asociado.
- El profesional que carga la evolución debe quedar registrado.
- No se requiere firma profesional en esta etapa.
- Las evoluciones pueden editarse por ahora.
- A futuro podría agregarse auditoría de cambios clínicos.

---

## Relación con pacientes

Un profesional puede atender pacientes del consultorio.

Inicialmente, el profesional puede ver pacientes del consultorio, porque esto facilita la coordinación y evita fricción operativa.

Sin embargo, a futuro deberá definirse con más precisión qué puede ver y modificar cada rol.

Criterio inicial:

- El profesional puede consultar pacientes del consultorio.
- El profesional puede acceder a la información clínica necesaria para atender.
- El profesional puede cargar evoluciones.
- El profesional no debería modificar turnos de otros profesionales, salvo que tenga permisos adicionales.

---

## Relación con consultorio

Cada profesional debe pertenecer a un consultorio o unidad organizativa equivalente.

Este vínculo es fundamental para garantizar privacidad y aislamiento entre consultorios.

Reglas:

- Un profesional pertenece a un consultorio.
- Un consultorio puede tener muchos profesionales.
- Un profesional no debe poder acceder a información de otro consultorio.
- Los filtros y endpoints deben respetar siempre el consultorio correspondiente.

A futuro, puede evaluarse si un profesional puede pertenecer a más de un consultorio.

Esto podría pasar en casos reales, pero no debe permitir filtración de información entre consultorios.

Si un profesional trabaja en dos consultorios distintos, cada consultorio debe mantener sus pacientes, turnos e historias clínicas separados.

---

## Multi-sede

Actualmente el sistema no contempla formalmente múltiples sedes.

A futuro, un consultorio o centro podría tener varias sedes.

Esto impactaría en profesionales porque podría necesitarse definir:

- En qué sedes atiende un profesional.
- Qué turnos tiene en cada sede.
- Qué horarios tiene por sede.
- Qué pacientes atiende en cada sede.
- Qué reportes se agrupan por sede.

Decisión inicial:

- No implementar multi-sede todavía.
- Mantener la estructura preparada para evolucionar.
- Considerar multi-sede como una funcionalidad del plan `Kineq Centro` o `Kineq Institucional`.

---

## Roles y permisos relacionados

Todavía falta definir formalmente el sistema de usuarios y roles.

Como criterio inicial, los roles relacionados son:

- Administrador.
- Profesional.
- Recepción.
- Supervisor.

### Administrador

Puede crear, modificar, activar e inactivar profesionales.

Puede asignar especialidades.

Puede gestionar configuración del consultorio.

Puede ver todos los profesionales, turnos y pacientes del consultorio.

### Profesional

Puede operar dentro del sistema como usuario clínico.

Puede:

- Ver sus turnos.
- Ver todos los turnos si el sistema lo permite.
- Iniciar atención.
- Finalizar atención.
- Consultar pacientes.
- Consultar historia clínica.
- Cargar evoluciones.
- Completar ficha inicial.
- Ver documentos clínicos, si existieran.

En principio, un profesional no debería modificar turnos de otros profesionales.

### Recepción

Puede ver profesionales para asignar turnos.

Puede crear turnos para profesionales.

Puede modificar agenda según permisos.

No necesariamente debe poder modificar datos internos del profesional.

### Supervisor

Puede ver información general de profesionales y reportes.

Podría consultar métricas futuras como:

- Turnos por profesional.
- Ocupación.
- Ausencias.
- Sesiones finalizadas.
- Pacientes atendidos.
- Productividad operativa.

Los permisos exactos deben definirse más adelante.

---

## Configuración futura

La pestaña Configuración todavía no está desarrollada.

A futuro, desde Configuración deberían poder administrarse aspectos relacionados con profesionales, como:

- Alta de profesionales.
- Edición de profesionales.
- Activación/inactivación.
- Especialidades asociadas.
- Colores o preferencias visuales.
- Usuarios vinculados.
- Invitaciones por email.
- Permisos.
- Horarios de atención, si se implementan.

**Actualización (implementado) — tabla de Profesionales y eliminación segura**: la pestaña Configuración → Profesionales ya existe (`ConfiguracionProfesionales.tsx`), exclusiva de `ADMINISTRADOR` (ver `docs/modules/users-and-roles.md`). Hacer click en cualquier parte de una fila abre el mismo modal de edición que el ícono de lápiz. El botón de activar/inactivar se reemplazó por un ícono de tacho ("Eliminar profesional"):

- Si el profesional **no tiene turnos ni evoluciones** asociadas (ni fichas iniciales/estudios donde figure como responsable), se elimina **físicamente** (`DELETE /api/profesionales/:id`). Si tiene un `Usuario` vinculado, ese usuario **no se borra**: la relación se desvincula sola (`Usuario.profesionalId` pasa a `null` vía `ON DELETE SET NULL` en el esquema), preservando la cuenta.
- Si el profesional **tiene historial** (turnos y/o evoluciones), no se permite el borrado físico — el endpoint responde `409` y la UI llama en su lugar a "archivar" (ver "Inactivo vs. Eliminado" más abajo). El historial clínico nunca se toca ni se cascadea.
- El endpoint valida el conteo de relaciones bloqueantes antes de intentar el borrado (mismo patrón que Especialidades/Obras sociales), no depende de capturar el error de FK de la base de datos.
- Aislado por consultorio: un administrador no puede eliminar un profesional de otro consultorio (`404`).

### Actualización (implementado) — Inactivo vs. Eliminado

Antes, `activo:false` conflaba dos cosas distintas. Ahora hay dos estados independientes:

- **Inactivo** (`activo: false`, `deletedAt: null`): sigue siendo administrable, sigue apareciendo en Configuración con `?estado=todos` (el checkbox "Profesional activo" del formulario de edición), solo deja de estar disponible para nuevas asignaciones.
- **Eliminado/archivado** (`deletedAt` seteado — siempre implica `activo:false` también): `POST /api/profesionales/:id/archivar` (`ADMINISTRADOR`-only). Saca al profesional de `GET /api/profesionales` **siempre**, incluso con `?estado=todos` — no hay pantalla de auditoría de eliminados en esta iteración. Nunca toca turnos ni evoluciones. `DELETE /api/profesionales/:id/archivar` restaura técnicamente (vuelve a aparecer como Inactivo, no como Activo).

En la UI, el tacho de la tabla de Profesionales sigue diciendo "Eliminar": si no hay historial, hace el `DELETE` físico de siempre; si hay historial, ahora llama a `archivar` en vez de solo ofrecer "Desactivar" (que sigue disponible, pero desde el checkbox del formulario de edición).

**Autoría clínica bloqueada centralizadamente**: `requireProfesionalVinculado` (`backend/src/auth.ts`), usado por las ~19 rutas de escritura clínica (evoluciones, ficha inicial y sus sub-recursos), ahora es `async` y además de exigir que `profesionalId` no sea `null`, verifica que el profesional vinculado siga `activo` y sin `deletedAt` — un usuario vinculado a un profesional inactivo o eliminado recibe `403` al intentar registrar contenido clínico, aunque su propia cuenta de `Usuario` siga activa y pueda loguearse con normalidad.

**Autoría histórica preservada**: en las vistas donde se muestra el nombre de un profesional sobre datos ya existentes (turnos en `TurnosPage.tsx`/calendario de `App.tsx`, evoluciones en `EvolutionTable.tsx`, responsable de ficha inicial en `InitialAssessmentPanel.tsx`) se usa el helper compartido `frontend/src/utils/professional.ts` (`professionalName`), que agrega el sufijo `(Inactivo)` o `(Eliminado)` al nombre según corresponda — nunca se reemplaza por "Sin profesional" ni desaparece de la vista histórica.
- Sedes, si se implementan.
- Duración default, si se decide permitir override por profesional.

No implementar configuración avanzada sin una definición explícita.

---

## Consideraciones de UI

La interfaz de profesionales debe ser simple y clara.

No debe sentirse como un panel administrativo pesado.

Prioridades de diseño:

- Listado claro de profesionales.
- Estado activo/inactivo visible.
- Especialidades visibles.
- Acceso rápido a editar profesional.
- Alta rápida de profesional.
- Buena integración con turnos.
- Filtros simples.
- Diseño moderno y coherente con Kineq.

En formularios, evitar pedir demasiada información obligatoria.

La carga inicial de un profesional debería ser rápida.

Datos mínimos recomendados para crear un profesional:

- Nombre.
- Apellido.
- Especialidad o especialidades, si corresponde.

Datos adicionales como matrícula, email, teléfono y título pueden completarse luego.

---

## Pendientes / mejoras futuras

Pendientes importantes:

- Definir relación final entre `Profesional` y `Usuario`.
- Definir autenticación.
- Definir invitación de profesionales por email.
- Definir permisos exactos por rol.
- Definir pantalla o sección de configuración de profesionales.
- Definir si los profesionales tendrán horarios propios.
- Definir si habrá disponibilidad por sede.
- Definir si habrá duración de turno por profesional.
- Definir si habrá métricas por profesional.
- Definir si habrá vista “mis turnos” como toggle principal.
- Definir comportamiento para profesionales que trabajan en más de un consultorio.
- Definir importación o carga masiva de profesionales para centros grandes.

---

## No implementar todavía

No implementar todavía sin definición explícita:

- Login completo de profesionales.
- Invitaciones por email.
- Relación obligatoria `Profesional = Usuario`.
- Horarios individuales avanzados.
- Vacaciones.
- Licencias.
- Bloqueos de agenda.
- Multi-sede avanzado.
- Duración de turno por profesional.
- Métricas avanzadas por profesional.
- Firma profesional.
- Auditoría clínica avanzada.
- Permisos complejos por módulo.

Estos elementos forman parte de la visión futura, pero no deben mezclarse con tareas inmediatas sin una definición previa.

---

## Notas para agentes IA

Antes de modificar el módulo de profesionales, revisar:

- `backend/prisma/schema.prisma`
- Endpoints actuales de profesionales en backend.
- Relación actual entre profesionales y especialidades.
- `docs/modules/appointments.md`
- `docs/modules/clinical-history.md`
- `docs/modules/specialties.md`
- `docs/modules/users-and-roles.md`

Reglas importantes:

- No eliminar físicamente profesionales con información histórica.
- Mantener profesionales aislados por consultorio.
- No asumir que un profesional es automáticamente un usuario con login.
- No reemplazar `Profesional` por `Usuario`.
- No hacer obligatoria la matrícula en esta etapa.
- No bloquear turnos superpuestos de un profesional.
- No implementar horarios individuales avanzados sin una tarea explícita.
- No implementar vacaciones/licencias todavía.
- No permitir filtración de información entre consultorios.
- Priorizar una UI simple y rápida de usar.

El objetivo del módulo de profesionales es permitir que Kineq organice la atención clínica alrededor de los kinesiólogos del consultorio, conectando agenda, especialidades, pacientes, evoluciones y futura gestión de permisos.
# Módulo: Usuarios y Roles

## Objetivo del módulo

El módulo de Usuarios y Roles permite definir quién puede acceder al sistema, a qué consultorio pertenece, qué información puede ver y qué acciones puede realizar.

En Kineq, este módulo es fundamental porque el sistema manejará información sensible de pacientes, turnos e historia clínica.

El objetivo principal es garantizar privacidad, seguridad y separación estricta entre consultorios, sin volver el sistema demasiado complejo en etapas iniciales.

---

## Estado actual

**Esta sección quedó desactualizada — `docs/tasks.md` es la fuente de verdad, no este archivo.** En resumen: autenticación real ya existe (JWT en cookie httpOnly, `requireAuth`/`requireRole`), con los cuatro roles descriptos más abajo (`ADMINISTRADOR`, `PROFESIONAL`, `RECEPCION`, `SUPERVISOR`) ya implementados y con permisos reales en cada endpoint, no solo documentados. La relación `Usuario`↔`Profesional` **sí está implementada**: 1:1 real (`Usuario.profesionalId Int? @unique`), vinculable desde Configuración → Usuarios y desde Configuración → Profesionales (ambos formularios editan el mismo campo). Desde la ronda "Autoría clínica, vínculo Usuario–Profesional y permisos" (ver `docs/tasks.md`), tener el vínculo activo es además **obligatorio** para escribir contenido clínico (evoluciones, ficha inicial, antecedentes, alergias, medicación, estudios) — un `ADMINISTRADOR` sin profesional vinculado puede leer lo que su rol permita pero no puede escribir. Los datos administrativos de paciente y los turnos, en cambio, los pueden editar los cuatro roles por igual. El resto de esta sección (multi-sede, licencias, portal de pacientes, invitaciones por email, permisos granulares) sigue siendo visión futura no implementada — eso sí sigue vigente.

**Actualización (implementado) — foto de perfil**: cada usuario puede subir/reemplazar/quitar su propia foto (`Usuario.fotoPathname`/`fotoMimeType`, `POST`/`DELETE /api/usuarios/me/foto`) desde el lápiz sobre su avatar en el sidebar. Es la **única** superficie de autoedición que existe hoy para `Usuario` — no hay (ni había antes) una ruta para que un usuario edite otros campos propios; `PATCH /api/usuarios/:id` sigue siendo exclusivo de `ADMINISTRADOR`. La ruta de foto nunca acepta un id: siempre es "la propia" (`req.usuario!.id`), así que no hay forma de subir o ver la foto de otro usuario por esta vía. Igual que las imágenes de Evolución, el binario vive en Vercel Blob privado — ver "Archivos: Vercel Blob (implementado)" en `docs/architecture.md`.

**Actualización (implementado) — un solo campo "Nombre completo"**: `UsuarioFormModal.tsx` (alta y edición de cuentas en Configuración) y la pantalla pública de registro (`RegisterPage.tsx`, alta del primer administrador de un consultorio nuevo) ya no piden Nombre y Apellido por separado — piden un único campo "Nombre completo", mismo criterio que Paciente/Profesional. **Sin cambio de schema**: `Usuario.nombre`/`apellido` siguen existiendo como columnas separadas, el nombre completo se guarda entero en `nombre` con `apellido: ''`, sin parseo ingenuo. `POST /auth/register` (`backend/src/authRoutes.ts`) dejó de exigir `apellido` como campo requerido (antes rechazaba con 400 si venía vacío). Nuevo helper `userFullName()` (`frontend/src/utils/usuario.ts`) centraliza el armado del nombre para mostrar/precargar — reemplaza las concatenaciones sueltas `usuario.nombre + ' ' + usuario.apellido` que había en `ConfiguracionUsuarios.tsx` (listado, búsqueda, confirmaciones de activar/desactivar) y en el dropdown de "Usuario vinculado" de `ProfesionalFormModal.tsx`. Cuando un `Usuario PROFESIONAL` sin `profesionalId` crea automáticamente su `Profesional` (ver "creación automática de Profesional" más abajo), el nombre completo se copia tal cual — el `Profesional` creado también queda con `apellido: ''`. Regla transversal, documentada también en `docs/modules/patients.md` y `docs/modules/professionals.md`.

---

## Entidades relacionadas

El módulo de Usuarios y Roles se relaciona principalmente con:

- `Usuario` o entidad futura equivalente.
- `Rol` o entidad futura equivalente.
- `Consultorio`
- `Profesional`
- `Paciente`
- `Turno`
- `Evolucion`
- `Especialidad`
- `ObraSocial`
- `Sede` o entidad futura equivalente.

---

## Principio fundamental de privacidad

Kineq será utilizado por múltiples consultorios, centros e instituciones.

Cada consultorio debe operar como un espacio privado y aislado.

Un consultorio nunca debe poder ver, modificar o acceder a información de otro consultorio.

Esto aplica a:

- Pacientes.
- Turnos.
- Profesionales.
- Historias clínicas.
- Evoluciones.
- Obras sociales.
- Especialidades.
- Documentos.
- Configuraciones.
- Usuarios.
- Reportes.

Este requerimiento es fundamental y debe respetarse en toda implementación futura.

---

## Multi-consultorio

El sistema debe soportar múltiples consultorios cargados dentro de Kineq.

Cada consultorio tendrá:

- Sus propios pacientes.
- Sus propios profesionales.
- Sus propios turnos.
- Sus propias historias clínicas.
- Sus propias obras sociales.
- Sus propias especialidades.
- Sus propias configuraciones.
- Sus propias licencias.

El sistema debe evitar cualquier filtración de información entre consultorios.

Toda consulta de base de datos, endpoint o pantalla debe estar filtrada por el consultorio correspondiente.

---

## Pertenencia de usuarios a consultorios

Como regla inicial, un usuario pertenece a un consultorio.

Esto simplifica la privacidad y reduce el riesgo de filtraciones.

Puede existir el caso donde una persona trabaje en más de un consultorio, pero no debe implicar compartir información entre consultorios.

Si un usuario trabaja en más de un consultorio, deben evaluarse dos opciones:

1. Crear accesos separados por consultorio.
2. Permitir múltiples pertenencias, pero con aislamiento estricto por contexto activo.

Decisión inicial recomendada:

- Empezar con un usuario asociado a un consultorio.
- No implementar usuarios multi-consultorio todavía.
- Priorizar privacidad y simplicidad.

---

## Roles iniciales

Los roles iniciales recomendados son:

- Administrador.
- Profesional.
- Recepción.
- Supervisor.

A futuro podría existir un rol Paciente vinculado al portal de pacientes, pero no debería implementarse en esta etapa.

---

## Administrador

El Administrador es el usuario con mayor control dentro de un consultorio.

Puede gestionar configuración, usuarios, profesionales, especialidades, obras sociales y operación general.

Permisos esperados:

- Ver todos los turnos del consultorio.
- Crear turnos.
- Editar turnos.
- Cancelar turnos.
- Marcar ausentes.
- Crear pacientes.
- Editar pacientes.
- Inactivar pacientes.
- Ver profesionales.
- Crear profesionales.
- Editar profesionales.
- Inactivar profesionales.
- Crear y editar especialidades.
- Crear y editar obras sociales.
- Acceder a configuración.
- Invitar usuarios, cuando exista esa funcionalidad.
- Gestionar roles, cuando exista esa funcionalidad.

Debe definirse más adelante si el Administrador puede editar información clínica o solo verla.

**Actualización (implementado) — nunca sin administrador**: un consultorio nunca puede quedar sin al menos un `ADMINISTRADOR` activo. `PATCH /api/usuarios/:id` (`backend/src/app.ts`) rechaza con `409` cualquier desactivación o cambio de rol que dejaría al consultorio sin ningún administrador activo (`quedariaSinAdministrador`, `backend/src/auth.ts`) — un administrador puede desactivar a otro si queda al menos uno más, y puede desactivarse a sí mismo bajo la misma condición; el conteo es siempre por consultorio y solo sobre administradores activos. El frontend muestra ese `409` en un mensaje de error legible, usando el diálogo de confirmación custom ya existente en la app (nunca `confirm()` nativo).

**Actualización (implementado) — terminología**: en la tabla de Usuarios (Configuración), la acción para dar de baja una cuenta dice **"Desactivar"** (antes "Inactivar"); "Activar"/"Desactivar" es el único par de acciones para Usuarios. Profesionales, Especialidades y Obras sociales usan en cambio un ícono de tacho ("Eliminar") con eliminación física condicionada a no tener historial — ver `docs/modules/professionals.md`, `docs/modules/specialties.md` y `docs/modules/social-works.md`.

---

## Profesional

El Profesional es el usuario clínico que atiende pacientes.

Normalmente representa a un kinesiólogo o terapeuta.

Permisos esperados:

- Ver sus propios turnos.
- Ver todos los turnos del consultorio, si se permite para coordinación.
- Iniciar atención de sus turnos.
- Finalizar atención de sus turnos.
- Ver pacientes del consultorio.
- Consultar historia clínica necesaria para atender.
- Completar ficha inicial.
- Crear evoluciones.
- Editar evoluciones.
- Consultar documentos clínicos, si existieran.
- Ver sus especialidades asociadas.

Restricciones iniciales:

- No debería modificar turnos de otros profesionales.
- No debería gestionar usuarios.
- No debería gestionar configuración general.
- No debería crear o modificar obras sociales y especialidades, salvo que se le otorgue permiso adicional.
- No debería acceder a información de otros consultorios.

**Actualización (implementado) — creación automática de Profesional al crear/editar Usuario `PROFESIONAL`**: antes, un `Usuario` con rol `PROFESIONAL` sin un `Profesional` vinculado manualmente no podía recibir turnos ni cargar evoluciones hasta que un administrador completara ese vínculo en un segundo paso. Ahora:

- `POST /api/usuarios` (`backend/src/app.ts`): si el rol es `PROFESIONAL` y no se envía `profesionalId`, se crea automáticamente un `Profesional` en el mismo consultorio (copiando `nombre`/`apellido`/`email` del Usuario) y se vincula, todo en una única operación de Prisma (nested write, atómica — si falla cualquier parte, no queda ni Usuario ni Profesional huérfano). Si se envía `profesionalId` explícito, se usa ese vínculo y no se crea uno nuevo.
- `PATCH /api/usuarios/:id`: la creación automática solo dispara ante la **transición real** de rol hacia `PROFESIONAL` (de otro rol a `PROFESIONAL` en el mismo PATCH) cuando el resultado quedaría sin `profesionalId`. Un PATCH que no toca `rol` en un usuario que ya era `PROFESIONAL` nunca crea uno nuevo, aunque su `profesionalId` sea `null` — eso preserva la desvinculación manual explícita (ver más abajo) en vez de revertirla sola.
- Cambio de rol **desde** `PROFESIONAL` hacia otro rol nunca borra ni desvincula el `Profesional` — puede tener historial de turnos/evoluciones. El vínculo se conserva (`Usuario.profesionalId` sigue apuntando al mismo `Profesional`) salvo que un administrador lo desvincule explícitamente con `profesionalId: null` (acción manual ya existente, con su propia protección — ver "desvincular Usuario-Profesional" en `backend/src/app.test.ts`).
- `Usuario` y `Profesional` siguen siendo entidades distintas: puede existir un `Profesional` sin `Usuario` (sin acceso al sistema) y un `Usuario` administrativo sin `Profesional` (sin autoría clínica).

**Actualización (implementado) — vínculo también desde el alta de Profesional**: `ProfesionalFormModal.tsx` muestra el campo "Usuario vinculado" tanto en edición como en la creación (antes solo en edición). `POST /api/profesionales` acepta `usuarioId` opcional; valida que el usuario sea del mismo consultorio, esté activo y no tenga ya otro `Profesional` vinculado (`409` si no), y crea+vincula en una transacción. `usuariosDisponibles` (`ConfiguracionProfesionales.tsx`) ya filtraba a usuarios activos del consultorio sin vínculo previo — se reutiliza sin cambios para el alta.

---

## Recepción

Recepción es el usuario operativo o administrativo del consultorio.

Se encarga principalmente de agenda, pacientes y coordinación diaria.

Permisos esperados:

- Ver agenda general del consultorio.
- Crear turnos.
- Editar turnos.
- Cancelar turnos.
- Reprogramar turnos.
- Marcar check-in.
- Marcar ausente.
- Crear pacientes.
- Editar datos administrativos de pacientes.
- Cargar obra social, número de afiliado y plan.
- Consultar información básica de profesionales.
- Usar filtros de agenda.
- Ver datos de contacto del paciente.

Restricciones iniciales:

- No debería cargar evoluciones clínicas.
- No debería modificar historia clínica, salvo definición explícita.
- No debería gestionar usuarios.
- No debería modificar configuraciones sensibles.
- Su acceso a información clínica debe ser limitado o configurable.

---

## Supervisor

El Supervisor es un rol orientado a coordinación, dirección o revisión.

Puede aplicar a dueños, coordinadores, responsables de centro o responsables institucionales.

Permisos esperados:

- Ver agenda general.
- Ver pacientes del consultorio.
- Ver profesionales.
- Consultar operación general.
- Ver futuras estadísticas.
- Ver reportes.
- Monitorear productividad operativa.
- Monitorear ausentismo.
- Monitorear ocupación.

Debe definirse con cuidado si el Supervisor puede ver información clínica sensible.

El Supervisor no necesariamente debe modificar datos operativos o clínicos.

---

## Rol Paciente

A futuro podría existir un usuario o rol Paciente.

Este rol estaría relacionado con el portal público o portal de pacientes.

Posibles acciones futuras:

- Reservar turno.
- Completar datos básicos.
- Completar formularios previos.
- Cancelar turno, si el consultorio lo permite.
- Reprogramar turno, si el consultorio lo permite.
- Ver información limitada.

No implementar rol Paciente todavía.

El portal de pacientes puede comenzar como una experiencia pública con link único por consultorio, sin necesidad de login completo.

---

## Profesional vs Usuario

`Profesional` y `Usuario` no deben confundirse.

Un profesional representa a una persona que atiende pacientes.

Un usuario representa a una cuenta que puede iniciar sesión en el sistema.

A futuro, puede existir una relación entre ambos.

Posibles escenarios:

- Un profesional tiene un usuario asociado.
- Un profesional existe en la agenda, pero todavía no tiene usuario.
- Un usuario con rol profesional está vinculado a un profesional.
- Un usuario administrador no necesariamente es profesional.
- Un usuario de recepción no necesariamente es profesional.

Decisión inicial recomendada:

- Mantener `Profesional` como entidad separada.
- Crear `Usuario` como entidad de autenticación cuando corresponda.
- Relacionar usuario con profesional solo si aplica.
- No reemplazar `Profesional` por `Usuario`.

---

## Login

La opción base de login debería ser email y contraseña.

A futuro, sería deseable soportar una experiencia passwordless.

Opciones posibles:

- Email y contraseña.
- Link mágico por email.
- Código de acceso por email.
- Invitación por email.
- Recuperación de contraseña.

Decisión inicial:

- Empezar con email y contraseña cuando se implemente autenticación.
- Diseñar la estructura de forma que pueda evolucionar hacia passwordless.

---

## Invitación de usuarios

A futuro, un administrador debería poder invitar usuarios al consultorio por email.

Flujo posible:

1. El administrador ingresa el email del nuevo usuario.
2. Selecciona el rol.
3. Opcionalmente lo vincula a un profesional.
4. El sistema envía una invitación.
5. El usuario acepta la invitación.
6. Crea su acceso o ingresa mediante passwordless.
7. Queda asociado al consultorio correspondiente.

No implementar invitaciones todavía sin una tarea explícita.

---

## Permisos por rol vs permisos por módulo

Todavía no está definido si Kineq usará permisos simples por rol o un sistema más granular por módulo.

Para evitar complejidad en etapas iniciales, se recomienda empezar con permisos por rol.

Ejemplo:

- Administrador.
- Profesional.
- Recepción.
- Supervisor.

A futuro, si el producto lo necesita, se puede evolucionar a permisos más granulares.

Ejemplos de permisos granulares futuros:

- Puede ver historia clínica.
- Puede editar historia clínica.
- Puede crear turnos.
- Puede cancelar turnos.
- Puede gestionar profesionales.
- Puede gestionar configuración.
- Puede ver estadísticas.
- Puede exportar datos.
- Puede administrar usuarios.

Decisión inicial:

- Empezar con roles simples.
- No implementar permisos granulares todavía.
- Diseñar sin bloquear una evolución futura.

---

## Sedes

Actualmente el sistema no contempla formalmente múltiples sedes.

A futuro, un consultorio o centro podría tener varias sedes.

Esto puede impactar en usuarios y roles.

Ejemplos:

- Un administrador puede ver todas las sedes.
- Un supervisor puede ver una o varias sedes.
- Recepción puede operar solo una sede.
- Un profesional puede atender en una o varias sedes.
- Los turnos pueden pertenecer a una sede.
- Los reportes pueden filtrarse por sede.

No implementar multi-sede todavía sin una definición específica.

---

## Licencias y planes

Kineq tendrá múltiples consultorios cargados en el sistema, cada uno con su correspondiente licencia.

Los planes definidos conceptualmente son:

- Kineq Esencial.
- Kineq Consultorio.
- Kineq Centro.
- Kineq Institucional.

La licencia puede impactar en:

- Cantidad de profesionales.
- Cantidad de usuarios administrativos.
- Cantidad de sedes.
- Funcionalidades disponibles.
- Integraciones.
- Soporte.
- Reportes.
- WhatsApp.
- Onboarding.

No implementar lógica de licencias todavía sin una definición específica.

---

## Seguridad y privacidad

Como Kineq maneja información de salud, la seguridad debe ser prioridad.

Principios importantes:

- Autenticación segura.
- Separación estricta por consultorio.
- Control de acceso por rol.
- No exponer datos clínicos innecesariamente.
- No permitir consultas globales sin filtro de consultorio.
- No mostrar información sensible a roles no autorizados.
- Evitar eliminación física de datos clínicos.
- Preparar el sistema para auditoría futura.

---

## Historia clínica y roles

El acceso a historia clínica debe definirse con cuidado.

Criterio inicial:

- Profesional puede acceder a información clínica necesaria para atender.
- Recepción debería tener acceso limitado o configurable.
- Administrador puede tener acceso según configuración del consultorio.
- Supervisor puede tener acceso según definición futura.
- Paciente no debe tener acceso libre a toda la historia clínica.

No implementar permisos clínicos complejos todavía, pero no asumir que todos los roles pueden ver todo.

---

## Turnos y roles

Criterio inicial para turnos:

### Administrador

Puede gestionar todos los turnos.

### Recepción

Puede gestionar todos los turnos desde el punto de vista operativo.

### Profesional

Puede operar principalmente sobre sus propios turnos.

Puede iniciar y finalizar atención.

No debería modificar turnos de otros profesionales, salvo permiso especial.

### Supervisor

Puede visualizar la agenda general y reportes futuros.

Los permisos operativos deben definirse más adelante.

**Actualización (implementado)**: `RECEPCION`, `SUPERVISOR` y `ADMINISTRADOR` pueden crear, editar y reasignar cualquier turno del consultorio a cualquier profesional activo — sin necesitar un profesional vinculado. `PROFESIONAL` solo puede crear turnos para sí mismo (el campo Profesional ni se muestra en el formulario; el backend ignora/rechaza cualquier `profesionalId` distinto del propio) y solo puede editar/ver en detalle sus propios turnos, sin poder reasignarlos a otro profesional. Un `PROFESIONAL` sin vínculo activo a un `Profesional` no puede crear turnos (403, mensaje "Tu usuario no está vinculado a un profesional activo..."). Validado en backend (`backend/src/app.ts`, `POST`/`PATCH /api/turnos`) — el frontend solo refleja estas reglas en la UI, nunca es la autoridad.

---

## Configuración y roles

La pestaña Configuración todavía no está desarrollada.

A futuro, solo ciertos roles deberían acceder a Configuración.

Inicialmente:

- Administrador: acceso completo.
- Supervisor: posible acceso parcial o solo lectura.
- Recepción: acceso limitado o sin acceso.
- Profesional: acceso limitado o sin acceso.

**Actualización (implementado)**: la pestaña Configuración (`ConfiguracionPage.tsx`, con las subsecciones General, Usuarios, Profesionales, Especialidades y Obras sociales) ya está desarrollada y es **exclusiva de `ADMINISTRADOR`**: el ítem de navegación está oculto para el resto de los roles, y todos los endpoints de escritura (`POST`/`PATCH`/`DELETE` de usuarios, profesionales, especialidades, obras sociales y datos generales del consultorio) devuelven `403` para `PROFESIONAL`, `RECEPCION` y `SUPERVISOR` — el backend es la autoridad, no el ocultamiento del menú. Los listados (`GET`) siguen abiertos a cualquier rol autenticado porque también los consumen otras pantallas (por ejemplo, los selectores de profesional/obra social al crear un turno o paciente).

Configuraciones futuras:

- Profesionales.
- Especialidades.
- Obras sociales.
- Duración default de turnos.
- Zona horaria.
- Colores.
- Sedes.
- Usuarios.
- Roles.
- Link público de reserva.
- Plantillas de evolución.

---

## Portal público de pacientes

Kineq debería permitir que los pacientes reserven turnos desde una página pública o portal.

Cada consultorio debería tener un link único para compartir.

Este portal debe estar conectado únicamente al consultorio correspondiente.

Flujo posible:

1. El paciente ingresa al link público del consultorio.
2. Selecciona especialidad o profesional.
3. Elige fecha y horario disponible.
4. Completa datos básicos.
5. Confirma la reserva.
6. El turno se crea en la agenda interna del consultorio.

No implementar portal todavía sin una definición explícita.

No permitir que el portal exponga información de otros consultorios.

---

## API, MCP y agente de IA

A futuro, Kineq podría tener:

- API propia.
- MCP.
- Agente de IA integrado.
- Acciones automatizadas dentro del sistema.

Esto podría permitir:

- Consultar agenda.
- Resumir pacientes del día.
- Buscar información clínica.
- Crear borradores de evolución.
- Detectar pacientes pendientes de seguimiento.
- Sugerir acciones administrativas.
- Facilitar tareas del sistema mediante lenguaje natural.

Estos elementos deben diseñarse con especial cuidado por la sensibilidad de los datos.

No implementar API pública, MCP ni agente de IA operativo todavía.

---

## Consideraciones de MVP

Para el MVP, no es necesario implementar todo el sistema de roles avanzado.

Pero sí es importante que el código esté preparado para evolucionar.

Criterios para el MVP:

- Mantener separación por consultorio.
- Evitar asumir acceso global.
- Evitar hardcodear reglas de permisos difíciles de cambiar.
- Documentar claramente qué acciones corresponden a cada rol.
- No mezclar profesional con usuario.
- Preparar la futura autenticación.
- Priorizar privacidad.

---

## Pendientes / mejoras futuras

Pendientes importantes:

- Definir modelo final de `Usuario`.
- Definir modelo final de `Rol`.
- Definir relación entre `Usuario` y `Profesional`.
- Definir autenticación con email y contraseña.
- Definir passwordless.
- Definir invitaciones por email.
- Definir permisos exactos por rol.
- Definir si habrá permisos granulares por módulo.
- Definir usuarios multi-consultorio o accesos separados.
- Definir multi-sede.
- Definir rol paciente o portal sin login.
- Definir permisos sobre historia clínica.
- Definir permisos sobre configuración.
- Definir lógica de licencias.
- Definir auditoría.
- Definir seguridad para API, MCP e IA.

---

## No implementar todavía

No implementar todavía sin definición explícita:

- Autenticación completa.
- Passwordless.
- Invitación de usuarios.
- Usuario multi-consultorio.
- Permisos granulares complejos.
- Multi-sede.
- Rol paciente.
- Portal de pacientes.
- Licencias.
- Facturación de licencias.
- Auditoría avanzada.
- API pública.
- MCP.
- Agente de IA operativo.
- Acceso clínico avanzado por permisos.

Estos elementos forman parte de la visión futura, pero no deben mezclarse con tareas inmediatas sin una definición previa.

---

## Notas para agentes IA

Antes de modificar usuarios, roles o permisos, revisar:

- `backend/prisma/schema.prisma`
- Estado actual de autenticación.
- Uso actual de `consultorioId`.
- Entidad `Profesional`.
- `docs/modules/appointments.md`
- `docs/modules/patients.md`
- `docs/modules/clinical-history.md`
- `docs/modules/professionals.md`
- `docs/modules/dashboard.md`

Reglas importantes:

- No permitir acceso entre consultorios.
- No asumir que un usuario puede ver datos globales.
- No confundir `Profesional` con `Usuario`.
- No reemplazar `Profesional` por `Usuario`.
- No implementar autenticación completa sin una tarea explícita.
- No implementar permisos complejos sin definición previa.
- No implementar rol paciente todavía.
- No implementar multi-sede todavía.
- Diseñar pensando en privacidad desde el inicio.
- Toda consulta futura debe respetar el consultorio activo.
- Priorizar un modelo simple que pueda evolucionar.

El objetivo del módulo de Usuarios y Roles es construir una base segura para que Kineq pueda escalar a múltiples consultorios, profesionales, centros e instituciones sin comprometer la privacidad ni la simplicidad del producto.
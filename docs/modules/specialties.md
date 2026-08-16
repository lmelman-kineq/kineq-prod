# Módulo: Especialidades

## Objetivo del módulo

El módulo de Especialidades permite organizar visualmente y funcionalmente los tipos de atención que ofrece un consultorio, centro o institución.

En Kineq, una especialidad representa una categoría de atención kinésica que puede asociarse a profesionales y turnos.

Su objetivo principal es ayudar a ordenar la agenda, facilitar filtros, identificar rápidamente el tipo de atención y mejorar la lectura visual del calendario.

---

## Estado actual

Actualmente el sistema ya cuenta con una entidad `Especialidad`.

El modelo actual de especialidad incluye campos como:

- Nombre.
- Color.
- Estado activo/inactivo.
- Consultorio asociado.

También existe una relación muchos a muchos entre profesionales y especialidades mediante la entidad `ProfesionalEspecialidad`.

Esto permite que:

- Un profesional tenga varias especialidades.
- Una especialidad esté asociada a varios profesionales.

La especialidad también se utiliza en turnos para identificar el tipo de atención.

---

## Entidades relacionadas

El módulo de Especialidades se relaciona principalmente con:

- `Especialidad`
- `Consultorio`
- `Profesional`
- `ProfesionalEspecialidad`
- `Turno`
- `Configuracion` o entidad futura equivalente

---

## Qué representa una especialidad

Una especialidad representa un tipo o categoría de atención dentro de un consultorio.

Ejemplos posibles:

- Kinesiología general.
- Rehabilitación deportiva.
- RPG.
- Traumatología.
- Neurología.
- Respiratoria.
- Postural.
- Piso pélvico.
- Osteopatía.
- Masoterapia.
- Rehabilitación postquirúrgica.
- Rehabilitación vestibular.
- Adultos mayores.
- Pediatría.

La lista exacta puede variar según el consultorio.

---

## Especialidades por consultorio

Las especialidades pertenecen a un consultorio.

No deben ser globales para todo Kineq.

Cada consultorio debe poder tener su propia lista de especialidades, sus propios nombres y sus propios colores.

Esto permite que cada centro adapte el sistema a su forma de trabajar.

Reglas:

- Una especialidad debe estar asociada a un `consultorioId`.
- Un consultorio no debe ver ni modificar especialidades de otro consultorio.
- Las especialidades deben respetar el aislamiento multi-consultorio.
- Los endpoints y pantallas deben filtrar siempre por consultorio.

**Actualización (implementado) — catálogo global + custom**: esta sección y la de "Especialidades default" de abajo describían copiar una lista inicial por consultorio; en cambio se implementó el mismo patrón que ya existía para el catálogo clínico (`CatalogoClinicoItem`): `Especialidad.consultorioId` ahora es **nullable** y hay un booleano `esSistema`. Una fila global (`esSistema: true, consultorioId: null`) es una sola fila compartida por todos los consultorios, administrada por Kineq — no una copia por consultorio. `GET /api/especialidades` devuelve la unión de las globales no ocultas por ese consultorio + las custom propias (`esSistema: false, consultorioId` del consultorio). Ningún consultorio puede editar (`PATCH`) ni borrar (`DELETE`) una fila global — ambos devuelven `403` con el mensaje "Este elemento es predeterminado de Kineq y no puede editarse. Podés ocultarlo para tu consultorio." — solo puede **ocultarla** para sí mismo: `POST /api/especialidades/:id/ocultar` crea una fila en la nueva tabla `ConsultorioEspecialidadOculta` (`consultorioId`, `especialidadId`), que no borra ni desactiva la especialidad global, solo la saca de los listados/selects de ese consultorio; `DELETE .../ocultar` la restaura. El resto de los consultorios sigue viéndola sin cambios. Las especialidades **custom** (creadas por un consultorio) siguen exactamente como antes: `POST`/`PATCH`/`DELETE` propios, `DELETE` bloqueado con `409` si tienen historial (turnos o profesionales asociados) — ver "Estado activo/inactivo" más abajo, sin cambios ahí.

---

## Especialidades default

Aunque las especialidades deben ser propias de cada consultorio, sería conveniente que cada consultorio nuevo empiece con una lista inicial de especialidades kinesiológicas default.

Esto reduce fricción en la configuración inicial.

Ejemplo de especialidades iniciales:

- Kinesiología general.
- Rehabilitación deportiva.
- Traumatología.
- RPG.
- Neurología.
- Respiratoria.
- Postural.

Estas especialidades deberían poder modificarse, desactivarse o eliminarse lógicamente según la configuración del consultorio.

No deben ser valores rígidos ni hardcodeados en la lógica del sistema.

**Actualización (implementado)**: en vez de una copia inicial por consultorio, se sembraron 5 especialidades **globales reales** (una sola fila cada una, compartida): Kinesiología general, Rehabilitación deportiva, Terapia manual, Osteopatía, Reeducación postural (`backend/src/seedCatalogosGlobales.ts`, idempotente — mismo patrón manual `findFirst`+`create`/`update` que `seedCatalogoClinico.ts`, porque `consultorioId: null` no se puede usar como parte de un `upsert` con Prisma). Los consultorios que ya tenían sus propias especialidades con nombres iguales o parecidos (por ejemplo el consultorio demo, que ya tenía "Kinesiología general" como especialidad custom) **no se tocaron ni se fusionaron** con las nuevas globales — quedan como filas custom separadas, tal como pide el criterio de "no perder historial ni convertir datos existentes en globales de golpe"; puede verse una especialidad con el mismo nombre dos veces en ese caso (una global, una custom), lo cual es el comportamiento esperado, no un bug.

---

## Uso principal de las especialidades

En esta etapa, las especialidades se usan principalmente para:

- Clasificar turnos.
- Filtrar turnos.
- Filtrar profesionales.
- Mostrar colores en la agenda.
- Ayudar a identificar visualmente bloques de atención.
- Ordenar la información del consultorio.

No se espera que, por ahora, las especialidades manejen reglas clínicas o administrativas complejas.

---

## Color de especialidad

Cada especialidad puede tener un color asociado.

Este color se utiliza principalmente en la interfaz para distinguir visualmente turnos o bloques de agenda.

Ejemplos de uso:

- Color del bloque del turno en el calendario.
- Badge de especialidad.
- Filtros visuales.
- Leyenda de agenda.

El color debe poder configurarse desde Configuración.

No hardcodear colores si deberían ser modificables por el consultorio.

---

## Relación con profesionales

La relación entre profesionales y especialidades es muchos a muchos.

Reglas:

- Un profesional puede tener varias especialidades.
- Una especialidad puede estar asociada a varios profesionales.
- Esta relación ayuda a filtrar profesionales disponibles según el tipo de atención.
- Esta relación puede ayudar al paciente a elegir profesional en el portal de reserva futuro.

Ejemplo:

Un profesional puede estar asociado a:

- Rehabilitación deportiva.
- Traumatología.
- Postural.

Y la especialidad “Rehabilitación deportiva” puede estar asociada a varios profesionales del mismo consultorio.

---

## Relación con turnos

Un turno puede tener una especialidad asociada.

La especialidad del turno ayuda a identificar qué tipo de atención se reservó.

Reglas:

- La especialidad del turno debe pertenecer al mismo consultorio.
- La especialidad debe poder seleccionarse al crear o editar un turno.
- La especialidad puede usarse para colorear el turno en la agenda.
- La especialidad puede usarse como filtro en la pantalla de turnos.
- La especialidad no define por ahora la duración del turno.

---

## Duración por especialidad

Por ahora, la duración de los turnos se define a nivel consultorio.

No se define duración default por especialidad en esta etapa.

A futuro, podría evaluarse si algunas especialidades deberían tener duraciones diferentes.

Ejemplos posibles:

- Evaluación inicial: 60 minutos.
- Sesión kinésica general: 45 minutos.
- RPG: 60 minutos.
- Control breve: 30 minutos.

Decisión inicial:

- No implementar duración por especialidad todavía.
- No asumir que la especialidad determina la duración.
- Mantener la duración default a nivel consultorio hasta nueva definición.

---

## Configuración de especialidades

A futuro, las especialidades deberían administrarse desde la pestaña Configuración.

Desde ahí, un administrador debería poder:

- Crear especialidades.
- Editar especialidades.
- Activar o inactivar especialidades.
- Asignar color.
- Asociar especialidades a profesionales.
- Ver qué profesionales pertenecen a cada especialidad.

También puede ser útil permitir crear una especialidad rápidamente desde el modal de creación o edición de turnos, siempre que el usuario tenga permisos.

---

## Creación desde turnos

Actualmente se contempla la posibilidad de crear especialidades desde el flujo de turnos.

Esto puede ser útil para reducir fricción durante la carga de agenda.

Reglas recomendadas:

- Permitir creación rápida desde el modal de turno.
- Solicitar solo nombre y color, o asignar color automático si se busca más simplicidad.
- Asociar automáticamente la especialidad al consultorio actual.
- No crear especialidades globales.
- No permitir que usuarios sin permisos creen especialidades si eso rompe la administración del consultorio.

Este comportamiento deberá ajustarse cuando existan roles y permisos reales.

---

## Estado activo/inactivo

Una especialidad puede estar activa o inactiva.

El objetivo es evitar eliminar especialidades que ya tienen turnos o profesionales asociados históricamente.

Reglas:

- No eliminar físicamente especialidades con información histórica.
- Usar inactivación lógica cuando una especialidad ya no se use.
- Una especialidad inactiva no debería aparecer como opción principal al crear nuevos turnos.
- Una especialidad inactiva debe seguir visible en registros históricos donde corresponda.

Ejemplos:

- Un turno antiguo debe seguir mostrando la especialidad que tenía.
- Un profesional histórico puede haber tenido una especialidad que luego fue desactivada.
- Los reportes futuros deberían poder conservar la información histórica.

**Actualización (implementado) — tabla de Especialidades y eliminación segura**: Configuración → Especialidades ya existe (`ConfiguracionEspecialidades.tsx`), exclusiva de `ADMINISTRADOR`. Click en la fila abre el mismo modal que el lápiz. El botón de activar/inactivar se reemplazó por un tacho ("Eliminar especialidad"):

- Sin profesionales ni turnos asociados: se elimina **físicamente** (`DELETE /api/especialidades/:id`).
- Con profesionales y/o turnos asociados: no se borra — `409` con el mensaje "Esta especialidad está asociada a profesionales o turnos. No puede eliminarse definitivamente porque forma parte del historial.". Los turnos históricos siguen mostrando el nombre y color de la especialidad sin cambios (nunca se rompe la referencia).
- Aislado por consultorio (`404` cross-consultorio).

**Actualización (implementado) — filas globales en la misma tabla**: con el catálogo global/custom (ver más arriba), las filas con `esSistema: true` muestran una etiqueta "Predeterminada" junto al nombre, el lápiz queda deshabilitado (con `title` explicando que es predeterminada) y el tacho, en vez de eliminar, la **oculta** para el consultorio actual (confirmación no destructiva: "Ocultar especialidad predeterminada — Esta especialidad dejará de estar disponible en tu consultorio, pero seguirá existiendo en Kineq."). Un checkbox "Mostrar ocultas" en el filtro permite ver las globales ocultas y restaurarlas. Las filas custom siguen exactamente el comportamiento de eliminación segura descripto arriba, sin cambios.

**Actualización (implementado) — especialidades legibles en Editar Profesional**: la checklist de especialidades de `ProfesionalFormModal.tsx` (`.config-checkbox-list`) ya no trunca los nombres con `text-overflow: ellipsis` — el texto hace wrap normal dentro de una grilla responsive (`minmax(200px, 1fr)`), con scroll vertical interno si hay muchas especialidades, sin generar scroll horizontal.

---

## Especialidades y portal de pacientes

A futuro, si Kineq incorpora un portal público de reserva de turnos, las especialidades podrían usarse para que el paciente seleccione el tipo de atención que necesita.

Desde el portal, el paciente podría:

- Elegir una especialidad.
- Ver profesionales asociados a esa especialidad.
- Ver horarios disponibles.
- Reservar un turno.

Este flujo todavía no está implementado.

No implementar portal de pacientes ni reserva por especialidad sin una definición explícita.

---

## Especialidades y UI

Las especialidades deben aportar claridad visual, no complejidad.

Prioridades de diseño:

- Nombres claros.
- Colores fáciles de distinguir.
- Badges simples.
- Filtros rápidos.
- Buena lectura en calendario.
- Buena lectura en tablas.
- Configuración sencilla.

Evitar que el usuario tenga que configurar demasiadas cosas para empezar a usar el sistema.

La idea es que un consultorio pueda comenzar con especialidades default y luego ajustarlas a su gusto.

---

## Roles y permisos relacionados

Todavía falta definir formalmente el sistema de usuarios y roles.

Como criterio inicial:

### Administrador

Puede crear, editar, activar e inactivar especialidades.

Puede asignar colores.

Puede asociar especialidades a profesionales.

### Recepción

Puede seleccionar especialidades al crear o editar turnos.

Podría crear especialidades rápidamente si el consultorio lo permite.

Este permiso debe definirse más adelante.

### Profesional

Puede filtrar turnos por especialidad.

Puede ver sus especialidades asociadas.

No necesariamente debería poder crear o modificar especialidades del consultorio.

### Supervisor

Puede ver especialidades y reportes relacionados.

Los permisos exactos deben definirse más adelante.

---

## Multi-consultorio y privacidad

Las especialidades deben estar aisladas por consultorio.

Reglas fundamentales:

- Un consultorio no puede ver especialidades de otro consultorio.
- Un consultorio no puede editar especialidades de otro consultorio.
- Un turno no puede asociarse a una especialidad de otro consultorio.
- Un profesional no puede asociarse a una especialidad de otro consultorio.
- Toda consulta de especialidades debe filtrar por `consultorioId` o unidad organizativa equivalente.

Este aislamiento es obligatorio para evitar filtraciones entre consultorios.

---

## Multi-sede

Actualmente el sistema no contempla formalmente múltiples sedes.

Por ahora, las especialidades pertenecen al consultorio en general, no a una sede específica.

A futuro, si se implementa multi-sede, podría evaluarse si:

- Todas las sedes comparten las mismas especialidades.
- Algunas especialidades solo se ofrecen en ciertas sedes.
- Algunos profesionales atienden ciertas especialidades solo en determinadas sedes.

No implementar especialidades por sede todavía sin una definición específica.

---

## Consideraciones de MVP

Para el MVP, el módulo de especialidades debería mantenerse simple.

Funcionalidades mínimas recomendadas:

- Listar especialidades del consultorio.
- Crear especialidad.
- Editar nombre.
- Editar color.
- Activar/inactivar.
- Asociar especialidades a profesionales.
- Seleccionar especialidad en turno.
- Usar color de especialidad en la agenda.
- Filtrar por especialidad.

No agregar reglas avanzadas por especialidad en esta etapa.

---

## Pendientes / mejoras futuras

Pendientes importantes:

- Definir lista inicial de especialidades default.
- Definir UI final de configuración de especialidades.
- ~~Definir si se pueden crear desde el modal de turno.~~ Implementado: `TurnoFormFields` (`frontend/src/components/FormFields.tsx`) tiene un flujo "+ Nueva Especialidad" inline, solo para ADMINISTRADOR.
- Definir permisos para crear y editar especialidades.
- ~~Mejorar selección visual de color.~~ Implementado: el selector de Especialidad del modal de turno es un combobox custom (no un `<select>` nativo) que muestra un punto de color (`.turnos-specialty-dot`) junto a cada opción y junto al valor elegido, reutilizando el mismo estilo que ya usaba la tabla de Turnos/Configuración.
- ~~Definir si habrá colores automáticos.~~ Implementado: una especialidad creada desde el flujo rápido de Turnos recibe color automático (`getSpecialtyColor()`, rotación sobre la paleta curada de `utils/specialtyColors.ts`) si no se elige uno manualmente — el usuario no ve un selector de color en ese flujo rápido.
- Definir si se podrán ordenar manualmente.
- Definir si habrá especialidades visibles u ocultas en portal público.
- Definir si especialidad impactará en reserva online.
- Definir si especialidad impactará en reportes.
- Definir si especialidad tendrá relación con tratamientos en el futuro.

---

## No implementar todavía

No implementar todavía sin definición explícita:

- Duración por especialidad.
- Reglas avanzadas de agenda por especialidad.
- Especialidades por sede.
- Portal público con selección de especialidad.
- Reportes avanzados por especialidad.
- Relación entre especialidad y tratamientos.
- Permisos complejos por especialidad.
- Especialidades globales compartidas por todos los consultorios.
- Eliminación física de especialidades con historial.

Estos elementos forman parte de la visión futura, pero no deben mezclarse con tareas inmediatas sin una definición previa.

---

## Notas para agentes IA

Antes de modificar el módulo de especialidades, revisar:

- `backend/prisma/schema.prisma`
- Endpoints actuales de especialidades en backend.
- Relación actual `ProfesionalEspecialidad`.
- Componentes actuales de creación/edición de turnos.
- `docs/modules/appointments.md`
- `docs/modules/professionals.md`
- `docs/modules/users-and-roles.md`

Reglas importantes:

- Las especialidades custom son por consultorio.
- ~~No crear especialidades globales.~~ **Actualización**: sí existen (`esSistema: true`, ver "Especialidades por consultorio" arriba) — lo que sigue prohibido es que un consultorio edite/borre una global o vea las custom de otro.
- Mantener aislamiento por consultorio.
- No bloquear el sistema por falta de especialidades configuradas.
- No hacer que la especialidad determine la duración del turno todavía.
- No eliminar físicamente especialidades con información histórica.
- No permitir asociación entre profesionales, turnos y especialidades de distintos consultorios.
- Priorizar uso visual simple: filtros, colores y badges.
- Evitar complejidad innecesaria en el MVP.

El objetivo del módulo de especialidades es mejorar la organización visual y operativa de Kineq sin convertirlo en una configuración pesada o difícil de mantener.
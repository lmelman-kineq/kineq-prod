# Módulo: Obras Sociales

## Objetivo del módulo

El módulo de Obras Sociales permite registrar, consultar y administrar las coberturas médicas asociadas a los pacientes del consultorio.

En Kineq, la obra social es principalmente un dato del paciente. Sirve para identificar bajo qué cobertura se atiende, qué plan tiene, cuál es su número de afiliado y, a futuro, si existen condiciones específicas vinculadas a autorizaciones, sesiones disponibles o documentación requerida.

El objetivo inicial del módulo es mantener simple la carga administrativa, sin introducir complejidad innecesaria en el MVP.

---

## Estado actual

Actualmente el sistema ya cuenta con una entidad `ObraSocial`.

La obra social está asociada al consultorio.

El paciente puede tener una obra social asociada y un número de afiliado.

Los turnos pueden mostrar o utilizar la obra social del paciente, pero conceptualmente la obra social pertenece al paciente, no al turno.

---

## Entidades relacionadas

El módulo de Obras Sociales se relaciona principalmente con:

- `ObraSocial`
- `Consultorio`
- `Paciente`
- `Turno`
- `PlanObraSocial` o entidad futura equivalente
- `Autorizacion` o entidad futura equivalente
- `Documento` o entidad futura equivalente

---

## Qué representa una obra social

Una obra social representa la cobertura médica, prepaga o financiador de salud asociado a un paciente.

Ejemplos posibles:

- OSDE
- Swiss Medical
- Galeno
- Medifé
- Sancor Salud
- Accord Salud
- IOMA
- PAMI
- Obra social sindical
- Particular / Sin obra social

La lista exacta puede variar según el consultorio.

Cada consultorio debe poder administrar sus propias obras sociales.

---

## Obras sociales por consultorio

Las obras sociales pertenecen a un consultorio.

No deben ser globales para todo Kineq.

Cada consultorio debe poder tener su propia lista de obras sociales, ya que no todos trabajan con las mismas coberturas.

Reglas:

- Una obra social debe estar asociada a un `consultorioId`.
- Un consultorio no debe ver obras sociales de otro consultorio.
- Un consultorio no debe modificar obras sociales de otro consultorio.
- Los endpoints y pantallas deben filtrar siempre por consultorio.

Esto es importante para mantener privacidad y evitar mezcla de configuraciones entre consultorios.

**Actualización (implementado) — catálogo global + custom**: esta regla ("no deben ser globales para todo Kineq") sigue valiendo para las obras sociales **custom** creadas por cada consultorio, pero ahora conviven con obras sociales **globales** administradas por Kineq (mismo patrón que Especialidades y que el catálogo clínico): `ObraSocial.consultorioId` es nullable, con un booleano `esSistema`. Una fila global (`esSistema: true, consultorioId: null`) es una única fila visible para todos los consultorios — no una copia por consultorio, y ningún consultorio individual puede editarla ni borrarla (ver detalle en "Estado activo/inactivo" más abajo). El aislamiento sigue intacto para las filas custom: `GET /api/obras-sociales` nunca devuelve custom de otro consultorio, y las globales ocultas por un consultorio (tabla `ConsultorioObraSocialOculta`) no afectan a los demás.

---

## Obra social del paciente

La obra social es un dato propio del paciente.

Un paciente puede tener obra social o no tenerla.

Reglas:

- La obra social no debe ser obligatoria.
- El paciente puede atenderse como particular.
- El paciente puede tener una obra social asociada.
- El paciente puede tener número de afiliado.
- El paciente puede tener un plan asociado a la obra social, si se implementa.
- La obra social del paciente debe usarse como referencia al crear turnos.

---

## Obra social y turnos

Cuando se crea un turno, la obra social debería copiarse o derivarse desde el paciente.

Por ahora, no se contempla cambiar la obra social en un turno puntual.

Reglas iniciales:

- El turno utiliza la obra social del paciente.
- Si el paciente no tiene obra social, el turno puede considerarse particular o sin cobertura.
- No permitir seleccionar una obra social distinta para un turno puntual en esta etapa.
- Si cambia la obra social del paciente, se debe definir más adelante si impacta solo en turnos nuevos o también en turnos futuros ya creados.

Decisión recomendada inicial:

- Tomar la obra social actual del paciente al crear el turno.
- Mantener simple el modelo.
- No implementar lógica compleja de cobertura por turno todavía.

---

## Paciente sin obra social

El sistema debe permitir pacientes sin obra social.

Esto puede representar:

- Atención particular.
- Paciente que no informa cobertura.
- Cobertura pendiente de cargar.
- Consultorio que no trabaja con obras sociales.

La ausencia de obra social no debe bloquear:

- Alta de paciente.
- Creación de turno.
- Carga de evolución.
- Atención clínica.

---

## Número de afiliado

El número de afiliado es un dato administrativo del paciente.

Debe poder cargarse de forma opcional.

Reglas:

- No debe ser obligatorio.
- Debe estar asociado al paciente.
- Puede mostrarse en la ficha administrativa del paciente.
- Puede mostrarse en el detalle del turno si resulta útil.
- Puede ser necesario para futuras autorizaciones o reportes.

---

## Plan de obra social

A futuro, sería útil permitir cargar planes dentro de una obra social.

Ejemplo:

- OSDE 210
- OSDE 310
- Swiss Medical SMG20
- Galeno Azul
- PAMI
- IOMA

Todavía no está definido si el plan debe ser:

1. Un campo de texto dentro del paciente.
2. Una entidad propia relacionada con `ObraSocial`.
3. Una configuración administrable desde el consultorio.

Decisión inicial recomendada:

- Para mantener simple el MVP, permitir un campo opcional de plan en el paciente.
- No crear una estructura compleja de planes hasta validar la necesidad real.
- Más adelante, si hace falta, crear una entidad específica para planes.

---

## Datos posibles de una obra social

La entidad obra social podría incluir:

- Nombre.
- Estado activo/inactivo.
- Consultorio asociado.
- Observaciones internas.
- Código interno, si se necesitara a futuro.
- Datos de contacto, si se necesitara a futuro.

Para el MVP, lo más importante es:

- Nombre.
- Estado activo/inactivo.
- Consultorio.

No agregar campos administrativos complejos todavía sin una necesidad concreta.

---

## Estado activo/inactivo

Una obra social puede estar activa o inactiva.

El objetivo es evitar eliminar obras sociales que ya están asociadas a pacientes o turnos históricos.

Reglas:

- No eliminar físicamente obras sociales con historial asociado.
- Usar inactivación lógica cuando una obra social ya no se use.
- Una obra social inactiva no debería aparecer como opción principal al crear o editar pacientes.
- Una obra social inactiva debe seguir visible en registros históricos donde corresponda.

Ejemplos:

- Un paciente histórico puede haber tenido una obra social que luego fue inactivada.
- Un turno histórico debe poder seguir mostrando la cobertura que tenía el paciente en ese momento, si el sistema almacena esa referencia.
- Reportes futuros podrían necesitar conservar esta información.

**Actualización (implementado) — tabla de Obras sociales y eliminación segura**: Configuración → Obras sociales ya existe (`ConfiguracionObrasSociales.tsx`), exclusiva de `ADMINISTRADOR`. Click en la fila abre el mismo modal que el lápiz. El botón de activar/inactivar se reemplazó por un tacho ("Eliminar obra social"):

- Sin pacientes ni turnos asociados: se elimina **físicamente** (`DELETE /api/obras-sociales/:id`).
- Asociada a pacientes y/o turnos: no se borra ni se dejan referencias inválidas — `409` con el mensaje "Esta obra social está asociada a pacientes. No puede eliminarse definitivamente porque forma parte de información histórica.". No se modifica automáticamente a los pacientes para desasociarlos.
- Aislado por consultorio (`404` cross-consultorio).

**Actualización (implementado) — filas globales en la misma tabla**: igual que en Especialidades, las obras sociales con `esSistema: true` muestran la etiqueta "Predeterminada", el lápiz queda deshabilitado y el tacho oculta (`POST /api/obras-sociales/:id/ocultar` / `DELETE .../ocultar` para restaurar) en vez de eliminar. Un checkbox "Mostrar ocultas" permite verlas y restaurarlas. Las filas custom mantienen exactamente el comportamiento de eliminación segura de arriba.

---

## Autorizaciones de obra social

En kinesiología, algunas obras sociales pueden requerir autorizaciones para cierta cantidad de sesiones.

Este tema puede volverse importante más adelante, pero no debe complejizar el MVP.

Conceptos posibles a futuro:

- Cantidad de sesiones autorizadas.
- Fecha de autorización.
- Fecha de vencimiento.
- Número de autorización.
- Documento adjunto de autorización.
- Estado de autorización.
- Sesiones consumidas.
- Sesiones disponibles.
- Obra social relacionada.
- Paciente relacionado.
- Tratamiento relacionado.

Estados posibles de autorización:

- Pendiente.
- Aprobada.
- Rechazada.
- Vencida.
- Agotada.

No implementar autorizaciones todavía sin una definición funcional más clara.

---

## Sesiones autorizadas y sesiones consumidas

A futuro, si se implementan autorizaciones, Kineq podría ayudar a controlar cuántas sesiones tiene disponibles un paciente por obra social.

Ejemplo:

- La obra social autoriza 10 sesiones.
- Cada turno finalizado o ausente puede consumir una sesión.
- Un turno cancelado no consume sesión.
- El sistema muestra cuántas sesiones quedan disponibles.

Reglas alineadas con turnos:

- Un turno `FINALIZADO` podría consumir sesión.
- Un turno `AUSENTE` también podría consumir sesión.
- Un turno `CANCELADO` no debería consumir sesión.

Este flujo todavía no está implementado.

No implementar control de sesiones autorizadas todavía sin una definición específica.

---

## Documentación relacionada

A futuro, una obra social o cobertura podría requerir documentación.

Posibles documentos:

- Orden médica.
- Derivación.
- Autorización.
- Credencial.
- DNI.
- Consentimiento.
- Informe clínico.
- Estudios complementarios.

Todavía no está definido dónde deberían adjuntarse estos documentos.

Opciones posibles:

- Al paciente.
- A la obra social del paciente.
- A una autorización.
- A un tratamiento.
- A un turno.
- A la historia clínica.

Decisión inicial recomendada:

- Para el MVP, no implementar documentos específicos de obra social.
- A futuro, permitir documentos asociados al paciente y luego relacionarlos con autorizaciones o tratamientos si hace falta.

---

## Relación con historia clínica

La obra social es principalmente información administrativa.

No debe mezclarse innecesariamente con la historia clínica.

Sin embargo, puede influir en el seguimiento del tratamiento si existen autorizaciones, sesiones aprobadas o documentación requerida.

Reglas:

- La historia clínica no debe depender de que el paciente tenga obra social.
- La carga de evoluciones no debe bloquearse por falta de obra social.
- La atención clínica debe poder registrarse aunque el paciente sea particular.
- Las autorizaciones, si se implementan, deben ser un flujo administrativo relacionado, no el centro de la historia clínica.

---

## Relación con alta del paciente

La obra social no define por sí sola el alta clínica del paciente.

El alta clínica depende del proceso de tratamiento, evolución y criterio profesional.

A futuro, si hay autorizaciones, el sistema podría mostrar información útil como:

- Sesiones autorizadas agotadas.
- Autorización vencida.
- Tratamiento finalizado.
- Alta clínica cargada.

Pero no debe confundirse vencimiento de autorización con alta clínica.

---

## Particular / sin cobertura

Debe contemplarse explícitamente el caso de pacientes particulares.

Opciones posibles de implementación:

1. Permitir `obraSocialId` vacío.
2. Crear una obra social especial llamada `Particular`.
3. Crear un campo separado de tipo de cobertura.

Decisión inicial recomendada:

- Permitir pacientes sin obra social.
- Evaluar más adelante si conviene tener una opción visible `Particular` para facilitar filtros y reportes.

No forzar la creación de una obra social artificial si no aporta valor inmediato.

---

## Configuración futura

La pestaña Configuración todavía no está desarrollada.

A futuro, desde Configuración deberían poder administrarse aspectos relacionados con obras sociales, como:

- Alta de obra social.
- Edición de obra social.
- Activación/inactivación.
- Planes disponibles.
- Observaciones internas.
- Reglas de autorización, si se implementan.
- Documentación requerida, si se implementa.
- Configuración de atención particular.

No implementar configuración avanzada sin una definición explícita.

---

## Roles y permisos relacionados

Todavía falta definir formalmente el sistema de usuarios y roles.

Como criterio inicial:

### Administrador

Puede crear, editar, activar e inactivar obras sociales.

Puede configurar planes, si se implementan.

Puede definir reglas administrativas futuras.

### Recepción

Puede seleccionar obra social al crear o editar pacientes.

Puede cargar número de afiliado y plan.

Puede consultar información administrativa de cobertura.

Podría gestionar autorizaciones si se implementan en el futuro.

### Profesional

Puede ver la obra social del paciente si resulta relevante para la atención.

No necesariamente debería administrar obras sociales.

No debería depender de la obra social para cargar evoluciones clínicas.

### Supervisor

Puede ver información general y reportes relacionados con coberturas, si se implementan.

Los permisos exactos deben definirse más adelante.

---

## Multi-consultorio y privacidad

Las obras sociales deben estar aisladas por consultorio.

Reglas fundamentales:

- Un consultorio no puede ver obras sociales configuradas por otro consultorio.
- Un consultorio no puede editar obras sociales de otro consultorio.
- Un paciente no puede asociarse a una obra social de otro consultorio.
- Un turno no puede usar información de cobertura de otro consultorio.
- Toda consulta de obras sociales debe filtrar por `consultorioId` o unidad organizativa equivalente.

Este aislamiento es obligatorio para evitar filtraciones entre consultorios.

---

## Multi-sede

Actualmente el sistema no contempla formalmente múltiples sedes.

Por ahora, las obras sociales pertenecen al consultorio en general, no a una sede específica.

A futuro, si se implementa multi-sede, podría evaluarse si:

- Todas las sedes comparten las mismas obras sociales.
- Algunas sedes trabajan con ciertas coberturas y otras no.
- Los reportes de cobertura deben separarse por sede.

No implementar obras sociales por sede todavía sin una definición específica.

---

## Consideraciones de UI

La interfaz de obras sociales debe ser simple.

El usuario no debería tener que completar demasiada información para cargar una cobertura.

Prioridades de diseño:

- Selección rápida de obra social en paciente.
- Posibilidad de paciente sin obra social.
- Campo claro para número de afiliado.
- Campo opcional para plan.
- Configuración sencilla de obras sociales.
- Evitar pantallas administrativas pesadas.
- Mostrar la cobertura en el detalle del paciente.
- Mostrar la cobertura en el detalle del turno si resulta útil.

La UI debe mantener la identidad de Kineq: moderna, clara y fácil de usar.

---

## Consideraciones de MVP

Para el MVP, el módulo de obras sociales debería mantenerse muy simple.

Funcionalidades mínimas recomendadas:

- Listar obras sociales del consultorio.
- Crear obra social.
- Editar obra social.
- Activar/inactivar obra social.
- Asociar obra social a paciente.
- Cargar número de afiliado en paciente.
- Permitir paciente sin obra social.
- Mostrar obra social en datos del paciente.
- Usar obra social del paciente al crear turnos.

No agregar autorizaciones, topes o reglas complejas en el MVP.

---

## Pendientes / mejoras futuras

Pendientes importantes:

- Definir si existirá campo plan como texto o entidad propia.
- Definir si existirá opción explícita `Particular`.
- Definir si se controlarán autorizaciones.
- Definir si se controlarán sesiones autorizadas.
- Definir si turnos finalizados y ausentes consumirán sesiones autorizadas.
- Definir documentación requerida por obra social.
- Definir relación entre autorizaciones, tratamientos y documentos.
- Definir reportes por obra social.
- Definir permisos finales por rol.
- Definir UI final de configuración de obras sociales.
- Definir importación de obras sociales desde plantillas o Excel.

---

## No implementar todavía

No implementar todavía sin definición explícita:

- Autorizaciones de obra social.
- Control de sesiones autorizadas.
- Planes como entidad compleja.
- Documentación obligatoria por cobertura.
- Validaciones estrictas por obra social.
- Facturación.
- Liquidaciones.
- Reportes avanzados por cobertura.
- Integraciones con obras sociales.
- Obras sociales por sede.
- Reglas automáticas de consumo de sesiones.
- Bloqueos de atención por cobertura.

Estos elementos forman parte de la visión futura, pero no deben mezclarse con tareas inmediatas sin una definición previa.

---

## Notas para agentes IA

Antes de modificar el módulo de obras sociales, revisar:

- `backend/prisma/schema.prisma`
- Endpoints actuales de obras sociales en backend.
- Formulario actual de pacientes.
- Formulario actual de turnos.
- `docs/modules/patients.md`
- `docs/modules/appointments.md`
- `docs/modules/clinical-history.md`
- `docs/modules/users-and-roles.md`

Reglas importantes:

- La obra social pertenece al paciente.
- La obra social no debe ser obligatoria.
- El paciente puede no tener obra social.
- No cambiar obra social por turno en esta etapa.
- No implementar autorizaciones sin una tarea explícita.
- No implementar control de sesiones autorizadas todavía.
- Mantener aislamiento por consultorio.
- ~~No crear obras sociales globales.~~ **Actualización**: sí existen ahora (`esSistema: true`, ver arriba) — lo que sigue sin poder pasar es que un consultorio cree o edite una fila global, o que una obra social custom de un consultorio sea visible para otro.
- No eliminar físicamente obras sociales con historial.
- No bloquear la atención clínica por falta de obra social.
- Priorizar una UI simple y administrativa, sin complejidad innecesaria.

El objetivo del módulo de obras sociales es cubrir las necesidades administrativas básicas de cobertura del paciente, dejando preparada la evolución futura hacia planes, autorizaciones y control de sesiones si el producto lo requiere.
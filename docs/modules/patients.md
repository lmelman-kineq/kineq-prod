# Módulo: Pacientes

## Objetivo del módulo

El módulo de Pacientes permite registrar, consultar y mantener la información administrativa y clínica base de cada paciente del consultorio.

En Kineq, el paciente es una entidad central del sistema. A partir del paciente se conectan los turnos, la historia clínica, la ficha inicial, las evoluciones, los tratamientos, los documentos y el seguimiento general.

El objetivo del módulo no es solo guardar datos personales, sino facilitar el trabajo diario del consultorio y permitir que el profesional tenga una visión clara y ordenada del paciente antes, durante y después de cada sesión.

---

## Estado actual

Actualmente el sistema ya cuenta con una base inicial para pacientes.

El modelo actual de paciente incluye campos como:

- Nombre.
- Apellido.
- Documento.
- Fecha de nacimiento.
- Email.
- Teléfono.
- Dirección.
- Obra social.
- Número de afiliado.
- Observaciones.
- Estado activo/inactivo a nivel registro.

También existe una pantalla de Pacientes desarrollada inicialmente.

Esta base es válida como punto de partida, pero debe evolucionar para soportar mejor el flujo clínico y administrativo de Kineq.

---

## Entidades relacionadas

El módulo de Pacientes se relaciona principalmente con:

- `Paciente`
- `Consultorio`
- `ObraSocial`
- `Turno`
- `Evolucion`
- `Profesional`
- `HistoriaClinica` o entidad equivalente futura
- `FichaInicial` o entidad equivalente futura
- `Documento` o entidad equivalente futura
- `Tratamiento` o entidad equivalente futura

---

## Datos administrativos del paciente

Los datos administrativos son los datos básicos necesarios para identificar y contactar al paciente.

**Actualización (implementado) — editar paciente también desde Atención**: el botón "Editar paciente" (`PatientFormModal.tsx`, mismos permisos `ADMINISTRADOR`/`RECEPCION` de siempre) ya no vive solo en `PatientDetailPage.tsx` — `AttentionPage.tsx` ("Continuar atención") también lo tiene, en el header, reutilizando exactamente el mismo componente y flujo (nunca un segundo formulario). Ver `docs/modules/appointments.md` para el detalle de ubicación y permisos.

### Campos obligatorios iniciales

**Actualización (implementado)**: los únicos campos obligatorios para crear un paciente son **Nombre** y **Apellido**, tanto en frontend (`PatientFormModal.tsx`) como en backend (`POST`/`PATCH /api/pacientes`, `backend/src/app.ts`). Documento, fecha de nacimiento, teléfono, email, dirección, obra social, número de afiliado y observaciones son opcionales — el schema de Prisma (`Paciente`) ya los tenía como columnas nullable, así que no hizo falta ninguna migración para volverlos opcionales, solo sacar la validación extra que el frontend agregaba únicamente en el alta (`isCreate`). Un campo opcional vacío se guarda como `null`, nunca como `''` (ver "Documento / DNI" abajo). Esto también habilita el alta rápida de paciente desde Crear Turno (ver `docs/modules/appointments.md`), que solo pide Nombre y Apellido como obligatorios (más Documento/Teléfono opcionales).

### Campos opcionales o futuros

Además de los campos obligatorios, el paciente podría tener:

- Email.
- Sexo biológico.
- Estado civil.
- CUIL/CUIT.
- Ocupación.
- Dirección.
- Obra social.
- Número de afiliado.
- Plan de obra social.
- Observaciones administrativas.
- Número de legajo.

---

## Documento / DNI

El documento debe ser único por persona.

El sistema debería evitar la creación de pacientes duplicados con el mismo documento dentro de un mismo consultorio.

La unicidad debe aplicarse por consultorio, no de manera global entre todos los consultorios de Kineq.

Esto es importante porque Kineq será un sistema multi-consultorio y un paciente podría existir en más de un consultorio sin que esos consultorios compartan información entre sí.

Regla clave:

- Un consultorio no debe ver ni acceder a datos de pacientes cargados por otro consultorio.
- Si el mismo paciente existe en dos consultorios, deben ser registros separados y aislados.

**Actualización (implementado) — unicidad real por consultorio**: el schema tenía un índice simple (`@@index([consultorioId, documento])`), que no impedía duplicados. Se cambió a `@@unique([consultorioId, documento])` (migración `20260817123951_paciente_documento_unico`, aditiva — verificado antes de aplicarla que no existían duplicados en la base). MySQL no deduplica valores `NULL` en un índice único, así que cualquier cantidad de pacientes sin documento (el caso normal ahora que es opcional) conviven sin problema dentro del mismo consultorio; solo se rechaza un documento no nulo repetido. `POST`/`PATCH /api/pacientes` capturan la violación (`P2002`) y devuelven `409` con un mensaje claro en vez de un error genérico. El mismo documento puede repetirse sin problema entre dos consultorios distintos.

---

## Dirección

El campo dirección existe como parte de los datos del paciente.

A futuro, sería ideal que la dirección se autocomplete usando un servicio externo como Google Maps Places o una integración similar.

La dirección debería poder estructurarse en campos como:

- Calle.
- Número.
- Piso/departamento, si corresponde.
- Ciudad.
- Provincia.
- Código postal.
- País.
- Dirección completa formateada.

No implementar autocompletado de dirección todavía sin una tarea explícita.

---

## Número de legajo

El número de legajo aparece como referencia habitual en algunos sistemas de gestión clínica.

Todavía no está definido si Kineq debería usarlo.

Puede representar, según el criterio del consultorio:

- Un identificador interno del paciente.
- Un número administrativo propio del centro.
- Una forma de ordenar o buscar pacientes.
- Un código migrado desde sistemas anteriores.

Para evitar complejidad innecesaria en el MVP, el número de legajo no debería ser obligatorio.

Decisión inicial:

- Mantenerlo como campo opcional futuro.
- No usarlo como ID técnico de base de datos.
- No reemplazar el `id` interno del sistema.
- No hacerlo obligatorio hasta validar su utilidad real con usuarios.

---

## Obra social

El paciente puede tener o no tener obra social.

La obra social debe considerarse un dato propio del paciente.

Cuando se crea un turno, la obra social debería copiarse o derivarse desde el paciente.

Por ahora no se contempla que la obra social cambie en un turno puntual.

Datos relacionados posibles:

- Obra social.
- Plan.
- Número de afiliado.
- Observaciones de cobertura.

Pendiente a futuro:

- Definir si Kineq manejará autorizaciones.
- Definir si se controlarán topes de sesiones.
- Definir si habrá vencimientos o documentación asociada a cobertura.

No implementar lógica avanzada de autorizaciones de obra social sin una definición funcional más clara.

---

## Estado del registro

Actualmente el paciente cuenta con un campo `activo`.

Este campo representa si el registro está activo en la base de datos.

El objetivo es evitar eliminar pacientes de forma definitiva.

Regla:

- No eliminar pacientes físicamente si tienen información clínica, turnos o evoluciones asociadas.
- Usar baja lógica o estado inactivo cuando corresponda.

El campo `activo` no debe confundirse con el estado clínico del paciente.

**Actualización (implementado) — "Eliminar paciente" y cascada a turnos futuros**: "Eliminar paciente" (`PatientDetailPage.tsx`) sigue siendo `PATCH { activo: false }`, sin cambios de contrato. Lo nuevo, en `backend/src/app.ts` (mismo endpoint): al detectar una transición real `activo: true → false`, dentro de la misma transacción se buscan los turnos **futuros** (`inicio > ahora`) del paciente en estados no terminales (`ASIGNADO`, `EN_ESPERA`) y se pasan a `CANCELADO`, con `canceladoAt` y una nota (`"Cancelado automáticamente: paciente archivado"`, agregada al final de `notas` si ya tenía contenido) — nunca se borran. Los turnos pasados o ya terminales (`FINALIZADO`, `AUSENTE`, `CANCELADO`) no se tocan. Además, mientras el paciente esté `activo: false`, el backend rechaza (`404`, mismo criterio que "paciente no encontrado en el consultorio") la creación de turnos nuevos y de contenido clínico nuevo (evoluciones, PATCH de ficha inicial, antecedentes, alergias, medicación, estudios) para ese paciente — la **lectura** de su historial sigue funcionando sin restricciones para los roles que ya podían verla. Reactivar (`activo: true`) levanta ambos bloqueos sin ninguna acción adicional. El texto de confirmación en la UI es: "El paciente dejará de aparecer en la operación diaria. Sus turnos futuros se cancelarán y su historial clínico se conservará."

---

## Estado clínico / operativo del paciente

Además del estado técnico `activo`, Kineq debería manejar estados más específicos para representar la situación del paciente dentro del consultorio.

Estados propuestos:

- `ACTIVO`
- `EN_TRATAMIENTO`
- `PAUSADO`
- `INACTIVO`

### ACTIVO

El paciente está registrado y disponible para operar en el sistema.

Puede tener turnos, evoluciones o historial, pero no necesariamente estar en un tratamiento activo.

### EN_TRATAMIENTO

El paciente se encuentra actualmente realizando un tratamiento o proceso de atención.

Este estado debería ayudar a identificar pacientes en seguimiento.

### PAUSADO

El paciente tiene un tratamiento interrumpido temporalmente.

Puede volver a atención más adelante sin considerarse dado de baja definitivamente.

### INACTIVO

El paciente ya no está siendo atendido activamente o fue dado de baja operativamente.

No debe eliminarse su información histórica.

---

## Ficha inicial del paciente

**Implementada** — ver "Ficha Inicial — rediseño estructurado" y "Ficha Inicial — ajustes incrementales" en `docs/tasks.md` para el modelo de datos real (catálogo clínico global + personalizado por consultorio, antecedentes/alergias/medicación estructurados con flag opcional de alerta clínica, estudios en su propia pestaña general, estado de sección/ficha calculado automáticamente — no solo los campos de texto libre listados más abajo, que siguen existiendo como notas complementarias). La lista de "campos posibles" de esta sección era la referencia funcional de planificación usada para diseñar esa implementación. Escribir cualquier dato de la ficha inicial ahora requiere además que el usuario tenga un `Profesional` vinculado (ver "Autoría clínica, vínculo Usuario–Profesional y permisos" en `docs/tasks.md`) — sin vínculo, `403` aunque el rol sea `ADMINISTRADOR`.

**Datos administrativos, en cambio, ahora los editan los cuatro roles por igual** (`ADMINISTRADOR`, `PROFESIONAL`, `RECEPCION`, `SUPERVISOR`) — antes `PATCH /api/pacientes/:id` era solo `ADMINISTRADOR`+`RECEPCION`. Sigue sin requerir vínculo con `Profesional`: son datos administrativos, no contenido clínico.

**Alertas clínicas manuales extendidas a más campos**: además de Antecedentes y Medicación (flag `esAlertaClinica` por fila), ahora también se puede marcar como alerta un puñado de campos de texto libre elegibles (Motivo de consulta, Diagnóstico de derivación, Traumatismos/accidentes, Tratamientos previos, Enfermedades actuales, Dolor y síntomas, Limitaciones funcionales, Hallazgos iniciales, Observaciones clínicas, Estudios complementarios) — ver "Alertas clínicas: extensión a otros campos" en `docs/modules/clinical-history.md` para el detalle del modelo (`FichaAlertaCampo`) y los endpoints.

La ficha inicial es distinta de los datos administrativos.

Los datos administrativos sirven para identificar y contactar al paciente.

La ficha inicial sirve para registrar información clínica relevante al comenzar la atención.

La idea inicial es que el paciente primero sea dado de alta con información básica y luego, durante la primera consulta o evaluación, se complete una ficha inicial más completa.

La ficha inicial debería ser simple, clara y fácil de completar durante la sesión.

---

## Campos posibles de ficha inicial

La ficha inicial podría incluir:

- Actividad física.
- Deportes.
- Menarca.
- Menopausia.
- Partos.
- Alergias.
- Antecedentes personales.
- Enfermedades previas.
- Antecedentes familiares.
- Traumatismos o accidentes.
- Tratamientos previos.
- Estado de salud general.
- Medicación.
- Estudios complementarios.
- Observaciones clínicas iniciales.

### Alergias

Podría manejarse con opciones simples:

- Sí.
- No.
- No informa.

Si la respuesta es sí, debería poder especificarse el detalle.

### Estado de salud general

Podría manejarse con opciones simples:

- Bueno.
- Medio.
- Malo.

El nombre final de estas opciones debe revisarse para que suene profesional y adecuado al contexto clínico.

### Medicación

Podría manejarse con opciones simples:

- Sí.
- No.
- Especificar.

Si la respuesta es sí, debería poder completarse el detalle.

### Estudios complementarios

Podrían registrarse estudios como:

- RX.
- RMN.
- Laboratorio.
- Otros.

Estos estudios podrían estar relacionados con documentos adjuntos en el futuro.

---

## Historia clínica y evoluciones

La historia clínica y las evoluciones deben estar relacionadas con el paciente, pero no son exactamente lo mismo.

### Historia clínica

La historia clínica está más asociada a la información clínica base del paciente.

Puede incluir:

- Ficha inicial.
- Antecedentes.
- Diagnóstico o motivo de consulta.
- Tratamientos.
- Documentos.
- Información relevante para la atención.

### Evoluciones

Las evoluciones son registros clínicos progresivos que describen el avance del paciente a lo largo de las sesiones.

Cada evolución debe estar asociada obligatoriamente a un paciente.

Una evolución puede estar asociada a un turno, pero no debería ser obligatorio.

Esto permite cargar evoluciones o notas clínicas incluso fuera de una sesión puntual.

---

## Timeline clínico

El paciente debería tener, a futuro, una vista de timeline clínico.

La timeline permitiría ver de forma ordenada los eventos importantes del paciente.

Podría incluir:

- Alta del paciente.
- Ficha inicial completada.
- Turnos.
- Evoluciones.
- Cambios de estado.
- Documentos cargados.
- Tratamientos iniciados o finalizados.
- Ausencias.
- Cancelaciones relevantes.
- Alta clínica o cierre de tratamiento.

El objetivo de la timeline es que el profesional pueda entender rápidamente el recorrido del paciente sin navegar por demasiadas pantallas.

La UI de esta timeline todavía debe diseñarse.

Debe mantener coherencia con la identidad visual actual de Kineq: moderna, clara, simple e intuitiva.

---

## Documentos del paciente

A futuro, el paciente debería poder tener documentos adjuntos.

Posibles documentos:

- Estudios médicos.
- Imágenes.
- PDFs.
- Informes.
- Derivaciones.
- Autorizaciones.
- Consentimientos.
- Documentos administrativos.
- Documentos relacionados con tratamientos.

Todavía no está definido si los documentos se adjuntarán:

- Directamente al paciente.
- A la historia clínica.
- A una evolución.
- A un tratamiento.
- A un turno.
- A una sección específica como estudios complementarios.

Decisión inicial recomendada:

- Permitir documentos asociados al paciente como base.
- Más adelante, permitir relaciones opcionales con turnos, evoluciones o tratamientos si hace falta.

No implementar documentos clínicos todavía sin una definición funcional y técnica más clara.

---

## Alta del paciente

El alta del paciente todavía no está definida.

Debe diferenciarse entre:

- Alta administrativa del registro.
- Alta clínica del tratamiento.
- Inactivación del paciente.
- Pausa temporal del tratamiento.

Posibles datos de alta clínica:

- Fecha de alta.
- Profesional responsable.
- Motivo de alta.
- Estado final.
- Observaciones.
- Recomendaciones.
- Evolución final.
- Indicaciones para seguimiento.

No implementar el flujo de alta todavía sin una definición específica.

---

## Roles y permisos relacionados

Todavía falta definir formalmente el sistema de usuarios y roles.

Como criterio inicial:

### Administrador

Puede crear, ver, modificar e inactivar pacientes del consultorio.

Puede ver todos los pacientes del consultorio.

### Recepción

Puede crear y modificar datos administrativos del paciente.

Puede gestionar datos de contacto, obra social, número de afiliado y observaciones administrativas.

El acceso a información clínica debe definirse con cuidado.

### Profesional

Puede ver pacientes del consultorio.

Puede consultar la información clínica necesaria para la atención.

Puede cargar evoluciones, ficha inicial y datos clínicos relacionados con sus sesiones.

Se debe definir más adelante si puede modificar datos administrativos completos del paciente o solo información clínica.

### Supervisor

Puede consultar información general y reportes.

El acceso a datos clínicos sensibles debe definirse más adelante.

### Paciente

A futuro podría existir un usuario paciente o portal de paciente.

El paciente podría reservar turnos, completar datos iniciales o consultar información limitada.

No implementar rol paciente todavía sin una definición explícita.

---

## Multi-consultorio y privacidad

Kineq será utilizado por múltiples consultorios, centros e instituciones.

La privacidad entre consultorios es un requerimiento fundamental.

Cada paciente debe pertenecer a un consultorio o unidad organizativa equivalente.

Un consultorio nunca debe poder ver, modificar o acceder a pacientes de otro consultorio.

Esto aplica incluso si dos consultorios cargan a la misma persona con el mismo documento.

Reglas clave:

- Aislar pacientes por `consultorioId` o entidad equivalente.
- No buscar pacientes globalmente entre consultorios.
- No compartir historia clínica entre consultorios.
- No compartir turnos entre consultorios.
- No compartir documentos entre consultorios.
- No compartir evoluciones entre consultorios.

Toda consulta, endpoint o pantalla de pacientes debe filtrar por consultorio.

---

## Portal de pacientes

A futuro, Kineq debería permitir que los pacientes interactúen con el sistema desde una página pública o portal.

Cada consultorio debería tener un link único para compartir.

Desde ese portal, un paciente podría:

- Reservar un turno.
- Completar datos básicos.
- Actualizar información de contacto.
- Completar formularios previos.
- Cancelar o reprogramar turnos, si el consultorio lo permite.

Este portal debe estar conectado al consultorio correspondiente.

Es fundamental que el paciente no pueda acceder a información de otros consultorios ni ver datos no autorizados.

No implementar portal de pacientes todavía sin una definición funcional específica.

---

## Consideraciones de UI

La pantalla de Pacientes debe ser simple, moderna y rápida de usar.

Debe evitar sentirse como un sistema clínico antiguo, pesado o visualmente sobrecargado.

Prioridades de diseño:

- Búsqueda rápida.
- Listado claro.
- Acceso fácil a detalle del paciente.
- Separación clara entre datos administrativos y datos clínicos.
- Acciones rápidas para agendar turno.
- Acceso visible a historia clínica y evoluciones.
- Buen uso de tabs o secciones, sin sobrecargar la pantalla.
- Timeline clínico clara a futuro.
- Diseño coherente con el resto del sistema.

Posibles secciones dentro del detalle del paciente:

- Resumen.
- Datos personales.
- Obra social.
- Ficha inicial.
- Evoluciones.
- Turnos.
- Documentos.
- Tratamientos.
- Timeline.

Estas secciones no deben implementarse todas de golpe si comprometen la simplicidad del MVP.

**Actualización (implementado) — orden del listado**: `PatientsPage.tsx` tiene un botón "Ordenar" (mismo patrón visual y de interacción que el de `TurnosPage.tsx` — panel de radios, cierre por click afuera/Escape) con tres opciones: `Más recientes` (`createdAt DESC`, desempate `id DESC` — **default**), `Alfabético A–Z` y `Alfabético Z–A` (`localeCompare` con locale `es` y `sensitivity: 'base'` sobre apellido+nombre, para que tildes/mayúsculas no rompan el orden esperado, desempate `id ASC`). El orden se aplica en el cliente sobre la lista ya cargada (igual que la búsqueda y los filtros existentes — `GET /api/pacientes` no tiene paginación, trae todo el consultorio de una vez) y se combina correctamente con ambos sin resetearse al escribir.

**Actualización (implementado) — avatar con placeholder de foto**: `PatientProfileHeader.tsx` envuelve el avatar de iniciales (`PatientAvatar.tsx`) con el mismo patrón ya usado para la foto de perfil del usuario logueado (`.avatar-wrapper`/`.avatar-edit-button`/`.avatar-edit-popover` en `App.css`): un lápiz pequeño sobre el avatar abre un popover honesto — "Foto del paciente / La carga de imágenes estará disponible próximamente." — sin abrir ningún selector de archivos real ni tocar el modelo de datos.

**Actualización (implementado) — fecha de nacimiento tipeable**: el campo "Fecha de nacimiento" de `PatientFormModal.tsx` usa el nuevo componente compartido `frontend/src/components/DateInput.tsx` en vez de un `<input type="date">` nativo crudo — permite tipear `dd/mm/aaaa` a mano (con validación inline de fechas imposibles) y también sigue teniendo el ícono de calendario para elegir visualmente. El contrato con el backend no cambió: se sigue mandando `YYYY-MM-DD`. Mismo componente se usó en todos los demás campos de fecha de la app (turnos, ficha inicial, estudios, antecedentes) — ver `docs/modules/appointments.md` para el detalle de zona horaria en turnos.

---

## Pendientes / mejoras futuras

Pendientes importantes:

- Definir UI del detalle del paciente.
- Definir ficha inicial completa.
- Definir estados clínicos del paciente.
- Definir timeline clínico.
- Definir si existirá número de legajo.
- Definir autocompletado de dirección.
- Definir documentos adjuntos.
- Definir relación entre documentos, estudios y evoluciones.
- Definir alta clínica del paciente.
- Definir permisos finales por rol.
- Definir portal de pacientes.
- Definir formularios previos para reserva online.
- Definir importación de pacientes desde Excel u otros sistemas.
- Definir estrategia anti-duplicados por consultorio.

---

## No implementar todavía

No implementar todavía sin definición explícita:

- Portal de pacientes.
- Login de pacientes.
- Historia clínica avanzada completa.
- Documentos clínicos adjuntos.
- Autocompletado con Google Maps.
- Alta clínica.
- Autorizaciones de obra social.
- Importación masiva.
- Auditoría clínica avanzada.
- Integraciones externas.
- IA operativa sobre pacientes.
- MCP/API pública.

Estos elementos forman parte de la visión futura, pero no deben mezclarse con tareas inmediatas sin una definición previa.

---

## Notas para agentes IA

Antes de modificar el módulo de pacientes, revisar:

- `backend/prisma/schema.prisma`
- Endpoints actuales de pacientes en backend.
- Pantalla actual de pacientes en frontend.
- `docs/modules/appointments.md`
- `docs/modules/clinical-history.md`
- `docs/modules/social-works.md`
- `docs/modules/users-and-roles.md`

Reglas importantes:

- No eliminar pacientes físicamente si tienen información relacionada.
- Mantener aislamiento por consultorio.
- No buscar pacientes globalmente entre consultorios.
- No asumir que obra social es obligatoria.
- No hacer obligatorio el número de legajo.
- No mezclar datos administrativos con historia clínica sin una estructura clara.
- No implementar portal de pacientes sin una tarea explícita.
- No agregar complejidad clínica innecesaria en el MVP.
- Priorizar una UI simple, moderna y fácil de usar.
- Mantener la posibilidad de evolucionar hacia ficha inicial, timeline clínico, documentos y tratamientos.

El objetivo del módulo de pacientes es construir una base sólida para que Kineq pueda conectar agenda, atención clínica, seguimiento y operación diaria del consultorio.
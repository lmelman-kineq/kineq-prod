# Módulo: Historia Clínica

## Objetivo del módulo

El módulo de Historia Clínica permite registrar, consultar y mantener la información clínica del paciente a lo largo del tiempo.

En Kineq, la historia clínica debe funcionar como el núcleo clínico del sistema. Debe permitir que el profesional entienda rápidamente quién es el paciente, cuál es su motivo de consulta, qué antecedentes tiene, qué tratamiento está realizando y cómo viene evolucionando sesión a sesión.

La historia clínica no debe ser una pantalla pesada ni difícil de usar. El objetivo principal es que sea simple, moderna, clara y útil durante la atención.

---

## Estado actual

**Esta sección quedó desactualizada por debajo de este párrafo — `docs/tasks.md` es la fuente de verdad sobre qué está implementado hoy, no este archivo.** En resumen: `Evolucion` existe (con borrado lógico vía `activo`), y `FichaInicial` no solo existe sino que fue rediseñada con un catálogo clínico extensible (antecedentes personales/familiares/quirúrgicos, alergias y medicación estructuradas, hábitos y contexto gineco-obstétrico renombrados como "Contexto y Hábitos" en la UI, estudios complementarios movidos a su propia pestaña general "Estudios") y luego ajustada en una segunda ronda: catálogo personalizado por consultorio, estado de sección/ficha 100% automático (ya no hay selector manual), y una card "Alertas clínicas" derivada de datos explícitamente marcados (nunca diagnóstico automático). Una tercera ronda ("Autoría clínica, vínculo Usuario–Profesional y permisos") hizo la autoría de todo el contenido clínico automática y obligatoria: sale siempre del `Profesional` vinculado al usuario autenticado, nunca de un valor enviado por el cliente, y sin vínculo el backend devuelve `403` a cualquier escritura clínica (evoluciones, ficha inicial, antecedentes, alergias, medicación, estudios) aunque el rol sea `ADMINISTRADOR`. Ver "Ficha Inicial — rediseño estructurado", "Ficha Inicial — ajustes incrementales" y "Autoría clínica, vínculo Usuario–Profesional y permisos" en `docs/tasks.md` para el modelo real. El resto de esta sección (antes decía que ni la ficha inicial ni una historia clínica estructurada existían) queda como referencia de planificación temprana, no como estado real.

Una cuarta ronda agregó dos cosas: **alertas manuales sobre campos de texto libre de la Ficha Inicial** (más allá de Antecedentes/Medicación, que ya tenían su propio flag `esAlertaClinica`) vía la tabla nueva `FichaAlertaCampo` — ver sección "Alertas clínicas: extensión a otros campos" más abajo — y **grupos de evolución** (`GrupoEvolucion`) — ver "Grupos de evolución (implementado — no es `Tratamiento`)" en la sección Tratamientos. Una quinta ronda corrigió dos bugs reales de esa cuarta ronda (pérdida de contenido al marcar una alerta + guardado roto en la primera edición de una ficha nueva — ver "Bugs corregidos: pérdida de contenido y guardado roto" más abajo), completó la navegación "click en alerta → campo de origen", terminó la gestión de grupos (antes solo se podían crear, no listar/editar sin pasar por una evolución existente) y agregó formato básico (negrita/cursiva/subrayado) a Evoluciones — ver "Formato básico en Evoluciones" más abajo. Una sexta ronda (UI/UX transversal, ver `docs/tasks.md`) simplificó aún más la gestión de grupos (un único "Ver grupos", eliminar en vez de archivar), cambió la Ficha Inicial para que la tab de Antecedentes muestre **solo** los ítems marcados `SI` (los `NO` se conservan y siguen editables desde "Ver todos", pero dejan de aparecer en el listado visible), agregó menú contextual por click derecho a los turnos del listado de Turnos (reutilizando exactamente la misma lógica de acciones que el calendario de Inicio), corrigió la navegación del botón "Volver" desde Atención, y agregó una confirmación obligatoria a "Finalizar atención" en los cuatro lugares desde donde se puede disparar.

La evolución permite registrar notas clínicas asociadas a un paciente y a un profesional.

El modelo actual de evolución incluye:

- Paciente.
- Profesional.
- Turno opcional.
- Grupo opcional (`grupoId`, ver "Grupos de evolución" más abajo).
- Contenido.
- Estado activo/inactivo (borrado lógico).
- Fecha de creación.
- Fecha de actualización.

### Alertas clínicas: extensión a otros campos

Antes de esta ronda, "marcar como alerta" solo existía como un booleano (`esAlertaClinica`) en `FichaAntecedente` y `FichaMedicacion` — filas de catálogo con una columna natural donde colgar el flag. Los campos de texto libre de Ficha Inicial (Motivo de consulta, Diagnóstico de derivación, Traumatismos/accidentes, Tratamientos previos, Enfermedades actuales, Dolor y síntomas, Limitaciones funcionales, Hallazgos iniciales, Observaciones clínicas, Estudios complementarios) no tenían equivalente, porque son columnas escalares sueltas en `FichaInicial`, no filas.

Se agregó una tabla chica y aislada, sin tocar el modelo existente de Antecedentes/Medicación/Alergias:

```
FichaAlertaCampo
- id
- consultorioId
- fichaInicialId
- campo        (string, validado contra una whitelist fija — ELIGIBLE_ALERT_FIELDS en backend/src/app.ts)
- createdAt
```

La existencia de la fila **es** la alerta — no hay columna `activa`: marcar = crear (`PUT /api/pacientes/:pacienteId/ficha-inicial/alertas-campo/:campo`), desmarcar = borrar (`DELETE` misma ruta). Mismo criterio de autoría estricta que el resto de escritura clínica (`requireProfesionalVinculado`, sin excepción de rol). Una alerta significa "el profesional quiere que este dato quede destacado en futuras atenciones" — nunca "Kineq determinó que es peligroso": no hay severidad, vencimiento, acknowledgement, IA ni reglas automáticas, a propósito.

En la UI (`InitialAssessmentPanel.tsx`, `FichaEstudiosTab.tsx`), cada campo elegible tiene un botón chico junto a su label ("Marcar como alerta" / "Alerta" cuando está activa, `AlertToggleButton.tsx`). El panel de Alertas clínicas (`ClinicalAlertsDetail.tsx`) sigue agrupando Alergias / Antecedentes / Medicación como antes, más un cuarto grupo "Otras alertas" con estas — mismo lenguaje visual, sin rojo agresivo. El preview de cada una muestra el contenido real del campo de origen (truncado a ~3 líneas si es largo), no un texto genérico: `computeAlertasClinicas()` (`utils/clinicalAlerts.ts`) lo lee de la `FichaInicial` vigente en cada cómputo — nunca se persiste una copia — así que si el profesional edita el campo después de marcarlo, el preview se actualiza solo. El texto genérico ("Marcada manualmente por el profesional") queda solo como fallback para el caso borde de un campo sin contenido legible.

No cualquier campo es elegible: datos puramente administrativos (fecha de nacimiento, email, dirección) quedan afuera a propósito.

#### Bugs corregidos: pérdida de contenido y guardado roto

Encontrados con un click-through real del formulario (los tests de integración existentes nunca reproducían esto, porque mandan payloads puntuales campo por campo, no el form completo como hace el frontend):

1. **`refresh()` pisaba una edición sin guardar.** `useFichaInicial.ts` resincroniza `form` desde el servidor después de cualquier mutación (agregar antecedente, marcar/desmarcar una alerta, etc.) para que la UI refleje el cambio. El bug: si el usuario tipeaba en un campo de texto (autoguardado programado a 900ms) y, antes de que ese autoguardado terminara, marcaba una alerta (`PUT`/`DELETE` + `refresh()`), la respuesta del `GET` todavía traía el valor viejo del campo — y `refresh()` lo pisaba encima de lo recién tipeado, sin merge. Fix: `refresh()` ahora solo resincroniza `form` si no hay una edición pendiente sin guardar (`pendingRef`, un ref — no el state `pending` — para no depender del closure del render en que se disparó el handler async).
2. **El primer autoguardado de una ficha nueva rompía con "failed to save ficha inicial".** Causa real, distinta de la de arriba: `buildFichaPayload(form)` manda el form completo en cada autoguardado, incluidos los campos que mapean a un enum de Prisma (`alergiasEstado`, `medicacionEstado`, `tabaquismoEstado`, `alcoholEstado`, `sedentarismoEstado`, `menarcaEstado`, `menopausiaEstado`) — y esos campos arrancan en `''` (string vacío) hasta que se tocan. Prisma rechaza `''` para un enum (`EstadoDatoClinico` solo acepta `SI`/`NO`/`NO_INFORMA` o ausencia de valor) con un error 500 real. Pasaba en la práctica apenas se completaba el primer dato de cualquier ficha nueva. Fix en dos capas: el frontend (`buildFichaPayload`) ahora manda `null` en vez de `''` para esos campos — la corrección de raíz; el backend (`PATCH /api/pacientes/:id/ficha-inicial`) también normaliza `'' → null` para esos mismos campos como frontera de la API, nunca confiando en que el cliente lo haga bien.

Ninguno de los dos era una condición de carrera exótica — el segundo pasaba siempre, sin necesidad de ninguna concurrencia. También se blindó `upsertFichaInicial` (usada tanto por el `PATCH` principal como por `getOrCreateFichaInicial`, que corre en cada alta de antecedente/alergia/medicación/estudio/alerta) contra el caso legítimamente concurrente: dos escrituras casi simultáneas sobre una ficha que todavía no existe pueden competir por crearla (`P2002` en el unique de `pacienteId`) — ahora se reintenta como `update` puro en vez de devolver 500.

#### Navegación "click en alerta → campo de origen"

Cada alerta del popup de detalle (`ClinicalAlertsDetail.tsx`) es clickeable: cierra el popup, navega a la tab/sección correspondiente (Ficha inicial → sección de `AssessmentSectionNav`, o la tab "Estudios" para la alerta de Estudios complementarios), cambia la categoría de Antecedentes si corresponde, hace scroll hasta el campo/fila de origen y lo resalta ~1.6s (`.clinical-nav-highlight`). El "destino" nunca se adivina comparando texto — cada alerta trae su propia metadata de origen (`utils/clinicalNavTarget.ts`: `outerTab`, `section`, `categoria`, `elementId`), construida a partir de datos reales (`FichaAlergia.id`, `FichaAntecedente.catalogoItem.categoria`, `FichaMedicacion.id`, `FichaAlertaCampo.campo` vía `ELIGIBLE_ALERT_FIELDS`). Un `token` incremental en el target fuerza a los `useEffect` que escuchan la navegación a reaccionar incluso si el destino es idéntico al de la vez anterior.

#### Formato básico en Evoluciones

`Evolucion.contenido` (texto plano, sin cambios) sigue siendo el campo principal; se agregó `contenidoHtml` (nullable, `@db.Text`) para negrita/cursiva/subrayado. Editor (`RichTextEditor.tsx`): `contentEditable` + `document.execCommand('bold'|'italic'|'underline')` — deprecado pero soportado en todos los navegadores evergreen, se descartó una dependencia de RTE completa para 3 botones. Toolbar B/I/U + atajos Ctrl/Cmd+B/I/U.

**Sanitización en dos capas, nunca solo en el frontend**: el editor sanitiza con DOMPurify (`utils/richTextSanitize.ts`, allowlist `b,strong,i,em,u,p,br`, sin atributos) antes de emitir el `onChange`, pero el backend (`sanitizeRichText.ts`, `sanitize-html`, misma allowlist) vuelve a sanitizar todo antes de persistir — nunca confía en que el HTML que llegó ya esté limpio. `Evolucion.contenido` (plano) se deriva del HTML ya sanitizado en el backend cuando hay formato, para que nunca queden desincronizados entre sí.

**Compatibilidad con evoluciones anteriores**: `contenidoHtml` es `null` en todas las evoluciones existentes (columna nueva, migración aditiva) — siguen mostrándose como texto plano exactamente igual que antes (`EvolucionContent.tsx` solo renderiza HTML cuando `contenidoHtml` no es `null`). No hubo backfill ni reinterpretación del `contenido` plano existente como HTML — hacerlo hubiera sido frágil (texto viejo con `<`/`&` literales se habría interpretado mal como markup).

#### Grupos de evolución: gestión completa

La ronda anterior permitía crear grupos y asignarlos al crear/editar una evolución, pero no había forma de **editar un grupo que todavía no tenía ninguna evolución** (la única edición existente pasaba por el header de su sección en "Ver por grupo", que solo aparece si el grupo ya tiene al menos una evolución) ni un **filtro por grupo** independiente de las dos vistas. Se agregó "Ver grupos" (`GestionarGruposModal.tsx`), único punto de entrada a la gestión (crear/editar/eliminar) — reemplaza el botón suelto "+ Nuevo grupo" y el antiguo "Gestionar grupos" condicionado a que ya hubiera grupos — y un filtro (botón "Filtro", mismo componente visual que Turnos/Pacientes, no un `<select>` crudo) con "Todos los grupos" / "Sin grupo" / cada grupo, que acota tanto "Ver por fecha" como "Ver por grupo" sin afectar "Última evolución" del resumen ni el badge de la tab (esos siguen contando el total real, no el filtrado). Una ronda posterior reemplazó "archivar" por eliminar de verdad (ver más abajo).

Todavía no existe una vista clínica completa del paciente más allá de lo ya implementado (resumen clínico con alertas derivadas de datos estructurados), ni una timeline clínica, tratamientos, ni documentos clínicos reales.

---

## Entidades relacionadas

El módulo de Historia Clínica se relaciona principalmente con:

- `Paciente`
- `Profesional`
- `Turno`
- `Evolucion`
- `Consultorio`
- `Especialidad`
- `Documento` o entidad futura equivalente
- `FichaInicial` o entidad futura equivalente
- `Tratamiento` o entidad futura equivalente

---

## Diferencia entre historia clínica y evolución

En Kineq, historia clínica y evolución no deben tratarse como exactamente lo mismo.

### Historia clínica

La historia clínica representa el conjunto de información clínica del paciente.

Puede incluir:

- Ficha inicial.
- Motivo de consulta.
- Antecedentes personales.
- Antecedentes familiares.
- Antecedentes quirúrgicos.
- Alergias.
- Medicación.
- Estudios complementarios.
- Diagnósticos o problemas clínicos.
- Tratamientos.
- Documentos.
- Evoluciones.
- Alta clínica o cierre de tratamiento.

La historia clínica funciona como la vista general del estado clínico del paciente.

### Evoluciones

Las evoluciones son registros progresivos de texto que describen el avance del paciente a lo largo de sus sesiones.

Cada evolución es una entrada puntual en la historia clínica.

Una evolución debería responder a preguntas como:

- Qué se observó en la sesión.
- Qué se trabajó.
- Cómo respondió el paciente.
- Qué cambios hubo respecto a sesiones anteriores.
- Qué indicaciones se dejaron.
- Qué se debería revisar en la próxima sesión.

Las evoluciones deben ser simples de cargar y consultar.

---

## Ficha inicial

La ficha inicial es la primera carga clínica estructurada del paciente.

Debe completarse al inicio del proceso de atención, generalmente durante la primera consulta o evaluación.

La ficha inicial debe estar separada de los datos administrativos del paciente.

Los datos administrativos identifican y permiten contactar al paciente.

La ficha inicial registra información clínica relevante para la atención.

**Actualización (implementado) — acceso directo desde el resumen**: la card "Ficha inicial" del resumen del paciente (`PatientSummaryCards.tsx`) ahora es clickeable — reutiliza la misma afordancia "Ver detalle" que ya tenía la card de "Alertas clínicas" (`SummaryCard` con `onClick`) y navega directo a la tab "Ficha inicial" (`onGoToFicha`, ya existía como prop, solo faltaba conectarla en esta card puntual). No se duplicó lógica de navegación.

**Actualización (implementado) — autocomplete de antecedentes/alergias muestra todo al enfocar**: el hook compartido `frontend/src/hooks/useClinicalCatalogSearch.ts` (usado por `ClinicalAntecedentesSection.tsx` y `FichaAllergyList.tsx`) ya no recorta a los primeros 5 resultados cuando el input está vacío — muestra el catálogo completo de la categoría activa (excluyendo lo ya seleccionado), con scroll interno en el contenedor (`max-height` ya existente, sin cambios de CSS). Al escribir, sigue filtrando igual que antes con el mismo debounce.

---

## Campos posibles de ficha inicial

La ficha inicial podría incluir inicialmente:

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

### Actividad física y deportes

Debe permitir registrar si el paciente realiza actividad física o deportes.

Puede incluir:

- Tipo de actividad.
- Frecuencia.
- Intensidad.
- Observaciones relevantes.

### Menarca, menopausia y partos

Estos campos pueden ser relevantes según el caso clínico.

No deberían ser obligatorios para todos los pacientes.

Deben tratarse como campos opcionales y clínicamente contextualizados.

### Alergias

Debe permitir registrar alergias de forma simple.

Opciones sugeridas:

- Sí.
- No.
- No informa.

Si la respuesta es sí, debe poder especificarse el detalle.

### Antecedentes personales

Debe permitir registrar información relevante sobre antecedentes o enfermedades previas del paciente.

Puede ser un campo de texto libre inicialmente.

### Antecedentes familiares

Debe permitir registrar antecedentes familiares relevantes.

Puede ser un campo de texto libre inicialmente.

### Traumatismos o accidentes

Debe permitir registrar lesiones, accidentes, caídas, cirugías traumáticas u otros eventos relevantes para el tratamiento kinésico.

Puede ser un campo de texto libre inicialmente.

### Tratamientos previos

Debe permitir registrar tratamientos anteriores realizados por el paciente.

Puede incluir:

- Tratamientos kinésicos previos.
- Tratamientos médicos.
- Rehabilitaciones.
- Terapias alternativas.
- Resultados obtenidos.

### Estado de salud general

Debe permitir registrar una apreciación general del estado de salud del paciente.

Opciones iniciales posibles:

- Bueno.
- Medio.
- Malo.

Estas etiquetas deben revisarse más adelante para usar una terminología profesional y clara.

### Medicación

Debe permitir registrar si el paciente toma medicación.

Opciones sugeridas:

- Sí.
- No.
- Especificar.

Si la respuesta es sí, debe poder completarse el detalle.

### Estudios complementarios

Debe permitir registrar estudios complementarios relevantes.

Opciones posibles:

- RX.
- RMN.
- Laboratorio.
- Otros.

A futuro, estos estudios podrían vincularse con documentos adjuntos.

---

## Evoluciones clínicas

Las evoluciones son entradas clínicas de seguimiento.

Cada evolución debe estar asociada obligatoriamente a un paciente.

Cada evolución debe estar asociada a un profesional.

Una evolución puede estar asociada a un turno, pero no debería ser obligatorio.

Esto permite que el profesional pueda cargar notas clínicas fuera de una sesión puntual si fuera necesario.

---

## Contenido de una evolución

Inicialmente, una evolución puede ser un registro de texto con formato.

Debe permitir escribir de forma flexible.

A futuro, podrían existir plantillas para guiar al profesional.

Una evolución podría incluir:

- Fecha.
- Profesional.
- Turno relacionado, si corresponde.
- Texto de evolución.
- Observaciones.
- Indicaciones.
- Próximos pasos.

No hace falta que todos estos campos sean estructurados desde el inicio.

Para el MVP, puede ser suficiente una evolución con texto enriquecido, paciente, profesional y fecha.

---

## Edición de evoluciones

Las evoluciones deben poder editarse.

Esto es importante para corregir errores de carga, errores de tipeo o datos mal ingresados.

Sin embargo, como las evoluciones contienen información clínica, a futuro debería evaluarse un mecanismo de auditoría simple.

Decisión inicial:

- Permitir edición.
- No bloquear evoluciones después de guardarlas.
- No implementar firma profesional en esta etapa.
- Evaluar auditoría de cambios más adelante.

**Actualización (implementado) — espaciado del detalle expandido**: al hacer click en una fila de `EvolutionTable.tsx` para ver el texto completo, el bloque expandido (`.evolution-expanded-content`) tenía muy poca separación visual respecto de la fila y del contenido siguiente. Se agregó `margin: 10px 0` a ese bloque (además del `padding` que ya tenía) — cambio puramente de espaciado, no afecta edición ni eliminación ni el override responsive para mobile (que aplica el margen sobre un elemento distinto, `.evolution-expanded-row`, así que no se duplica).

---

## Auditoría clínica

La auditoría clínica significa registrar quién modificó información clínica, cuándo la modificó y qué cambió.

No es lo mismo que impedir la edición.

Una auditoría permite mantener trazabilidad sin bloquear al usuario.

Ejemplos de datos que podrían auditarse:

- Usuario que creó una evolución.
- Fecha y hora de creación.
- Usuario que modificó una evolución.
- Fecha y hora de modificación.
- Versión anterior del contenido.
- Motivo de modificación, si se decidiera pedirlo.

Por ahora, no implementar auditoría clínica avanzada.

Sí conviene tener en cuenta que, en el futuro, los cambios clínicos sensibles podrían requerir trazabilidad.

---

## Firma profesional

Por ahora no se requiere firma profesional.

No implementar firma digital, firma manuscrita ni bloqueo de evolución firmada en esta etapa.

---

## Plantillas de evolución

Las plantillas de evolución serían útiles para guiar a los kinesiólogos en la carga clínica.

El objetivo es ayudar sin volver rígido el sistema.

Las plantillas deberían ser simples y configurables.

A futuro, podrían cargarse desde la pestaña Configuración.

Ejemplos de estructura de plantilla:

- Motivo de consulta.
- Evaluación de la sesión.
- Tratamiento realizado.
- Respuesta del paciente.
- Indicaciones.
- Próxima sesión.

Otra plantilla posible:

- Subjetivo.
- Objetivo.
- Intervención.
- Evolución.
- Plan.

No implementar plantillas complejas todavía.

Para una primera versión, puede bastar con permitir texto enriquecido y luego sumar plantillas simples.

---

## Vista clínica durante el turno

Durante un turno en estado `ATENDIENDO`, el profesional debería tener una vista clara de atención en curso.

Esta vista debería permitir consultar y cargar información clínica sin salir del flujo del turno.

Debe incluir idealmente:

- Datos básicos del paciente.
- Timer de atención.
- Duración reservada del turno.
- Ficha inicial.
- Evoluciones anteriores.
- Nueva evolución de la sesión.
- Tratamientos.
- Documentos relacionados.
- Información administrativa relevante.

Esta pantalla debe priorizar rapidez, claridad y baja fricción.

El profesional debería poder entender rápido el contexto del paciente y registrar la evolución de la sesión con la menor cantidad de pasos posible.

---

## Timeline clínica

A futuro, la historia clínica debería poder visualizarse como una timeline.

La timeline clínica permitiría ver los eventos importantes del paciente ordenados cronológicamente.

Podría incluir:

- Fecha de alta del paciente.
- Ficha inicial.
- Turnos.
- Evoluciones.
- Cambios de estado clínico.
- Documentos cargados.
- Tratamientos iniciados.
- Tratamientos finalizados.
- Ausencias.
- Cancelaciones relevantes.
- Alta clínica.

La timeline debe ser visualmente clara y no sobrecargar al profesional.

El objetivo es que el profesional pueda entender el recorrido del paciente de un vistazo.

No implementar timeline clínica todavía sin diseño previo.

---

## Tratamientos

El concepto de tratamiento todavía no está completamente definido.

Inicialmente, el seguimiento podría funcionar con:

- Paciente.
- Turnos.
- Evoluciones.
- Estado clínico del paciente.
- Ficha inicial.

Más adelante, podría incorporarse una entidad `Tratamiento`.

Un tratamiento podría incluir:

- Paciente.
- Profesional responsable.
- Especialidad.
- Fecha de inicio.
- Fecha estimada de finalización.
- Diagnóstico o motivo.
- Objetivos.
- Plan de sesiones.
- Estado del tratamiento.
- Evoluciones relacionadas.
- Documentos relacionados.
- Fecha de alta.
- Observaciones finales.

No implementar entidad `Tratamiento` todavía sin una definición más clara.

### Grupos de evolución (implementado — no es `Tratamiento`)

Se implementó `GrupoEvolucion` (`backend/prisma/schema.prisma`) como agrupación **puramente visual/organizativa** de evoluciones (ej. "Lumbalgia", "Rehabilitación postoperatoria"), no como una versión encubierta de `Tratamiento`. Diferencias explícitas:

- No tiene diagnóstico, plan de sesiones, objetivos, fecha estimada de finalización ni estado de tratamiento — solo `nombre` y `color` (paleta curada, misma que `Especialidad.color`).
- Una evolución tiene 0 o 1 grupo (`Evolucion.grupoId`, nullable). Un grupo pertenece a un solo paciente y consultorio; nunca cruza esos límites (validado server-side en cada endpoint, nunca se confía en el `grupoId` que manda el cliente).
- `DELETE /api/grupos-evolucion/:id` borra la fila del grupo de verdad (ya no hay concepto de "archivar" — se sacó el campo `archivedAt` en la migración `20260815004433_remove_grupo_evolucion_archived_at`). Nunca borra evoluciones: la FK `Evolucion.grupoId` usa `onDelete: SetNull`, así que las evoluciones que tenían ese grupo quedan automáticamente "Sin grupo" y conservan todo su contenido.
- En la tab Evoluciones del paciente hay un único punto de entrada a la gestión de grupos: el botón "Ver grupos" (`GestionarGruposModal.tsx`), que lista los grupos del paciente con acciones de editar (lápiz) y eliminar (tachito) por fila, más "+ Nuevo grupo" dentro del propio modal — no hay un botón de creación suelto en el toolbar. Eliminar (desde la lista o desde el modal de edición) dispara siempre la misma confirmación y el mismo llamado al backend (`deleteGrupo` en `PatientDetailPage.tsx`), nunca dos lógicas distintas. El selector "Grupo / problema" al crear/editar una evolución, el chip `● Nombre` con el color del grupo en la tabla, y el toggle "Ver por fecha | Ver por grupo" (default: por fecha, agrupación en el propio frontend vía `frontend/src/utils/groupEvolucionesByGrupo.ts`) siguen igual. Un filtro por grupo (botón "Filtro", mismo patrón visual que Turnos/Pacientes) acota ambas vistas sin afectar "Última evolución" del resumen ni el badge de la tab.

Endpoints: `GET/POST /api/pacientes/:pacienteId/grupos-evolucion`, `PATCH/DELETE /api/grupos-evolucion/:id`, mismo criterio de roles que Evoluciones (`CLINICAL_ROLES`). Migraciones `20260814204620_add_ficha_alerta_campo_y_grupo_evolucion` y `20260815004433_remove_grupo_evolucion_archived_at` (ambas aditivas/limpieza, sin backfill ni pérdida de evoluciones).

Sigue sin implementarse (y sigue fuera de alcance sin definición previa): `Tratamiento` formal, diagnóstico codificado, plan de sesiones, alta clínica, facturación por tratamiento.

---

## Diagnóstico, motivo de consulta y problemas

Todavía no está definido cómo se representarán diagnóstico, motivo de consulta o problemas clínicos.

Opciones posibles:

1. Incluirlos dentro de la ficha inicial.
2. Crear campos específicos dentro de historia clínica.
3. Crear una entidad de problemas o diagnósticos.
4. Asociarlos a tratamientos.

Para mantener simple el MVP, conviene empezar con campos dentro de ficha inicial o historia clínica básica.

No crear una estructura compleja de diagnósticos/problemas sin validarlo antes.

---

## Documentos clínicos

A futuro, el paciente debería poder tener documentos relacionados con su historia clínica.

Posibles documentos:

- Estudios médicos.
- RX.
- RMN.
- Laboratorio.
- Informes.
- Derivaciones.
- Consentimientos.
- Autorizaciones.
- Indicaciones.
- Archivos administrativos.
- Imágenes.
- PDFs.

Todavía no está definido dónde deberían adjuntarse exactamente.

Opciones posibles:

- Al paciente.
- A la ficha inicial.
- A una evolución.
- A un tratamiento.
- A un turno.
- A estudios complementarios.

Decisión inicial recomendada:

- Permitir documentos asociados al paciente como base futura.
- Luego permitir relación opcional con evolución, turno o tratamiento si el flujo lo requiere.

No implementar carga de documentos clínicos todavía sin definición funcional y técnica.

---

## Alta clínica

El alta clínica todavía no está definida.

Debe diferenciarse de inactivar el registro del paciente.

Inactivar un paciente es una decisión administrativa o técnica.

Dar de alta clínicamente a un paciente significa cerrar o finalizar un tratamiento.

Posibles campos de alta clínica:

- Fecha de alta.
- Profesional responsable.
- Motivo de alta.
- Estado final.
- Objetivos cumplidos.
- Observaciones.
- Evolución final.
- Indicaciones posteriores.
- Recomendaciones.
- Necesidad de control futuro.

No implementar alta clínica todavía sin diseño funcional previo.

---

## Relación con turnos

La historia clínica debe estar conectada con los turnos, pero no depender completamente de ellos.

Reglas:

- Un turno puede tener una evolución asociada.
- Una evolución puede estar asociada a un turno.
- Una evolución no necesita obligatoriamente tener turno.
- La vista de turno en proceso debe permitir cargar o consultar evoluciones.
- Un turno finalizado puede formar parte de la timeline clínica del paciente.
- Un turno ausente también puede formar parte de la timeline, aunque no tenga evolución clínica.

---

## Relación con pacientes

Toda historia clínica pertenece a un paciente.

No debe existir información clínica suelta sin paciente.

Reglas:

- Toda evolución debe tener `pacienteId`.
- Toda ficha inicial debe tener `pacienteId`.
- Todo documento clínico debe tener `pacienteId`, al menos como relación base.
- Todo tratamiento futuro debe tener `pacienteId`.

---

## Relación con profesionales

Las evoluciones deben estar asociadas a un profesional.

Esto permite saber quién cargó la información clínica.

Reglas:

- Toda evolución debe tener `profesionalId`.
- La ficha inicial puede tener profesional responsable o profesional que la cargó.
- El tratamiento futuro podría tener profesional responsable.
- No asumir todavía firma profesional.

---

## Roles y permisos relacionados

Todavía falta definir formalmente el sistema de usuarios y roles.

Como criterio inicial:

### Administrador

Puede ver la información clínica del consultorio si así se define para la institución.

Puede gestionar configuraciones, usuarios y permisos.

Debe definirse más adelante si puede editar información clínica o solo administrarla.

### Recepción

Puede gestionar datos administrativos y turnos.

El acceso a historia clínica debe ser limitado o configurable.

Recepción no debería cargar evoluciones clínicas salvo que se defina explícitamente.

### Profesional

Puede consultar la historia clínica necesaria para atender al paciente.

Puede cargar y editar evoluciones.

Puede completar ficha inicial.

Puede consultar documentos clínicos.

Puede operar principalmente sobre sus propios pacientes o turnos, pero podría tener visibilidad general del consultorio según configuración.

### Supervisor

Puede tener acceso a reportes y supervisión.

El acceso a información clínica sensible debe definirse con cuidado.

### Paciente

A futuro podría existir un portal de paciente.

No debería tener acceso libre a toda la historia clínica salvo que se defina explícitamente.

---

## Multi-consultorio y privacidad

Kineq será usado por múltiples consultorios, centros e instituciones.

La historia clínica es información sensible.

Por lo tanto, el aislamiento por consultorio es obligatorio.

Reglas fundamentales:

- Un consultorio nunca debe ver historia clínica de otro consultorio.
- Un consultorio nunca debe ver evoluciones de otro consultorio.
- Un consultorio nunca debe ver documentos clínicos de otro consultorio.
- Un consultorio nunca debe buscar pacientes globalmente en otros consultorios.
- Si una misma persona es paciente en dos consultorios distintos, deben existir registros separados.
- La historia clínica de un paciente debe pertenecer al consultorio que la cargó.

Toda consulta, endpoint o pantalla relacionada con historia clínica debe respetar `consultorioId` o la unidad organizativa equivalente.

---

## Consideraciones de UI

La interfaz de historia clínica debe ser moderna, simple e intuitiva.

Kineq debe evitar parecerse a sistemas clínicos antiguos, sobrecargados o difíciles de usar.

Prioridades de diseño:

- Acceso rápido durante la sesión.
- Pocas acciones necesarias para cargar una evolución.
- Lectura clara de evoluciones anteriores.
- Separación entre ficha inicial, evoluciones, documentos y tratamientos.
- Buena visibilidad del contexto del paciente.
- Diseño coherente con el resto del sistema.
- Uso de tabs o secciones solo si ayudan a ordenar, no si generan fricción.
- Timeline clínica visual a futuro.
- Posibilidad futura de asistencia con IA.

La historia clínica debe ser útil en contexto de atención, no solo como archivo administrativo.

---

## IA aplicada a historia clínica

A futuro, Kineq podría incorporar funciones impulsadas por IA para facilitar el trabajo clínico.

Posibles usos:

- Resumir historia clínica del paciente.
- Resumir evoluciones anteriores.
- Sugerir estructura de evolución.
- Transformar notas rápidas en texto clínico ordenado.
- Detectar información faltante en ficha inicial.
- Ayudar a preparar un resumen de tratamiento.
- Ayudar a generar indicaciones simples para el paciente.
- Buscar información relevante dentro del historial del paciente.

Estas funciones deben ser asistivas, no reemplazar el criterio profesional.

No implementar IA clínica todavía sin definición funcional, técnica y de privacidad.

---

## MCP, API y agente de IA

A futuro, Kineq podría contar con:

- API propia.
- MCP.
- Agente de IA integrado.
- Acciones automatizadas sobre pacientes, turnos e historia clínica.

Esto podría permitir tareas como:

- Consultar próximos turnos.
- Resumir pacientes del día.
- Buscar antecedentes relevantes.
- Preparar la agenda clínica del profesional.
- Generar borradores de evoluciones.
- Detectar pacientes sin evolución cargada.
- Ayudar con seguimiento posterior.

No implementar MCP, API pública ni agente de IA operativo todavía.

Estos elementos forman parte de la visión futura.

---

## Pendientes / mejoras futuras

Pendientes importantes:

- Definir estructura final de ficha inicial.
- Definir UI de historia clínica.
- Definir UI de turno en proceso.
- Definir si existirá entidad `HistoriaClinica` o si se modelará mediante entidades relacionadas.
- Definir si existirá entidad `FichaInicial`.
- Definir si existirá entidad `Tratamiento`.
- Definir documentos clínicos y dónde se adjuntan.
- Definir timeline clínica.
- Definir alta clínica.
- Definir diagnóstico, motivo de consulta y problemas clínicos.
- Definir plantillas de evolución.
- Definir permisos sobre información clínica.
- Definir auditoría simple de cambios clínicos.
- Definir asistencia de IA.
- Definir exportación o impresión de historia clínica, si fuera necesaria.

---

## No implementar todavía

No implementar todavía sin definición explícita:

- Firma profesional.
- Firma digital.
- Bloqueo de evoluciones firmadas.
- Historia clínica demasiado estructurada.
- Diagnósticos codificados.
- Tratamientos complejos.
- Documentos clínicos adjuntos.
- Timeline clínica avanzada.
- Alta clínica.
- Auditoría clínica avanzada.
- IA sobre historia clínica.
- MCP.
- API pública.
- Portal de pacientes con acceso clínico.

Estos elementos forman parte de la visión futura, pero no deben mezclarse con tareas inmediatas sin una definición previa.

---

## Notas para agentes IA

Antes de modificar el módulo de historia clínica, revisar:

- `backend/prisma/schema.prisma`
- Endpoints actuales de evoluciones en backend.
- Pantalla actual de pacientes en frontend.
- `docs/modules/patients.md`
- `docs/modules/appointments.md`
- `docs/modules/professionals.md`
- `docs/modules/users-and-roles.md`

Reglas importantes:

- Toda evolución debe pertenecer a un paciente.
- Toda evolución debe pertenecer a un profesional.
- Una evolución puede tener turno asociado, pero no es obligatorio.
- No confundir datos administrativos del paciente con historia clínica.
- No implementar firma profesional todavía.
- No bloquear edición de evoluciones todavía.
- No implementar auditoría avanzada sin una tarea explícita.
- No crear estructuras clínicas excesivamente complejas sin validación.
- No permitir acceso entre consultorios.
- Mantener aislamiento por consultorio en todo momento.
- Priorizar una UI simple, moderna y útil durante la sesión.
- Mantener abierta la posibilidad futura de ficha inicial, timeline, tratamientos, documentos e IA.

El objetivo del módulo de historia clínica es que el profesional tenga contexto clínico suficiente para atender mejor, registrar la evolución del paciente y seguir su tratamiento sin fricción.
# Módulo: Historia Clínica

## Objetivo del módulo

El módulo de Historia Clínica permite registrar, consultar y mantener la información clínica del paciente a lo largo del tiempo.

En Kineq, la historia clínica debe funcionar como el núcleo clínico del sistema. Debe permitir que el profesional entienda rápidamente quién es el paciente, cuál es su motivo de consulta, qué antecedentes tiene, qué tratamiento está realizando y cómo viene evolucionando sesión a sesión.

La historia clínica no debe ser una pantalla pesada ni difícil de usar. El objetivo principal es que sea simple, moderna, clara y útil durante la atención.

---

## Estado actual

**Esta sección quedó desactualizada por debajo de este párrafo — `docs/tasks.md` es la fuente de verdad sobre qué está implementado hoy, no este archivo.** En resumen: `Evolucion` existe (con borrado lógico vía `activo`), y `FichaInicial` no solo existe sino que fue rediseñada con un catálogo clínico extensible (antecedentes personales/familiares/quirúrgicos, alergias y medicación estructuradas, hábitos y contexto gineco-obstétrico renombrados como "Contexto y Hábitos" en la UI, estudios complementarios movidos a su propia pestaña general "Estudios") y luego ajustada en una segunda ronda: catálogo personalizado por consultorio, estado de sección/ficha 100% automático (ya no hay selector manual), y una card "Alertas clínicas" derivada de datos explícitamente marcados (nunca diagnóstico automático). Una tercera ronda ("Autoría clínica, vínculo Usuario–Profesional y permisos") hizo la autoría de todo el contenido clínico automática y obligatoria: sale siempre del `Profesional` vinculado al usuario autenticado, nunca de un valor enviado por el cliente, y sin vínculo el backend devuelve `403` a cualquier escritura clínica (evoluciones, ficha inicial, antecedentes, alergias, medicación, estudios) aunque el rol sea `ADMINISTRADOR`. Ver "Ficha Inicial — rediseño estructurado", "Ficha Inicial — ajustes incrementales" y "Autoría clínica, vínculo Usuario–Profesional y permisos" en `docs/tasks.md` para el modelo real. El resto de esta sección (antes decía que ni la ficha inicial ni una historia clínica estructurada existían) queda como referencia de planificación temprana, no como estado real.

Una cuarta ronda agregó dos cosas: **alertas manuales sobre campos de texto libre de la Ficha Inicial** (más allá de Antecedentes/Medicación, que ya tenían su propio flag `esAlertaClinica`) vía la tabla nueva `FichaAlertaCampo` — ver sección "Alertas clínicas: extensión a otros campos" más abajo — y **grupos de evolución** (`GrupoEvolucion`) — ver "Grupos de evolución (implementado — no es `Tratamiento`)" en la sección Tratamientos. Una quinta ronda corrigió dos bugs reales de esa cuarta ronda (pérdida de contenido al marcar una alerta + guardado roto en la primera edición de una ficha nueva — ver "Bugs corregidos: pérdida de contenido y guardado roto" más abajo), completó la navegación "click en alerta → campo de origen", terminó la gestión de grupos (antes solo se podían crear, no listar/editar sin pasar por una evolución existente) y agregó formato básico (negrita/cursiva/subrayado) a Evoluciones — ver "Formato básico en Evoluciones" más abajo. Una sexta ronda (UI/UX transversal, ver `docs/tasks.md`) simplificó aún más la gestión de grupos (un único "Ver grupos", eliminar en vez de archivar), cambió la Ficha Inicial para que la tab de Antecedentes muestre **solo** los ítems marcados `SI` (los `NO` se conservan y siguen editables desde "Ver todos", pero dejan de aparecer en el listado visible), agregó menú contextual por click derecho a los turnos del listado de Turnos (reutilizando exactamente la misma lógica de acciones que el calendario de Inicio), corrigió la navegación del botón "Volver" desde Atención, y agregó una confirmación obligatoria a "Finalizar atención" en los cuatro lugares desde donde se puede disparar. Una séptima ronda ("Plantillas de Evolución, tabs y ajustes de Ficha Inicial", ver `docs/tasks.md`) agregó Plantillas de Evolución (ver sección propia más abajo), reordenó las tabs de Paciente a Evoluciones/Ficha inicial/Estudios/Turnos (Evoluciones ahora la tab inicial por default), reescribió la condición de la alerta "Ficha inicial pendiente" para que solo aparezca si la ficha está genuinamente vacía (antes solo miraba los campos escalares planos, no las listas estructuradas de antecedentes/alergias/medicación/estudios — bug real, la alerta seguía mostrándose con datos clínicos ya cargados), reordenó "Nueva evolución" (editor arriba, Diagnóstico/Archivos debajo, dentro de una card sutil), precargó el Diagnóstico de la evolución anterior como default al abrir el formulario, y corrigió el combobox custom compartido (Paciente/Profesional/Especialidad/Diagnóstico) para que el chevron quede integrado dentro de la misma caja del trigger (antes el borde vivía en el `<input>` interno y el chevron, hermano flex de ese input, quedaba renderizado por fuera — una flecha suelta al lado del campo).

La evolución permite registrar notas clínicas asociadas a un paciente y a un profesional.

El modelo actual de evolución incluye:

- Paciente.
- Profesional.
- Turno opcional.
- Diagnóstico opcional (`grupoId` — modelo interno `GrupoEvolucion`, presentado en toda la UI como "Diagnóstico"; ver "Grupos de evolución" más abajo).
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

En la UI (`InitialAssessmentPanel.tsx`, `FichaEstudiosTab.tsx`), cada campo elegible tiene un botón chico junto a su label (`AlertToggleButton.tsx`). El panel de Alertas clínicas (`ClinicalAlertsDetail.tsx`) sigue agrupando Alergias / Antecedentes / Medicación como antes, más un cuarto grupo "Otras alertas" con estas — mismo lenguaje visual, sin rojo agresivo. El preview de cada una muestra el contenido real del campo de origen (truncado a ~3 líneas si es largo), no un texto genérico: `computeAlertasClinicas()` (`utils/clinicalAlerts.ts`) lo lee de la `FichaInicial` vigente en cada cómputo — nunca se persiste una copia — así que si el profesional edita el campo después de marcarlo, el preview se actualiza solo. El texto genérico ("Marcada manualmente por el profesional") queda solo como fallback para el caso borde de un campo sin contenido legible.

**Actualización (implementado) — botón icon-only**: `AlertToggleButton.tsx` mostraba ícono + texto ("⚠ Marcar como alerta" / "⚠ Alerta"); ahora es solo el ícono (círculo de 28px, ícono a 16px — no se achicó al punto de perder área táctil), botón redondo en vez de pill. El texto vive en `title` y `aria-label` ("Marcar como alerta" / "Quitar alerta"), no en el botón. Misma lógica y mismo estado activo/inactivo de siempre (`--active` con fondo tintado de warning), sin cambios funcionales.

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

**Bug real corregido en producción — evoluciones largas fallaban con 500**: `Evolucion.contenido` seguía siendo `String` sin `@db.Text` (`VARCHAR(191)`, el default de Prisma en MySQL) — una nota clínica de más de 191 caracteres hacía fallar el `INSERT` en la base ("Data too long for column"), devuelto como `POST /api/evoluciones → 500` genérico, sin loguear la excepción real en el servidor. Irónicamente, `contenidoHtml` ya se había creado con `@db.Text` precisamente porque una sesión anterior "ya había demostrado que 191 caracteres se queda corto" — pero ese mismo fix nunca se aplicó al campo `contenido` original. Corregido: migración `20260817145447_evolucion_contenido_text` (`ALTER TABLE Evolucion MODIFY contenido TEXT NOT NULL`, no destructiva). De paso, `POST`/`PATCH /api/evoluciones` ahora loguean la excepción real con `console.error()` antes de responder (mismo patrón ya usado en `PATCH /api/pacientes/:id/ficha-inicial` y en antecedentes) y devuelven un mensaje en español ("No se pudo guardar la evolución/los cambios. Volvé a intentar.") en vez del string técnico en inglés que el frontend mostraba tal cual (`getErrorMessage()` prioriza cualquier mensaje no vacío del backend sobre su propio fallback amigable).

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

**Actualización (implementado) — tab interna inicial según si la ficha está realmente vacía**: `InitialAssessmentPanel.tsx` abría siempre en "Resumen" (`useState('resumen')` fijo), incluso para una ficha sin ningún dato cargado — mostrando un resumen vacío en vez de arrancar directo por donde el profesional necesita empezar a cargar. Ahora, una vez que termina de cargar (`loading === false`), decide una única vez por paciente: si la ficha está **realmente vacía** (`fichaEstaRealmenteVacia()` — ni el form plano tiene ningún campo con contenido, ni hay antecedentes/alergias/medicaciones/estudios/alertas cargados; no alcanza con mirar el `pendiente` de `computeFichaCompletionStatus()` solo, porque ese cálculo únicamente conoce el form plano y una ficha puede seguir en `pendiente` con antecedentes ya cargados) abre en **"Antecedentes"** (antes "Motivo" — ver "Motivo se fusionó con Antecedentes" más abajo); si ya tiene cualquier progreso real, abre en "Resumen" como antes. La decisión se toma una sola vez por paciente (`useRef` guardando el último `patientId` ya resuelto, nuevo prop `patientId` en `InitialAssessmentPanelProps`) — nunca en cada render, para no arrancarle al profesional la sección de las manos mientras navega manualmente a Antecedentes/Seguridad/Hábitos/Dolor y función más adelante. El deep-link existente desde una alerta clínica (`navTarget`) sigue funcionando igual, sin interferir.

**Actualización (implementado) — "Motivo" se fusionó con "Antecedentes", ya no es una subpestaña propia**: `NAV_SECTIONS` (`InitialAssessmentPanel.tsx`) bajó de 6 a 5 entradas — se sacó "Motivo". Sus seis campos (`motivoConsulta`, `fechaInicioProblema`, `diagnosticoDerivacion`, `objetivoPaciente`, `tratamientosPrevios`, `traumatismosAccidentes`) **no se tocaron ni se migraron**: siguen siendo las mismas columnas de `FichaInicial`, ahora renderizadas al principio de `panels.antecedentes`, antes del bloque existente de Antecedentes — es un cambio puramente de navegación, "retirar UI, no migración destructiva". El contador "N de M secciones revisadas" (`fichaSeccionesResumen()`, `utils/fichaInicial.ts`) ya no hardcodea `5`: deriva el total de `REVISABLE_SECCIONES` (`['ANTECEDENTES', 'SEGURIDAD', 'HABITOS', 'DOLOR_FUNCION']`, ahora 4), que también excluye explícitamente `MOTIVO` además de `ESTUDIOS` (que ya se excluía). El backend (`recomputeSeccionesEstado()` en `backend/src/app.ts`) dejó de calcular un estado `MOTIVO` separado — su condición booleana (¿algún campo de Motivo tiene contenido?) se sumó con `OR` a la condición de `ANTECEDENTES` (además de `antecedentesCount > 0`), así que completar cualquier campo de Motivo sigue marcando una sección como revisada, ahora bajo `ANTECEDENTES`. Filas preexistentes en `FichaSeccionEstado` con `seccion='MOTIVO'` (de fichas ya calculadas antes de este cambio) **no se borran ni se migran** — quedan como historial inofensivo, simplemente ya no se vuelven a escribir ni se cuentan. Se actualizaron en el mismo sentido: `InitialAssessmentSummary.tsx` (el bloque "Motivo de consulta" del resumen navega a `sectionKey="antecedentes"`, no `"motivo"`) y `utils/eligibleAlertFields.ts`/`ELIGIBLE_ALERT_FIELDS` en el backend (las alertas manuales de Motivo navegan a `section: 'antecedentes'`/`'ANTECEDENTES'`). El header del paciente ("Sesiones realizadas / Última atención / Próximo turno") sigue derivando exclusivamente de `Turno`, nunca de este cálculo de progreso — no se tocó nada de esa lógica.

**Actualización (implementado) — Antecedentes: el header de cada categoría reemplaza a "Ver todos"**: `ClinicalAntecedentesSection.tsx` tenía un botón separado "Ver todos" que abría `CatalogoCompletoDrawer` (el modal de catálogo completo, con toggle Sí/No/Sin relevar, renombrar, quitar). Se sacó ese botón — ahora el propio botón de cada categoría (Personales/Familiares/Quirúrgicos, `role="tab"`) hace las dos cosas a la vez al hacer click: selecciona la categoría (comportamiento que ya tenía) y abre el mismo drawer (comportamiento nuevo, con un `›` como afordancia visual). No hay dos catálogos ni dos modales — es el mismo `CatalogoCompletoDrawer` de siempre, solo con un único punto de entrada.

**Actualización (implementado) — crear un ítem de catálogo desde el catálogo completo**: antes, la única forma de crear un antecedente/procedimiento custom del consultorio era desde el buscador rápido (`+ Agregar "X"`, solo aparece cuando la búsqueda no encuentra nada). `CatalogoCompletoDrawer` ahora tiene su propia fila "+ Agregar antecedente" al final de la lista, mismo endpoint (`createCatalogoClinicoItem`, `esSistema: false`, categoría fija a la del drawer abierto) — al crear, queda marcado "Sí" de una (mismo criterio que el quick-add del buscador) y la lista se recarga, sin tener que cerrar el drawer y volver a abrirlo. Aplica a las tres categorías (Personales/Familiares/Quirúrgicos), porque las tres reusan el mismo componente parametrizado por `categoria`.

**Actualización (implementado) — Ficha Inicial ya no tiene subpestaña "Resumen"**: con la nueva tab principal "Resumen clínico" en `PatientDetailPage.tsx` (ver "Reorganización de la pantalla del Paciente" en `docs/modules/patients.md`), la subpestaña "Resumen" dentro de Ficha Inicial quedaba duplicada — se sacó de `NAV_SECTIONS` (`InitialAssessmentPanel.tsx`), junto con el componente que la alimentaba (`InitialAssessmentSummary.tsx`, eliminado por quedar sin uso). Ficha Inicial ahora siempre abre en "Antecedentes" (la primera sección real), sin importar si la ficha está vacía o ya tiene progreso — antes esa decisión dependía de `fichaEstaRealmenteVacia()` (abría en "Resumen" si ya había algo cargado), que también se eliminó por quedar sin uso.

**Actualización (implementado) — "Motivo y contexto" eliminado por completo de la UI**: la ronda anterior había fusionado esta sección (Motivo de consulta, Fecha aproximada de inicio, Diagnóstico o derivación, Objetivo del paciente, Tratamientos previos, Traumatismos o accidentes) dentro de Antecedentes — esta ronda la sacó de la UI directamente, a pedido. **Las columnas de Prisma no se tocaron** (`FichaInicial.motivoConsulta`, etc. siguen existiendo, datos viejos preservados), mismo criterio de siempre. Se sacaron además esos 6 campos de `FICHA_FORM_FIELDS` (`utils/fichaInicial.ts`) — si hubieran seguido contando para `computeFichaCompletionStatus()`, ninguna ficha nueva podría haber llegado nunca a "Completa" (son campos que ya no tienen ningún input desde donde llenarse). El backend (`recomputeSeccionesEstado()`) no se tocó: sigue sumando esos 6 campos a la condición de `ANTECEDENTES` revisada, lo cual solo importa para fichas viejas que ya los tenían cargados (nunca se puede volver a cumplir esa condición por esos campos en una ficha nueva, pero `antecedentesCount > 0` sigue funcionando igual). Una alerta manual ya marcada sobre alguno de estos campos (`FichaAlertaCampo`) sigue mostrándose en el panel de Alertas clínicas con su contenido real — clickearla para "navegar al campo de origen" ya no encuentra ningún elemento en el DOM (`#ficha-field-motivoConsulta`, etc.) y simplemente no hace nada (`scrollToAndHighlight` tiene guard `if (!el) return`, sin error) — degradación aceptable, no se rediseñó ese flujo para este caso.

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

**Actualización (implementado) — archivo adjunto real**: cada entrada de `FichaEstudioComplementario` puede tener **un archivo** (PDF, JPG, PNG o WEBP, máximo 15MB — no había ningún límite "actual" que respetar, Estudios no tenía soporte de archivos antes de esto). Mismo mecanismo que las imágenes de Evolución: Vercel Blob privado, solo la referencia en la base (`archivoPathname`, `archivoNombreOriginal`, `archivoMimeType`, `archivoSizeBytes`, todas nullable), nunca la URL cruda al frontend (`archivoUrl` es la ruta propia `GET /api/ficha-estudios/:id/archivo/contenido`). El archivo de un estudio **ya existente** se sube/reemplaza/borra desde la fila de la lista en `FichaEstudiosList.tsx`. Como puede ser un PDF (no siempre una imagen para mostrar inline), "ver archivo" usa `openAuthorizedFile()` (`services/api.ts`): pide el contenido autenticado, arma un object URL y lo abre en una pestaña nueva — mismo mecanismo de sesión que el resto de la app, sin exponer la URL de Blob. Mismo criterio de permisos que editar/borrar el estudio: cualquier `CLINICAL_ROLES` con profesional vinculado, sin restricción de "solo el propio autor" (a diferencia de Evoluciones).

**Actualización (implementado) — adjuntar archivo ya en el alta, "upload diferido"**: antes, crear un estudio nuevo mostraba el aviso "Guardá el estudio primero; después vas a poder adjuntarle un archivo" — un archivo solo se podía sumar en un segundo paso, editando el estudio ya guardado. Se sacó ese aviso y ese requisito: el formulario de alta (`FichaEstudiosList.tsx`) ahora tiene su propio selector "↑ Subir archivo" (mismo estilo que el de Evolución), con el nombre del archivo elegido mostrado en un chip removible/reemplazable antes de guardar, validación de tipo/tamaño inline (mismos límites de arriba) y sin usar nunca `alert()` nativo. El archivo elegido se guarda en estado de React (`File`, nunca se sube todavía) — recién al tocar "Guardar" se ejecuta la secuencia **upload diferido**: 1) `POST` crea el `FichaEstudioComplementario` (sin archivo), 2) con el `id` real ya devuelto, sube el archivo (`onUploadArchivo`, mismo endpoint que ya existía para estudios existentes). Si el paso 1 falla, no hay nada que subir. Si el paso 2 falla, el estudio **ya quedó guardado** (no se pierde el alta por un error de red al subir el archivo) — se muestra un error explicando que el archivo no se pudo subir y que se puede reintentar desde la fila recién creada en la lista, en vez de bloquear o revertir el alta. `useFichaInicial.ts`'s `addEstudio()` ahora devuelve el estudio creado (antes solo hacía `refresh()` y no exponía el `id`), que es lo que permite encadenar el upload sin esperar a un segundo `refresh()`. El formulario de **edición** de un estudio existente no cambió — sigue usando la fila de la lista para adjuntar/reemplazar/quitar el archivo.

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

**Actualización (implementado) — imágenes adjuntas**: una evolución puede tener hasta **5 imágenes** (JPG/PNG/WEBP, máximo 10MB cada una). El binario nunca se guarda en MySQL: se sube a **Vercel Blob** (`@vercel/blob`, `access: 'private'`, requiere la variable de entorno `BLOB_READ_WRITE_TOKEN` — ver "Producción" más abajo) y en la base solo queda la referencia (`EvolucionImagen`: `pathname`, `nombreOriginal`, `mimeType`, `sizeBytes`, más `consultorioId`/`pacienteId`/`evolucionId` para poder filtrar y validar — **sin** columna `url`). El endpoint de subida (`POST /api/evoluciones/:evolucionId/imagenes`, `multer` con `memoryStorage`, campo `imagenes`) exige una evolución **ya creada** — por eso, al cargar una evolución nueva con imágenes, el frontend (`PatientDetailPage.tsx`) primero crea la evolución (`POST /api/evoluciones`) y recién después sube las imágenes seleccionadas a ese id (mientras tanto, las imágenes elegidas quedan solo en memoria del navegador — "sacar antes de guardar" es sacarlas de ese array local, sin ningún request). Mismo criterio de permisos que editar/eliminar la evolución: el profesional solo agrega o saca imágenes de sus propias evoluciones, administrador de cualquiera del consultorio; el backend siempre revalida `consultorioId`/dueño, nunca confía en lo que mande el cliente.

**Actualización (implementado) — blobs privados, nunca la URL cruda al frontend**: `@vercel/blob` sí soporta `access: 'private'` (requiere el token del servidor para leer, no solo para escribir) — la ronda anterior había asumido que Blob solo tenía modo público y documentaba eso como límite conocido; quedó corregido. El frontend nunca recibe ni guarda la URL de Vercel Blob: el backend expone `GET /api/evoluciones/:evolucionId/imagenes/:id/contenido`, que revalida consultorio/permisos y recién ahí llama a `get()` (con el token) y hace streaming de la respuesta (`backend/src/blobStorage.ts`, compartido con Estudios y fotos de Usuario/Paciente — ver "Archivos: Vercel Blob (implementado)" en `docs/architecture.md`). El frontend pide esa ruta autenticada (`fetch(credentials:'include')`) y arma un object URL local — `AuthorizedImg.tsx`, usado por `EvolucionImages.tsx` para miniaturas y lightbox.

**Actualización (implementado) — Diagnóstico y Archivos en la misma fila, mismo selector custom en alta y edición**: el formulario de edición inline de una evolución (`EvolutionTable.tsx`) usaba un `<select>` nativo sin estilo para Diagnóstico, distinto del combobox custom (`DiagnosticoSelect.tsx`) que ya usaba el alta — quedó unificado, ahora los dos formularios usan el mismo componente. `DiagnosticoSelect` y `EvolucionImages` (rediseñado: el antes-cuadrado-suelto "+ Imagen" pasó a ser un botón real "Subir imágenes"/"Agregar imagen" con ícono, label "Archivos" arriba a juego con "Diagnóstico") van dentro de una fila compartida (`.evolution-form-fields-row`, flex con wrap — sin breakpoint dedicado, se apila solo en mobile), tanto en el alta como en la edición. Componente de UI compartido: `EvolucionImages.tsx` (miniaturas + lightbox con cierre por click afuera/Escape/X), reutilizado igual en el formulario de alta, en la edición y en la vista de solo lectura de evoluciones históricas (`EvolucionContent.tsx`). Validación de tipo/cantidad/tamaño duplicada a propósito en frontend (`utils/evolucionImageValidation.ts`, da el error al toque) y backend (nunca se confía solo en el frontend).

**Actualización (implementado) — Diagnóstico/Archivos arriba del editor, chevron en los cuatro combobox, vista de lectura también los muestra**: en ambos formularios (alta en `PatientDetailPage.tsx`, edición en `EvolutionTable.tsx`) la fila `.evolution-form-fields-row` (Diagnóstico + Archivos) pasó a ir **antes** del editor de texto (`RichTextEditor`/`textarea`), no después — esto además resuelve por construcción que "Subir imágenes" quedara pegado a "Cancelar/Guardar cambios" en el formulario de edición: ahora los separa todo el alto del editor (`.evolution-edit-form` sigue siendo un grid con `gap: 8px` uniforme entre secciones, sin espaciado especial). El único elemento visual que le faltaba a `DiagnosticoSelect.tsx` respecto al resto del combobox custom (ya tenía punto de color, check de seleccionado, "Sin diagnóstico", "+ Agregar diagnóstico" dentro del panel, teclado, click-afuera, scroll interno) era un indicador de flecha — se agregó una sola vez, vía `.dropdown-input-row::after { content: '▾' }`, así que los cuatro combobox custom de la app (Paciente, Profesional, Especialidad, Diagnóstico) lo ganaron a la vez, no solo Diagnóstico. La vista de solo lectura de una evolución (`EvolucionContent.tsx`) ahora también muestra Diagnóstico (`GrupoChip`, mismo chip que la edición) y Archivos (`EvolucionImages` sin `onAdd`/`onRemove` → automáticamente de solo lectura, sin controles de edición) antes del contenido — ninguno de los dos bloques se renderiza si no hay datos, para no dejar un hueco vacío.

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

**Actualización (implementado) — click en una fila entra directo a edición**: antes, click en una fila de `EvolutionTable.tsx` solo expandía a modo lectura (`toggleExpand`); el lápiz era la única forma de editar. Ahora, si el usuario puede editar esa evolución (`canEdit(evolucion)`, mismo criterio de siempre — autor o administrador), el click en la fila llama al mismo handler que el lápiz (`startEdit`), sin lógica duplicada. Si no puede editar (evolución de otro profesional, por ejemplo), el click sigue funcionando como antes (expande a solo lectura) — nunca queda sin efecto. El lápiz sigue existiendo, ahora es simplemente redundante con el click de la fila.

**Actualización (implementado) — alta de evolución colapsada detrás de "Cargar evolución"**: el formulario de "Nueva evolución" en `PatientDetailPage.tsx` ya no está siempre visible — arranca oculto detrás de un botón de ancho completo, "+ Cargar evolución" (`.evolution-load-button`). Al tocarlo se muestra el formulario completo (Diagnóstico/Archivos/editor/Guardar/Cancelar); guardar con éxito o cancelar (con confirmación custom si ya había texto/archivos/diagnóstico cargados, mismo patrón que "Finalizar atención" con cambios sin guardar) vuelve a ocultarlo y limpia todo el estado temporal (texto, HTML, diagnóstico, imágenes en staging) — nunca queda contenido de un intento anterior al volver a abrirlo.

**Bug real corregido — el editor de texto enriquecido saltaba de scroll al escribir**: `RichTextEditor.tsx`'s `emitChange()` (disparado en cada `onInput`) reasignaba `el.innerHTML = sanitized` cada vez que `sanitizeRichTextHtml()` devolvía algo distinto al HTML actual del `contentEditable` — reasignar `innerHTML` de un elemento enfocado destruye y recrea sus nodos DOM, lo que le hace perder el cursor al navegador (suele reposicionarlo al principio) y dispara un salto de scroll hacia arriba. Como DOMPurify normaliza markup con cierta frecuencia (aunque sea funcionalmente equivalente al que ya produjo el `contentEditable`), esto podía pasar en casi cualquier tecla. Corregido: `emitChange()` ya nunca reescribe el DOM mientras se está escribiendo — solo emite el HTML sanitizado hacia arriba (`onChange`); la corrección real del DOM (si hiciera falta) queda para el `blur`, donde perder el cursor no importa. De paso se cerró el único vector real por el que podría entrar HTML fuera del allowlist: pegar contenido externo ahora siempre se inserta como texto plano (`onPaste` + `execCommand('insertText', ...)`), nunca con el markup/estilos de la fuente original — tipear y usar B/I/U vía `execCommand` nunca generaban markup fuera del allowlist de todos modos. El backend sigue sanitizando de nuevo antes de persistir, sin cambios ahí.

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

## Plantillas de evolución (implementado — V1)

**Modelo (`PlantillaEvolucion`, migración `20260822195351_plantilla_evolucion`)**: `id`, `consultorioId`, `nombre`, `contenido` (`@db.Text`), `contenidoHtml` (`@db.Text`, nullable), `activo` (baja lógica, `@default(true)`), `createdAt`/`updatedAt`. Siempre de consultorio — nunca global (a diferencia de `Especialidad`/`CatalogoClinicoItem`, acá no existe noción "de sistema") ni asociada a un `Profesional` en particular: cualquier ADMINISTRADOR/PROFESIONAL del consultorio la puede usar/crear/editar/archivar por igual (mismo alcance que `CLINICAL_ROLES`, usado también en Evoluciones/Ficha inicial — Recepción/Supervisor no la ven ni administran).

**Endpoints** (`backend/src/app.ts`, junto a los de `grupos-evolucion`): `GET/POST /api/plantillas-evolucion`, `PATCH/DELETE /api/plantillas-evolucion/:id`. Mismo criterio de sanitización que Evolución: `contenidoHtml` se sanitiza siempre en el servidor (nunca se confía en el que mandó el cliente) y `contenido` (texto plano) se deriva del HTML sanitizado cuando hay formato. `DELETE` es baja lógica (`activo:false`), nunca borrado físico — aplicar una plantilla solo copia texto una vez a un editor, no deja ninguna relación que preservar en la Evolución resultante.

**UI**: botón "Plantillas" integrado en la toolbar del editor rico de "Nueva evolución" (`RichTextEditor.tsx` ganó un prop opcional `toolbarExtra`, sin afectar sus otros usos — edición de evolución existente, contenido de la propia plantilla). Abre `PlantillasListModal.tsx` (listar/aplicar/ir a editar/eliminar, "+ Nueva plantilla" al pie — mismo patrón que `GestionarGruposModal.tsx` para Diagnóstico) → `PlantillaFormModal.tsx` (Nombre + el mismo `RichTextEditor` básico para el contenido — mismo patrón que `GrupoEvolucionModal.tsx`).

**Aplicar plantilla**: si el editor de "Nueva evolución" está vacío, se aplica directo; si ya tiene texto, nunca se pisa en silencio — confirmación custom Kineq ("Reemplazar contenido", nunca `confirm()` nativo) antes de reemplazar.

**No implementado a propósito (fuera de alcance de V1)**: plantillas globales, variables dinámicas, IA para completar contenido, versionado, firma, auditoría avanzada, sharing entre consultorios.

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

**Actualización (implementado) — layout estable: contenido a la izquierda, Resumen clínico a la derecha**: `PatientDetailPage.tsx` (única pantalla de Paciente, con o sin turno activo — ver más abajo) usa un grid (`.patient-detail-layout`, dos columnas: `minmax(0, 1fr) minmax(280px, 340px)`) con `.patient-detail-stack` (Datos administrativos + Resumen clínico) y `.patient-detail-card.clinical-workspace` (las tabs, siempre en orden Ficha inicial/Evoluciones/Turnos/Estudios) como los dos hijos directos del grid. `.patient-detail-stack` aparece primero en el DOM (columna fija de 320px); `.clinical-workspace` queda a la derecha invertido únicamente con CSS (`order: 2` en `.patient-detail-stack`, `order: 1` en `.clinical-workspace`), nunca con JSX distinto — así el orden queda automáticamente consistente en cualquier contexto (con o sin turno) y entre las cuatro tabs (cambiar de tab no mueve el Resumen, porque nunca formó parte del contenido de la tab). En el breakpoint de una columna (≤1170px, ya existente) el mismo `order` decide el apilado vertical: tabs primero, Resumen clínico después — sin agregar una media query nueva. Sin `position: sticky` (no lo tenía antes; no se agregó, per criterio de no introducirlo si no existía ya).

**Actualización (implementado) — pantalla única de Paciente/Atención**: `AttentionPage.tsx` fue eliminado. `PatientDetailPage.tsx` recibe dos props opcionales, `activeTurno` y `onUpdateEstado` — cuando `App.tsx` navega a "atención" (Iniciar/Continuar atención desde un turno), renderiza el mismo `PatientDetailPage.tsx` con esos props en vez de un componente separado. Con `activeTurno`, se agrega de forma puramente aditiva una barra de sesión (pill de estado del turno, profesional/especialidad/sesión, timer de atención cuando `estado === 'Atendiendo'`, botón "Finalizar atención") y el vínculo automático evolución↔turno (`turnoId` en la evolución nueva, alerta de "sin evolución cargada" antes de finalizar) — nunca se oculta ni reemplaza nada de la pantalla base. Sin `activeTurno`, el comportamiento es idéntico al de antes de esta unificación. Esto garantiza por construcción que tabs, edad, "Editar paciente", Diagnóstico y el layout de Resumen clínico sean exactamente los mismos estando o no en atención — no hay dos implementaciones que puedan divergir.

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

#### `GrupoEvolucion` ahora se presenta como "Diagnóstico"

**Actualización (implementado)**: todo el copy visible pasó de "Grupo"/"Grupo de evolución" a **"Diagnóstico"** ("Sin diagnóstico", "Ver diagnósticos", "Nuevo/Editar/Eliminar diagnóstico", "Por diagnóstico", filtro "Diagnóstico"). El modelo interno **no se renombró** — sigue siendo `GrupoEvolucion`/`grupoId` en `schema.prisma`, endpoints y estado de React (`grupos`, `grupoModal`, etc.) — por ser un cambio de copy seguro y de bajo riesgo frente a una migración de rename real; ya tenía `pacienteId` propio (agregado en la ronda que lo creó), así que no hizo falta backfill ni migración nueva para esta funcionalidad. Sigue siendo, como antes, una organización libre y simple creada por el profesional — nunca CIE/SNOMED ni diagnóstico automático (ver aviso arriba).

**Alta rápida desde Nueva evolución**: el selector "Diagnóstico" de "Nueva evolución" ya no es un `<select>` nativo con un botón "+ Agregar diagnóstico" suelto debajo — pasó a ser un componente propio, `DiagnosticoSelect.tsx`, que replica exactamente el patrón del combobox de Especialidad de Turnos (`TurnoFormFields` en `FormFields.tsx`): dropdown posicionado con `getBoundingClientRect` (mismas clases `.dropdown-field`/`.dropdown-input-row`/`.dropdown-list`, sin CSS nueva), lista de diagnósticos con su punto de color, y "+ Agregar diagnóstico" como **último ítem dentro del propio panel desplegable** (`.dropdown-footer`/`.add-item-button`), nunca una acción externa. Al tocarlo se abre la misma mini-creación inline de antes: **un único campo obligatorio, Nombre** (placeholder "Ej. Lumbalgia"), sin selector de color — el color se asigna automáticamente por rotación sobre `SPECIALTY_COLOR_TOKENS` (`frontend/src/utils/specialtyColors.ts`), igual que antes, vía el mismo `POST /api/pacientes/:id/grupos-evolucion` sin cambios de backend. Al crear: el diagnóstico se agrega a la lista, el dropdown se cierra y queda seleccionado automáticamente, sin tocar el contenido/formato ya tipeado de la evolución en curso. La gestión completa (crear con color elegido a mano, editar nombre/color, eliminar) sigue viviendo en "Ver diagnósticos" (`GestionarGruposModal.tsx`/`GrupoEvolucionModal.tsx`), sin cambios.

**Actualización (implementado) — el mismo selector también en la pantalla de Atención**: `AttentionPage.tsx` nunca había tenido el selector de Diagnóstico en su formulario de "Nueva evolución" ni en la edición de una evolución existente (`EvolutionTable.tsx` ya soportaba las props `grupos`/`editingGrupoId`/`onChangeEditingGrupoId` para esto — `PatientDetailPage.tsx` las usaba, `AttentionPage.tsx` nunca las pasó). Esto se reportó como "no aparece con el turno FINALIZADO", pero el gap era real e independiente del estado del turno: faltaba en **cualquier** estado. Se agregó el mismo `DiagnosticoSelect` (con su propio `grupos`/`createDiagnosticoInline`, cargado junto al resto de los datos del paciente) tanto en el alta de una evolución nueva como en la edición de una existente. El selector depende únicamente del paciente (`turno.patientId`) — nunca de `turno.estado` — así que crear o editar una evolución con Diagnóstico funciona igual en `ASIGNADO`/`EN_ESPERA`/`ATENDIENDO`/`FINALIZADO`. El botón "Editar paciente" (agregado a `AttentionPage.tsx` en una ronda anterior) **nunca** dependió del estado del turno — se verificó explícitamente en las cuatro fases y sigue siendo así; no hizo falta ningún cambio ahí. Cargar una evolución con el turno ya `FINALIZADO` ("evolución post-sesión") es un flujo válido y no reabre ni modifica el estado del turno — `submitEvolucion`/`POST /api/evoluciones` nunca tocan `Turno.estado`. El selector de "Editar evolución" en `PatientDetailPage.tsx` (dentro de `EvolutionTable.tsx`) no cambió — ya funcionaba igual.

#### Diagnóstico con sesiones planificadas — "Sesión X de Y"

**Actualización (implementado)**: `GrupoEvolucion` ganó un campo opcional, `cantidadSesionesPlanificadas Int?` (migración `20260817163218_turno_grupo_y_sesiones_planificadas`, aditiva). Sin este campo, un Diagnóstico se comporta exactamente igual que antes — es la primera y única pieza de "plan" que se agregó a lo que sigue siendo, deliberadamente, una entidad liviana (ver arriba: nunca objetivos por sesión, alta médica, facturación, autorizaciones, CIE/ICD, múltiples etapas ni firma).

`Turno` ganó `grupoId Int?` (FK a `GrupoEvolucion`, `onDelete: SetNull`) — antes un turno no tenía ninguna relación con un Diagnóstico, solo las Evoluciones la tenían. Con un Diagnóstico elegido en el formulario de Turno (`TurnoFormFields`, reutiliza `DiagnosticoSelect.tsx`) que tiene `cantidadSesionesPlanificadas`, el campo "Nro. de sesión" pasa a mostrarse como "Sesión (de Y)" y se autocompleta con el próximo número real, pedido a `GET /api/grupos-evolucion/:id/proxima-sesion` — pero sigue siendo un `<input type="number">` editable normal, nunca de solo lectura: el valor sugerido es un default, no una restricción.

Cálculo (`sesionAutomaticaParaGrupo()` en `backend/src/app.ts`, usado tanto por el endpoint de consulta como por el default en `POST`/`PATCH /api/turnos` cuando el cliente no manda `numeroSesion` explícito):

```
count(Turno donde consultorioId + pacienteId + grupoId coinciden, estado = FINALIZADO) + 1
```

Deliberadamente **no** `count(Evolucion con ese grupoId) + 1` — una evolución puede cargarse sin turno asociado, o un turno puede terminar con más de una evolución (o ninguna), así que ese conteo se desincroniza del "turno" real fácilmente. Y deliberadamente solo `FINALIZADO`: ni `CANCELADO` ni `AUSENTE` incrementan la sesión — mismo criterio que ya usa `sesionesRealizadas` en `estadisticasService.ts` (ver `docs/modules/statistics.md`) y distinto del concepto administrativo "ausente cuenta como sesión consumida" de `docs/modules/appointments.md` (esa es sobre cobertura/turno usado, esto es sobre progreso real del tratamiento). Un `numeroSesion` explícito enviado por el cliente nunca se pisa con el cálculo automático, ni al crear ni al editar.

Solo se ofrece el selector de Diagnóstico en el formulario de Turno a roles con acceso clínico (`ADMINISTRADOR`/`PROFESIONAL`, mismo gate que Evoluciones/Ficha Inicial) — `RECEPCION`/`SUPERVISOR` pueden crear y editar turnos igual que siempre, pero ven el campo "Nro. de sesión" manual de siempre, sin Diagnóstico. Fue una decisión deliberada para no ampliar quién ve contenido clínico (`GET /api/pacientes/:pacienteId/grupos-evolucion` sigue siendo `CLINICAL_ROLES`-only) solo porque la creación de Turnos en sí es más permisiva (`ADMIN_DATA_ROLES`).

`GET /api/grupos-evolucion/:id/proxima-sesion` valida consultorio (404 si el grupo es de otro consultorio o no existe) igual que el resto de los endpoints de `GrupoEvolucion` — nunca confía en un `grupoId` del cliente sin revalidar.

#### Evoluciones en mobile: cards reorganizadas

**Actualización (implementado)**: la card mobile de cada evolución (`EvolutionTable.tsx`, breakpoint ≤820px existente) usaba el mismo fallback genérico "etiqueta: valor" en fila que el resto de `.turnos-table` — con contenido largo (Resumen) y un chip (Diagnóstico) esto quedaba comprimido, con la etiqueta compitiendo por espacio con el valor en la misma fila. Se agregó un layout en grid **scoped a `.evolution-table`** (no toca las demás tablas): Fecha y los botones editar/borrar comparten la fila de arriba (mismo ancho que el resto de la card); Profesional, Diagnóstico y Resumen se apilan a ancho completo, cada uno con su etiqueta en su propia línea arriba del valor. Probado en vivo (Playwright) a 390/414/430px sin overflow horizontal nuevo ni regresión visible en desktop. El toolbar ("Por fecha | Por diagnóstico | Filtro | Ver diagnósticos") pasó de `flex-wrap: nowrap` a `wrap` — "Por diagnóstico"/"Ver diagnósticos" son más largos que el "grupo" original y ya no entran siempre en una sola fila a los anchos más chicos probados; se prefiere que envuelva a una segunda fila antes que desbordar horizontalmente.

**Gap preexistente encontrado, no corregido en esta ronda** (fuera del alcance pedido, que era específicamente Evoluciones): `.patient-detail-page` tiene un overflow horizontal de ~30-45px a 390/414/430px que **no es específico de Evoluciones** — se reproduce igual en la tab "Ficha inicial", que esta ronda no tocó. Afecta al contenedor de toda la página de detalle de paciente (header, cards de resumen), no a las cards de evolución en sí. Necesita su propia investigación (probablemente un hijo de un grid/flex sin `min-width: 0`) y toca componentes compartidos por todas las tabs clínicas (`PatientProfileHeader.tsx`, `PatientSummaryCards.tsx`), por lo que corregirlo ahí hubiera excedido el pedido explícito de "sin rediseñar módulos completos, solo Evoluciones".

---

## Diagnóstico, motivo de consulta y problemas

**Actualización (implementado) — "Diagnóstico" simple por paciente**: se optó por la opción 3 (entidad propia), pero deliberadamente liviana — ver "`GrupoEvolucion` ahora se presenta como Diagnóstico" más abajo, dentro de la sección de Grupos de evolución. Sigue sin implementarse: diagnóstico codificado (CIE/SNOMED), diagnóstico automático, múltiples diagnósticos por evolución o reglas clínicas — eso queda fuera de alcance sin una definición previa explícita, igual que antes.

El motivo de consulta (`FichaInicial.motivoConsulta`) y el diagnóstico de derivación (`FichaInicial.diagnosticoDerivacion`) ya existen como campos de texto libre dentro de la ficha inicial — sin cambios en esta ronda.

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

**Actualización (implementado, parcial)**: la opción "A una evolución" ya tiene una primera implementación real, pero acotada a **imágenes** (no PDFs, informes u otros tipos de archivo) — ver "Imágenes adjuntas" en "Contenido de una evolución" más arriba. El resto de las opciones (paciente, ficha inicial, tratamiento, turno, estudios complementarios) y otros tipos de documento siguen sin definir/implementar.

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
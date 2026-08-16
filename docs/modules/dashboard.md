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

---

## Calendario mensual lateral

El calendario mensual lateral permite navegar entre días.

Debe servir para:

- Cambiar rápidamente la fecha seleccionada.
- Identificar el día actual.
- Ver días con turnos, si se implementa más adelante.
- Moverse por la agenda sin salir de Inicio.

No debe ocupar demasiado espacio ni competir con la vista principal del día.

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
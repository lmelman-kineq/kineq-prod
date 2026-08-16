# Database Model Draft

**Stale — this file predates the real (Spanish-named) Prisma schema and was never updated to match it.** `docs/tasks.md` already flags it as not authoritative. For the actual data model, read `backend/prisma/schema.prisma` directly — as of this session it includes `Consultorio`, `Usuario`, `Paciente`, `Profesional` (now with `deletedAt`, distinct from `activo` — see `docs/modules/professionals.md`), `Especialidad`/`ObraSocial` (now a global/custom catalog: nullable `consultorioId` + `esSistema`, plus the `ConsultorioEspecialidadOculta`/`ConsultorioObraSocialOculta` hide tables — see `docs/modules/specialties.md`/`docs/modules/social-works.md`), `Turno`, `Evolucion` (with soft-delete `activo`, plus an optional `grupoId` FK), and the Ficha Inicial cluster (`FichaInicial`, `CatalogoClinicoItem`, `FichaAntecedente`, `FichaAlergia`, `FichaMedicacion`, `FichaEstudioComplementario`, `FichaSeccionEstado` — see "Ficha Inicial — rediseño estructurado" in `docs/tasks.md`). None of the entity names below reflect that.

Two new tables added for Estadísticas / alertas / grupos de evolución (migration `20260814204620_add_ficha_alerta_campo_y_grupo_evolucion`, purely additive, no backfill): `FichaAlertaCampo` (manual clinical alert on a free-text Ficha Inicial field — `consultorioId`, `fichaInicialId`, `campo`, `createdAt`; row existence is the alert, no `activa` column) and `GrupoEvolucion` (visual grouping of evoluciones — `consultorioId`, `pacienteId`, `nombre`, `color`, `archivedAt`; never a `Tratamiento` substitute — see `docs/modules/clinical-history.md`). The Estadísticas endpoint (`docs/modules/statistics.md`) added no new tables — it only reads `Turno`/`Paciente`/`Evolucion`/`Profesional`/`Especialidad`.

One more additive column, migration `20260814233921_add_evolucion_contenido_html`: `Evolucion.contenidoHtml` (nullable `@db.Text`) — sanitized rich-text HTML (bold/italic/underline only) for evolutions that used the formatting toolbar; `null` for every evolution created before this, which keep rendering as plain text via `Evolucion.contenido` unchanged. See "Formato básico en Evoluciones" in `docs/modules/clinical-history.md`.

Main entities (original draft, generic names, not the real schema):

- User
- Role
- Organization
- Location
- ProfessionalProfile
- Patient
- Appointment
- ClinicalRecord
- SessionEvolution
- TreatmentPlan
- Notification
- FileAttachment
- AuditLog
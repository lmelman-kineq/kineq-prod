# Database Model Draft

**Stale — this file predates the real (Spanish-named) Prisma schema and was never updated to match it.** `docs/tasks.md` already flags it as not authoritative. For the actual data model, read `backend/prisma/schema.prisma` directly — as of this session it includes `Consultorio`, `Usuario`, `Paciente`, `Profesional` (now with `deletedAt`, distinct from `activo` — see `docs/modules/professionals.md`), `Especialidad`/`ObraSocial` (now a global/custom catalog: nullable `consultorioId` + `esSistema`, plus the `ConsultorioEspecialidadOculta`/`ConsultorioObraSocialOculta` hide tables — see `docs/modules/specialties.md`/`docs/modules/social-works.md`), `Turno`, `Evolucion` (with soft-delete `activo`, plus an optional `grupoId` FK), and the Ficha Inicial cluster (`FichaInicial`, `CatalogoClinicoItem`, `FichaAntecedente`, `FichaAlergia`, `FichaMedicacion`, `FichaEstudioComplementario`, `FichaSeccionEstado` — see "Ficha Inicial — rediseño estructurado" in `docs/tasks.md`). None of the entity names below reflect that.

Two new tables added for Estadísticas / alertas / grupos de evolución (migration `20260814204620_add_ficha_alerta_campo_y_grupo_evolucion`, purely additive, no backfill): `FichaAlertaCampo` (manual clinical alert on a free-text Ficha Inicial field — `consultorioId`, `fichaInicialId`, `campo`, `createdAt`; row existence is the alert, no `activa` column) and `GrupoEvolucion` (visual grouping of evoluciones — `consultorioId`, `pacienteId`, `nombre`, `color`, `archivedAt`; never a `Tratamiento` substitute — see `docs/modules/clinical-history.md`). The Estadísticas endpoint (`docs/modules/statistics.md`) added no new tables — it only reads `Turno`/`Paciente`/`Evolucion`/`Profesional`/`Especialidad`.

One more additive column, migration `20260814233921_add_evolucion_contenido_html`: `Evolucion.contenidoHtml` (nullable `@db.Text`) — sanitized rich-text HTML (bold/italic/underline only) for evolutions that used the formatting toolbar; `null` for every evolution created before this, which keep rendering as plain text via `Evolucion.contenido` unchanged. See "Formato básico en Evoluciones" in `docs/modules/clinical-history.md`.

Migration `20260817123951_paciente_documento_unico`: `Paciente.documento` went from a plain index (`@@index([consultorioId, documento])`) to a real unique constraint (`@@unique([consultorioId, documento])`) — MySQL doesn't dedupe `NULL`s in a unique index, so any number of patients without a document (the normal case now that the field is optional) coexist fine within the same consultorio; only a repeated non-null document within the same consultorio is rejected. Verified no pre-existing duplicates before applying. All of `Paciente`'s other administrative fields (`documento`, `fechaNacimiento`, `telefono`, `email`, `direccion`, `obraSocialId`, `numeroAfiliado`) were already nullable in the schema — only `nombre`/`apellido` are required — so making the frontend/backend enforce "only Nombre and Apellido required" needed no further schema change. See `docs/modules/patients.md`.

Migration `20260817145447_evolucion_contenido_text`: `Evolucion.contenido` went from `String` (no native type override — Prisma's MySQL default is `VARCHAR(191)`) to `String @db.Text`. A clinical note longer than 191 characters made the `INSERT` fail at the database level ("Data too long for column 'contenido'"), surfaced to the client as a bare `500` with no logged exception. `contenidoHtml` already used `@db.Text` since the rich-text migration (`20260814233921_add_evolucion_contenido_html`) — this was the same fix applied to the original field, which had been missed. `ALTER TABLE Evolucion MODIFY contenido TEXT NOT NULL` — non-destructive, widens the column type in place, no data loss/truncation for existing rows. See `docs/modules/clinical-history.md`.

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
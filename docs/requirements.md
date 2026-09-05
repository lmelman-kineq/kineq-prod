# Kineq - Product Requirements

## 1. Product Summary

Kineq is a web app for kinesiologists and rehabilitation centers to manage appointments, patients, clinical records, treatment follow-up, reminders, and operational reporting.

## 2. Target Customers

### Independent Professional
A single kinesiologist working alone or with minimal administrative support.

### Small Practice
A small office with multiple professionals and possibly one receptionist.

### Medium Center
A rehabilitation center with several professionals, admins, multiple agendas, and operational reporting needs.

### Healthcare Institution
A clinic, sanatorium, or large health organization with multiple teams, locations, roles, integrations, and reporting requirements.

## 3. User Types

### Professional User
Can manage their own agenda, access assigned patients, write clinical history, register session evolutions, and follow treatment progress.

### Administrative User
Can manage patients, appointments, cancellations, rescheduling, reminders, and basic operational tasks.

### Supervisor User
Can access reports, team performance, occupancy metrics, patient flow, and general system configuration.

### Patient User / Public Booking User
Can request or reserve appointments, receive reminders, cancel or reschedule depending on permissions, and complete basic intake information.

## 4. Core Modules

### Appointments
- Create appointment
- Edit appointment
- Cancel appointment
- Reschedule appointment
- Confirm appointment
- View daily, weekly, monthly, and yearly calendar — **implemented**: a Día/Semana/Mes/Año view selector on the Inicio calendar header, see "Vistas de calendario" in `docs/modules/dashboard.md`. Año is navigation-only (12 mini-calendars, no per-day appointment indicators).
- Filter by professional, location, specialty, or status

### Patients
- Create patient profile
- Edit patient information
- View patient details
- Search patients
- Track patient status

### Clinical History
- View clinical record
- Add initial evaluation
- Add session evolution
- Attach files
- Track diagnosis, treatment plan, goals, and progress
- Reusable evolution templates — **implemented (V1)**: consultorio-scoped, no dynamic variables/AI/versioning/sharing — see "Plantillas de evolución" in `docs/modules/clinical-history.md`.

### Treatment Follow-up
- Track active patients
- Mark patient as active, paused, discharged, abandoned, or referred
- Register session notes
- View treatment timeline

### Notifications
- Appointment reminders
- Confirmation messages
- Cancellation messages
- Post-session follow-up
- WhatsApp and/or email notifications

### Reports
**Implemented (V1)** as the "Estadísticas" page — see `docs/modules/statistics.md` for exact KPIs, formulas, permissions, and limitations.
- Appointments per professional — implemented ("Sesiones por profesional").
- Occupancy rate — **not implemented**: requires a reliable per-professional availability/schedule source that doesn't exist in the schema yet; not invented.
- No-show rate — implemented ("Ausentismo").
- Cancellations — implemented.
- Active patients — **not implemented** as a distinct status (no active/paused/discharged patient-status field exists yet); "Pacientes atendidos" (unique patients with a finalized session in the period) is the closest implemented metric.
- Discharged patients — not implemented (no clinical discharge concept exists yet, see Clinical History / Treatment Follow-up below).
- Revenue or payment-related metrics — explicitly out of scope for V1.

## 5. Non-Functional Requirements

- Responsive web app — the Inicio calendar (Día/Semana/Mes/Año, quick-create, edit, custom recurrence) got a dedicated mobile-first pass: see "Rediseño mobile-first (Home)" in `docs/modules/dashboard.md`. Desktop (≥821px) unaffected.
- Secure authentication
- Role-based access control
- Audit logs for sensitive changes
- Data backup strategy
- Privacy-first handling of clinical data
- Scalable for multiple practices and institutions
# Kineq - Claude Instructions

## Project Overview

Kineq is a web-based management system for kinesiologists, rehabilitation clinics, small practices, medium-sized centers, and healthcare institutions.

The system helps manage appointments, patients, clinical records, treatment follow-up, reminders, roles, and operational reporting.

## Tech Stack

- Backend: Node.js / TypeScript / Prisma
- Frontend: Vite / TypeScript
- Database: PostgreSQL or current configured database through Prisma
- Architecture: separated frontend and backend apps

## Development Rules

- Always prioritize clean, maintainable, typed code.
- Do not make large architectural changes without explaining them first.
- Keep frontend and backend concerns separated.
- Do not hardcode business rules that should be configurable.
- Prefer reusable components and services.
- Keep healthcare data privacy and role-based access in mind.
- Before modifying existing files, inspect the relevant files first.

## Product Priorities

Core modules:
- Patients
- Appointments
- Clinical history
- Session evolution notes
- Treatment follow-up
- Users, roles and permissions
- Notifications and reminders
- Reports

## Important Domain Concepts

A “professional user” is a kinesiologist or therapist who treats patients.

An “admin user” is a secretary, receptionist, or operational user who manages appointments and patients but does not write clinical records.

A “supervisor user” is an owner, manager, coordinator, or institution-level user who reviews metrics, teams, and operations.

## Response Style

When suggesting implementation steps:
- Be practical.
- Work incrementally.
- Avoid overengineering.
- Explain tradeoffs when relevant.
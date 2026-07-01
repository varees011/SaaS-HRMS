# HRMS Component Runbooks

These runbooks follow the reference style from `daws-84s/roboshop-documentation`: one numbered document per component, ordered by setup and debugging flow.

Use this folder when a team needs to find the owner, setup commands, environment requirements, and first debugging files for a specific component.

## Order

1. `01-database.md`: PostgreSQL and Prisma schema.
2. `02-backend-api.md`: Express API runtime.
3. `03-frontend-web.md`: React/Vite frontend runtime.
4. `04-auth-module.md`: identity, sessions, MFA, and route access.
5. `05-admin-module.md`: tenants, organizations, users, roles.
6. `06-performance-module.md`: cycles, goals, KRAs, KPIs, reviews.
7. `07-rbac-audit.md`: permissions, role catalog, and audit events.
8. `08-development-workflow.md`: local development and verification commands.

## Ownership Rule

- Backend behavior issues start in `src/modules/<module>`.
- Frontend screen issues start in `frontend/src/features/<feature>`.
- Shared UI issues start in `frontend/src/components`.
- Setup and environment issues start in this runbook folder.

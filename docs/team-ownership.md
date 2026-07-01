# Team Ownership Map

Use this map to find the right folder when a bug is reported.

For setup steps and operational debugging, use the numbered component runbooks in `docs/runbooks/`.

## Backend Teams

| Area | Owner Team | Primary Folder | First Debugging File |
| --- | --- | --- | --- |
| Login, MFA, sessions, permissions | Identity Team | `src/modules/auth` | `auth.service.ts` |
| Tenant, org, user, role management | Admin Platform Team | `src/modules/admin` | `admin.service.ts` |
| Reviews, goals, KRAs, KPIs | Performance Team | `src/modules/performance` | `performance.service.ts` |
| Audit events | Security Platform Team | `src/modules/audit` | `audit.service.ts` |
| Permission catalog | Security Platform Team | `src/modules/rbac` | `rbac.catalog.ts` |
| Shared backend concerns | Backend Platform Team | `src/core` | relevant core file |

## Frontend Teams

| Area | Owner Team | Primary Folder | First Debugging File |
| --- | --- | --- | --- |
| Login and route access | Identity UI Team | `frontend/src/features/auth` | `login-page.tsx` |
| Admin screens | Admin UI Team | `frontend/src/features/admin` | relevant page file |
| Performance screens | Performance UI Team | `frontend/src/features/performance` | `performance-page.tsx` |
| Profile, security, sessions | Self-Service UI Team | `frontend/src/features/self-service` | relevant page file |
| Dashboard | Dashboard UI Team | `frontend/src/features/dashboard` | `dashboard-page.tsx` |
| Shared UI primitives | Design System Team | `frontend/src/shared/ui` | relevant component file |
| Shared form helpers | Design System Team | `frontend/src/shared/forms` | relevant component file |

## Rule Of Thumb

- If the bug is in a screen, start in `frontend/src/features/<feature>`.
- If the bug is in an API response, start in `src/modules/<module>/<module>.service.ts`.
- If the bug is an access problem, check frontend guards first, then backend route permissions.
- If the bug appears in many screens, check `frontend/src/shared`.

## Runbook Index

| Runbook | Use For |
| --- | --- |
| `docs/runbooks/01-database.md` | Database, Prisma, migrations, seed data |
| `docs/runbooks/02-backend-api.md` | API boot, routes, middleware, health checks |
| `docs/runbooks/03-frontend-web.md` | Vite app, routing, API proxy, frontend runtime |
| `docs/runbooks/04-auth-module.md` | Login, sessions, MFA, auth guards |
| `docs/runbooks/05-admin-module.md` | Tenants, organizations, users, roles |
| `docs/runbooks/06-performance-module.md` | Performance cycles, goals, reviews |
| `docs/runbooks/07-rbac-audit.md` | Permissions, RBAC catalog, audit events |
| `docs/runbooks/08-development-workflow.md` | Local commands and verification |

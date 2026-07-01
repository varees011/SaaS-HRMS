# 05-Admin Module

Admin owns tenants, organizations, users, roles, and permission management.

## Owners

- Backend: Admin Platform Team
- Frontend: Admin UI Team

## Backend Files

```text
src/modules/admin/
  controllers/
  routes/
  services/
  validators/
```

## Frontend Files

```text
frontend/src/features/admin/
  api/
  pages/
  types/
```

## Key Endpoints

```text
GET    /api/v1/admin/tenants
POST   /api/v1/admin/tenants
PATCH  /api/v1/admin/tenants/:id
GET    /api/v1/admin/organizations
POST   /api/v1/admin/organizations
GET    /api/v1/admin/users
POST   /api/v1/admin/users
GET    /api/v1/admin/roles
POST   /api/v1/admin/roles
GET    /api/v1/admin/permissions
```

## Debugging

- List/table issue: frontend relevant file in `pages/`.
- API data issue: backend `services/admin.service.ts`.
- Access denied: backend `routes/admin.routes.ts` permission checks.
- Bad payload: backend `validators/admin.validation.ts`.

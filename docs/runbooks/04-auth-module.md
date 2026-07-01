# 04-Auth Module

Auth owns login, refresh tokens, logout, MFA, password reset, sessions, frontend guards, and permission checks.

## Owners

- Backend: Identity Team
- Frontend: Identity UI Team

## Backend Files

```text
src/modules/auth/
  controllers/
  middleware/
  routes/
  services/
  types/
  validators/
```

## Frontend Files

```text
frontend/src/features/auth/
  api/
  components/
  guards/
  pages/
  schemas/
  store/
  types/
  utils/
```

## Key Endpoints

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
POST /api/v1/auth/logout
GET  /api/v1/auth/sessions
POST /api/v1/auth/mfa/setup
POST /api/v1/auth/mfa/confirm
```

## Debugging

- Login fails: backend `services/auth.service.ts`, frontend `pages/login-page.tsx`.
- Refresh fails: backend `services/auth.service.ts`, frontend `lib/api-client.ts`.
- Permission blocked: backend `middleware/auth.middleware.ts`, frontend `guards/`.
- Bad form validation: frontend `schemas/auth.schemas.ts`.

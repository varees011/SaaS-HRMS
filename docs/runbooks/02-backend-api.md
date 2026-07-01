# 02-Backend API

The backend is an Express API that exposes auth, admin, and performance endpoints.

## Owner

Backend Platform Team

## Main Files

```text
src/
  server.ts
  app.ts
  config/
  shared/
  modules/
```

## Routes

```text
GET  /health/live
/api/v1/auth
/api/v1/admin
/api/v1/performance
```

## Run

```bash
pnpm dev
```

Backend runs on:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health/live
```

## Debugging

- App boot failure: check `src/server.ts` and `src/config/env.ts`.
- Route not found: check `src/app.ts` router registration.
- Validation errors: check module `validators/`.
- Unhandled API error: check `src/shared/middleware/error.middleware.ts`.

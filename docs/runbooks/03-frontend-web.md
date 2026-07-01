# 03-Frontend Web

The frontend is a React/Vite app organized by feature ownership.

## Owner

Frontend Platform Team

## Main Files

```text
frontend/src/
  app.tsx
  main.tsx
  layouts/
  lib/api-client.ts
  features/
  components/
```

## Run

```bash
pnpm frontend:dev
```

Frontend runs on:

```text
http://localhost:5173
```

## API Proxy

Vite proxies `/api` to the backend:

```text
frontend/vite.config.ts
/api -> http://127.0.0.1:3000
```

## Debugging

- Page route issue: check `frontend/src/app.tsx`.
- API request issue: check `frontend/src/lib/api-client.ts`.
- Shared UI bug: check `frontend/src/components/ui`.
- Feature screen bug: check `frontend/src/features/<feature>/pages`.

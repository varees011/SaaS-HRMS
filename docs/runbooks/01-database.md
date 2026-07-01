# 01-Database

PostgreSQL is the persistence layer for tenants, users, RBAC, sessions, HRMS records, performance reviews, and audit events.

## Owner

Backend Platform Team

## Main Files

```text
prisma/
  schema.prisma
  seed.ts
  migrations/
src/lib/prisma.ts
```

## Required Environment

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hrms?schema=public
```

## Setup

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

## Debugging

- Schema mismatch: check `prisma/schema.prisma`.
- Missing tables or columns: check `prisma/migrations/`.
- Seeded roles/users missing: check `prisma/seed.ts`.
- Runtime DB connection issue: check `DATABASE_URL` and `src/lib/prisma.ts`.

# 08-Development Workflow

Use these commands to verify changes before handing work to another team.

## Install

```bash
pnpm install
```

## Backend

```bash
pnpm dev
pnpm typecheck
pnpm test
```

## Frontend

```bash
pnpm frontend:dev
pnpm --dir frontend typecheck
pnpm frontend:test
```

## Full Verification

```bash
pnpm typecheck
pnpm --dir frontend typecheck
pnpm test
pnpm frontend:test
```

## Git Hygiene

Ignored local-only files:

```text
.env
*.log
node_modules/
.pnpm-store/
dist/
frontend/dist/
```

Before pushing:

```bash
git status --short
```

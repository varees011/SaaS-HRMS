# Project File Structure

The project is feature/module based, but intentionally flat. Use subfolders only when a group has multiple related files.

## Backend

```text
src/
  app.ts
  server.ts
  core/
    auth.ts
    config.ts
    db.ts
    error.middleware.ts
    errors.ts
    logger.ts
    organization-scope.ts
    request-context.middleware.ts
    request-context.ts
    validate.middleware.ts
  modules/
    auth/
      auth.routes.ts
      auth.controller.ts
      auth.service.ts
      auth.schema.ts
      auth.types.ts
      auth-rate-limit.middleware.ts
      crypto.service.ts
      password-reset-notifier.ts
      token.service.ts
      index.ts
    admin/
      admin.routes.ts
      admin.controller.ts
      admin.service.ts
      admin.schema.ts
      index.ts
    performance/
      performance.routes.ts
      performance.controller.ts
      performance.service.ts
      performance.schema.ts
      index.ts
    audit/
      audit.service.ts
      index.ts
    rbac/
      rbac.catalog.ts
      index.ts
```

Backend rules:

- Global backend concerns live in `src/core`.
- Feature-specific files live in `src/modules/<module>`.
- Small modules stay flat with feature-prefixed filenames.
- `index.ts` is used only at module boundaries for public exports.
- API route paths and behavior are unchanged.

## Frontend

```text
frontend/src/
  app.tsx
  main.tsx
  shared/
    api/
      http.ts
    forms/
      form-field.tsx
      password-input.tsx
    lib/
      cn.ts
      format-date.ts
      initials.ts
    ui/
      alert.tsx
      badge.tsx
      button.tsx
      card.tsx
      dialog.tsx
      input.tsx
      label.tsx
      select.tsx
      table.tsx
  layouts/
    app-layout.tsx
    auth-layout.tsx
  features/
    auth/
      auth.api.ts
      auth.schema.ts
      auth.schema.test.ts
      auth.store.ts
      auth.types.ts
      auth-bootstrap.tsx
      auth-guard.tsx
      permission-guard.tsx
      access-policy.ts
      permissions.ts
      login-page.tsx
      login-page.test.tsx
      forgot-password-page.tsx
      reset-password-page.tsx
      index.ts
    admin/
      admin.api.ts
      admin.types.ts
      tenants-page.tsx
      organizations-page.tsx
      users-page.tsx
      roles-page.tsx
      index.ts
    performance/
      performance.api.ts
      performance.types.ts
      performance-page.tsx
      index.ts
    dashboard/
      dashboard-page.tsx
      index.ts
    self-service/
      profile-page.tsx
      security-page.tsx
      sessions-page.tsx
      index.ts
    shell/
      not-found-page.tsx
      index.ts
```

Frontend rules:

- Reusable UI and form components live in `frontend/src/shared`.
- Feature code stays inside `frontend/src/features/<feature>`.
- Small features stay flat.
- Use `components/` inside a feature only when multiple feature-specific components exist.
- `index.ts` is used only as a public feature boundary.

## Adding New Code

- New backend module: add flat files under `src/modules/<module>`.
- New frontend feature: add flat files under `frontend/src/features/<feature>`.
- New shared frontend primitive: add a single file under `frontend/src/shared/ui` or `frontend/src/shared/forms`.
- Add subfolders only when there are multiple related files.

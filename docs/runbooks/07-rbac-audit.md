# 07-RBAC And Audit

RBAC defines permissions and system roles. Audit records important security and business events.

## Owners

Security Platform Team

## Main Files

```text
src/modules/rbac/
  catalogs/rbac.catalog.ts
src/modules/audit/
  services/audit.service.ts
src/modules/auth/middleware/auth.middleware.ts
```

## Debugging RBAC

- Permission missing from role: check `src/modules/rbac/catalogs/rbac.catalog.ts`.
- API blocked unexpectedly: check route permissions and `auth.middleware.ts`.
- Frontend link hidden unexpectedly: check `frontend/src/features/auth/utils/access-policy.ts`.

## Debugging Audit

- Missing audit event: check the owning service method.
- Wrong actor/request details: check `src/shared/middleware/request-context.middleware.ts`.
- Audit write failure: check `src/modules/audit/services/audit.service.ts`.

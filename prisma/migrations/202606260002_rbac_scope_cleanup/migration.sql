UPDATE "role_assignments"
SET "organization_id" = NULL
WHERE "scope_type" IN ('PLATFORM', 'TENANT', 'SELF')
  AND "organization_id" IS NOT NULL;

ALTER TABLE "role_assignments"
  ADD CONSTRAINT "role_assignments_organization_compatibility_check"
  CHECK (
    "organization_id" IS NULL
    OR "scope_type" IN ('ORGANIZATION', 'TEAM')
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MembershipStatus') THEN
    CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssignmentScope') THEN
    CREATE TYPE "AssignmentScope" AS ENUM ('PLATFORM', 'TENANT', 'ORGANIZATION', 'TEAM', 'SELF');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionSensitivity') THEN
    CREATE TYPE "PermissionSensitivity" AS ENUM ('STANDARD', 'SENSITIVE', 'RESTRICTED');
  END IF;
END $$;

CREATE TABLE "tenant_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joined_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

INSERT INTO "tenant_memberships" (
  "tenant_id", "user_id", "status", "joined_at", "created_at", "updated_at"
)
SELECT
  u."tenant_id",
  u."id",
  CASE
    WHEN u."status" = 'ACTIVE' THEN 'ACTIVE'::"MembershipStatus"
    WHEN u."status" = 'INVITED' THEN 'INVITED'::"MembershipStatus"
    WHEN u."status" = 'DISABLED' THEN 'DISABLED'::"MembershipStatus"
    ELSE 'SUSPENDED'::"MembershipStatus"
  END,
  COALESCE(u."email_verified_at", u."created_at"),
  u."created_at",
  u."updated_at"
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_role_assignments" ura
  JOIN "roles" r ON r."id" = ura."role_id"
  WHERE ura."user_id" = u."id"
    AND ura."deleted_at" IS NULL
    AND r."role_type" = 'PLATFORM'
);

ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_tenant_id_actor_user_id_fkey";
ALTER TABLE "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_tenant_id_user_id_fkey";
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_tenant_id_manager_user_id_fkey";
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT IF EXISTS "password_reset_tokens_tenant_id_user_id_fkey";
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_tenant_id_permission_id_fkey";
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_tenant_id_role_id_fkey";
ALTER TABLE "user_role_assignments" DROP CONSTRAINT IF EXISTS "user_role_assignments_tenant_id_organization_id_fkey";
ALTER TABLE "user_role_assignments" DROP CONSTRAINT IF EXISTS "user_role_assignments_tenant_id_role_id_fkey";
ALTER TABLE "user_role_assignments" DROP CONSTRAINT IF EXISTS "user_role_assignments_tenant_id_user_id_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tenant_id_fkey";

-- Global identities require globally unique login identifiers. Preserve deleted
-- duplicates for history while making their identifiers non-loginable.
WITH duplicates AS (
  SELECT id
  FROM (
    SELECT id, row_number() OVER (
      PARTITION BY lower(email::text)
      ORDER BY (deleted_at IS NULL) DESC, created_at DESC
    ) AS rn
    FROM users
  ) ranked
  WHERE rn > 1
)
UPDATE users u
SET email = ('deleted+' || replace(u.id::text, '-', '') || '@invalid.local')::citext,
    username = CASE
      WHEN u.username IS NULL THEN NULL
      ELSE ('deleted_' || replace(u.id::text, '-', ''))::citext
    END
FROM duplicates d
WHERE u.id = d.id;

DROP INDEX IF EXISTS "users_tenant_id_email_key";
DROP INDEX IF EXISTS "users_tenant_id_username_key";
DROP INDEX IF EXISTS "users_tenant_id_status_idx";
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");
CREATE UNIQUE INDEX "users_username_key" ON "users" ("username") WHERE "username" IS NOT NULL;
CREATE INDEX "users_status_deleted_at_idx" ON "users" ("status", "deleted_at");
CREATE INDEX "users_last_name_first_name_idx" ON "users" ("last_name", "first_name");
ALTER TABLE "users" DROP COLUMN "tenant_id";

ALTER TABLE "roles" ALTER COLUMN "tenant_id" DROP NOT NULL;
UPDATE "roles"
SET "code" = 'PLATFORM_SUPER_ADMIN', "name" = 'Platform Super Admin'
WHERE "code" = 'SUPER_ADMIN' AND "role_type" = 'PLATFORM';
UPDATE "roles"
SET "code" = 'ORGANIZATION_ADMIN', "name" = 'Organization Admin'
WHERE "code" = 'HR_ADMIN' AND "role_type" = 'TENANT';
UPDATE "roles" SET "tenant_id" = NULL WHERE "role_type" = 'PLATFORM';
DROP INDEX IF EXISTS "roles_tenant_id_code_key";
DROP INDEX IF EXISTS "roles_tenant_id_id_key";
CREATE UNIQUE INDEX "roles_tenant_id_code_key" ON "roles" ("tenant_id", "code");
CREATE UNIQUE INDEX "roles_platform_code_key"
  ON "roles" ("code")
  WHERE "tenant_id" IS NULL AND "deleted_at" IS NULL;
CREATE INDEX "roles_tenant_id_role_type_deleted_at_idx"
  ON "roles" ("tenant_id", "role_type", "deleted_at");

ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "permissions_tenant_id_fkey";
DROP INDEX IF EXISTS "permissions_tenant_id_code_key";
DROP INDEX IF EXISTS "permissions_tenant_id_id_key";
DROP INDEX IF EXISTS "permissions_tenant_id_module_resource_action_idx";
ALTER TABLE "permissions"
  ADD COLUMN "sensitivity" "PermissionSensitivity" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "requires_mfa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "permissions" DROP COLUMN "tenant_id";
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions" ("code");
CREATE INDEX "permissions_module_resource_action_idx"
  ON "permissions" ("module", "resource", "action");
CREATE INDEX "permissions_sensitivity_requires_mfa_idx"
  ON "permissions" ("sensitivity", "requires_mfa");

DROP INDEX IF EXISTS "role_permissions_tenant_id_role_id_permission_id_key";
ALTER TABLE "role_permissions" DROP COLUMN "tenant_id";
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key"
  ON "role_permissions" ("role_id", "permission_id");
CREATE INDEX "role_permissions_permission_id_deleted_at_idx"
  ON "role_permissions" ("permission_id", "deleted_at");
ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_role_assignments" RENAME TO "role_assignments";
ALTER TABLE "role_assignments"
  ADD COLUMN "scope_type" "AssignmentScope",
  ADD COLUMN "include_descendants" BOOLEAN NOT NULL DEFAULT false;

UPDATE "role_assignments" ra
SET "scope_type" = CASE r."role_type"
  WHEN 'PLATFORM' THEN 'PLATFORM'::"AssignmentScope"
  WHEN 'TENANT' THEN 'TENANT'::"AssignmentScope"
  WHEN 'ORGANIZATION' THEN 'ORGANIZATION'::"AssignmentScope"
  WHEN 'MANAGER' THEN 'TEAM'::"AssignmentScope"
  WHEN 'SELF' THEN 'SELF'::"AssignmentScope"
END
FROM "roles" r
WHERE r."id" = ra."role_id";

ALTER TABLE "role_assignments" ALTER COLUMN "tenant_id" DROP NOT NULL;

UPDATE "role_assignments" ra
SET "tenant_id" = NULL, "organization_id" = NULL
FROM "roles" r
WHERE r."id" = ra."role_id" AND r."role_type" = 'PLATFORM';

ALTER TABLE "role_assignments" ALTER COLUMN "scope_type" SET NOT NULL;
DROP INDEX IF EXISTS "user_role_assignments_tenant_id_user_id_idx";
DROP INDEX IF EXISTS "user_role_assignments_tenant_id_role_id_idx";
CREATE INDEX "role_assignments_user_id_tenant_id_deleted_at_idx"
  ON "role_assignments" ("user_id", "tenant_id", "deleted_at");
CREATE INDEX "role_assignments_role_id_tenant_id_deleted_at_idx"
  ON "role_assignments" ("role_id", "tenant_id", "deleted_at");
CREATE INDEX "role_assignments_tenant_id_organization_id_deleted_at_idx"
  ON "role_assignments" ("tenant_id", "organization_id", "deleted_at");
CREATE INDEX "role_assignments_valid_until_idx" ON "role_assignments" ("valid_until");
CREATE UNIQUE INDEX "role_assignments_active_scope_key"
  ON "role_assignments" ("user_id", "role_id", "tenant_id", "organization_id", "scope_type")
  NULLS NOT DISTINCT
  WHERE "deleted_at" IS NULL;
ALTER TABLE "role_assignments"
  ADD CONSTRAINT "role_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "role_assignments_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "role_assignments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "role_assignments_tenant_id_organization_id_fkey"
    FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "organizations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "role_assignments_assigned_by_fkey"
    FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "role_assignments_scope_check" CHECK (
    ("scope_type" = 'PLATFORM' AND "tenant_id" IS NULL AND "organization_id" IS NULL)
    OR
    ("scope_type" <> 'PLATFORM' AND "tenant_id" IS NOT NULL)
  ),
  ADD CONSTRAINT "role_assignments_organization_scope_check" CHECK (
    "scope_type" <> 'ORGANIZATION' OR "organization_id" IS NOT NULL
  ),
  ADD CONSTRAINT "role_assignments_validity_check" CHECK (
    "valid_until" IS NULL OR "valid_until" > "valid_from"
  );

CREATE OR REPLACE FUNCTION enforce_role_assignment_scope()
RETURNS trigger AS $$
DECLARE
  role_tenant UUID;
  role_kind "RoleType";
BEGIN
  SELECT r.tenant_id, r.role_type INTO role_tenant, role_kind
  FROM roles
  AS r
  WHERE r.id = NEW.role_id AND r.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role does not exist or is deleted';
  END IF;

  IF NEW.scope_type = 'PLATFORM' THEN
    IF role_kind <> 'PLATFORM' OR role_tenant IS NOT NULL THEN
      RAISE EXCEPTION 'Platform assignments require a global platform role';
    END IF;
  ELSE
    IF role_kind = 'PLATFORM' OR role_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Tenant assignment role must belong to assignment tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER role_assignment_scope_trigger
BEFORE INSERT OR UPDATE OF role_id, tenant_id, scope_type
ON role_assignments
FOR EACH ROW EXECUTE FUNCTION enforce_role_assignment_scope();

ALTER TABLE "tenant_memberships"
  ADD CONSTRAINT "tenant_memberships_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "tenant_memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_user_id_key"
  ON "tenant_memberships" ("tenant_id", "user_id");
CREATE INDEX "tenant_memberships_user_id_status_deleted_at_idx"
  ON "tenant_memberships" ("user_id", "status", "deleted_at");
CREATE INDEX "tenant_memberships_tenant_id_status_deleted_at_idx"
  ON "tenant_memberships" ("tenant_id", "status", "deleted_at");

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_manager_user_id_fkey"
    FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DROP INDEX IF EXISTS "organizations_tenant_id_manager_user_id_idx";
CREATE INDEX "organizations_manager_user_id_idx" ON "organizations" ("manager_user_id");

ALTER TABLE "auth_sessions" ALTER COLUMN "tenant_id" DROP NOT NULL;
ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX IF EXISTS "auth_sessions_tenant_id_user_id_revoked_at_idx";
CREATE INDEX "auth_sessions_user_id_tenant_id_revoked_at_idx"
  ON "auth_sessions" ("user_id", "tenant_id", "revoked_at");

ALTER TABLE "password_reset_tokens" ALTER COLUMN "tenant_id" DROP NOT NULL;
ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX IF EXISTS "password_reset_tokens_tenant_id_user_id_expires_at_idx";
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx"
  ON "password_reset_tokens" ("user_id", "expires_at");

ALTER TABLE "audit_events" ALTER COLUMN "tenant_id" DROP NOT NULL;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "audit_events_effective_user_id_fkey"
    FOREIGN KEY ("effective_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DROP INDEX IF EXISTS "audit_events_tenant_id_actor_user_id_occurred_at_idx";
CREATE INDEX "audit_events_actor_user_id_occurred_at_idx"
  ON "audit_events" ("actor_user_id", "occurred_at");

CREATE INDEX "tenants_status_deleted_at_idx" ON "tenants" ("status", "deleted_at");

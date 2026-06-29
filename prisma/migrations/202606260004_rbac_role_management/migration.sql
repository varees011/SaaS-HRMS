CREATE UNIQUE INDEX IF NOT EXISTS "role_assignments_one_active_tenant_role_per_user"
  ON "role_assignments" ("user_id", "tenant_id")
  WHERE "deleted_at" IS NULL AND "tenant_id" IS NOT NULL;

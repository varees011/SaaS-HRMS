ALTER TABLE "roles"
  ADD COLUMN IF NOT EXISTS "department_id" UUID;

CREATE INDEX IF NOT EXISTS "roles_tenant_id_department_id_deleted_at_idx"
  ON "roles" ("tenant_id", "department_id", "deleted_at");

ALTER TABLE "roles"
  ADD CONSTRAINT "roles_tenant_id_department_id_fkey"
    FOREIGN KEY ("tenant_id", "department_id") REFERENCES "organizations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

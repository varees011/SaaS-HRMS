CREATE TABLE IF NOT EXISTS "deleted_user_archives" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "original_user_id" UUID NOT NULL,
  "tenant_id" UUID,
  "deleted_by" UUID,
  "deleted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" VARCHAR(200),
  "user" JSONB NOT NULL,
  "related_data" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT "deleted_user_archives_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "deleted_user_archives_original_user_id_idx"
  ON "deleted_user_archives"("original_user_id");

CREATE INDEX IF NOT EXISTS "deleted_user_archives_tenant_id_deleted_at_idx"
  ON "deleted_user_archives"("tenant_id", "deleted_at");

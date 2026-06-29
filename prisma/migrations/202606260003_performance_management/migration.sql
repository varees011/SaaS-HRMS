DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewCycleStatus') THEN
    CREATE TYPE "ReviewCycleStatus" AS ENUM (
      'DRAFT',
      'ACTIVE',
      'CLOSED',
      'ARCHIVED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PerformanceReviewStatus') THEN
    CREATE TYPE "PerformanceReviewStatus" AS ENUM (
      'DRAFT',
      'SELF_ASSESSMENT_SUBMITTED',
      'MANAGER_REVIEWED',
      'APPROVED',
      'REJECTED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "performance_review_cycles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID,
  "name" VARCHAR(200) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" "ReviewCycleStatus" NOT NULL DEFAULT 'DRAFT',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "performance_review_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "performance_goals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "cycle_id" UUID NOT NULL,
  "organization_id" UUID,
  "owner_user_id" UUID,
  "name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "weightage" DECIMAL(5, 2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "performance_goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "performance_kras" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "goal_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "weightage" DECIMAL(5, 2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "performance_kras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "performance_kpis" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "kra_id" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "target_value" DECIMAL(12, 2),
  "actual_value" DECIMAL(12, 2),
  "achievement_percentage" DECIMAL(5, 2),
  "score" DECIMAL(5, 2),
  "weightage" DECIMAL(5, 2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "performance_kpis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "performance_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "cycle_id" UUID NOT NULL,
  "employee_user_id" UUID NOT NULL,
  "manager_user_id" UUID,
  "organization_id" UUID,
  "self_score" DECIMAL(5, 2),
  "manager_score" DECIMAL(5, 2),
  "final_score" DECIMAL(5, 2),
  "employee_comments" TEXT,
  "manager_comments" TEXT,
  "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "submitted_at" TIMESTAMPTZ(6),
  "reviewed_at" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "performance_evidence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "review_id" UUID NOT NULL,
  "kpi_id" UUID,
  "uploaded_by_user_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "file_url" TEXT NOT NULL,
  "mime_type" VARCHAR(100),
  "size_bytes" BIGINT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "performance_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "performance_review_cycles_tenant_id_name_key"
  ON "performance_review_cycles" ("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "performance_review_cycles_tenant_id_status_deleted_at_idx"
  ON "performance_review_cycles" ("tenant_id", "status", "deleted_at");
CREATE INDEX IF NOT EXISTS "performance_review_cycles_tenant_id_organization_id_status_idx"
  ON "performance_review_cycles" ("tenant_id", "organization_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "performance_goals_tenant_id_cycle_id_name_key"
  ON "performance_goals" ("tenant_id", "cycle_id", "name");
CREATE INDEX IF NOT EXISTS "performance_goals_tenant_id_cycle_id_deleted_at_idx"
  ON "performance_goals" ("tenant_id", "cycle_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "performance_goals_tenant_id_organization_id_deleted_at_idx"
  ON "performance_goals" ("tenant_id", "organization_id", "deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "performance_kras_tenant_id_goal_id_title_key"
  ON "performance_kras" ("tenant_id", "goal_id", "title");
CREATE INDEX IF NOT EXISTS "performance_kras_tenant_id_goal_id_deleted_at_idx"
  ON "performance_kras" ("tenant_id", "goal_id", "deleted_at");

CREATE INDEX IF NOT EXISTS "performance_kpis_tenant_id_kra_id_deleted_at_idx"
  ON "performance_kpis" ("tenant_id", "kra_id", "deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "performance_reviews_tenant_id_cycle_id_employee_user_id_key"
  ON "performance_reviews" ("tenant_id", "cycle_id", "employee_user_id");
CREATE INDEX IF NOT EXISTS "performance_reviews_tenant_id_cycle_id_status_deleted_at_idx"
  ON "performance_reviews" ("tenant_id", "cycle_id", "status", "deleted_at");
CREATE INDEX IF NOT EXISTS "performance_reviews_tenant_id_employee_user_id_deleted_at_idx"
  ON "performance_reviews" ("tenant_id", "employee_user_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "performance_reviews_tenant_id_manager_user_id_status_idx"
  ON "performance_reviews" ("tenant_id", "manager_user_id", "status");

CREATE INDEX IF NOT EXISTS "performance_evidence_tenant_id_review_id_deleted_at_idx"
  ON "performance_evidence" ("tenant_id", "review_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "performance_evidence_tenant_id_kpi_id_idx"
  ON "performance_evidence" ("tenant_id", "kpi_id");

ALTER TABLE "performance_review_cycles"
  ADD CONSTRAINT "performance_review_cycles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_review_cycles"
  ADD CONSTRAINT "performance_review_cycles_tenant_id_organization_id_fkey"
    FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "organizations"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "performance_goals"
  ADD CONSTRAINT "performance_goals_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_goals"
  ADD CONSTRAINT "performance_goals_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_goals"
  ADD CONSTRAINT "performance_goals_tenant_id_organization_id_fkey"
    FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "organizations"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "performance_goals"
  ADD CONSTRAINT "performance_goals_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "performance_kras"
  ADD CONSTRAINT "performance_kras_goal_id_fkey"
    FOREIGN KEY ("goal_id") REFERENCES "performance_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_kpis"
  ADD CONSTRAINT "performance_kpis_kra_id_fkey"
    FOREIGN KEY ("kra_id") REFERENCES "performance_kras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_reviews"
  ADD CONSTRAINT "performance_reviews_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_reviews"
  ADD CONSTRAINT "performance_reviews_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_reviews"
  ADD CONSTRAINT "performance_reviews_employee_user_id_fkey"
    FOREIGN KEY ("employee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_reviews"
  ADD CONSTRAINT "performance_reviews_manager_user_id_fkey"
    FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "performance_reviews"
  ADD CONSTRAINT "performance_reviews_tenant_id_organization_id_fkey"
    FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "organizations"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "performance_evidence"
  ADD CONSTRAINT "performance_evidence_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_evidence"
  ADD CONSTRAINT "performance_evidence_review_id_fkey"
    FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_evidence"
  ADD CONSTRAINT "performance_evidence_kpi_id_fkey"
    FOREIGN KEY ("kpi_id") REFERENCES "performance_kpis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "performance_evidence"
  ADD CONSTRAINT "performance_evidence_uploaded_by_user_id_fkey"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HrmsRecordType') THEN
    CREATE TYPE "HrmsRecordType" AS ENUM (
      'EMPLOYEE_DOCUMENT',
      'ATTENDANCE',
      'LEAVE_REQUEST',
      'PAYROLL_RECORD',
      'PAYROLL_RUN',
      'RECRUITMENT_JOB',
      'CANDIDATE',
      'INTERVIEW',
      'OFFER',
      'TEAM_GOAL',
      'PERFORMANCE_REVIEW',
      'WORKFLOW_TASK',
      'REPORT_EXPORT',
      'TRAINING'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HrmsRecordStatus') THEN
    CREATE TYPE "HrmsRecordStatus" AS ENUM (
      'DRAFT',
      'ACTIVE',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'COMPLETED',
      'CANCELLED',
      'ARCHIVED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "hrms_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID,
  "subject_user_id" UUID,
  "owner_user_id" UUID,
  "assigned_to_user_id" UUID,
  "type" "HrmsRecordType" NOT NULL,
  "status" "HrmsRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "code" CITEXT,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "start_date" TIMESTAMPTZ(6),
  "end_date" TIMESTAMPTZ(6),
  "amount" DECIMAL(14, 2),
  "currency" CHAR(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "hrms_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hrms_records_tenant_id_type_code_key"
  ON "hrms_records" ("tenant_id", "type", "code");

CREATE INDEX IF NOT EXISTS "hrms_records_tenant_id_type_status_deleted_at_idx"
  ON "hrms_records" ("tenant_id", "type", "status", "deleted_at");

CREATE INDEX IF NOT EXISTS "hrms_records_tenant_id_organization_id_type_deleted_at_idx"
  ON "hrms_records" ("tenant_id", "organization_id", "type", "deleted_at");

CREATE INDEX IF NOT EXISTS "hrms_records_tenant_id_subject_user_id_type_deleted_at_idx"
  ON "hrms_records" ("tenant_id", "subject_user_id", "type", "deleted_at");

CREATE INDEX IF NOT EXISTS "hrms_records_tenant_id_assigned_to_user_id_status_deleted_at_idx"
  ON "hrms_records" ("tenant_id", "assigned_to_user_id", "status", "deleted_at");

CREATE INDEX IF NOT EXISTS "hrms_records_start_date_end_date_idx"
  ON "hrms_records" ("start_date", "end_date");

ALTER TABLE "hrms_records"
  ADD CONSTRAINT "hrms_records_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hrms_records"
  ADD CONSTRAINT "hrms_records_tenant_id_organization_id_fkey"
    FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "organizations"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hrms_records"
  ADD CONSTRAINT "hrms_records_subject_user_id_fkey"
    FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hrms_records"
  ADD CONSTRAINT "hrms_records_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hrms_records"
  ADD CONSTRAINT "hrms_records_assigned_to_user_id_fkey"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

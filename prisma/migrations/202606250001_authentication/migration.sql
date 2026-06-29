CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "RoleType" AS ENUM ('PLATFORM', 'TENANT', 'ORGANIZATION', 'MANAGER', 'SELF');
CREATE TYPE "SessionRevocationReason" AS ENUM ('LOGOUT', 'USER_REQUEST', 'PASSWORD_CHANGED', 'ADMIN_ACTION', 'REFRESH_TOKEN_REUSE', 'EXPIRED');
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'LOCKED', 'DISABLED');

CREATE TABLE "tenants" (
  "id" UUID NOT NULL,
  "code" CITEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "default_timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
  "default_locale" VARCHAR(16) NOT NULL DEFAULT 'en',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "email" CITEXT NOT NULL,
  "username" CITEXT,
  "password_hash" TEXT,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
  "email_verified_at" TIMESTAMPTZ(6),
  "last_login_at" TIMESTAMPTZ(6),
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(6),
  "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
  "mfa_secret_encrypted" TEXT,
  "preferences" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" CITEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "role_type" "RoleType" NOT NULL,
  "is_system_role" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" CITEXT NOT NULL,
  "module" VARCHAR(50) NOT NULL,
  "resource" VARCHAR(100) NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organizations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "parent_id" UUID,
  "manager_user_id" UUID,
  "code" CITEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "organization_type" VARCHAR(30) NOT NULL,
  "legal_name" VARCHAR(250),
  "registration_number" VARCHAR(100),
  "email" CITEXT,
  "phone" VARCHAR(40),
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
  "country_code" CHAR(2),
  "address" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_by" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  "row_version" BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_role_assignments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "organization_id" UUID,
  "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_until" TIMESTAMPTZ(6),
  "assigned_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by" UUID,
  CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "refresh_token_hash" CHAR(64) NOT NULL,
  "refresh_token_family" UUID NOT NULL,
  "user_agent" TEXT,
  "ip_address" INET,
  "authentication_methods" TEXT[] DEFAULT ARRAY['pwd']::TEXT[],
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  "revocation_reason" "SessionRevocationReason",
  "replaced_by_session_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "effective_user_id" UUID,
  "action" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(100) NOT NULL,
  "entity_id" UUID,
  "request_id" UUID,
  "correlation_id" UUID,
  "ip_address" INET,
  "user_agent" TEXT,
  "result" VARCHAR(20) NOT NULL,
  "reason" TEXT,
  "old_values" JSONB,
  "new_values" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");
CREATE UNIQUE INDEX "users_tenant_id_id_key" ON "users"("tenant_id", "id");
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE UNIQUE INDEX "users_tenant_id_username_key" ON "users"("tenant_id", "username");
CREATE INDEX "users_tenant_id_status_idx" ON "users"("tenant_id", "status");
CREATE UNIQUE INDEX "roles_tenant_id_id_key" ON "roles"("tenant_id", "id");
CREATE UNIQUE INDEX "roles_tenant_id_code_key" ON "roles"("tenant_id", "code");
CREATE UNIQUE INDEX "permissions_tenant_id_id_key" ON "permissions"("tenant_id", "id");
CREATE UNIQUE INDEX "permissions_tenant_id_code_key" ON "permissions"("tenant_id", "code");
CREATE INDEX "permissions_tenant_id_module_resource_action_idx" ON "permissions"("tenant_id", "module", "resource", "action");
CREATE UNIQUE INDEX "role_permissions_tenant_id_role_id_permission_id_key" ON "role_permissions"("tenant_id", "role_id", "permission_id");
CREATE UNIQUE INDEX "organizations_tenant_id_id_key" ON "organizations"("tenant_id", "id");
CREATE UNIQUE INDEX "organizations_tenant_id_code_key" ON "organizations"("tenant_id", "code");
CREATE INDEX "organizations_tenant_id_parent_id_idx" ON "organizations"("tenant_id", "parent_id");
CREATE INDEX "organizations_tenant_id_manager_user_id_idx" ON "organizations"("tenant_id", "manager_user_id");
CREATE INDEX "organizations_tenant_id_organization_type_idx" ON "organizations"("tenant_id", "organization_type");
CREATE INDEX "user_role_assignments_tenant_id_user_id_idx" ON "user_role_assignments"("tenant_id", "user_id");
CREATE INDEX "user_role_assignments_tenant_id_role_id_idx" ON "user_role_assignments"("tenant_id", "role_id");
CREATE INDEX "auth_sessions_refresh_token_hash_idx" ON "auth_sessions"("refresh_token_hash");
CREATE INDEX "auth_sessions_refresh_token_family_idx" ON "auth_sessions"("refresh_token_family");
CREATE INDEX "auth_sessions_tenant_id_user_id_revoked_at_idx" ON "auth_sessions"("tenant_id", "user_id", "revoked_at");
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_tenant_id_user_id_expires_at_idx" ON "password_reset_tokens"("tenant_id", "user_id", "expires_at");
CREATE INDEX "audit_events_tenant_id_occurred_at_idx" ON "audit_events"("tenant_id", "occurred_at");
CREATE INDEX "audit_events_tenant_id_actor_user_id_occurred_at_idx" ON "audit_events"("tenant_id", "actor_user_id", "occurred_at");
CREATE INDEX "audit_events_tenant_id_entity_type_entity_id_occurred_at_idx" ON "audit_events"("tenant_id", "entity_type", "entity_id", "occurred_at");

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_role_id_fkey" FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_permission_id_fkey" FOREIGN KEY ("tenant_id", "permission_id") REFERENCES "permissions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_parent_id_fkey" FOREIGN KEY ("tenant_id", "parent_id") REFERENCES "organizations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_manager_user_id_fkey" FOREIGN KEY ("tenant_id", "manager_user_id") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_tenant_id_user_id_fkey" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_tenant_id_role_id_fkey" FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "organizations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_id_user_id_fkey" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_tenant_id_user_id_fkey" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_actor_user_id_fkey" FOREIGN KEY ("tenant_id", "actor_user_id") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

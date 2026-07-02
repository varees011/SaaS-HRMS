CREATE TABLE "login_otps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "user_id" UUID NOT NULL,
  "otp_hash" CHAR(64) NOT NULL,
  "authentication_methods" TEXT[] NOT NULL DEFAULT ARRAY['pwd']::TEXT[],
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "generation_count" INTEGER NOT NULL DEFAULT 1,
  "used_flag" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  CONSTRAINT "login_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_otps_user_id_tenant_id_used_flag_expires_at_idx" ON "login_otps"("user_id", "tenant_id", "used_flag", "expires_at");
CREATE INDEX "login_otps_created_at_idx" ON "login_otps"("created_at");

ALTER TABLE "login_otps" ADD CONSTRAINT "login_otps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "login_otps" ADD CONSTRAINT "login_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

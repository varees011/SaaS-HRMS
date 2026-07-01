import { logger } from "../../core/logger.js";
import { env } from "../../core/config.js";

export interface PasswordResetNotifier {
  send(input: {
    email: string;
    tenantName: string;
    resetToken: string;
    expiresAt: Date;
  }): Promise<void>;
}

class LoggingPasswordResetNotifier implements PasswordResetNotifier {
  async send(input: {
    email: string;
    tenantName: string;
    resetToken: string;
    expiresAt: Date;
  }): Promise<void> {
    if (env.NODE_ENV === "production") {
      logger.error(
        { email: input.email, tenantName: input.tenantName },
        "Password reset notifier is not configured"
      );
      return;
    }
    logger.info(
      {
        email: input.email,
        tenantName: input.tenantName,
        resetToken: input.resetToken,
        expiresAt: input.expiresAt
      },
      "Development password reset token"
    );
  }
}

export const passwordResetNotifier: PasswordResetNotifier =
  new LoggingPasswordResetNotifier();

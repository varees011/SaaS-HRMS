import { env } from "../../core/config.js";
import { AppError } from "../../core/errors.js";
import { logger } from "../../core/logger.js";
import nodemailer, { type Transporter } from "nodemailer";

export interface EmailOtpNotifier {
  send(input: {
    email: string;
    otp: string;
    expiresAt: Date;
  }): Promise<void>;
}

class SmtpEmailOtpNotifier implements EmailOtpNotifier {
  private transporter: Transporter | null = null;

  async send(input: {
    email: string;
    otp: string;
    expiresAt: Date;
  }): Promise<void> {
    const message = emailOtpMessage(input.otp);
    if (!isSmtpConfigured()) {
      logger.error(
        { email: input.email, expiresAt: input.expiresAt, subject: message.subject },
        "Email OTP SMTP delivery is not configured"
      );
      throw new AppError(
        503,
        "EMAIL_DELIVERY_UNAVAILABLE",
        "Email OTP delivery is not configured."
      );
    }

    try {
      await this.getTransporter().sendMail({
        to: input.email,
        from: formatSender(),
        subject: message.subject,
        text: message.body
      });
      logger.info(
        { email: input.email, expiresAt: input.expiresAt, subject: message.subject },
        "Email OTP sent"
      );
    } catch (error) {
      logger.error(
        { err: error, email: input.email, expiresAt: input.expiresAt, subject: message.subject },
        "Email OTP delivery failed"
      );
      throw new AppError(
        502,
        "EMAIL_DELIVERY_FAILED",
        "Email OTP could not be sent. Try again later."
      );
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
    return this.transporter;
  }
}

export let emailOtpNotifier: EmailOtpNotifier = new SmtpEmailOtpNotifier();

// Allows tests to capture OTP delivery without logging codes or weakening storage.
export function setEmailOtpNotifierForTesting(notifier: EmailOtpNotifier): void {
  if (env.NODE_ENV !== "test") return;
  emailOtpNotifier = notifier;
}

// Builds the required OTP email content while callers keep the body out of logs.
export function emailOtpMessage(otp: string): { subject: string; body: string } {
  return {
    subject: "VentureSoft HRMS Verification Code",
    body: `Hello,

Your verification code is:

${otp}

This code expires in 5 minutes.

If you did not request this login, please ignore this email.`
  };
}

function isSmtpConfigured(): boolean {
  return Boolean(
    env.SMTP_HOST &&
      env.SMTP_PORT &&
      env.SMTP_USER &&
      env.SMTP_PASS &&
      env.SMTP_FROM_EMAIL
  );
}

function formatSender(): string {
  const name = env.SMTP_FROM_NAME.replace(/"/g, "");
  return `"${name}" <${env.SMTP_FROM_EMAIL}>`;
}

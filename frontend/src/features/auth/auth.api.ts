import { apiRequest } from "@/shared/api/http";
import type {
  ApiEnvelope,
  AuthTokens,
  CurrentUser,
  LoginResponse,
  LoginTenant,
  MfaSetup,
  SessionPage
} from "./auth.types";

export interface LoginInput {
  tenant?: string;
  login: string;
  password: string;
  mfaCode?: string;
}

export const authApi = {
  async tenants() {
    const response =
      await apiRequest<ApiEnvelope<LoginTenant[]>>("/auth/tenants", {
        authenticate: false
      });
    return response.data;
  },

  async login(input: LoginInput) {
    const response = await apiRequest<ApiEnvelope<LoginResponse>>("/auth/login", {
      method: "POST",
      body: input,
      authenticate: false
    });
    return response.data;
  },

  async verifyEmailOtp(input: { challengeId: string; code: string }) {
    const response = await apiRequest<ApiEnvelope<AuthTokens>>(
      "/auth/otp/verify",
      {
        method: "POST",
        body: input,
        authenticate: false
      }
    );
    return response.data;
  },

  async resendEmailOtp(challengeId: string) {
    const response = await apiRequest<
      ApiEnvelope<{ expiresIn: number; resendAfterSeconds: number }>
    >("/auth/otp/resend", {
      method: "POST",
      body: { challengeId },
      authenticate: false
    });
    return response.data;
  },

  async me() {
    const response =
      await apiRequest<ApiEnvelope<CurrentUser>>("/auth/me");
    return response.data;
  },

  logout(allSessions = false) {
    return apiRequest<void>("/auth/logout", {
      method: "POST",
      body: { allSessions }
    });
  },

  forgotPassword(input: { tenant: string; email: string }) {
    return apiRequest<ApiEnvelope<{ message: string }>>(
      "/auth/password/forgot",
      { method: "POST", body: input, authenticate: false }
    );
  },

  resetPassword(input: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    return apiRequest<void>("/auth/password/reset", {
      method: "POST",
      body: input,
      authenticate: false
    });
  },

  changePassword(input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    return apiRequest<void>("/auth/password/change", {
      method: "POST",
      body: input
    });
  },

  async sessions(cursor?: string) {
    const query = new URLSearchParams({ limit: "25" });
    if (cursor) query.set("cursor", cursor);
    return apiRequest<SessionPage>(`/auth/sessions?${query}`);
  },

  revokeSession(sessionId: string) {
    return apiRequest<void>(`/auth/sessions/${sessionId}`, {
      method: "DELETE"
    });
  },

  async setupMfa() {
    const response =
      await apiRequest<ApiEnvelope<MfaSetup>>("/auth/mfa/setup", {
        method: "POST"
      });
    return response.data;
  },

  confirmMfa(code: string) {
    return apiRequest<void>("/auth/mfa/confirm", {
      method: "POST",
      body: { code }
    });
  },

  disableMfa(input: { password: string; code: string }) {
    return apiRequest<void>("/auth/mfa/disable", {
      method: "POST",
      body: input
    });
  }
};

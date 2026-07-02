// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/features/auth/auth.store";
import type { CurrentUser } from "@/features/auth/auth.types";
import { LoginPage } from "./login-page";

const { loginMock, meMock, resendEmailOtpMock, tenantsMock, verifyEmailOtpMock } =
  vi.hoisted(() => ({
    loginMock: vi.fn(),
    meMock: vi.fn(),
    resendEmailOtpMock: vi.fn(),
    tenantsMock: vi.fn(),
    verifyEmailOtpMock: vi.fn()
  }));

vi.mock("@/features/auth/auth.api", () => ({
  authApi: {
    tenants: tenantsMock,
    login: loginMock,
    verifyEmailOtp: verifyEmailOtpMock,
    resendEmailOtp: resendEmailOtpMock,
    me: meMock
  }
}));

const platformUser: CurrentUser = {
  id: "8bb7d31a-2c62-4ab0-8a8d-44b729ec981a",
  tenantId: null,
  organizationId: null,
  roleId: "bfa7bf72-6d8e-4283-a93b-638887c68170",
  roleName: "Platform Super Admin",
  email: "superadmin@venturesoft.ai",
  username: "superadmin",
  firstName: "Platform",
  lastName: "Admin",
  status: "ACTIVE",
  emailVerifiedAt: "2026-06-26T00:00:00.000Z",
  lastLoginAt: "2026-06-26T00:00:00.000Z",
  mfaEnabled: false,
  preferences: {},
  roleAssignments: [],
  roles: ["PLATFORM_SUPER_ADMIN"],
  roleIds: ["bfa7bf72-6d8e-4283-a93b-638887c68170"],
  roleNames: ["Platform Super Admin"],
  permissions: ["platform.tenants.read", "tenant.settings.read"],
  authenticationMethods: ["pwd"],
  isSuperAdmin: true
};

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<div>Dashboard loaded</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("login page flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.getState().clear();
    tenantsMock.mockResolvedValue([
      {
        id: "1ef8ccce-a823-4317-a387-93bbd4ef5004",
        code: "venturesoft",
        name: "VentureSoft.AI"
      }
    ]);
  });

  it("logs in with email and password and redirects to the app dashboard", async () => {
    loginMock.mockResolvedValue({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresIn: 900
    });
    meMock.mockResolvedValue(platformUser);

    renderLoginPage();

    fireEvent.click(screen.getByRole("button", { name: "Platform login" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "superadmin@venturesoft.ai" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Strong-Password-123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard loaded")).toBeTruthy();
    });
    expect(loginMock).toHaveBeenCalledWith({
      login: "superadmin@venturesoft.ai",
      password: "Strong-Password-123!",
    });
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "access-token",
      status: "authenticated",
      user: platformUser
    });
  });

  it("logs in organization users with organization and user id", async () => {
    loginMock.mockResolvedValue({
      accessToken: "org-access-token",
      tokenType: "Bearer",
      expiresIn: 900
    });
    meMock.mockResolvedValue({
      ...platformUser,
      tenantId: "1ef8ccce-a823-4317-a387-93bbd4ef5004",
      isSuperAdmin: false,
      roles: ["EMPLOYEE"],
      permissions: ["self.profile.read"]
    });

    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "VentureSoft.AI (venturesoft)" })).toBeTruthy();
    });
    await waitFor(() => {
      expect((screen.getByLabelText("Organization") as HTMLSelectElement).value).toBe(
        "venturesoft"
      );
    });
    fireEvent.change(screen.getByLabelText("Email or user ID"), {
      target: { value: "employee@venturesoft.ai" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Strong-Password-123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard loaded")).toBeTruthy();
    });
    expect(loginMock).toHaveBeenCalledWith({
      login: "employee@venturesoft.ai",
      password: "Strong-Password-123!",
      tenant: "venturesoft"
    });
    expect(window.localStorage.getItem("hrms_last_tenant")).toBe("venturesoft");
  });

  it("shows email OTP verification before creating the session", async () => {
    loginMock.mockResolvedValue({
      otpRequired: true,
      challengeId: "a8cb6d5e-65f4-491e-9cd3-0c4a7d3df0da",
      expiresIn: 300,
      resendAfterSeconds: 30,
      email: "su********@venturesoft.ai"
    });
    verifyEmailOtpMock.mockResolvedValue({
      accessToken: "otp-access-token",
      tokenType: "Bearer",
      expiresIn: 900
    });
    meMock.mockResolvedValue(platformUser);

    renderLoginPage();

    fireEvent.click(screen.getByRole("button", { name: "Platform login" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "superadmin@venturesoft.ai" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Strong-Password-123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Verification code")).toBeTruthy();
    });
    expect(
      (screen.getByRole("button", { name: "Resend OTP in 30s" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(screen.getAllByText("Dashboard loaded").length).toBeGreaterThan(0);
    });
    expect(verifyEmailOtpMock).toHaveBeenCalledWith({
      challengeId: "a8cb6d5e-65f4-491e-9cd3-0c4a7d3df0da",
      code: "123456"
    });
  });

  it("shows an organization load error when the tenants endpoint fails", async () => {
    tenantsMock.mockRejectedValue(new Error("API unavailable"));

    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Unable to load organizations"
      );
    });
    expect(screen.getByRole("option", { name: "Unable to load organizations" })).toBeTruthy();
  });
});

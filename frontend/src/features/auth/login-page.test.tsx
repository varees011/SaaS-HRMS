// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/features/auth/auth.store";
import type { CurrentUser } from "@/features/auth/auth.types";
import { LoginPage } from "./login-page";

const { loginMock, meMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  meMock: vi.fn()
}));

vi.mock("@/features/auth/auth.api", () => ({
  authApi: {
    login: loginMock,
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

describe("login page flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.getState().clear();
  });

  it("logs in with email and password and redirects to the app dashboard", async () => {
    loginMock.mockResolvedValue({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresIn: 900
    });
    meMock.mockResolvedValue(platformUser);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<div>Dashboard loaded</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Platform" }));
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

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<div>Dashboard loaded</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Organization"), {
      target: { value: "venturesoft" }
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
});

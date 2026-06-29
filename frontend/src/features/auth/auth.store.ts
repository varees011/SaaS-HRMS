import { create } from "zustand";
import type { CurrentUser } from "./auth.types";

interface AuthState {
  accessToken: string | null;
  user: CurrentUser | null;
  status: "bootstrapping" | "authenticated" | "anonymous";
  setSession: (accessToken: string, user: CurrentUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: CurrentUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "bootstrapping",
  setSession: (accessToken, user) =>
    set({ accessToken, user, status: "authenticated" }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user, status: "authenticated" }),
  clear: () => set({ accessToken: null, user: null, status: "anonymous" })
}));

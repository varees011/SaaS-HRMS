import { useEffect, type ReactNode } from "react";
import { refreshAccessToken } from "@/lib/api-client";
import { authApi } from "./auth.api";
import { useAuthStore } from "./auth.store";

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const clear = useAuthStore((state) => state.clear);

  useEffect(() => {
    let active = true;
    void (async () => {
      const token = await refreshAccessToken();
      if (!active) return;
      if (!token) {
        clear();
        return;
      }
      try {
        const user = await authApi.me();
        if (active) setUser(user);
      } catch {
        if (active) clear();
      }
    })();
    return () => {
      active = false;
    };
  }, [clear, setUser]);

  return children;
}

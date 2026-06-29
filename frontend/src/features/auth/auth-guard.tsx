import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "./auth.store";

export function AuthGuard() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === "bootstrapping") {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (status !== "authenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <Outlet />;
}

export function AnonymousOnly() {
  const status = useAuthStore((state) => state.status);
  if (status === "bootstrapping") {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (status === "authenticated") return <Navigate to="/app" replace />;
  return <Outlet />;
}

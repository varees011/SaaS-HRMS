import { useAuthStore } from "@/features/auth/auth.store";
import type {
  ApiEnvelope,
  ApiErrorPayload,
  AuthTokens
} from "@/features/auth/auth.types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
let refreshPromise: Promise<string | null> | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: ApiErrorPayload["error"]["fields"] = [],
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  authenticate?: boolean;
  retryOnUnauthorized?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    body,
    authenticate = true,
    retryOnUnauthorized = true,
    headers,
    ...requestInit
  } = options;
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_URL}${path}`, {
    ...requestInit,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(authenticate && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  if (
    response.status === 401 &&
    authenticate &&
    retryOnUnauthorized &&
    !path.startsWith("/auth/refresh")
  ) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      return apiRequest<T>(path, {
        ...options,
        retryOnUnauthorized: false
      });
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await apiRequest<ApiEnvelope<AuthTokens>>(
        "/auth/refresh",
        {
          method: "POST",
          body: {},
          authenticate: false,
          retryOnUnauthorized: false
        }
      );
      useAuthStore.getState().setAccessToken(response.data.accessToken);
      return response.data.accessToken;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorPayload | undefined;
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    // Non-JSON upstream errors receive a stable client-side message.
  }
  return new ApiError(
    response.status,
    payload?.error.code ?? "REQUEST_FAILED",
    payload?.error.message ?? "The request could not be completed.",
    payload?.error.fields,
    payload?.error.request_id
  );
}

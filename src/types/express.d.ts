import type {
  AuthContext,
  TenantAccessContext
} from "../modules/auth/auth.types.js";
import type { RequestContext } from "../shared/request-context.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      tenantAccess?: TenantAccessContext;
      context: RequestContext;
    }
  }
}

export {};
